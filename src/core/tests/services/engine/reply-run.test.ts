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
import { Message, MessageAuthor, MessageStatus, Provenance } from "@noldova/teamrun-protocol";
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
      [], provenance, "t", null, [], "alice", "Alice");
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
    const { execFileSync } = await import("node:child_process");
    const entries = Array.from({ length: Resources.maximumSnapshotFiles + 1 }, (_, i) => `100644 ${hash}\tfile-${i}.txt`).join("\n");
    execFileSync("git", ["update-index", "--index-info"], { cwd: project.rootPath, input: entries + "\n", windowsHide: true });
    const conversation = host.createConversation(project);
    await host.engine.send(new MessageSendParams(conversation.id, "hello", new RequestedSettings("fake", null, null), null));
    await host.engine.waitForIdle();
    const reply = host.messages.list(new MessageListParams(conversation.id, null)).at(-1);
    const note = reply?.details.find(t => t.text === Resources.incompleteWorkingTreeEvidence);
    Assert.areEqual(JSON.stringify({ source: Resources.workingTreeSource }), JSON.stringify(note?.payload));
  }
}
