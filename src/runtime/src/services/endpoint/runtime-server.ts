/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Server, type Socket, createServer } from "node:net";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import type { IEventListener } from "@noldova/teamrun-core";
import { ErrorCode, Event, Hello, MethodName, ProtocolVersion, Request, Response, WireDecoder, type WireMessage, type IRequestDispatcher } from "@noldova/teamrun-protocol";

import { EndpointKind } from "../../enums/endpoint-kind.js";
import { InvalidOperationException } from "../../exceptions/invalid-operation.exception.js";
import type { IServerListener } from "../../interfaces/i-server-listener.js";
import type { ISessionListener } from "../../interfaces/i-session-listener.js";
import type { IUpdateShutdown } from "../../interfaces/i-update-shutdown.js";
import { Endpoint } from "../../models/endpoint.js";
import { Resources } from "../../resources.js";
import type { TerminalHost } from "../terminals/terminal-host.js";
import { ClientSession } from "./client-session.js";

export class RuntimeServer implements ISessionListener, IEventListener {
  private readonly endpointKind: EndpointKind;
  private readonly socketPath: string;
  private readonly token: string;
  private readonly dispatcher: IRequestDispatcher;
  private readonly listener: IServerListener;
  private readonly decoder: WireDecoder = new WireDecoder();
  private readonly sessions: Set<ClientSession> = new Set();
  private server: Server | null = null;
  private listening: Endpoint | null = null;
  private readonly isBusy: () => boolean;
  private readonly pauseLeaseMilliseconds: number;
  private activeRequests: number = 0;
  private pauseOwner: ClientSession | null = null;
  private pauseTimer: NodeJS.Timeout | null = null;
  private readonly shutdown: IUpdateShutdown | null;
  private readonly terminals: TerminalHost | null;
  private committing: boolean = false;

  public constructor(endpointKind: EndpointKind, socketPath: string, token: string, dispatcher: IRequestDispatcher, listener: IServerListener,
    isBusy: () => boolean = () => false, pauseLeaseMilliseconds: number = Resources.runtimePauseLeaseMilliseconds, shutdown: IUpdateShutdown | null = null,
    terminals: TerminalHost | null = null) {
    ArgumentException.throwIfNullOrWhitespace(socketPath, Resources.pathParameterName);
    ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenParameterName);

    this.endpointKind = endpointKind;
    this.socketPath = socketPath;
    this.token = token;
    this.dispatcher = dispatcher;
    this.listener = listener;
    this.isBusy = isBusy;
    this.pauseLeaseMilliseconds = pauseLeaseMilliseconds;
    this.shutdown = shutdown;
    this.terminals = terminals;
  }

  public get endpoint(): Endpoint | null {
    return this.listening;
  }

  public get sessionCount(): number {
    return this.sessions.size;
  }

  public get authenticatedCount(): number {
    return [...this.sessions].filter(t => t.isAuthenticated).length;
  }

  public start(): Promise<Endpoint> {
    if (!Object.isNull(this.server))
      throw new InvalidOperationException(Resources.serverAlreadyStarted);

    const server = createServer((socket: Socket) => this.accept(socket));
    this.server = server;
    const resolvers = Promise.withResolvers<Endpoint>();
    server.once(Resources.errorEvent, (error: Error) => resolvers.reject(error));
    server.once(Resources.listeningEvent, () => {
      this.listening = this.describeListening(server);
      resolvers.resolve(this.listening);
    });
    if (this.endpointKind === EndpointKind.Tcp) {
      server.listen(Resources.ephemeralPort, Resources.loopbackHost);
    }
    else {
      server.listen(this.socketPath);
    }

    return resolvers.promise;
  }

  public async stop(): Promise<void> {
    this.resume();
    const server = this.server;
    if (Object.isNull(server))
      return;

    this.server = null;
    this.listening = null;
    for (const session of this.sessions)
      session.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }

  public onEvent(event: Event): void {
    for (const session of this.sessions)
      if (session.isAuthenticated)
        session.write(event);
  }

  public onLine(session: ClientSession, line: string): void {
    let message: WireMessage;
    try {
      message = this.decoder.decodeText(line);
    }
    catch {
      this.reject(session, Response.failure(null, new ServiceResponseInfo(ErrorCode.InvalidParams, Resources.messageUnreadable)), !session.isAuthenticated);
      return;
    }
    if (!session.isAuthenticated)
      this.handleHello(session, message);
    else if (message instanceof Request)
      void this.handleRequest(session, message);
    else
      this.reject(session, Response.failure(null, new ServiceResponseInfo(ErrorCode.InvalidParams, Resources.requestRequired)), false);
  }

  public onClosed(session: ClientSession): void {
    if (this.pauseOwner === session && !this.committing)
      this.resume();
    this.sessions.delete(session);
    this.terminals?.endOwnedBy(session);
    this.listener.onSessionCountChanged(this.sessions.size);
  }

  private accept(socket: Socket): void {
    this.sessions.add(new ClientSession(socket, this));
    this.listener.onSessionCountChanged(this.sessions.size);
  }

  private handleHello(session: ClientSession, message: WireMessage): void {
    if (!(message instanceof Hello)) {
      this.reject(session, Response.failure(null, new ServiceResponseInfo(ErrorCode.Unauthorized, Resources.helloRequired)), true);
      return;
    }
    if (message.token !== this.token) {
      this.reject(session, Response.failure(null, new ServiceResponseInfo(ErrorCode.Unauthorized, Resources.tokenRejected)), true);
      return;
    }
    const current = ProtocolVersion.current;
    if (!current.canServe(message.version)) {
      const text = Resources.formatVersionMismatch(message.version.toString(), current.toString());
      const info = new ServiceResponseInfo(ErrorCode.VersionMismatch, text, [message.version.toString(), current.toString()]);
      this.reject(session, Response.failure(null, info), true);
      return;
    }

    session.authenticate(message.client);
    session.write(Response.success(null, current.toJson()));
  }

  private async handleRequest(session: ClientSession, request: Request): Promise<void> {
    if (this.committing) {
      session.write(Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Unavailable, Resources.runtimePaused)));
      return;
    }
    if (request.method === MethodName.RuntimeStopForUpdate) {
      await this.stopForUpdate(session, request);
      return;
    }
    if (request.method === MethodName.RuntimePause || request.method === MethodName.RuntimeResume) {
      session.write(this.controlAdmission(session, request));
      return;
    }
    if (!Object.isNull(this.pauseOwner)) {
      session.write(Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Unavailable, Resources.runtimePaused)));
      return;
    }
    this.activeRequests += 1;
    try {
      const response = !Object.isNull(this.terminals) && this.terminals.handles(request.method)
        ? await this.terminals.dispatch(session, request)
        : await this.dispatcher.dispatch(request);
      try {
        await session.writeAndFlush(response);
        this.listener.onResponseSent?.(request);
      }
      catch { }
    }
    finally {
      this.activeRequests -= 1;
    }
  }

  private async stopForUpdate(session: ClientSession, request: Request): Promise<void> {
    if (session !== this.pauseOwner || Object.isNull(this.shutdown) || !Object.isNull(request.payload)) {
      session.write(Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Conflict, Resources.runtimeStopRequiresPause)));
      return;
    }
    this.committing = true;
    if (!Object.isNull(this.pauseTimer))
      clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
    let response: Response;
    try {
      await this.shutdown.prepareUpdateShutdown();
      response = Response.success(request.id, null);
    }
    catch {
      response = Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Unavailable, Resources.runtimeShutdownFailed));
    }
    try {
      await session.writeAndFlush(response);
    }
    catch { }
    finally {
      await this.shutdown.finishUpdateShutdown();
    }
  }

  private controlAdmission(session: ClientSession, request: Request): Response {
    if (!Object.isNull(request.payload))
      return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.InvalidParams, Resources.runtimePausePayloadInvalid));
    if (!Object.isNull(this.pauseOwner) && this.pauseOwner !== session)
      return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Conflict, Resources.runtimePauseOwned));
    if (request.method === MethodName.RuntimeResume) {
      this.resume();
      return Response.success(request.id, null);
    }
    if (this.activeRequests > 0 || this.isBusy())
      return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Conflict, Resources.runtimePauseBusy));
    this.resume();
    this.pauseOwner = session;
    this.pauseTimer = setTimeout(() => this.resume(), this.pauseLeaseMilliseconds);
    this.pauseTimer.unref();
    return Response.success(request.id, null);
  }

  private resume(): void {
    if (!Object.isNull(this.pauseTimer))
      clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
    this.pauseOwner = null;
  }

  private reject(session: ClientSession, response: Response, close: boolean): void {
    session.write(response);
    if (close)
      session.close();
  }

  private describeListening(server: Server): Endpoint {
    const address = server.address();
    if (Object.isString(address) || Object.isNull(address))
      return Endpoint.socket(this.socketPath);

    return Endpoint.tcp(address.port);
  }
}
