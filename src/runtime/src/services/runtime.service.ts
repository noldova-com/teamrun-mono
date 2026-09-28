/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, rmSync } from "node:fs";
import { release } from "node:os";

import { Guid } from "@noldova/teamrun-foundation-core";
import {
  TeammatesService,
  ApprovalsService,
  ConversationEngine,
  ConversationsService,
  DatabaseContext,
  DatabaseRecovery,
  EventHub,
  type EventSubscription,
  type IEventListener,
  MessagesService,
  ProjectsService,
  ProviderAccountsService,
  type ProviderRegistry,
  ProvidersService,
  RequestDispatcher
} from "@noldova/teamrun-core";
import { type Event, ProtocolVersion } from "@noldova/teamrun-protocol";

import { InvalidOperationException } from "../exceptions/invalid-operation.exception.js";
import { EndpointKind } from "../enums/endpoint-kind.js";
import type { IIdleParticipant } from "../interfaces/i-idle-participant.js";
import type { IServerListener } from "../interfaces/i-server-listener.js";
import type { IShellLocator } from "../interfaces/i-shell-locator.js";
import { RuntimeLock } from "../models/runtime-lock.js";
import { RuntimeSettings } from "../models/runtime-settings.js";
import { TerminalSettings } from "../models/terminal-settings.js";
import { Resources } from "../resources.js";
import { RuntimeServer } from "./endpoint/runtime-server.js";
import { IdleMonitor } from "./idle-monitor.js";
import { LockFile } from "./lock/lock-file.js";
import { ProcessProbe } from "./lock/process-probe.js";
import type { ProcessRegistry } from "./processes/process-registry.js";
import type { IUpdateShutdown } from "../interfaces/i-update-shutdown.js";
import { InstallationRole } from "../enums/installation-role.js";
import { InstallationMember } from "../models/installation-member.js";
import type { InstallationRegistry } from "./installation-registry.js";
import { ShellLocator } from "./terminals/shell-locator.js";
import { TerminalEnvironment } from "./terminals/terminal-environment.js";
import { TerminalHost } from "./terminals/terminal-host.js";
import { TokenGenerator } from "./tokens/token-generator.js";

export class RuntimeService implements IServerListener, IIdleParticipant, IEventListener, IUpdateShutdown {
  public static createRecoveryCopy(dataDirectory: string, operationId: string): Promise<string | null> {
    return DatabaseRecovery.createBackup(dataDirectory, operationId);
  }
  public readonly settings: RuntimeSettings;
  private readonly registry: ProviderRegistry;
  private readonly processes: ProcessRegistry;
  private readonly lockFile: LockFile;
  private readonly stopped: PromiseWithResolvers<string> = Promise.withResolvers<string>();
  private readonly idle: IdleMonitor;
  private context: DatabaseContext | null = null;
  private engine: ConversationEngine | null = null;
  private server: RuntimeServer | null = null;
  private subscriptions: EventSubscription[] = [];
  private currentLock: RuntimeLock | null = null;
  private stopping: boolean = false;
  private sessionCount: number = 0;
  private updateDataClosed: boolean = false;
  private readonly installation: InstallationRegistry | null;
  private readonly shells: IShellLocator;
  private member: InstallationMember | null = null;
  private terminals: TerminalHost | null = null;

  public constructor(settings: RuntimeSettings, registry: ProviderRegistry, processes: ProcessRegistry, installation: InstallationRegistry | null = null,
    shells: IShellLocator = ShellLocator.fromPlatform(process.platform)) {
    this.settings = settings;
    this.registry = registry;
    this.processes = processes;
    this.lockFile = new LockFile(settings.lockPath, new ProcessProbe());
    this.idle = new IdleMonitor(settings.idleGraceMilliseconds, this);
    this.installation = installation;
    this.shells = shells;
  }

  public get lock(): RuntimeLock | null {
    return this.currentLock;
  }

  public get isRunning(): boolean {
    return !Object.isNull(this.currentLock) && !this.stopping;
  }

  public get isIdle(): boolean {
    return this.sessionCount === 0 && (Object.isNull(this.engine) || this.engine.activeRunCount === 0);
  }

  public get clientCount(): number {
    return this.sessionCount;
  }

  public async start(): Promise<RuntimeLock> {
    if (!Object.isNull(this.context))
      throw new InvalidOperationException(Resources.serviceAlreadyStarted);

    if (!Object.isNull(this.installation)) {
      const member = new InstallationMember(Guid.createVersion7().toString(), InstallationRole.Runtime, process.pid,
        this.settings.dataDirectory, this.settings.productVersion, null, null);
      this.installation.register(member);
      this.member = member;
    }
    try {
      this.lockFile.claim();
      this.installation?.linkDataDirectory(this.settings.dataDirectory);
      return await this.startOwned();
    }
    catch (error) {
      try {
        if (!Object.isNull(this.context))
          await this.release();
      }
      finally {
        if (!Object.isNull(this.currentLock)) {
          this.lockFile.release(this.currentLock.processId);
          this.currentLock = null;
        }
        this.lockFile[Symbol.dispose]();
        this.unregister();
      }
      throw error;
    }
  }

  private async startOwned(): Promise<RuntimeLock> {
    if (this.settings.endpointKind === EndpointKind.Socket &&
        this.settings.socketPath === RuntimeSettings.createSocketPath(false, this.settings.dataDirectory) &&
        existsSync(this.settings.socketPath))
      rmSync(this.settings.socketPath);
    this.processes.reapLeftovers();
    await DatabaseRecovery.prepare(this.settings.dataDirectory);
    const context = DatabaseContext.open(this.settings.dataDirectory);
    this.context = context;
    const events = new EventHub();
    const conversations = new ConversationsService(context);
    const projects = new ProjectsService(context, conversations);
    const messages = new MessagesService(context);
    const approvals = new ApprovalsService(context);
    const accounts = new ProviderAccountsService(context, this.registry, events);
    const teammates = new TeammatesService(context, accounts, conversations);
    const providers = new ProvidersService(this.registry, accounts);
    const engine = new ConversationEngine(context, projects, conversations, messages, approvals, accounts, teammates, this.registry, events);
    this.engine = engine;
    engine.reconcile();
    const dispatcher = new RequestDispatcher(providers, accounts, projects, conversations, messages, approvals, engine, teammates, events);
    const terminals = new TerminalHost(projects, this.settings.terminalsPath, this.shells,
      TerminalEnvironment.forPlatform(process.platform, process.env, Intl.DateTimeFormat().resolvedOptions().locale),
      TerminalSettings.forPlatform(process.platform, release()));
    terminals.prepare();
    this.terminals = terminals;
    const token = new TokenGenerator().generate();
    const server = new RuntimeServer(this.settings.endpointKind, this.settings.socketPath, token, dispatcher, this,
      () => engine.activeRunCount > 0, Resources.runtimePauseLeaseMilliseconds, this, terminals);
    this.server = server;
    this.subscriptions = [events.subscribe(server), events.subscribe(this)];

    const endpoint = await server.start();
    const lock = new RuntimeLock(process.pid, endpoint, token, ProtocolVersion.current, this.settings.productVersion, new Date().toISOString());
    this.lockFile.acquire(lock);
    this.currentLock = lock;
    if (!Object.isNull(this.member)) {
      this.member = this.member.withEndpoint(endpoint, token);
      this.installation?.activate(this.member);
    }
    this.idle.check();

    return lock;
  }

  public async stop(reason: string): Promise<void> {
    if (Object.isNull(this.currentLock) || this.stopping)
      return;

    this.stopping = true;
    this.idle[Symbol.dispose]();
    try {
      await this.release();
    }
    finally {
      this.lockFile.release(this.currentLock.processId);
      this.lockFile[Symbol.dispose]();
      this.currentLock = null;
      try {
        this.unregister();
      }
      finally {
        this.stopped.resolve(reason);
      }
    }
  }

  public waitForStop(): Promise<string> {
    return this.stopped.promise;
  }

  public async prepareUpdateShutdown(): Promise<void> {
    this.idle[Symbol.dispose]();
    const context = this.context;
    this.context = null;
    for (const subscription of this.subscriptions)
      subscription[Symbol.dispose]();
    this.subscriptions = [];
    let timer: NodeJS.Timeout | null = null;
    try {
      await Promise.race([
        this.endWork(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(Resources.runtimeShutdownFailed)), Resources.updateShutdownMilliseconds);
        })
      ]);
    }
    finally {
      if (!Object.isNull(timer))
        clearTimeout(timer);
      context?.[Symbol.dispose]();
      this.engine = null;
      this.updateDataClosed = true;
    }
  }

  public finishUpdateShutdown(): Promise<void> {
    return this.stop(Resources.stoppedForUpdate);
  }

  public onSessionCountChanged(count: number): void {
    this.sessionCount = count;
    this.idle.check();
  }

  public onEvent(_event: Event): void {
    this.idle.check();
  }

  public handleIdle(): void {
    void this.stop(Resources.stoppedByIdle);
  }

  private async release(): Promise<void> {
    for (const subscription of this.subscriptions)
      subscription[Symbol.dispose]();
    this.subscriptions = [];
    if (!Object.isNull(this.server))
      await this.server.stop();
    if (this.updateDataClosed) {
      this.server = null;
      return;
    }
    await this.endWork();
    if (!Object.isNull(this.context))
      this.context[Symbol.dispose]();
    this.server = null;
    this.engine = null;
    this.context = null;
  }

  private async endWork(): Promise<void> {
    if (!Object.isNull(this.terminals))
      await this.terminals.shutdown();
    await this.shutdownProviders();
  }

  private async shutdownProviders(): Promise<void> {
    if (!Object.isNull(this.engine))
      await this.engine.shutdown();
    const results = await Promise.allSettled(this.registry.all().map(t => t.shutdown()));
    if (results.some(t => t.status === Resources.updateRejectedPromise))
      throw new Error(Resources.runtimeShutdownFailed);
  }

  private unregister(): void {
    const member = this.member;
    this.member = null;
    if (!Object.isNull(member))
      this.installation?.unregister(member.id);
  }
}
