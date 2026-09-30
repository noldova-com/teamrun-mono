/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import {
  Approval,
  ApprovalStatus,
  AuthStatus,
  Conversation,
  ConversationRewindResult,
  ConversationRewoundPayload,
  ConversationSearchHit,
  ConversationSearchResult,
  DetailEventPayload,
  DetailKind,
  ErrorCode,
  Event,
  EventName,
  Message,
  MessageAuthor,
  MessageIdParams,
  MessagePage,
  MessageSendResult,
  MessageStatus,
  MethodName,
  ProviderAccount
} from "@noldova/teamrun-protocol";

import type { FakeTeamRunBridge } from "../../fixtures/fake-teamrun-bridge";
import { DeferredResponse } from "../../fixtures/deferred-response";
import { SampleData } from "../../fixtures/sample-data";
import { TeammateFixture } from "../../fixtures/teammate-fixture";
import { TeammateUpdateParams, ConversationMember } from "@noldova/teamrun-protocol";
import { AccessMode } from "../../../src/app/enums/access-mode";
import { ComposerSettings } from "../../../src/app/models/composer-settings";
import { ReadingPosition } from "../../../src/app/models/reading-position";
import { Resources } from "../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";
import { PreferencesService } from "../../../src/app/services/preferences.service";

describe("ChatStore", () => {
  let bridge: FakeTeamRunBridge;
  let store: ChatStore;

  beforeEach(() => {
    bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    store = TestBed.inject(ChatStore);
  });

  afterEach(() => store.dispose());

  it("loads and refreshes teammates and selected membership, with teammate-scoped mutation errors", async () => {
    const data = new TeammateFixture();
    for (const [method, handler] of data.bridge.handlers)
      bridge.answer(method, handler);
    await store.initialize();
    expect(store.teammates()).toHaveLength(3);
    expect(bridge.methods).not.toContain(MethodName.ConversationListMembers);
    await store.selectConversation("c1");
    expect(store.membersOf("c1").map(t => t.teammateId)).toEqual(["alice"]);
    expect(store.isTeammateUnavailable("offline")).toBe(true);
    expect(store.isTeammateUnavailable("alice")).toBe(false);
    await store.addMember("c1", "bob");
    expect(store.membersOf("c1")).toHaveLength(2);
    const alice = data.alice;
    await store.saveTeammate(new TeammateUpdateParams(alice.id, "Renamed", null, alice.providerAccountId, alice.harness, null, null));
    expect(store.teammate("alice")?.name).toBe("Renamed");
    bridge.fail(MethodName.TeammateDelete, ErrorCode.Conflict, "Reply in progress");
    expect(await store.deleteTeammate(data.alice)).toBe(false);
    expect(store.error()).toContain("@Alice:");
    expect(store.teammate("alice")).not.toBeNull();
    data.members = [new ConversationMember("c1", "bob", "t", null, false)];
    bridge.emit(new Event(EventName.StateInvalidated, null));
    await vi.waitFor(() => expect(store.membersOf("c1").map(t => t.teammateId)).toEqual(["bob"]));
  });

  it("reloads the selected conversation's members after a send whose mentions can add teammates", async () => {
    const data = new TeammateFixture();
    for (const [method, handler] of data.bridge.handlers)
      bridge.answer(method, handler);
    bridge.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    const settings = new ComposerSettings("codex", null, null, null);
    const listed = (): number => bridge.methods.filter(t => t === MethodName.ConversationListMembers).length;
    const before = listed();
    expect(await store.send("No mention", settings, "c1")).toBe(true);
    expect(listed()).toBe(before);
    data.members.push(new ConversationMember("c1", "bob", "t", null, false));
    expect(await store.send("@Bob, have a look", settings, "c1", [], ["bob"])).toBe(true);
    expect(listed()).toBe(before + 1);
    expect(store.membersOf("c1").map(t => t.teammateId)).toEqual(["alice", "bob"]);
    bridge.fail(MethodName.ConversationListMembers, ErrorCode.Unavailable, "Disconnected");
    expect(await store.send("@Alice, and you", settings, "c1", [], ["alice"])).toBe(true);
    expect(store.error()).toBe("Disconnected");
  });

  it("keeps a conversation busy across queued replies and follows their terminal updates", async () => {
    const first = SampleData.withStatus(SampleData.reply, MessageStatus.Pending);
    const second = new Message("second", "c1", 3, MessageAuthor.Provider, SampleData.userMessage.id,
      MessageStatus.Pending, [], first.provenance, SampleData.timestamp, null, null, [], "bob", "Bob");
    bridge.answer(MethodName.MessageListOpen, () => [first.toJson(), second.toJson()]);
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.runningReply()?.id).toBe(first.id);
    store.apply(new Event(EventName.MessageUpdated, SampleData.withStatus(first, MessageStatus.Completed).toJson()));
    expect(store.isWorking("c1")).toBe(true);
    expect(store.runningReply()?.id).toBe(second.id);
    store.apply(new Event(EventName.MessageUpdated, SampleData.withStatus(second, MessageStatus.Running).toJson()));
    expect(store.runningReply()?.status).toBe(MessageStatus.Running);
    store.apply(new Event(EventName.MessageUpdated, SampleData.withStatus(second, MessageStatus.Cancelled).toJson()));
    expect(store.isWorking("c1")).toBe(false);
    bridge.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    expect(await store.send("@Bob unavailable", new ComposerSettings("codex", null, null, null), "c1", [], ["bob"])).toBe(true);
    expect(store.runningReply()).toBeNull();
    const request = bridge.requests.find(t => t.method === MethodName.MessageSend)?.payload;
    expect(request).toMatchObject({ requested: null, mentionedTeammateIds: ["bob"] });
  });

  it("preserves the message window during local and peer catalog changes", async () => {
    const older = SampleData.userMessage;
    const newest = new Message("newest", "c1", 100, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
    bridge.answer(MethodName.MessagePage, payload => (payload as { beforeSequence: number | null }).beforeSequence === null
      ? new MessagePage([newest], true, false).toJson() : new MessagePage([older], false, true).toJson());
    bridge.answer(MethodName.MessageList, () => [older.toJson(), newest.toJson()]);
    await store.initialize();
    await store.selectConversation("c1");
    await store.loadEarlierMessages();
    await vi.waitFor(() => expect(store.isBusy()).toBe(false));
    const window = store.messages();
    const pages = bridge.methods.filter(t => t === MethodName.MessagePage).length;
    const digests = bridge.methods.filter(t => t === MethodName.MessageList).length;
    const renamed = new Conversation("c1", "p1", "Renamed", SampleData.timestamp, SampleData.timestamp);
    bridge.answer(MethodName.ConversationList, () => [renamed.toJson()]);
    bridge.answer(MethodName.ConversationRename, () => {
      bridge.emit(new Event(EventName.StateInvalidated, null));
      return renamed.toJson();
    });
    await store.renameConversation("c1", "Renamed");
    await vi.waitFor(() => expect(store.isBusy()).toBe(false));
    const peer = new Conversation("peer", "p1", "Created elsewhere", SampleData.timestamp, SampleData.timestamp);
    bridge.answer(MethodName.ConversationList, () => [renamed.toJson(), peer.toJson()]);
    bridge.emit(new Event(EventName.StateInvalidated, null));
    await vi.waitFor(() => expect(store.isBusy()).toBe(false));
    expect(store.hasConversation("peer")).toBe(true);
    expect(store.selectedConversation()?.title).toBe("Renamed");
    expect(store.messages()).toBe(window);
    expect(bridge.methods.filter(t => t === MethodName.MessagePage)).toHaveLength(pages);
    expect(bridge.methods.filter(t => t === MethodName.MessageList)).toHaveLength(digests);
  });

  it("resyncs missed message events once after coalesced reconnect notifications", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    await vi.waitFor(() => expect(store.isBusy()).toBe(false));
    const accounts = new DeferredResponse();
    bridge.answer(MethodName.ProviderAccountList, () => accounts.promise);
    bridge.answer(MethodName.MessagePage, () => new MessagePage([SampleData.withStatus(SampleData.reply, MessageStatus.Completed)], false, false).toJson());
    const pages = bridge.methods.filter(t => t === MethodName.MessagePage).length;
    bridge.emit(new Event(EventName.StateInvalidated, null));
    bridge.emit(new Event(EventName.StateResyncRequested, null));
    bridge.emit(new Event(EventName.StateResyncRequested, null));
    accounts.resolve([SampleData.account.toJson()]);
    await vi.waitFor(() => expect(store.isBusy()).toBe(false));
    expect(store.messages()[0]?.status).toBe(MessageStatus.Completed);
    expect(store.runningReply()).toBeNull();
    expect(bridge.methods.filter(t => t === MethodName.MessagePage)).toHaveLength(pages + 1);
  });

  it("keeps the latest selection when earlier page requests finish late", async () => {
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    bridge.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    await store.initialize();
    const delayed = new DeferredResponse();
    bridge.answer(MethodName.MessagePage, payload => (payload as { conversationId: string }).conversationId === "c2"
      ? delayed.promise : new MessagePage([SampleData.userMessage], false, false).toJson());
    const earlier = store.selectConversation("c2");
    await store.selectConversation("c1");
    delayed.resolve(new MessagePage([], false, false).toJson());
    await earlier;
    expect(store.selectedConversationId()).toBe("c1");
    expect(store.messages().map(t => t.id)).toEqual(["m1"]);

    const abandoned = new DeferredResponse();
    bridge.answer(MethodName.MessagePage, () => abandoned.promise);
    const selecting = store.selectConversation("c2");
    store.deselectConversation();
    abandoned.resolve(new MessagePage([], false, false).toJson());
    await selecting;
    expect(store.selectedConversationId()).toBeNull();
  });

  it("replays stream events over a page snapshot and over the send response", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    const delayed = new DeferredResponse();
    bridge.answer(MethodName.MessagePage, () => delayed.promise);
    const loading = store.loadNewestMessages();
    bridge.emit(new Event(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson()));
    bridge.emit(new Event(EventName.DetailUpdated, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Text, "latest")).toJson()));
    delayed.resolve(new MessagePage([SampleData.reply], false, false).toJson());
    await loading;
    expect(store.messages()[0]?.status).toBe(MessageStatus.Completed);
    expect(store.messages()[0]?.details[0]?.text).toBe("latest");
    expect(store.runningReply()).toBeNull();

    bridge.answer(MethodName.MessageSend, () => {
      bridge.emit(new Event(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson()));
      return new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson();
    });
    expect(await store.send("hi", new ComposerSettings("codex", null, null, null))).toBe(true);
    expect(store.runningReply()).toBeNull();
    expect(store.messages().find(t => t.id === "m2")?.status).toBe(MessageStatus.Completed);
  });

  it("refreshes peer metadata and restores work and approvals outside the selected page", async () => {
    bridge.answer(MethodName.MessageList, () => [SampleData.userMessage.toJson()]);
    bridge.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    bridge.answer(MethodName.ApprovalListPending, () => [SampleData.approval.toJson()]);
    bridge.answer(MethodName.ApprovalList, () => []);
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.runningReply()?.id).toBe("m2");
    expect(store.pendingApprovals().map(t => t.id)).toEqual(["ap1"]);
    const renamed = new Conversation("c1", "p1", "Renamed by CLI", SampleData.timestamp, SampleData.timestamp);
    bridge.answer(MethodName.ConversationList, () => [renamed.toJson()]);
    bridge.emit(new Event(EventName.StateInvalidated, null));
    await vi.waitFor(() => expect(store.selectedConversation()?.title).toBe("Renamed by CLI"));
    bridge.answer(MethodName.ApprovalDecide, () => SampleData.approval.withDecision("yes", SampleData.timestamp).toJson());
    store.deselectConversation();
    TestBed.inject(PreferencesService).setAccessMode(AccessMode.Full);
    TestBed.tick();
    await vi.waitFor(() => expect(store.pendingApprovals()).toEqual([]));
    expect(bridge.requests.find(t => t.method === MethodName.ApprovalDecide)?.payload).toEqual({ approvalId: "ap1", optionId: "yes" });
  });

  it("marks a running reply as thinking until its next detail or its end, and ignores replies that are not running", async () => {
    bridge.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    await store.initialize();
    const thinking = (messageId: string): Event => new Event(EventName.ReplyThinking, new MessageIdParams(messageId).toJson());

    bridge.emit(thinking("unknown"));
    bridge.emit(thinking("m2"));
    expect([...store.thinkingReplies()]).toEqual(["m2"]);
    bridge.emit(new Event(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Reasoning, "Planning")).toJson()));
    expect([...store.thinkingReplies()]).toEqual([]);
    bridge.emit(thinking("m2"));
    bridge.emit(new Event(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson()));
    expect([...store.thinkingReplies()]).toEqual([]);
    bridge.emit(thinking("m2"));
    expect([...store.thinkingReplies()]).toEqual([]);
  });

  it("loads the catalog and selects a project without opening a conversation", async () => {
    bridge.answer(MethodName.ApprovalListPending, () => [SampleData.approval.toJson()]);
    bridge.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()]);
    expect(store.loaded()).toBe(false);
    await store.initialize();
    expect(store.loaded()).toBe(true);

    expect(store.providers().map(t => t.id)).toEqual(["codex", "claude"]);
    expect(store.accounts().map(t => t.id)).toEqual(["a1"]);
    expect(store.selectedProject()?.id).toBe("p1");
    expect(store.selectedConversationId()).toBeNull();
    expect(store.messages()).toEqual([]);
    expect(store.pendingApprovals().map(t => t.id)).toEqual(["ap1"]);
    expect(store.runningReply()).toBeNull();
    expect(store.isWorking("c1")).toBe(true);
    expect(bridge.methods).not.toContain(MethodName.MessagePage);
    expect(store.isBusy()).toBe(false);
    expect(store.error()).toBeNull();
    expect(bridge.listenerCount).toBe(1);
  });

  it("records a failure and keeps working", async () => {
    bridge.fail(MethodName.ProjectList, ErrorCode.Unavailable, "down");

    await store.initialize();

    expect(store.error()).toBe("down");
    expect(store.projects()).toEqual([]);
    store.dismissError();
    expect(store.error()).toBeNull();
  });

  it("opens, selects, and forgets projects", async () => {
    bridge.answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
    bridge.answer(MethodName.ProjectForget, () => null);
    bridge.pickedDirectory = "D:\\other";
    await store.initialize();

    await store.openProject(await store.pickDirectory() ?? "");
    expect(store.projects().map(t => t.id)).toEqual(["p1", "p2"]);
    expect(store.selectedProjectId()).toBe("p2");

    await store.selectProject("p1");
    expect(store.selectedConversationId()).toBe("c1");

    await store.forgetProject("p1");
    expect(store.projects().map(t => t.id)).toEqual(["p2"]);
    expect(store.selectedProjectId()).toBeNull();
    expect(store.conversations()).toEqual([]);
    expect(store.messages()).toEqual([]);
    expect(bridge.methods.filter(t => t === MethodName.ProjectForget)).toHaveLength(1);
  });

  it("creates, renames, and deletes conversations", async () => {
    const created = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    bridge.answer(MethodName.ConversationCreate, () => created.toJson());
    bridge.answer(MethodName.ConversationRename, payload => new Conversation("c2", "p1", String((payload as { title: string }).title), SampleData.timestamp, SampleData.timestamp).toJson());
    bridge.answer(MethodName.ConversationDelete, () => null);
    await store.initialize();

    await store.createConversation("Second");
    expect(store.selectedConversationId()).toBe("c2");
    expect(store.conversations().map(t => t.id)).toEqual(["c1", "c2"]);

    await store.renameConversation("c2", "Renamed");
    expect(store.selectedConversation()?.title).toBe("Renamed");

    bridge.answer(MethodName.ConversationMove, payload =>
      new Conversation("c2", String((payload as { projectId: string }).projectId), "Renamed", SampleData.timestamp, SampleData.timestamp).toJson());
    await store.moveConversation("c2", "p2");
    expect(store.conversationsOf("p1").map(t => t.id)).toEqual(["c1"]);
    expect(store.conversationsOf("p2").map(t => t.id)).toEqual(["c2"]);
    expect(store.conversation("c2")?.projectId).toBe("p2");

    await store.deleteConversation("c2");
    expect(store.selectedProjectId()).toBe("p2");
    expect(store.conversationsOf("p1").map(t => t.id)).toEqual(["c1"]);
    expect(store.selectedConversationId()).toBeNull();

    await store.selectConversation("c1");
    expect(store.messages()).toHaveLength(2);
  });

  it("ignores conversation commands without a project or conversation", async () => {
    await store.createConversation(null);
    await store.send("hi", new ComposerSettings("codex", null, null, null));

    expect(bridge.requests).toEqual([]);
  });

  it("grants approvals as they arrive under full access", async () => {
    bridge.answer(MethodName.ApprovalDecide, () => SampleData.approval.toJson());
    bridge.answer(MethodName.MessageList, () => [SampleData.userMessage.toJson(), SampleData.reply.toJson()]);
    bridge.answer(MethodName.ApprovalList, () => []);
    TestBed.inject(PreferencesService).setAccessMode(AccessMode.Full);
    await store.initialize();

    store.apply(new Event(EventName.ApprovalCreated, SampleData.approval.toJson()));
    TestBed.tick();
    await Promise.resolve();
    store.apply(new Event(EventName.ApprovalUpdated, SampleData.approval.toJson()));
    TestBed.tick();
    await Promise.resolve();

    expect(bridge.methods.filter(t => t === MethodName.ApprovalDecide)).toHaveLength(1);
    expect(bridge.requests.find(t => t.method === MethodName.ApprovalDecide)?.payload).toEqual({ approvalId: SampleData.approval.id, optionId: "yes" });
  });

  it("knows which conversations have a reply running", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.isWorking("c1")).toBe(true);
    expect(store.isWorking("c2")).toBe(false);

    const elsewhere = new Message("m9", "c2", 1, MessageAuthor.Provider, "m8", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
    store.apply(new Event(EventName.MessageCreated, elsewhere.toJson()));
    expect(store.isWorking("c2")).toBe(true);
    store.apply(new Event(EventName.MessageUpdated, elsewhere.withStatus(MessageStatus.Completed, SampleData.timestamp).toJson()));
    expect(store.isWorking("c2")).toBe(false);
    store.apply(new Event(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson()));
    expect(store.isWorking("c1")).toBe(false);
  });

  it("leaves a project or conversation already shown alone and points at a message", async () => {
    await store.initialize();
    const loads = (): number => bridge.methods.filter(t => t === MethodName.MessageList).length;
    const before = loads();

    await store.selectConversation("c1");
    await store.selectProject("p1");
    expect(loads()).toBe(before);
    expect(store.selectedConversationId()).toBe("c1");

    store.focusMessage("m2");
    expect(store.focusMessageId()).toBe("m2");
    store.focusMessage(null);
    expect(store.focusMessageId()).toBeNull();
  });

  it("searches through the runtime and skips blank text", async () => {
    const hit = new ConversationSearchHit("c1", "p1", "Chat", "m2", "…the login page…", SampleData.timestamp);
    bridge.answer(MethodName.ConversationSearch, () => new ConversationSearchResult([hit]).toJson());
    await store.initialize();

    expect(await store.search("  ")).toEqual([]);
    const hits = await store.search(" login ");
    expect(hits.map(t => t.messageId)).toEqual(["m2"]);
    expect(bridge.requests.find(t => t.method === MethodName.ConversationSearch)?.payload).toEqual({ query: "login", limit: Resources.searchLimit });
  });

  it("rewinds the selected conversation and applies rewinds from elsewhere", async () => {
    const marked = new Conversation("c1", "p1", "Chat", SampleData.timestamp, SampleData.timestamp, true);
    bridge.answer(MethodName.ConversationRewind, payload =>
      new ConversationRewindResult(marked, [String((payload as { messageId: string }).messageId), "m2"], 2).toJson());
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.messages().map(t => t.id)).toEqual(["m1", "m2"]);

    const result = await store.rewind("m1", true);
    expect(store.messageIndex()).toHaveLength(0);

    expect(result?.restoredFiles).toBe(2);
    expect(store.messages()).toEqual([]);
    expect(store.selectedConversation()?.sessionReset).toBe(true);
    expect(bridge.requests.find(t => t.method === MethodName.ConversationRewind)?.payload)
      .toEqual({ conversationId: "c1", messageId: "m1", restoreFiles: true });

    await store.selectConversation("c1");
    expect(store.messages()).toHaveLength(0);
    store.apply(new Event(EventName.MessageCreated, SampleData.userMessage.toJson()));
    store.apply(new Event(EventName.MessageCreated, SampleData.reply.toJson()));
    expect(store.messages()).toHaveLength(2);
    store.apply(new Event(EventName.ConversationRewound, new ConversationRewoundPayload("other", 0).toJson()));
    expect(store.messages()).toHaveLength(2);
    store.apply(new Event(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 1).toJson()));
    expect(store.messages().map(t => t.id)).toEqual(["m1"]);
    expect(store.pendingApprovals()).toEqual([]);
  });

  it("sends, cancels, and decides", async () => {
    bridge.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson());
    bridge.answer(MethodName.MessageCancel, () => SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson());
    bridge.answer(MethodName.ApprovalDecide, () => new Approval("ap1", "m2", SampleData.approval.kind, "exec", "run tests", null, SampleData.approval.options, ApprovalStatus.Approved, "yes", SampleData.timestamp, SampleData.timestamp).toJson());
    bridge.answer(MethodName.MessageList, () => []);
    bridge.answer(MethodName.ApprovalList, () => []);
    await store.initialize();
    await store.selectConversation("c1");

    await store.send("hello", new ComposerSettings("codex", "gpt-5", "high", "a1"));
    expect(store.messages().map(t => t.id)).toEqual(["m1", "m2"]);
    expect(store.runningReply()?.id).toBe("m2");
    const sent = bridge.requests.find(t => t.method === MethodName.MessageSend)?.payload as { requested: { model: string }; providerAccountId: string };
    expect(sent.requested.model).toBe("gpt-5");
    expect(sent.providerAccountId).toBe("a1");

    store.apply(new Event(EventName.ApprovalCreated, SampleData.approval.toJson()));
    expect(store.pendingApprovals()).toHaveLength(1);
    await store.decide("ap1", "yes");
    expect(store.pendingApprovals()).toHaveLength(0);

    await store.cancel("m2");
    expect(store.runningReply()).toBeNull();
    expect(store.messages()[1]?.status).toBe(MessageStatus.Cancelled);
  });

  it("keeps message windows scoped and tracks approvals across conversations", async () => {
    await store.initialize();
    await store.selectConversation("c1");

    store.apply(new Event(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson()));
    bridge.emit(new Event(EventName.MessageCreated, SampleData.withStatus(SampleData.reply, MessageStatus.Failed).toJson()));
    store.apply(new Event(EventName.MessageCreated, new Message("m9", "c9", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp).toJson()));
    store.apply(new Event(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Text, "done")).toJson()));
    store.apply(new Event(EventName.DetailUpdated, new DetailEventPayload("m2", SampleData.detail(0, DetailKind.Text, "done!")).toJson()));
    store.apply(new Event(EventName.DetailAppended, new DetailEventPayload("missing", SampleData.detail(0, DetailKind.Text, "lost")).toJson()));
    store.apply(new Event(EventName.ApprovalUpdated, new Approval("ap9", "missing", SampleData.approval.kind, "exec", "s", null, SampleData.approval.options, ApprovalStatus.Pending, null, SampleData.timestamp, null).toJson()));
    store.apply(new Event(EventName.ProviderAccountUpdated, new ProviderAccount("a1", "codex", "Work", "D:\\p", AuthStatus.LoggedOut, null, null, null, null, SampleData.timestamp).toJson()));
    store.apply(new Event("unknown/event", null));

    expect(store.messages().map(t => t.id)).toEqual(["m1", "m2"]);
    expect(store.messages()[1]?.status).toBe(MessageStatus.Failed);
    expect(store.messages()[1]?.details.map(t => t.text)).toEqual(["done!"]);
    expect(store.pendingApprovals().map(t => t.id)).toEqual(["ap1", "ap9"]);
    expect(store.accounts()[0]?.authStatus).toBe(AuthStatus.LoggedOut);
    expect(store.runningReply()).toBeNull();
  });

  it("manages accounts and lists models", async () => {
    bridge.answer(MethodName.ProviderAccountCreate, () => new ProviderAccount("a2", "claude", "Home", "D:\\h", AuthStatus.Unknown, null, null, null, null, SampleData.timestamp).toJson());
    bridge.answer(MethodName.ProviderAccountCheck, () => new ProviderAccount("a2", "claude", "Home", "D:\\h", AuthStatus.LoggedIn, null, "2.0", SampleData.timestamp, null, SampleData.timestamp).toJson());
    bridge.answer(MethodName.ProviderAccountDelete, () => null);
    await store.initialize();

    await store.addAccount("claude", "Home", "D:\\h");
    expect(store.accounts().map(t => t.id)).toEqual(["a1", "a2"]);
    await store.checkAccount("a2");
    expect(store.accounts()[1]?.authStatus).toBe(AuthStatus.LoggedIn);
    await store.removeAccount("a2");
    expect(store.accounts().map(t => t.id)).toEqual(["a1"]);

    expect((await store.listModels("codex", null)).map(t => t.id)).toEqual(["gpt-5", "gpt-5-mini"]);
    bridge.answer(MethodName.ProviderModelCatalog, () => [1]);
    await expect(store.listModels("codex", null)).rejects.toThrow();
    bridge.answer(MethodName.ProviderModelCatalog, () => null);
    await expect(store.listModels("codex", null)).rejects.toThrow();
  });

  it("stops listening when disposed", async () => {
    await store.initialize();
    store.dispose();
    store.dispose();

    expect(bridge.listenerCount).toBe(0);
  });

  it("pages the selected conversation: earlier and later pages, the newest page, and a search hit's surroundings", async () => {
    const all = Array.from({ length: 5 }, (_, i) => new Message(`m${i}`, "c1", i, MessageAuthor.User, null, MessageStatus.Completed,
      [SampleData.detail(0, DetailKind.Text, `t${i}`)], null, SampleData.timestamp, null, SampleData.timestamp));
    bridge.answer(MethodName.MessagePage, payload => {
      const cursors = payload as { beforeSequence: number | null; afterSequence: number | null };
      const slice = cursors.beforeSequence !== null ? all.filter(t => t.sequence < cursors.beforeSequence!).slice(-2)
        : cursors.afterSequence !== null ? all.filter(t => t.sequence > cursors.afterSequence!).slice(0, 2) : all.slice(-2);
      const first = slice[0];
      const last = slice.at(-1);
      return new MessagePage(slice, first !== undefined && first.sequence > 0, last !== undefined && last.sequence < 4).toJson();
    });
    const ids = (): string[] => store.messages().map(t => t.id);
    const pages = (): number => bridge.methods.filter(t => t === MethodName.MessagePage).length;
    await store.initialize();
    await store.selectConversation("c1");

    expect(ids()).toEqual(["m3", "m4"]);
    expect(store.hasEarlierMessages()).toBe(true);
    expect(store.hasLaterMessages()).toBe(false);
    await store.loadEarlierMessages();
    expect(ids()).toEqual(["m1", "m2", "m3", "m4"]);
    await store.loadEarlierMessages();
    expect(ids()).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(store.hasEarlierMessages()).toBe(false);
    const loaded = pages();
    await store.loadEarlierMessages();
    expect(pages()).toBe(loaded);

    await store.loadNewestMessages();
    expect(ids()).toEqual(["m3", "m4"]);
    await store.showMessage(new ConversationSearchHit("c1", "p1", "Chat", "m1", "t1", SampleData.timestamp, 1));
    expect(ids()).toEqual(["m0", "m1", "m2", "m3"]);
    expect(store.hasLaterMessages()).toBe(true);
    expect(store.focusMessageId()).toBe("m1");
    const late = new Message("m9", "c1", 9, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null,
      SampleData.timestamp);
    store.apply(new Event(EventName.MessageCreated, late.toJson()));
    expect(ids()).toEqual(["m0", "m1", "m2", "m3"]);
    await store.loadLaterMessages();
    expect(ids()).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(store.hasLaterMessages()).toBe(false);
    store.apply(new Event(EventName.MessageCreated, late.toJson()));
    expect(ids().at(-1)).toBe("m9");
    const before = pages();
    await store.showMessage(new ConversationSearchHit("c1", "p1", "Chat", "m2", "t2", SampleData.timestamp, 2));
    expect(pages()).toBe(before);
    expect(store.focusMessageId()).toBe("m2");
  });

  it("does not load full panel history when selecting a conversation", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    expect(bridge.methods).not.toContain(MethodName.MessageList);
    store.apply(new Event(EventName.DetailAppended, new DetailEventPayload("m2", SampleData.detail(8, DetailKind.Text, "done")).toJson()));
    expect(store.messages()[1]?.details.some(t => t.text === "done")).toBe(true);
  });

  it("remembers where the reader was in a conversation and brings the window back around it", async () => {
    const all = Array.from({ length: 5 }, (_, i) => new Message(`m${i}`, "c1", i, MessageAuthor.User, null, MessageStatus.Completed,
      [SampleData.detail(0, DetailKind.Text, `t${i}`)], null, SampleData.timestamp, null, SampleData.timestamp));
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    bridge.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    bridge.answer(MethodName.MessagePage, payload => {
      const request = payload as { conversationId: string; beforeSequence: number | null; afterSequence: number | null };
      if (request.conversationId !== "c1")
        return new MessagePage([], false, false).toJson();
      const slice = request.beforeSequence !== null ? all.filter(t => t.sequence < request.beforeSequence!).slice(-2)
        : request.afterSequence !== null ? all.filter(t => t.sequence > request.afterSequence!).slice(0, 2) : all.slice(-2);
      const first = slice[0];
      const last = slice.at(-1);
      return new MessagePage(slice, first !== undefined && first.sequence > 0, last !== undefined && last.sequence < 4).toJson();
    });
    await store.initialize();
    await store.selectConversation("c1");
    expect(store.messages().map(t => t.id)).toEqual(["m3", "m4"]);

    store.rememberPosition("c1", new ReadingPosition("m1", 1, 40));
    await store.selectConversation("c2");
    await store.selectConversation("c1");
    expect(store.messages().map(t => t.id)).toEqual(["m0", "m1", "m2", "m3"]);
    expect(store.hasLaterMessages()).toBe(true);
    expect(store.pendingPosition()?.messageId).toBe("m1");
    expect(store.pendingPosition()?.distance).toBe(40);
    store.consumePosition();
    expect(store.pendingPosition()).toBeNull();

    store.rememberPosition("c1", null);
    await store.selectConversation("c2");
    await store.selectConversation("c1");
    expect(store.messages().map(t => t.id)).toEqual(["m3", "m4"]);
    expect(store.pendingPosition()).toBeNull();
    store.rememberPosition("c1", new ReadingPosition("m1", 1, 40));
    store.forgetPosition("c1");
    await store.selectConversation("c2");
    await store.selectConversation("c1");
    expect(store.pendingPosition()).toBeNull();
  });
});
