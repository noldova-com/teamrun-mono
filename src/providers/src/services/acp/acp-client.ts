/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";

import "@noldova/teamrun-foundation-core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

import type { IAcpClientListener } from "../../interfaces/i-acp-client-listener.js";
import type { IProcessTracker } from "../../interfaces/i-process-tracker.js";
import { PendingRequest } from "../../models/pending-request.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import type { ProcessTerminator } from "../process/process-terminator.js";

export class AcpClient {
  private readonly command: ProcessCommand;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly directory: string;
  private readonly terminator: ProcessTerminator;
  private readonly timings: ProviderTimings;
  private readonly tracker: IProcessTracker;
  private readonly pending: Map<number, PendingRequest> = new Map();
  private readonly reverseRequests: Set<string | number> = new Set();
  private readonly closed = Promise.withResolvers<void>();
  private child: ChildProcessWithoutNullStreams | null = null;
  private listener: IAcpClientListener | null = null;
  private nextId: number = 0;
  private buffered: string = String.empty;
  private stopping: boolean = false;

  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string,
    terminator: ProcessTerminator, timings: ProviderTimings, tracker: IProcessTracker) {
    this.command = command;
    this.environment = environment;
    this.directory = directory;
    this.terminator = terminator;
    this.timings = timings;
    this.tracker = tracker;
  }

  public start(): void {
    if (!Object.isNull(this.child))
      throw new Error(Resources.acpAlreadyStarted);
    const child = spawn(this.command.executable, [...this.command.arguments], { cwd: this.directory, env: this.environment, stdio: "pipe", windowsHide: true });
    this.child = child;
    child.stdout.setEncoding(Resources.utf8Encoding);
    child.stdout.on(Resources.dataEvent, (text: string) => this.receive(text));
    child.stderr.resume();
    child.stdin.on(Resources.errorEvent, () => this.failPending(new Error(Resources.acpDisconnected)));
    child.once(Resources.errorEvent, (error: Error) => this.failPending(error));
    child.once(Resources.spawnEvent, () => {
      if (!Object.isUndefined(child.pid))
        this.tracker.track(child.pid, this.command.executable);
    });
    child.once(Resources.closeEvent, () => {
      if (!Object.isUndefined(child.pid))
        this.tracker.untrack(child.pid);
      this.failPending(new Error(Resources.acpDisconnected));
      this.closed.resolve();
      if (!this.stopping)
        this.listener?.onExit();
    });
  }

  public setListener(listener: IAcpClientListener | null): void {
    this.listener = listener;
  }

  public request(method: string, params: JsonObject, timeout: number | null = this.timings.requestTimeout): Promise<JsonValue> {
    if (this.stopping || Object.isNull(this.child) || this.child.stdin.destroyed)
      return Promise.reject(new Error(Resources.acpDisconnected));
    if (this.pending.size >= Resources.acpMaximumPending)
      return Promise.reject(new Error(Resources.acpTooManyRequests));
    const id = ++this.nextId;
    const resolvers = Promise.withResolvers<JsonValue>();
    const timer = Object.isNull(timeout) ? null : setTimeout(() => {
      this.pending.get(id)?.fail(new Error(Resources.formatAcpTimeout(method)));
      this.pending.delete(id);
    }, timeout);
    this.pending.set(id, new PendingRequest(method, resolvers, timer));
    this.write({ jsonrpc: Resources.acpJsonRpcVersion, id, method, params });
    return resolvers.promise;
  }

  public notify(method: string, params: JsonObject): void {
    this.write({ jsonrpc: Resources.acpJsonRpcVersion, method, params });
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    this.listener = null;
    const child = this.child;
    if (Object.isNull(child))
      return;
    this.failPending(new Error(Resources.acpDisconnected));
    child.stdin.end();
    if (!await this.waitForClose(this.timings.stopGrace)) {
      await this.terminator.terminate(child);
      if (!await this.waitForClose(Resources.acpKillWait))
        throw new Error(Resources.acpDidNotStop);
    }
  }

  private receive(text: string): void {
    this.buffered += text;
    if (this.buffered.length > Resources.acpMaximumBufferedCharacters) {
      this.failPending(new Error(Resources.acpFrameTooLarge));
      void this.stop().catch(() => undefined);
      return;
    }
    if (!text.includes(Resources.lineSeparator))
      return;
    let boundary: number;
    while ((boundary = this.buffered.indexOf(Resources.lineSeparator)) >= 0) {
      const line = this.buffered.slice(0, boundary).trim();
      this.buffered = this.buffered.slice(boundary + 1);
      if (line.length === 0)
        continue;
      try {
        this.handle(JsonReader.parse(line));
      }
      catch (error) {
        this.failPending(error instanceof Error ? error : new Error(Resources.acpInvalidFrame));
        void this.stop().catch(() => undefined);
        return;
      }
    }
  }

  private handle(message: JsonReader): void {
    const value = message.toJson();
    const id = value[Resources.idField];
    const method = message.readOptionalString(Resources.methodField);
    if (!Object.isUndefined(method)) {
      const params = message.hasField(Resources.paramsField) ? message.readObject(Resources.paramsField) : JsonReader.fromValue({});
      if (Object.isString(id) || Object.isNumber(id)) {
        if (this.reverseRequests.size >= Resources.acpMaximumPending || this.reverseRequests.has(id)) {
          this.write({ jsonrpc: Resources.acpJsonRpcVersion, id, error: { code: Resources.acpUnsupportedCode, message: Resources.acpTooManyRequests } });
          return;
        }
        this.reverseRequests.add(id);
        const listener = this.listener;
        const response = Promise.resolve().then(() => {
          if (Object.isNull(listener))
            throw new Error(Resources.acpUnsupportedRequest);
          return listener.onRequest(String(id), method, params);
        });
        void response.then(result => this.write({ jsonrpc: Resources.acpJsonRpcVersion, id, result }),
          () => this.write({ jsonrpc: Resources.acpJsonRpcVersion, id, error: { code: Resources.acpUnsupportedCode, message: Resources.acpUnsupportedRequest } }))
          .finally(() => this.reverseRequests.delete(id));
      }
      else {
        this.listener?.onNotification(method, params);
      }
      return;
    }
    if (!Object.isNumber(id))
      return;
    const pending = this.pending.get(id);
    if (Object.isUndefined(pending))
      return;
    this.listener?.onResponse(pending.method);
    this.pending.delete(id);
    if (message.hasField(Resources.errorField))
      pending.fail(new Error(message.readObject(Resources.errorField).readString(Resources.messageField)));
    else
      pending.complete(value[Resources.resultField] ?? null);
  }

  private write(message: JsonObject): void {
    if (!this.stopping && !Object.isNull(this.child) && !this.child.stdin.destroyed)
      this.child.stdin.write(`${JSON.stringify(message)}${Resources.lineSeparator}`);
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values())
      pending.fail(error);
    this.pending.clear();
  }

  private waitForClose(milliseconds: number): Promise<boolean> {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), milliseconds);
      void this.closed.promise.then(() => { clearTimeout(timer); resolve(true); });
    });
  }
}
