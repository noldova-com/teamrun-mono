/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalAsk, Resources, TurnDetail, TurnStart } from "@noldova/teamrun-core";
import { ActiveRun, ReplyRun, TurnRequest } from "@noldova/teamrun-core";
import { EventName, Message, MessageAuthor, MessageIdParams, MessageStatus, Provenance } from "@noldova/teamrun-protocol";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, DetailKind, MessageListParams, MessageSendParams, ObservedSettings, RequestedSettings } from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { GitRepository } from "../../fixtures/git-repository.fixture.js";

@TestClass
export class ReplyRunTests {
  @TestMethod
  public async preservesNamedAuthorshipWhenReplacingStreamedDetails(): Promise<void> {
    using host = new CoreHost();
    const project = host.openProject();
    const conversation = host.createConversation(project);
    const requested = new RequestedSettings("fake", null, null);
    const provenance = new Provenance(null, requested, new ObservedSettings(null, null, null, null, null), null, false);
    const reply = new Message("named-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending,
      [], provenance, "t", null, null, [], "alice", "Alice");
    host.messages.insert(reply);
    host.adapter.streamedTexts = ["part", "complete"];
    const run = new ReplyRun(reply, provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path);
    await run.execute(host.adapter, new TurnRequest(null, project.rootPath, "fixture", requested, null));
    const saved = host.messages.find(reply.id);
    Assert.areEqual(MessageStatus.Completed, saved?.status);
    Assert.areEqual("alice", saved?.teammateId);
    Assert.areEqual("Alice", saved?.teammateName);
    Assert.isTrue(saved?.details.some(t => t.text === "complete") ?? false);
    Assert.isFalse(saved?.details.some(t => t.text === "part") ?? true);
  }

  @TestMethod
  public async announcesThinkingUntilThinkingTextOrAnotherDetailAndStoresNothing(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.adapter.thinkingBeforeDetails = 3;
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Reasoning, "Planning", null, null)];
    host.adapter.thinkingAfterDetails = 2;
    const sent = await host.engine.send(new MessageSendParams(conversation.id, "hello", new RequestedSettings("fake", null, null), null));
    await host.engine.waitForIdle();
    const replyId = sent.replies[0]!.id;
    const names = host.listener.names().filter(t => t === EventName.ReplyThinking || t === EventName.DetailAppended);
    Assert.areEqual([EventName.ReplyThinking, EventName.DetailAppended, EventName.DetailAppended, EventName.ReplyThinking].join(","), names.join(","));
    const payloads = host.listener.events.filter(t => t.name === EventName.ReplyThinking).map(t => MessageIdParams.fromJson(t.payload).messageId);
    Assert.areEqual([replyId, replyId].join(","), payloads.join(","));
    const before = JSON.stringify(host.messages.find(replyId)?.toJson());
    host.adapter.lastListener?.onThinking();
    Assert.areEqual(2, host.listener.count(EventName.ReplyThinking));
    Assert.areEqual(before, JSON.stringify(host.messages.find(replyId)?.toJson()));
  }

  @TestMethod
  public async ignoresCallbacksAfterCompletion(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const sent = await host.engine.send(new MessageSendParams(conversation.id, "hello", new RequestedSettings("fake", null, null), null));
    await host.engine.waitForIdle();
    const before = JSON.stringify(host.messages.find(sent.replies[0]!.id)?.toJson());
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    listener.onStarted(new TurnStart("late", false));
    listener.onObserved(new ObservedSettings("fake", "late", null, null, null));
    listener.onDetail(new TurnDetail(DetailKind.Text, "late", null, null));
    const ask = new ApprovalAsk("late", ApprovalKind.Command, "command", "late", null, [new ApprovalOption("yes", "Allow", ApprovalOutcome.Approved)]);
    await Assert.throwsAsync(() => listener.onApprovalRequested(ask), ServiceException);
    Assert.areEqual(before, JSON.stringify(host.messages.find(sent.replies[0]!.id)?.toJson()));
  }

  @TestMethod
  public async labelsWorkingTreeEvidenceWhenTheSnapshotCapIsExceeded(): Promise<void> {
    using host = new CoreHost();
    const project = host.openProject();
    const repository = new GitRepository(project.rootPath);
    repository.write("one.txt", "one\n");
    repository.commit();
    const hash = repository.git("rev-parse", "HEAD:one.txt").trim();
    const entries = Array.from({ length: Resources.maximumSnapshotFiles + 1 }, (_, i) => `100644 ${hash}\tfile-${i}.txt`).join("\n");
    repository.gitWithInput(`${entries}\n`, "update-index", "--index-info");
    const conversation = host.createConversation(project);
    await host.engine.send(new MessageSendParams(conversation.id, "hello", new RequestedSettings("fake", null, null), null));
    await host.engine.waitForIdle();
    const reply = host.messages.list(new MessageListParams(conversation.id, null)).at(-1);
    const note = reply?.details.find(t => t.text === Resources.incompleteWorkingTreeEvidence);
    Assert.areEqual(JSON.stringify({ source: Resources.workingTreeSource }), JSON.stringify(note?.payload));
  }
}
