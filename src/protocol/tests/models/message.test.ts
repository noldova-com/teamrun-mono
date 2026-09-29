/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetailKind, Message, MessageAuthor, MessageDetail, MessageStatus, ObservedSettings, Provenance, RequestedSettings } from "@noldova/teamrun-protocol";
import { TeammateMention } from "@noldova/teamrun-protocol";

@TestClass
export class MessageTests {
  @TestMethod
  public retainsHistoricalAuthorsAndResolvedMentionsAcrossCopies(): void {
    const mentions = [new TeammateMention("alice", "Alice")];
    const user = new Message("u", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t", [], null, null, mentions);
    mentions.push(new TeammateMention("bob", "Bob"));
    Assert.areEqual(1, user.mentions.length);
    const restored = Message.fromJson(user.toJson());
    Assert.areEqual("Alice", restored.mentions[0]?.name);
    const reply = new Message("r", "c", 1, MessageAuthor.Provider, "u", MessageStatus.Pending, [], MessageTests.provenance,
      "t", null, null, [], "alice", "Alice");
    for (const copy of [reply.withStatus(MessageStatus.Completed, "end"), reply.withDetails([]), reply.withDetail(MessageTests.text),
      reply.withProvenance(MessageTests.provenance), Message.fromJson(reply.toJson())]) {
      Assert.areEqual("alice", copy.teammateId);
      Assert.areEqual("Alice", copy.teammateName);
    }
    Assert.isNull(Message.fromJson(MessageTests.json).teammateId);
    Assert.isNull(Message.fromJson({ ...user.toJson(), teammateId: null, teammateName: null }).teammateName);
    Assert.throws(() => Message.fromJson({ ...user.toJson(), mentions: "Alice" }), JsonException);
    Assert.throws(() => Message.fromJson({ ...user.toJson(), teammateId: "alice", teammateName: "Alice" }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), teammateName: null }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), teammateId: null }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), teammateId: " " }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), teammateName: " " }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), mentions: user.mentions.map(t => t.toJson()) }), ArgumentException);
  }

  @TestMethod
  public replacesItsDetails(): void {
    const original = new Message("msg-1", "conv-1", 2, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, "Hi", null, "t1")], null, "t1", null, "t1");

    const replaced = original.withDetails([]);

    Assert.areEqual(1, original.details.length);
    Assert.areEqual(0, replaced.details.length);
    Assert.areEqual(original.id, replaced.id);
    Assert.areEqual(original.sequence, replaced.sequence);
  }

  private static readonly text: MessageDetail = new MessageDetail(0, DetailKind.Text, "Add login", null, "t");
  private static readonly provenance: Provenance =
    new Provenance(null, new RequestedSettings("codex", null, null), new ObservedSettings(null, null, null, null, null), null, false);
  private static readonly json: object = {
    id: "msg-2",
    conversationId: "conv-1",
    sequence: 1,
    author: "Provider",
    inReplyTo: "msg-1",
    status: "Completed",
    details: [{ sequence: 0, kind: "Reasoning", text: "Looking at the login page.", payload: null, createdAt: "2026-09-08T09:00:02Z" },
      { sequence: 1, kind: "Command", text: "npm test", payload: { exitCode: 0 }, createdAt: "2026-09-08T09:00:05Z" }],
    provenance: {
      providerAccountId: "acc-1",
      requested: { provider: "codex", model: null, effort: null },
      observed: { provider: "codex", model: "gpt-5-codex", effort: "medium", harnessVersion: "0.50.0", identity: null },
      nativeSessionId: "thread-9",
      resumedNativeSession: false,
      nativeTurnId: null
    },
    createdAt: "2026-09-08T09:00:01Z",
    startedAt: "2026-09-08T09:00:02Z",
    endedAt: "2026-09-08T09:00:09Z"
  };

  @TestMethod
  public holdsTheUsersMessage(): void {
    const message = new Message("msg-1", "conv-1", 0, MessageAuthor.User, null, MessageStatus.Completed, [MessageTests.text], null, "t", null, "t");

    Assert.areEqual(MessageAuthor.User, message.author);
    Assert.isNull(message.inReplyTo);
    Assert.isNull(message.provenance);
    Assert.areEqual("Add login", message.details[0]?.text);
    Assert.isNull(message.toJson()["provenance"]);
  }

  @TestMethod
  public holdsAProvidersPendingReply(): void {
    const message = MessageTests.createReply(MessageStatus.Pending, [], MessageTests.provenance, null);

    Assert.areEqual("msg-1", message.inReplyTo);
    Assert.areEqual(0, message.details.length);
    Assert.areEqual("codex", message.provenance?.requested.provider);
    Assert.isNull(message.endedAt);
  }

  @TestMethod
  public keepsItsOwnCopyOfTheDetails(): void {
    const details = [MessageTests.text];
    const message = new Message("msg-1", "conv-1", 0, MessageAuthor.User, null, MessageStatus.Completed, details, null, "t", null, "t");
    details.push(MessageTests.text);

    Assert.areEqual(1, message.details.length);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    const create = (id: string, conversationId: string, inReplyTo: string | null, createdAt: string): Message =>
      new Message(id, conversationId, 0, MessageAuthor.User, inReplyTo, MessageStatus.Completed, [], null, createdAt, null, createdAt);

    Assert.throws(() => create(String.empty, "conv", null, "t"), ArgumentException);
    Assert.throws(() => create("msg", String.empty, null, "t"), ArgumentException);
    Assert.throws(() => create("msg", "conv", " ", "t"), ArgumentException);
    Assert.throws(() => create("msg", "conv", null, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsNegativeOrFractionalSequences(): void {
    Assert.throws(() => new Message("msg", "conv", -1, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t"), ArgumentOutOfRangeException);
    Assert.throws(() => new Message("msg", "conv", 1.5, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t"), ArgumentOutOfRangeException);
  }

  @TestMethod
  public tiesTheProvenanceToTheAuthor(): void {
    const missing = Assert.throws(() => MessageTests.createReply(MessageStatus.Completed, [], null, "t2"), ArgumentException);

    Assert.areEqual("provenance", missing.parameterName);
    Assert.throws(
      () => new Message("msg", "conv", 0, MessageAuthor.TeamRun, null, MessageStatus.Completed, [], MessageTests.provenance, "t", null, "t"), ArgumentException);
  }

  @TestMethod
  public tiesTheEndTimeToTheStatus(): void {
    const openWithEnd = Assert.throws(() => MessageTests.createReply(MessageStatus.Running, [], MessageTests.provenance, "t2"), ArgumentException);

    Assert.areEqual("endedAt", openWithEnd.parameterName);
    Assert.throws(() => MessageTests.createReply(MessageStatus.AwaitingApproval, [], MessageTests.provenance, "t2"), ArgumentException);
    Assert.throws(() => MessageTests.createReply(MessageStatus.Failed, [], MessageTests.provenance, null), ArgumentException);
    Assert.doesNotThrow(() => MessageTests.createReply(MessageStatus.Interrupted, [], MessageTests.provenance, "t2"));
  }

  @TestMethod
  public tiesTheStartTimeToARunningReply(): void {
    const reply = (status: MessageStatus, startedAt: string | null, endedAt: string | null): Message =>
      new Message("r", "c", 1, MessageAuthor.Provider, "u", status, [], MessageTests.provenance, "t", startedAt, endedAt);

    const waitingWithStart = Assert.throws(() => reply(MessageStatus.Pending, "t1", null), ArgumentException);
    const runningWithoutStart = Assert.throws(() => reply(MessageStatus.Running, null, null), ArgumentException);

    Assert.areEqual("startedAt", waitingWithStart.parameterName);
    Assert.areEqual("startedAt", runningWithoutStart.parameterName);
    Assert.throws(() => reply(MessageStatus.AwaitingApproval, null, null), ArgumentException);
    Assert.throws(() => reply(MessageStatus.Running, " ", null), ArgumentException);
    Assert.throws(() => new Message("u", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", "t", "t"), ArgumentException);
    Assert.isNull(reply(MessageStatus.Cancelled, null, "t2").startedAt);
    Assert.areEqual("t1", reply(MessageStatus.AwaitingApproval, "t1", null).startedAt);
  }

  @TestMethod
  public readsRepliesStoredBeforeStartTimesFromTheirCreation(): void {
    const stored = Object.fromEntries(Object.entries(MessageTests.json).filter(([key]) => key !== "startedAt"));

    Assert.areEqual("2026-09-08T09:00:01Z", Message.fromJson(stored).startedAt);
    Assert.areEqual("2026-09-08T09:00:01Z", Message.fromJson({ ...stored, status: "Running", endedAt: null }).startedAt);
    Assert.isNull(Message.fromJson({ ...stored, status: "Pending", endedAt: null }).startedAt);
    Assert.isNull(Message.fromJson({ ...stored, author: "User", inReplyTo: null, provenance: null }).startedAt);
    Assert.isNull(Message.fromJson({ ...MessageTests.json, status: "Cancelled", startedAt: null }).startedAt);
    Assert.areEqual("2026-09-08T09:00:01Z", Message.fromJson(stored).toJson()["startedAt"]);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const message = Message.fromJson(MessageTests.json);

    Assert.areEqual("msg-2", message.id);
    Assert.areEqual(MessageAuthor.Provider, message.author);
    Assert.areEqual(MessageStatus.Completed, message.status);
    Assert.areEqual(DetailKind.Command, message.details[1]?.kind);
    Assert.areEqual("thread-9", message.provenance?.nativeSessionId);
    Assert.areEqual("gpt-5-codex", message.provenance?.observed.model);
    Assert.areEqual(JSON.stringify(MessageTests.json), JSON.stringify(message.toJson()));
  }

  @TestMethod
  public readsAMessageWithoutProvenance(): void {
    const json = { ...MessageTests.json, author: "TeamRun", provenance: null, startedAt: null };
    const message = Message.fromJson(json);

    Assert.areEqual(MessageAuthor.TeamRun, message.author);
    Assert.isNull(message.provenance);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(message.toJson()));
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const badAuthor = Assert.throws(() => Message.fromJson({ ...MessageTests.json, author: "bot" }), JsonException);
    const badStatus = Assert.throws(() => Message.fromJson({ ...MessageTests.json, status: "done" }), JsonException);
    const image = { sequence: 0, kind: "image", text: String.empty, payload: null, createdAt: "t" };
    const badDetail = Assert.throws(() => Message.fromJson({ ...MessageTests.json, details: [image] }), JsonException);
    const badProvenance = Assert.throws(() => Message.fromJson({ ...MessageTests.json, provenance: { providerAccountId: null } }), JsonException);

    Assert.areEqual("$.author", badAuthor.path);
    Assert.areEqual("$.status", badStatus.path);
    Assert.areEqual("$.details.0.kind", badDetail.path);
    Assert.areEqual("$.provenance.requested", badProvenance.path);
  }

  private static createReply(status: MessageStatus, details: readonly MessageDetail[], provenance: Provenance | null, endedAt: string | null): Message {
    return new Message("msg-2", "conv-1", 1, MessageAuthor.Provider, "msg-1", status, details, provenance, "t", status === MessageStatus.Pending ? null : "t",
      endedAt);
  }

  @TestMethod
  public producesUpdatedCopies(): void {
    const reply = MessageTests.createReply(MessageStatus.Pending, [], MessageTests.provenance, null);
    const detail = new MessageDetail(0, DetailKind.Reasoning, "Thinking", null, "t");
    const observed = new ObservedSettings("codex", "gpt-5-codex", "medium", "0.50.0", null);

    const running = reply.withStart("t1");
    const detailed = running.withDetail(detail);
    const traced = detailed.withProvenance(MessageTests.provenance.withObserved(observed));
    const ended = traced.withStatus(MessageStatus.Completed, "t2");

    Assert.areEqual(MessageStatus.Pending, reply.status);
    Assert.isNull(reply.startedAt);
    Assert.areEqual(0, reply.details.length);
    Assert.areEqual(MessageStatus.Running, running.status);
    Assert.areEqual("t1", running.startedAt);
    Assert.isNull(running.endedAt);
    Assert.areEqual("Thinking", detailed.details[0]?.text);
    Assert.areEqual("gpt-5-codex", traced.provenance?.observed.model);
    Assert.areEqual("t1", ended.startedAt);
    Assert.areEqual("t2", ended.endedAt);
    Assert.areEqual(reply.id, ended.id);
    Assert.throws(() => reply.withStatus(MessageStatus.Completed, null), ArgumentException);
    Assert.throws(() => reply.withStatus(MessageStatus.Running, null), ArgumentException);
  }
}
