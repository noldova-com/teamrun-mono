/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { JsonException } from "@noldova/teamrun-foundation-json";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  Conversation, ErrorCode, EventName, Message, MessageSendResult, MessageStatus, MethodName, Project, ProtocolVersion, Request, TerminalInputParams,
  TerminalOpenParams, TerminalSize, TerminalState
} from "@noldova/teamrun-protocol";
import { EndpointKind, InstallationRegistry, InvalidOperationException, ProcessInspector, ProcessProbe, ProcessRegistry, RuntimeAlreadyRunningException, RuntimeService, RuntimeSettings } from "@noldova/teamrun-runtime";

import { RecordingClientListener } from "../fixtures/recording-client-listener.fixture.js";
import { RuntimeTestHost } from "../fixtures/runtime-test-host.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class RuntimeServiceTests {
  @TestMethod
  public async createsARecoveryCopyContainingCommittedProjectData(): Promise<void> {
    await using host = new RuntimeTestHost();
    const dispatcher = host.createDispatcher("data");
    const response = await dispatcher.dispatch(new Request("project", MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") }));
    const project = Project.fromJson(response.payload);

    const path = await RuntimeService.createRecoveryCopy(host.directory.resolve("data"), "12345678-1234-1234-1234-123456789abc");

    Assert.isNotNull(path);
    const copy = new DatabaseSync(path, { readOnly: true });
    try {
      Assert.areEqual(project.id, copy.prepare("SELECT id FROM projects WHERE id = ?").get(project.id)?.["id"]);
    }
    finally {
      copy.close();
    }
  }

  @TestMethod
  public async releasesThePublishedLockWhenInstallationActivationFails(): Promise<void> {
    await using host = new RuntimeTestHost();
    const settings = host.createSettings();
    const installation = new InstallationRegistry(host.directory.resolve("installation", "a".repeat(64), "instances.db"));
    installation.activate = () => { throw new Error("Fixture registry write failed"); };
    const service = new RuntimeService(settings, host.registry,
      new ProcessRegistry(settings.processesPath, process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(process.platform)), installation);
    await Assert.throwsAsync(() => service.start(), Error);
    Assert.isFalse(existsSync(settings.lockPath));
    Assert.areEqual(0, installation.members().length);
    Assert.areEqual(1, host.adapter.shutdowns);
  }

  @TestMethod
  public async releasesOwnershipAndResourcesAfterRecoveryFails(): Promise<void> {
    await using host = new RuntimeTestHost();
    const dispatcher = host.createDispatcher("data");
    const project = Project.fromJson((await dispatcher.dispatch(new Request("p", MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") }))).payload);
    const conversation = Conversation.fromJson((await dispatcher.dispatch(new Request("c", MethodName.ConversationCreate, { projectId: project.id, title: null }))).payload);
    const context = host.contexts[0];
    Assert.isDefined(context);
    context.database.connection.execute(new SqlQuery("INSERT INTO messages (id, conversationId, sequence, status, json, createdAt, updatedAt) VALUES ('broken', ?, 0, 'Running', 'invalid', 't', 't')", [conversation.id]));
    const standard = host.createSettings();
    const socketPath = RuntimeSettings.createSocketPath(false, standard.dataDirectory);
    const socketSettings = new RuntimeSettings(standard.dataDirectory, standard.productVersion, EndpointKind.Socket, socketPath, null);
    writeFileSync(socketPath, "stale fixture");
    await Assert.throwsAsync(() => host.createService(socketSettings).start(), JsonException);
    Assert.isFalse(existsSync(socketPath));
    context.database.connection.execute(new SqlQuery("DELETE FROM messages WHERE id = 'broken'", []));
    const service = host.createService();
    await service.start();
    Assert.isTrue(service.isRunning);
    await host.shutdown();
  }

  @TestMethod
  public async servesRequestsAndFansEventsOut(): Promise<void> {
    await using host = new RuntimeTestHost();
    const service = host.createService();
    const lock = await service.start();
    const first = new RecordingClientListener();
    const second = new RecordingClientListener();
    const chat = await host.connect(service, "chat", first);
    const watcher = await host.connect(service, "watch", second);

    const project = Project.fromJson((await chat.call(MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") })).payload);
    const conversation = Conversation.fromJson((await chat.call(MethodName.ConversationCreate, { projectId: project.id, title: "Chat" })).payload);
    const sent = MessageSendResult.fromJson((await chat.call(MethodName.MessageSend, { conversationId: conversation.id, text: "Hello", requested: { provider: "fake", model: null, effort: null }, providerAccountId: null })).payload);
    await Wait.until(() => second.names.filter(t => t === EventName.MessageUpdated).length >= 3);
    const twice = await Assert.throwsAsync(() => service.start(), InvalidOperationException);
    await host.shutdown();
    await service.stop("again");
    await Wait.until(() => !watcher.isConnected);

    Assert.areEqual(process.pid, lock.processId);
    Assert.isTrue(lock.protocolVersion.equals(ProtocolVersion.current));
    Assert.areEqual(RuntimeTestHost.PRODUCT_VERSION, lock.productVersion);
    Assert.isTrue(/^[0-9a-f]{64}$/.test(lock.build ?? ""), lock.build);
    Assert.areEqual(process.execPath, lock.executablePath);
    Assert.areEqual(conversation.id, sent.sent.conversationId);
    Assert.areEqual(first.names.join(","), second.names.join(","));
    Assert.isTrue(first.names.includes(EventName.MessageCreated));
    Assert.isTrue(first.names.includes(EventName.DetailAppended));
    Assert.areEqual("Hello", host.adapter.prompts[0]);
    Assert.areEqual("The runtime service was already started.", twice.message);
    Assert.isFalse(service.isRunning);
    Assert.isFalse(existsSync(service.settings.lockPath));
    Assert.areEqual(1, host.adapter.shutdowns);
    Assert.isFalse(watcher.isConnected);
  }

  @TestMethod
  public async stopsWhenIdleButNotWhileATurnRuns(): Promise<void> {
    await using host = new RuntimeTestHost();
    host.adapter.holdUntilAbort = true;
    const service = host.createService(host.createSettings(100));
    await service.start();
    const chat = await host.connect(service, "chat");
    const project = Project.fromJson((await chat.call(MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") })).payload);
    const conversation = Conversation.fromJson((await chat.call(MethodName.ConversationCreate, { projectId: project.id, title: null })).payload);
    const sent = MessageSendResult.fromJson((await chat.call(MethodName.MessageSend, { conversationId: conversation.id, text: "Wait", requested: { provider: "fake", model: null, effort: null }, providerAccountId: null })).payload);

    chat.close();
    await Wait.until(() => service.clientCount === 0);
    await Wait.delay(250);
    const stillRunning = service.isRunning;
    const canceller = await host.connect(service, "cancel");
    await canceller.call(MethodName.MessageCancel, { messageId: sent.replies[0]!.id });
    canceller.close();
    const reason = await service.waitForStop();

    Assert.isTrue(stillRunning);
    Assert.areEqual("idle", reason);
    Assert.isFalse(service.isRunning);
    Assert.isTrue(service.isIdle);
  }

  @TestMethod
  public async refusesToServeADirectoryAnotherRuntimeHolds(): Promise<void> {
    await using host = new RuntimeTestHost();
    const first = host.createService();
    const second = host.createService();
    await first.start();

    const refused = await Assert.throwsAsync(() => second.start(), RuntimeAlreadyRunningException);
    await second.stop("unused");
    await host.shutdown();

    Assert.areEqual(process.pid, refused.lock.processId);
    Assert.isNull(second.lock);
    Assert.isTrue(second.isIdle);
    Assert.isTrue(existsSync(first.settings.dataDirectory));
  }

  @TestMethod
  public async leavesTheOwnersActiveReplyUntouchedWhenStartupIsRefused(): Promise<void> {
    await using host = new RuntimeTestHost();
    host.adapter.holdUntilAbort = true;
    const owner = host.createService();
    await owner.start();
    const client = await host.connect(owner);
    const project = Project.fromJson((await client.call(MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") })).payload);
    const conversation = Conversation.fromJson((await client.call(MethodName.ConversationCreate, { projectId: project.id, title: null })).payload);
    await client.call(MethodName.MessageSend, {
      conversationId: conversation.id, text: "Wait", requested: { provider: "fake", model: null, effort: null }, providerAccountId: null
    });
    await Wait.until(() => host.adapter.prompts.length === 1);
    try {
      await Assert.throwsAsync(() => host.createService().start(), RuntimeAlreadyRunningException);
      const response = await client.call(MethodName.MessageList, { conversationId: conversation.id, afterSequence: null, kinds: [] });
      const messages = response.payload;
      Assert.isTrue(Array.isArray(messages));
      if (!Array.isArray(messages))
        throw new Error("Expected messages.");
      Assert.areEqual(MessageStatus.Running, Message.fromJson(messages[1]).status);
      Assert.areEqual(0, host.adapter.shutdowns);
    }
    finally {
      await host.shutdown();
    }
  }

  @TestMethod
  public async hostsTerminalsOnlyForTheConnectionThatOpensThem(): Promise<void> {
    await using host = new RuntimeTestHost();
    const settings = host.createSettings();
    mkdirSync(settings.terminalsPath, { recursive: true });
    writeFileSync(join(settings.terminalsPath, "left.jsonl"), "{}\n");
    const service = host.createService(settings);
    await service.start();
    const leftovers = readdirSync(settings.terminalsPath).length;
    const desktop = new RecordingClientListener();
    const cli = new RecordingClientListener();
    const owner = await host.connect(service, "desktop", desktop, host.terminalTimings);
    const other = await host.connect(service, "cli", cli);
    mkdirSync(host.directory.resolve("repo"));
    const project = Project.fromJson((await owner.call(MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") })).payload);

    const opened = TerminalState.fromJson((await owner.call(MethodName.TerminalOpen, new TerminalOpenParams(project.id, null, new TerminalSize(80, 5)).toJson())).payload);
    await owner.call(MethodName.TerminalInput, new TerminalInputParams(opened.id, "lines 1300\r").toJson());
    await Wait.until(() => desktop.names.includes(EventName.TerminalOutput) && existsSync(join(settings.terminalsPath, `${opened.id}-1.jsonl`)));
    const refused = await other.call(MethodName.TerminalInput, new TerminalInputParams(opened.id, "exit 0\r").toJson());
    const listed = await other.call(MethodName.TerminalList, null);
    owner.close();
    await Wait.until(() => readdirSync(settings.terminalsPath).length === 0);

    Assert.areEqual(0, leftovers);
    Assert.isFalse(cli.names.some(t => t.startsWith("Terminal")));
    Assert.areEqual(ErrorCode.NotFound, refused.info?.name);
    Assert.areEqual("[]", JSON.stringify(listed.payload));
  }

  @TestMethod
  public async endsTerminalsWhenItStops(): Promise<void> {
    await using host = new RuntimeTestHost();
    const service = host.createService();
    await service.start();
    const client = await host.connect(service, "desktop", new RecordingClientListener(), host.terminalTimings);
    mkdirSync(host.directory.resolve("repo"));
    const project = Project.fromJson((await client.call(MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") })).payload);
    const opened = TerminalState.fromJson((await client.call(MethodName.TerminalOpen, new TerminalOpenParams(project.id, null, new TerminalSize(80, 5)).toJson())).payload);
    await client.call(MethodName.TerminalInput, new TerminalInputParams(opened.id, "lines 1300\r").toJson());
    await Wait.until(() => existsSync(join(service.settings.terminalsPath, `${opened.id}-1.jsonl`)));

    await service.stop("test");

    Assert.areEqual(0, readdirSync(service.settings.terminalsPath).length);
  }
}
