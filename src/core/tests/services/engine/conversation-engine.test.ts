/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import "@noldova/teamrun-foundation-core";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalAsk, ConversationEngine, TurnDetail, TurnOutcome, WorkingTree } from "@noldova/teamrun-core";
import {
  Approval,
  AttachmentInput,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalStatus,
  ConversationIdParams,
  ConversationMoveParams,
  ConversationRewindParams,
  ConversationRewindResult,
  ConversationRewoundPayload,
  DetailEventPayload,
  DetailKind,
  ErrorCode,
  EventName,
  MessageAuthor,
  MessageIdParams,
  MessageListParams,
  MessageSendParams,
  MessageSendResult,
  MessageStatus,
  Provenance,
  ProviderAccountIdParams,
  RequestedSettings
} from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { GitRepository } from "../../fixtures/git-repository.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";

@TestClass
export class ConversationEngineTests {
  @TestMethod
  public async persistsFileOnlyMessagesAndRestoresTheirReferencesAfterRewind(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const settings = new RequestedSettings("fake", null, null);
    const result = await host.engine.send(new MessageSendParams(conversation.id, "", settings, null,
      [new AttachmentInput("notes.txt", "text/plain", Buffer.from("durable file contents").toString("base64"), null)]));
    await host.until(() => host.engine.activeRunCount === 0);
    const saved = host.messages.find(result.sent.id)?.attachments[0];
    Assert.isDefined(saved);
    Assert.areEqual("durable file contents", readFileSync(saved!.path, "utf8"));
    Assert.areEqual(saved!.path, host.adapter.requests[0]?.attachments[0]?.path);
    Assert.isTrue(host.adapter.requests[0]?.prompt.includes(JSON.stringify(saved!.path)) ?? false);
    const second = await host.engine.send(new MessageSendParams(conversation.id, "Second", settings, null));
    await host.until(() => host.engine.activeRunCount === 0);
    await host.engine.rewind(new ConversationRewindParams(conversation.id, second.sent.id, false));
    await host.engine.send(new MessageSendParams(conversation.id, "After rewind", settings, null));
    await host.until(() => host.engine.activeRunCount === 0);
    Assert.isTrue(host.adapter.requests.at(-1)?.prompt.includes(JSON.stringify(saved!.path)) ?? false);
    Assert.areEqual("durable file contents", readFileSync(saved!.path, "utf8"));
  }

  @TestMethod
  public async discardsCopiesWhenTheMessageTransactionFails(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.context.database.connection.execute(new SqlQuery("CREATE TRIGGER reject_message BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'fixture failure'); END"));
    await Assert.throwsAsync(() => host.engine.send(new MessageSendParams(conversation.id, "test", new RequestedSettings("fake", null, null), null,
      [new AttachmentInput("a.txt", "text/plain", "YQ==", null)])), Error);
    Assert.areEqual(0, readdirSync(join(host.directory.path, "attachments")).length);
    Assert.areEqual(0, host.messages.list(new MessageListParams(conversation.id, null)).length);
    Assert.areEqual(0, host.adapter.requests.length);
  }
  private static readonly accept: ApprovalOption = new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved);
  private static readonly decline: ApprovalOption = new ApprovalOption("decline", "Deny", ApprovalOutcome.Denied);
  private static readonly ask: ApprovalAsk =
    new ApprovalAsk("req-1", ApprovalKind.Command, "commandExecution", "Run npm test", { command: "npm test" }, [ConversationEngineTests.accept, ConversationEngineTests.decline]);

  @TestMethod
  public async finalizesRepliesWhenEventDeliveryFailsAndReleasesTheProject(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const broken = host.events.subscribe({
      onEvent: event => {
        if (event.name === EventName.MessageCreated)
          throw new Error("delivery failed");
      }
    });
    await Assert.throwsAsync(() => host.engine.send(ConversationEngineTests.params(conversation.id, "Fail")), Error);
    Assert.isNull(host.messages.findOpenReply(conversation.id));
    Assert.areEqual(MessageStatus.Failed, host.messages.list(new MessageListParams(conversation.id, null)).at(-1)?.status);
    broken[Symbol.dispose]();
    const terminalDelivery = host.events.subscribe({
      onEvent: event => {
        if (event.name === EventName.MessageUpdated)
          throw new Error("status delivery failed");
      }
    });
    const sending = host.engine.send(ConversationEngineTests.params(conversation.id, "Fail status"));
    const failed = Assert.throwsAsync(() => host.engine.waitForIdle(), Error);
    await sending;
    await failed;
    Assert.areEqual(0, host.engine.activeRunCount);
    Assert.isNull(host.messages.findOpenReply(conversation.id));
    terminalDelivery[Symbol.dispose]();
    await host.engine.send(ConversationEngineTests.params(conversation.id, "Recover"));
    await host.engine.waitForIdle();
    Assert.areEqual(MessageStatus.Completed, host.messages.list(new MessageListParams(conversation.id, null)).at(-1)?.status);
  }

  @TestMethod
  public async growsAStreamedDetailInPlace(): Promise<void> {
    using host = new CoreHost();
    host.adapter.detailTexts = [];
    host.adapter.streamedTexts = ["Hel", "Hello", "Hello world"];
    const conversation = host.createConversation();

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Stream"));
    await host.engine.waitForIdle();
    const reply = host.messages.find(result.replies[0]!.id);

    Assert.areEqual(1, reply?.details.length);
    Assert.areEqual("Hello world", reply?.details[0]?.text);
    Assert.areEqual(0, reply?.details[0]?.sequence);
    Assert.areEqual(1, host.listener.count(EventName.DetailAppended));
    Assert.areEqual(2, host.listener.count(EventName.DetailUpdated));
    const updated = host.listener.events.filter(t => t.name === EventName.DetailUpdated).map(t => DetailEventPayload.fromJson(t.payload).detail.text);
    Assert.areEqual("Hello,Hello world", updated.join(","));
  }

  @TestMethod
  public async routesOverlappingApprovalsByTheirOwnIdentifiers(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.adapter.approvalAsks = ["first", "second"].map(t => new ApprovalAsk(
      t, ApprovalKind.Command, "command", t, null, [ConversationEngineTests.accept, ConversationEngineTests.decline]));
    const sent = await host.engine.send(ConversationEngineTests.params(conversation.id, "Ask twice"));
    await host.until(() => host.approvals.listPending(sent.replies[0]!.id).length === 2);
    const first = host.approvals.listPending(sent.replies[0]!.id).find(t => t.summary === "first")!;
    const second = host.approvals.listPending(sent.replies[0]!.id).find(t => t.summary === "second")!;
    host.engine.decide(new ApprovalDecideParams(second.id, "decline"));
    await host.until(() => host.messages.find(sent.replies[0]!.id)?.details.some(t => t.text === "second: decline") ?? false);
    Assert.areEqual(MessageStatus.AwaitingApproval, host.messages.find(sent.replies[0]!.id)?.status);
    host.engine.decide(new ApprovalDecideParams(first.id, "accept"));
    await host.engine.waitForIdle();
    const reply = host.messages.find(sent.replies[0]!.id)!;
    Assert.areEqual(MessageStatus.Completed, reply.status);
    Assert.isTrue(reply.details.some(t => t.text === "first: accept"));
    Assert.areEqual(0, host.approvals.listPending(reply.id).length);
  }

  @TestMethod
  public async allowsConcurrentConversationsAndKeepsDestructiveOperationsExclusive(): Promise<void> {
    using host = new CoreHost();
    const project = host.openProject();
    const repository = new GitRepository(project.rootPath);
    repository.write("base.txt", "base\n");
    repository.commit();
    const index = readFileSync(join(project.rootPath, ".git", "index"));
    const first = host.createConversation(project);
    const second = host.createConversation(project);
    const other = host.openProject("other");
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.send(ConversationEngineTests.params(first.id, "Wait"));
    await host.until(() => host.adapter.requests.length === 1);
    try {
      const overlap = await host.engine.send(ConversationEngineTests.params(second.id, "Overlap"));
      await host.until(() => host.adapter.requests.length === 2);
      Assert.areEqual(2, host.engine.activeRunCount);
      repository.write("shared.txt", "shared edits\n");
      await host.engine.cancel(new MessageIdParams(sent.replies[0]!.id));
      Assert.areEqual(1, host.engine.activeRunCount);
      Assert.throws(() => host.conversations.delete(new ConversationIdParams(first.id)), ServiceException);
      Assert.throws(() => host.conversations.move(new ConversationMoveParams(first.id, other.id)), ServiceException);
      const failure = await ConversationEngineTests.rejection(host.engine.rewind(new ConversationRewindParams(first.id, sent.sent.id, true)));
      Assert.areEqual(ErrorCode.Conflict, failure.info.name);
      Assert.isTrue(host.messages.find(sent.replies[0]!.id)?.details.some(t => t.text.startsWith("Shared working-tree changes")) ?? false);
      await host.engine.cancel(new MessageIdParams(overlap.replies[0]!.id));
      const rewind = host.engine.rewind(new ConversationRewindParams(first.id, sent.sent.id, true));
      const blocked = await ConversationEngineTests.rejection(host.engine.send(ConversationEngineTests.params(second.id, "During rewind")));
      Assert.areEqual(ErrorCode.Conflict, blocked.info.name);
      await rewind;
      Assert.isTrue(index.equals(readFileSync(join(project.rootPath, ".git", "index"))));
    }
    finally {
      await host.engine.shutdown();
    }
    host.adapter.holdUntilAbort = false;
    await host.engine.send(ConversationEngineTests.params(second.id, "After"));
    await host.engine.waitForIdle();
  }

  @TestMethod
  public async endsRepliesWhenGitInspectionFailsBeforeOrAfterTheProvider(): Promise<void> {
    using host = new CoreHost();
    const repository = new GitRepository(join(host.directory.path, "repo"));
    repository.write("file.txt", "original\n");
    repository.commit("initial");
    const conversation = host.createConversation(host.openProject("repo"));
    const index = join(repository.path, ".git", "index");
    const originalIndex = readFileSync(index);
    writeFileSync(index, "broken");
    const before = await host.engine.send(ConversationEngineTests.params(conversation.id, "Before"));
    await host.engine.waitForIdle();
    Assert.areEqual(MessageStatus.Failed, host.messages.find(before.replies[0]!.id)?.status);
    Assert.areEqual(0, host.adapter.requests.length);
    writeFileSync(index, originalIndex);
    host.adapter.afterDetails = () => writeFileSync(index, "broken");
    const after = await host.engine.send(ConversationEngineTests.params(conversation.id, "After"));
    await host.engine.waitForIdle();
    Assert.areEqual(MessageStatus.Failed, host.messages.find(after.replies[0]!.id)?.status);
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async sendsAMessageAndCompletesTheReply(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Hello"));
    await host.engine.waitForIdle();
    const reply = host.messages.find(result.replies[0]!.id);

    Assert.areEqual(MessageAuthor.User, result.sent.author);
    Assert.areEqual(0, result.sent.sequence);
    Assert.areEqual("Hello", result.sent.details[0]?.text);
    Assert.areEqual(MessageStatus.Pending, result.replies[0]!.status);
    Assert.areEqual(result.sent.id, result.replies[0]!.inReplyTo);
    Assert.areEqual(MessageStatus.Completed, reply?.status);
    Assert.areEqual("Working", reply?.details[0]?.text);
    Assert.areEqual("fake-large", reply?.provenance?.observed.model);
    Assert.areEqual("session-1", reply?.provenance?.nativeSessionId);
    Assert.isFalse(reply?.provenance?.resumedNativeSession === true);
    Assert.isFalse(Object.isNull(reply?.endedAt));
    Assert.areEqual(join(host.directory.path, "alpha"), host.adapter.requests[0]?.workingDirectory);
    Assert.areEqual(2, host.listener.count(EventName.MessageCreated));
    Assert.areEqual(1, host.listener.count(EventName.DetailAppended));
    Assert.isTrue(host.listener.count(EventName.MessageUpdated) >= 3);
    Assert.areEqual(0, host.engine.activeRunCount);
    Assert.isTrue(host.context.database.changeFeed.readAfter(0).length >= 4);
  }

  @TestMethod
  public async resumesTheProvidersSessionOnTheNextMessage(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    await host.engine.send(ConversationEngineTests.params(conversation.id, "First"));
    await host.engine.waitForIdle();

    const second = await host.engine.send(ConversationEngineTests.params(conversation.id, "Second"));
    await host.engine.waitForIdle();

    Assert.areEqual("session-1", host.adapter.requests[1]?.resumeNativeSessionId);
    Assert.isTrue(host.messages.find(second.replies[0]!.id)?.provenance?.resumedNativeSession === true);
    Assert.areEqual(4, host.messages.list(ConversationEngineTests.list(conversation.id)).length);
  }

  @TestMethod
  public async waitsForAnApprovalDecision(): Promise<void> {
    using host = new CoreHost();
    host.adapter.approvalAsk = ConversationEngineTests.ask;
    const conversation = host.createConversation();

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Run the tests"));
    await host.until(() => host.approvals.list(new ConversationIdParams(conversation.id)).length === 1);
    const pending = host.approvals.list(new ConversationIdParams(conversation.id))[0];
    Assert.isFalse(Object.isUndefined(pending));
    if (Object.isUndefined(pending))
      return;
    const awaiting = host.messages.find(result.replies[0]!.id);
    const decided = host.engine.decide(new ApprovalDecideParams(pending.id, "accept"));
    await host.engine.waitForIdle();
    const reply = host.messages.find(result.replies[0]!.id);
    const duplicate = Assert.throws(() => host.engine.decide(new ApprovalDecideParams(pending.id, "accept")), ServiceException);

    Assert.areEqual(ErrorCode.Conflict, duplicate.info.name);

    Assert.areEqual(MessageStatus.AwaitingApproval, awaiting?.status);
    Assert.areEqual(ApprovalStatus.Approved, decided.status);
    Assert.areEqual("accept", decided.decision);
    Assert.areEqual(MessageStatus.Completed, reply?.status);
    Assert.areEqual("decided accept", reply?.details[1]?.text);
    Assert.areEqual(1, host.listener.count(EventName.ApprovalCreated));
    Assert.areEqual(1, host.listener.count(EventName.ApprovalUpdated));
    Assert.areEqual(0, host.approvals.list(new ConversationIdParams(conversation.id)).length);
  }

  @TestMethod
  public async cancelsARunningReply(): Promise<void> {
    using host = new CoreHost();
    host.adapter.holdUntilAbort = true;
    const conversation = host.createConversation();

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Wait"));
    await host.until(() => host.messages.find(result.replies[0]!.id)?.status === MessageStatus.Running);
    const cancelled = await host.engine.cancel(new MessageIdParams(result.replies[0]!.id));

    Assert.areEqual(MessageStatus.Cancelled, cancelled.status);
    Assert.isFalse(Object.isNull(cancelled.endedAt));
    Assert.areEqual(DetailKind.Note, cancelled.details[1]?.kind);
    Assert.areEqual("The reply was cancelled.", cancelled.details[1]?.text);
    Assert.areEqual(ErrorCode.Conflict, (await ConversationEngineTests.rejection(host.engine.cancel(new MessageIdParams(result.replies[0]!.id)))).info.name);
  }

  @TestMethod
  public async cancelsAReplyThatIsAwaitingApproval(): Promise<void> {
    using host = new CoreHost();
    host.adapter.approvalAsk = ConversationEngineTests.ask;
    const conversation = host.createConversation();

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Run the tests"));
    await host.until(() => host.approvals.list(new ConversationIdParams(conversation.id)).length === 1);
    const cancelled = await host.engine.cancel(new MessageIdParams(result.replies[0]!.id));
    const approval = host.approvals.find(host.listener.events.filter(t => t.name === EventName.ApprovalCreated).map(t => Approval.fromJson(t.payload).id)[0] ?? "");

    Assert.areEqual(MessageStatus.Cancelled, cancelled.status);
    Assert.areEqual(ApprovalStatus.Cancelled, approval?.status);
    Assert.areEqual(0, host.approvals.list(new ConversationIdParams(conversation.id)).length);
  }

  @TestMethod
  public async recordsFailedAndThrowingTurns(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.adapter.outcome = TurnOutcome.Failed;
    host.adapter.error = "quota exhausted";
    const failed = await host.engine.send(ConversationEngineTests.params(conversation.id, "One"));
    await host.engine.waitForIdle();
    host.adapter.outcome = TurnOutcome.Completed;
    host.adapter.error = null;
    host.adapter.failWith = new Error("boom");
    const thrown = await host.engine.send(ConversationEngineTests.params(conversation.id, "Two"));
    await host.engine.waitForIdle();
    host.adapter.failWith = "text failure";
    const plain = await host.engine.send(ConversationEngineTests.params(conversation.id, "Three"));
    await host.engine.waitForIdle();

    const failedReply = host.messages.find(failed.replies[0]!.id);
    const thrownReply = host.messages.find(thrown.replies[0]!.id);

    Assert.areEqual(MessageStatus.Failed, failedReply?.status);
    Assert.areEqual("The provider's turn failed: quota exhausted", failedReply?.details[1]?.text);
    Assert.areEqual(DetailKind.Error, failedReply?.details[1]?.kind);
    Assert.areEqual(MessageStatus.Failed, thrownReply?.status);
    Assert.areEqual("The provider's turn failed: boom", thrownReply?.details[0]?.text);
    Assert.areEqual("The provider's turn failed: text failure", host.messages.find(plain.replies[0]!.id)?.details[0]?.text);
  }

  @TestMethod
  public async recordsAnInterruptedTurn(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.adapter.outcome = TurnOutcome.Interrupted;

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "One"));
    await host.engine.waitForIdle();

    Assert.areEqual(MessageStatus.Interrupted, host.messages.find(result.replies[0]!.id)?.status);
  }

  @TestMethod
  public async rejectsASecondMessageWhileAReplyIsOpen(): Promise<void> {
    using host = new CoreHost();
    host.adapter.holdUntilAbort = true;
    const conversation = host.createConversation();

    await host.engine.send(ConversationEngineTests.params(conversation.id, "First"));
    const failure = await ConversationEngineTests.rejection(host.engine.send(ConversationEngineTests.params(conversation.id, "Second")));
    await host.engine.shutdown();

    Assert.areEqual(ErrorCode.Conflict, failure.info.name);
    Assert.areEqual(0, host.engine.activeRunCount);
    Assert.areEqual(MessageStatus.Cancelled, host.messages.list(ConversationEngineTests.list(conversation.id))[1]?.status);
  }

  @TestMethod
  public async rejectsUnknownConversationsProvidersAndAccounts(): Promise<void> {
    using host = new CoreHost();
    const other = new FakeProviderAdapter("other");
    host.registry.register(other);
    const conversation = host.createConversation();
    const otherAccount = host.createAccount("other", "Other");

    const missingConversation = await ConversationEngineTests.rejection(host.engine.send(ConversationEngineTests.params("nope", "Hi")));
    const missingProvider = await ConversationEngineTests.rejection(host.engine.send(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("nope", null, null), null)));
    const missingAccount = await ConversationEngineTests.rejection(host.engine.send(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), "acc-nope")));
    const mismatch = await ConversationEngineTests.rejection(host.engine.send(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), otherAccount.id)));

    Assert.areEqual(ErrorCode.NotFound, missingConversation.info.name);
    Assert.areEqual(ErrorCode.NotFound, missingProvider.info.name);
    Assert.areEqual(ErrorCode.NotFound, missingAccount.info.name);
    Assert.areEqual(ErrorCode.InvalidParams, mismatch.info.name);
  }

  @TestMethod
  public async sendsThroughAnAccountAndResumesOnlyThatAccountsSession(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const account = host.createAccount();

    const first = await host.engine.send(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), account.id));
    await host.engine.waitForIdle();
    await host.engine.send(new MessageSendParams(conversation.id, "Again", new RequestedSettings("fake", null, null), null));
    await host.engine.waitForIdle();

    Assert.areEqual(account.id, host.messages.find(first.replies[0]!.id)?.provenance?.providerAccountId);
    Assert.areEqual(account.id, host.adapter.requests[0]?.account?.id);
    Assert.isNull(host.adapter.requests[1]?.resumeNativeSessionId);
  }

  @TestMethod
  public async failsWhenTheProjectRowIsGone(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.context.database.connection.execute(new SqlQuery("PRAGMA foreign_keys = OFF"));
    host.context.database.connection.execute(new SqlQuery("DELETE FROM projects"));

    const failure = await ConversationEngineTests.rejection(host.engine.send(ConversationEngineTests.params(conversation.id, "Hi")));

    Assert.areEqual(ErrorCode.NotFound, failure.info.name);
  }

  @TestMethod
  public async decidesApprovalsWithValidation(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Hi"));
    await host.engine.waitForIdle();
    const orphan = new Approval("apr-1", result.replies[0]!.id, ApprovalKind.Tool, "Bash", "Run", null,
      [ConversationEngineTests.accept], ApprovalStatus.Pending, null, "t", null);
    host.approvals.insert(orphan);

    Assert.areEqual(ErrorCode.Conflict, Assert.throws(() => host.engine.decide(new ApprovalDecideParams(orphan.id, "accept")), ServiceException).info.name);
    Assert.areEqual(ApprovalStatus.Pending, host.approvals.find(orphan.id)?.status);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.engine.decide(new ApprovalDecideParams("nope", "accept")), ServiceException).info.name);
    Assert.areEqual(ErrorCode.Conflict, Assert.throws(() => host.engine.decide(new ApprovalDecideParams(orphan.id, "accept")), ServiceException).info.name);
    const fresh = new Approval("apr-2", result.replies[0]!.id, ApprovalKind.Tool, "Bash", "Run", null,
      [ConversationEngineTests.accept], ApprovalStatus.Pending, null, "t", null);
    host.approvals.insert(fresh);
    Assert.areEqual(ErrorCode.InvalidParams, Assert.throws(() => host.engine.decide(new ApprovalDecideParams(fresh.id, "mystery")), ServiceException).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await ConversationEngineTests.rejection(host.engine.cancel(new MessageIdParams("nope")))).info.name);
  }

  @TestMethod
  public async reconcilesRepliesAnEarlierRuntimeLeftOpen(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.adapter.holdUntilAbort = true;
    host.adapter.approvalAsk = new ApprovalAsk("r1", ApprovalKind.Command, "exec", "run", null, [ConversationEngineTests.accept]);
    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Hold"));
    await host.until(() => host.approvals.list(new ConversationIdParams(conversation.id)).length === 1);
    const pendingApproval = host.approvals.list(new ConversationIdParams(conversation.id))[0]!;
    const engine = new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.accounts, host.teammates, host.registry, host.events);

    const interrupted = engine.reconcile();
    const reply = host.messages.find(result.replies[0]!.id);

    Assert.areEqual(1, interrupted.length);
    Assert.areEqual(MessageStatus.Interrupted, reply?.status);
    Assert.areEqual("The runtime stopped before this reply ended.", reply?.details[reply.details.length - 1]?.text);
    Assert.isFalse(Object.isNull(reply?.endedAt));
    Assert.isNotNull(reply!.startedAt);
    Assert.areEqual(ApprovalStatus.Cancelled, host.approvals.find(pendingApproval.id)?.status);
    Assert.isNull(host.messages.findOpenReply(conversation.id));
    Assert.areEqual(0, engine.reconcile().length);
    await host.engine.cancel(new MessageIdParams(result.replies[0]!.id));
    await host.engine.waitForIdle();
  }

  @TestMethod
  public async reportsFilesChangedInTheWorkingTreeBesidesTheProvidersOwn(): Promise<void> {
    using host = new CoreHost();
    const repository = new GitRepository(join(host.directory.path, "repo"));
    repository.write("base.txt", "one\n");
    repository.commit("base");
    const conversation = host.createConversation(host.openProject("repo"));
    const reportedPath = join(repository.path, "reported.txt");
    host.adapter.writeFiles = { "base.txt": "changed\n", "reported.txt": "by the provider\n", "nested/added.txt": "new\n" };
    host.adapter.extraDetails = [new TurnDetail(DetailKind.FileChange, "Edit: reported.txt", { files: [reportedPath], changes: [] }, null)];

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Change things"));
    await host.engine.waitForIdle();
    const reply = host.messages.find(result.replies[0]!.id);
    const tree = reply?.details.find(t => t.text.startsWith("Shared working-tree changes"));
    const payload = tree?.payload as { files: string[]; changes: { path: string; kind: string; diff: string | null }[]; source: string };

    Assert.areEqual(MessageStatus.Completed, reply?.status);
    Assert.areEqual("Shared working-tree changes (may include other conversations or tools): base.txt, nested\\added.txt", tree?.text.replaceAll("/", "\\"));
    Assert.areEqual("workingTree", payload.source);
    Assert.areEqual("add,update", payload.changes.map(t => t.kind).sort().join(","));
    Assert.isTrue(payload.changes.every(t => t.diff !== null));
    Assert.isTrue(payload.files.every(t => t.toLowerCase().startsWith(realpathSync.native(repository.path).toLowerCase())));
  }

  @TestMethod
  public async recognizesProviderPathsThroughADirectoryAliasIncludingDeletedFiles(): Promise<void> {
    using host = new CoreHost();
    const repository = new GitRepository(join(host.directory.path, "physical"));
    repository.write("base.txt", "before\n");
    repository.write("gone.txt", "remove me\n");
    repository.commit("base");
    const alias = join(host.directory.path, "alias");
    symlinkSync(repository.path, alias, "junction");
    const conversation = host.createConversation(host.openProject("alias"));
    host.adapter.writeFiles = { "base.txt": "changed\n", "reported.txt": "reported\n" };
    host.adapter.extraDetails = [new TurnDetail(DetailKind.FileChange, "Provider edits", {
      files: [join(alias, "reported.txt"), join(alias, "gone.txt"), join(alias, "absent", "unknown.txt")], changes: []
    }, null)];
    host.adapter.afterDetails = () => rmSync(join(repository.path, "gone.txt"));

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Change through an alias"));
    await host.engine.waitForIdle();
    const reply = host.messages.find(result.replies[0]!.id);
    Assert.areEqual(MessageStatus.Completed, reply?.status);
    const tree = reply?.details.find(t => t.text.startsWith("Shared working-tree changes"));
    Assert.areEqual("Shared working-tree changes (may include other conversations or tools): base.txt", tree?.text);
  }

  @TestMethod
  public async staysQuietWhenTheWorkingTreeDidNotChange(): Promise<void> {
    using host = new CoreHost();
    const repository = new GitRepository(join(host.directory.path, "repo"));
    repository.write("base.txt", "one\n");
    repository.commit("base");
    const conversation = host.createConversation(host.openProject("repo"));

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Nothing"));
    await host.engine.waitForIdle();
    const reply = host.messages.find(result.replies[0]!.id);

    Assert.isUndefined(reply?.details.find(t => t.kind === DetailKind.FileChange));
  }

  @TestMethod
  public async storesGeneratedImagesAsFiles(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
    host.adapter.extraDetails = [
      new TurnDetail(DetailKind.Note, "Generated image", { itemType: "imageGeneration", imageData: png, mediaType: "image/png", savedPath: null }, null),
      new TurnDetail(DetailKind.Note, "Unknown media", { imageData: png, mediaType: "image/tiff" }, null),
      new TurnDetail(DetailKind.Note, "No data", { imageData: null, mediaType: "image/png" }, null),
      new TurnDetail(DetailKind.Note, "Plain", "text", null)
    ];

    const result = await host.engine.send(ConversationEngineTests.params(conversation.id, "Draw"));
    await host.engine.waitForIdle();
    const reply = host.messages.find(result.replies[0]!.id);
    const stored = reply?.details[0]?.payload as { imageData: string | null; storedPath: string };

    Assert.isNull(stored.imageData);
    Assert.areEqual(join(host.directory.path, "images", `${result.replies[0]!.id}-0.png`).toLowerCase(), stored.storedPath.toLowerCase());
    Assert.areEqual(png, readFileSync(stored.storedPath).toString("base64"));
    Assert.areEqual(png, (reply?.details[1]?.payload as { imageData: string }).imageData);
    Assert.isNull((reply?.details[2]?.payload as { imageData: null }).imageData);
    Assert.areEqual("text", reply?.details[3]?.payload);
  }

  @TestMethod
  public async rewindsAConversationRestoringTheFilesAndStartingAFreshSession(): Promise<void> {
    using host = new CoreHost();
    const repository = new GitRepository(join(host.directory.path, "repo"));
    repository.write("base.txt", "one\n");
    repository.commit("base");
    const conversation = host.createConversation(host.openProject("repo"));
    host.adapter.writeFiles = { "base.txt": "changed\n", "new.txt": "x\n" };
    const first = await host.engine.send(ConversationEngineTests.params(conversation.id, "First"));
    await host.engine.waitForIdle();
    host.adapter.writeFiles = { "base.txt": "changed again\n" };
    const second = await host.engine.send(ConversationEngineTests.params(conversation.id, "Second"));
    await host.engine.waitForIdle();
    const tree = await WorkingTree.capture(repository.path);
    Assert.isTrue(await tree!.hasSnapshot(first.replies[0]!.id));
    Assert.isTrue(await tree!.hasSnapshot(second.replies[0]!.id));

    const result = await host.engine.rewind(new ConversationRewindParams(conversation.id, second.sent.id, true));
    host.adapter.writeFiles = {};
    const third = await host.engine.send(ConversationEngineTests.params(conversation.id, "Third"));
    await host.engine.waitForIdle();

    Assert.areEqual(`${second.sent.id},${second.replies[0]!.id}`, result.removedMessageIds.join(","));
    Assert.isTrue(result.conversation.sessionReset);
    Assert.areEqual(1, result.restoredFiles);
    Assert.areEqual("changed\n", readFileSync(join(repository.path, "base.txt"), "utf8"));
    Assert.areEqual("x\n", readFileSync(join(repository.path, "new.txt"), "utf8"));
    Assert.isTrue(await tree!.hasSnapshot(first.replies[0]!.id));
    Assert.isFalse(await tree!.hasSnapshot(second.replies[0]!.id));
    Assert.areEqual(1, host.listener.count(EventName.ConversationRewound));
    Assert.areEqual(2, ConversationRewoundPayload.fromJson(host.listener.events.find(t => t.name === EventName.ConversationRewound)?.payload).fromSequence);
    Assert.isNull(host.adapter.requests[2]?.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[2]?.prompt.startsWith("This conversation continues from an earlier session") ?? false);
    Assert.isTrue(host.adapter.requests[2]?.prompt.includes("User: First\n\nAssistant: Working\n\nNow the user says:\n\nThird") ?? false);
    Assert.areEqual("Third", third.sent.details[0]?.text);
    Assert.isFalse(host.conversations.find(conversation.id)?.sessionReset ?? true);
    const kept = host.messages.list(new MessageListParams(conversation.id, null)).filter(t => t.author === MessageAuthor.User);
    Assert.areEqual("First,Third", kept.map(t => t.details[0]?.text).join(","));
  }

  @TestMethod
  public async rewindsByForkingTheProvidersSessionWhenItCan(): Promise<void> {
    using host = new CoreHost(true);
    const conversation = host.createConversation();
    const first = await host.engine.send(ConversationEngineTests.params(conversation.id, "First"));
    await host.engine.waitForIdle();
    const second = await host.engine.send(ConversationEngineTests.params(conversation.id, "Second"));
    await host.engine.waitForIdle();
    await host.engine.send(ConversationEngineTests.params(conversation.id, "Third"));
    await host.engine.waitForIdle();
    Assert.areEqual("turn-1", host.messages.find(first.replies[0]!.id)?.provenance?.nativeTurnId);
    Assert.areEqual("session-1", host.messages.find(second.replies[0]!.id)?.provenance?.nativeSessionId);

    const result = await host.engine.rewind(new ConversationRewindParams(conversation.id, second.sent.id, false));
    const fourth = await host.engine.send(ConversationEngineTests.params(conversation.id, "Fourth"));
    await host.engine.waitForIdle();
    await host.engine.send(ConversationEngineTests.params(conversation.id, "Fifth"));
    await host.engine.waitForIdle();

    Assert.isTrue(result.sessionKept);
    Assert.isFalse(result.conversation.sessionReset);
    Assert.areEqual("fork-1", result.conversation.forkedSession?.nativeSessionId);
    Assert.areEqual("fake", result.conversation.forkedSession?.provider);
    Assert.isNull(result.conversation.forkedSession?.providerAccountId);
    Assert.areEqual(4, result.removedMessageIds.length);
    Assert.areEqual("session-1", host.adapter.forkRequests[0]?.nativeSessionId);
    Assert.areEqual("turn-1", host.adapter.forkRequests[0]?.lastTurnId);
    Assert.areEqual("fake", host.adapter.forkRequests[0]?.requested.provider);
    Assert.areEqual("Fourth", host.adapter.requests[3]?.prompt);
    Assert.areEqual("fork-1", host.adapter.requests[3]?.resumeNativeSessionId);
    Assert.isNull(host.conversations.find(conversation.id)?.forkedSession);
    Assert.areEqual("fork-1", host.messages.find(fourth.replies[0]!.id)?.provenance?.nativeSessionId);
    Assert.areEqual("fork-1", host.adapter.requests[4]?.resumeNativeSessionId);

    const whole = await host.engine.rewind(new ConversationRewindParams(conversation.id, first.sent.id, false));
    Assert.isFalse(whole.sessionKept);
    Assert.isTrue(whole.conversation.sessionReset);
    Assert.areEqual(1, host.adapter.forkRequests.length);
  }

  @TestMethod
  public async rewindsWithTheTranscriptWhenTheSessionCannotBeForked(): Promise<void> {
    using host = new CoreHost(true);
    const conversation = host.createConversation();
    const send = (text: string): Promise<MessageSendResult> => host.engine.send(ConversationEngineTests.params(conversation.id, text));
    const rewindTo = (messageId: string): Promise<ConversationRewindResult> =>
      host.engine.rewind(new ConversationRewindParams(conversation.id, messageId, false));

    await send("First");
    await host.engine.waitForIdle();
    const second = await send("Second");
    await host.engine.waitForIdle();
    host.adapter.forkFailure = new Error("no such thread");
    const refused = await rewindTo(second.sent.id);
    Assert.isFalse(refused.sessionKept);
    Assert.isTrue(refused.conversation.sessionReset);
    Assert.areEqual(1, host.adapter.forkRequests.length);
    host.adapter.forkFailure = null;

    host.adapter.reportsTurnIds = false;
    await send("Third");
    await host.engine.waitForIdle();
    host.adapter.reportsTurnIds = true;
    const fourth = await send("Fourth");
    await host.engine.waitForIdle();
    Assert.isFalse((await rewindTo(fourth.sent.id)).sessionKept);
    Assert.areEqual(1, host.adapter.forkRequests.length);

    const fifth = await send("Fifth");
    await host.engine.waitForIdle();
    const sixth = await send("Sixth");
    await host.engine.waitForIdle();
    Assert.areNotEqual(host.messages.find(fifth.replies[0]!.id)?.provenance?.nativeSessionId,
      host.messages.find(fourth.replies[0]!.id)?.provenance?.nativeSessionId);
    Assert.isTrue((await rewindTo(sixth.sent.id)).sessionKept);
    Assert.areEqual(2, host.adapter.forkRequests.length);

    const account = host.createAccount();
    const seventh = await host.engine.send(new MessageSendParams(conversation.id, "Seventh", new RequestedSettings("fake", null, null), account.id));
    await host.engine.waitForIdle();
    const eighth = await host.engine.send(new MessageSendParams(conversation.id, "Eighth", new RequestedSettings("fake", null, null), account.id));
    await host.engine.waitForIdle();
    Assert.areEqual(account.id, host.messages.find(seventh.replies[0]!.id)?.provenance?.providerAccountId);
    Assert.areEqual("fork-2", host.conversations.find(conversation.id)?.forkedSession?.nativeSessionId);
    Assert.areNotEqual("fork-2", host.messages.find(seventh.replies[0]!.id)?.provenance?.nativeSessionId);
    Assert.areEqual(host.messages.find(seventh.replies[0]!.id)?.provenance?.nativeSessionId,
      host.messages.find(eighth.replies[0]!.id)?.provenance?.nativeSessionId);
    host.accounts.delete(new ProviderAccountIdParams(account.id));
    Assert.isFalse((await rewindTo(eighth.sent.id)).sessionKept);
    Assert.areEqual(2, host.adapter.forkRequests.length);

    const ninth = await send("Ninth");
    await host.engine.waitForIdle();
    const foreign = host.messages.find(ninth.replies[0]!.id)!;
    const provenance = new Provenance(null, new RequestedSettings("gone", null, null), foreign.provenance!.observed, "s-gone", false, "t-gone");
    host.messages.update(foreign.withProvenance(provenance));
    const tenth = await send("Tenth");
    await host.engine.waitForIdle();
    Assert.isFalse((await rewindTo(tenth.sent.id)).sessionKept);
    Assert.areEqual(2, host.adapter.forkRequests.length);

    const eleventh = await send("Eleventh");
    await host.engine.waitForIdle();
    const other = host.createAccount("fake", "Other");
    const twelfth = await host.engine.send(new MessageSendParams(conversation.id, "Twelfth", new RequestedSettings("fake", null, null), other.id));
    await host.engine.waitForIdle();
    Assert.areNotEqual(host.messages.find(eleventh.replies[0]!.id)?.provenance?.nativeSessionId,
      host.messages.find(twelfth.replies[0]!.id)?.provenance?.nativeSessionId);
    Assert.isFalse((await rewindTo(twelfth.sent.id)).sessionKept);
    Assert.areEqual(2, host.adapter.forkRequests.length);
  }

  @TestMethod
  public async rewindsWithoutFilesOutsideGitAndWithoutAPreambleWhenNothingIsLeft(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.adapter.detailTexts = [];
    const first = await host.engine.send(ConversationEngineTests.params(conversation.id, "x".repeat(30_000)));
    await host.engine.waitForIdle();
    host.adapter.detailTexts = ["Working"];
    const second = await host.engine.send(ConversationEngineTests.params(conversation.id, "Second"));
    await host.engine.waitForIdle();

    const partial = await host.engine.rewind(new ConversationRewindParams(conversation.id, second.sent.id, true));
    const third = await host.engine.send(ConversationEngineTests.params(conversation.id, "Third"));
    await host.engine.waitForIdle();
    const whole = await host.engine.rewind(new ConversationRewindParams(conversation.id, first.sent.id, false));
    const fourth = await host.engine.send(ConversationEngineTests.params(conversation.id, "Fourth"));
    await host.engine.waitForIdle();
    await host.engine.send(ConversationEngineTests.params(conversation.id, "Fifth"));
    await host.engine.waitForIdle();

    Assert.isNull(partial.restoredFiles);
    Assert.areEqual(2, partial.removedMessageIds.length);
    Assert.isTrue(host.adapter.requests[2]?.prompt.includes("Earlier messages were omitted") ?? false);
    Assert.isTrue((host.adapter.requests[2]?.prompt.length ?? 0) < 25_000);
    Assert.areEqual(4, whole.removedMessageIds.length);
    Assert.areEqual("Fourth", host.adapter.requests[3]?.prompt);
    Assert.isNull(host.adapter.requests[3]?.resumeNativeSessionId);
    Assert.areEqual(host.messages.find(fourth.replies[0]!.id)?.provenance?.nativeSessionId, host.adapter.requests[4]?.resumeNativeSessionId);
    const left = host.messages.list(new MessageListParams(conversation.id, null)).filter(t => t.author === MessageAuthor.User);
    Assert.areEqual("Fourth,Fifth", left.map(t => t.details[0]?.text).join(","));
    Assert.isFalse(Object.isNull(third.replies[0]!.id));
  }

  @TestMethod
  public async rejectsRewindsOfUnknownOrForeignMessagesAndOpenReplies(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const other = host.createConversation(host.openProject("beta"));
    const sent = await host.engine.send(ConversationEngineTests.params(other.id, "Elsewhere"));
    await host.engine.waitForIdle();
    const rewind = (conversationId: string, messageId: string): Promise<unknown> =>
      host.engine.rewind(new ConversationRewindParams(conversationId, messageId, false));

    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => rewind("nope", sent.sent.id), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => rewind(conversation.id, "nope"), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => rewind(conversation.id, sent.sent.id), ServiceException)).info.name);
    host.context.database.connection.execute(new SqlQuery("PRAGMA foreign_keys = OFF"));
    host.context.database.connection.execute(new SqlQuery("DELETE FROM projects WHERE id = ?", [other.projectId]));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => rewind(other.id, sent.sent.id), ServiceException)).info.name);
    host.adapter.holdUntilAbort = true;
    const held = await host.engine.send(ConversationEngineTests.params(conversation.id, "Hold"));
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => rewind(conversation.id, held.sent.id), ServiceException)).info.name);
    await host.engine.cancel(new MessageIdParams(held.replies[0]!.id));
    await host.engine.waitForIdle();
  }

  private static params(conversationId: string, text: string): MessageSendParams {
    return new MessageSendParams(conversationId, text, new RequestedSettings("fake", null, null), null);
  }

  private static list(conversationId: string): MessageListParams {
    return new MessageListParams(conversationId, null);
  }

  private static async rejection(promise: Promise<unknown>): Promise<ServiceException> {
    try {
      await promise;
    }
    catch (error) {
      if (error instanceof ServiceException)
        return error;
      throw error;
    }
    throw new Error("The promise did not reject.");
  }
}
