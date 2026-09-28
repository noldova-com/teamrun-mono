/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  TeammatesService,
  ApprovalsService,
  ConversationEngine,
  ConversationsService,
  DatabaseContext,
  EventHub,
  MessagesService,
  ProjectsService,
  ProviderAccountsService,
  ProviderRegistry,
  ProvidersService,
  RequestDispatcher
} from "@noldova/teamrun-core";
import {
  EndpointKind, type IShellLocator, ProcessInspector, ProcessProbe, ProcessRegistry,
  RuntimeClient, RuntimeService, RuntimeSettings, RuntimeTimings
} from "@noldova/teamrun-runtime";

import { FakeProviderAdapter } from "./fake-provider-adapter.fixture.js";
import { FixtureShell } from "./fixture-shell.fixture.js";
import { RecordingClientListener } from "./recording-client-listener.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class RuntimeTestHost implements AsyncDisposable {
  public static readonly PRODUCT_VERSION: string = "0.0.1-test";

  public readonly directory: TemporaryDirectory = new TemporaryDirectory();
  public readonly adapter: FakeProviderAdapter = new FakeProviderAdapter();
  public readonly registry: ProviderRegistry = new ProviderRegistry();
  public readonly timings: RuntimeTimings = new RuntimeTimings(1000, 5000, 5000, 50);
  public readonly services: RuntimeService[] = [];
  public readonly clients: RuntimeClient[] = [];
  public readonly contexts: DatabaseContext[] = [];

  public constructor() {
    this.registry.register(this.adapter);
  }

  public createSettings(idleGrace: number | null = null, kind: EndpointKind = EndpointKind.Tcp, directoryName: string = "data"): RuntimeSettings {
    const dataDirectory = this.directory.resolve(directoryName);
    const socketPath = RuntimeSettings.createSocketPath(process.platform === "win32", dataDirectory);
    return new RuntimeSettings(dataDirectory, RuntimeTestHost.PRODUCT_VERSION, kind, socketPath, idleGrace);
  }

  public createService(settings: RuntimeSettings = this.createSettings(), shells: IShellLocator = new FixtureShell()): RuntimeService {
    const processes = new ProcessRegistry(settings.processesPath, process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(process.platform));
    const service = new RuntimeService(settings, this.registry, processes, null, shells);
    this.services.push(service);
    return service;
  }

  public createDispatcher(directoryName: string = "dispatcher"): RequestDispatcher {
    const context = DatabaseContext.open(this.directory.resolve(directoryName));
    this.contexts.push(context);
    const events = new EventHub();
    const conversations = new ConversationsService(context);
    const projects = new ProjectsService(context, conversations);
    const messages = new MessagesService(context);
    const approvals = new ApprovalsService(context);
    const accounts = new ProviderAccountsService(context, this.registry, events);
    const teammates = new TeammatesService(context, accounts, conversations);
    const providers = new ProvidersService(this.registry, accounts);
    const engine = new ConversationEngine(context, projects, conversations, messages, approvals, accounts, teammates, this.registry, events);

    return new RequestDispatcher(providers, accounts, projects, conversations, messages, approvals, engine, teammates);
  }

  public async connect(service: RuntimeService, clientName: string = "test", listener: RecordingClientListener = new RecordingClientListener()): Promise<RuntimeClient> {
    const lock = service.lock;
    if (lock === null)
      throw new Error("The service is not running.");

    const client = await RuntimeClient.connect(lock.endpoint, lock.token, clientName, listener, this.timings);
    this.clients.push(client);
    return client;
  }

  public async shutdown(): Promise<void> {
    for (const client of this.clients)
      client.close();
    for (const service of this.services)
      await service.stop("test");
    for (const context of this.contexts)
      context[Symbol.dispose]();
    this.contexts.length = 0;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    try {
      await this.shutdown();
    }
    finally {
      this.directory[Symbol.dispose]();
    }
  }
}
