/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Conversation, Event, EventName, Message, MessageAuthor, MessagePage, MessagePageParams, MessageStatus, MethodName } from "@noldova/teamrun-protocol";

import { SampleData } from "../../fixtures/sample-data";
import { MessageControlState } from "../../../src/app/models/message-control-state";
import { ReadingPosition } from "../../../src/app/models/reading-position";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";

describe("ChatStore history retention", () => {
  const message = (sequence: number): Message => new Message(`m${sequence}`, "c1", sequence, MessageAuthor.User, null,
    MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
  let all: Message[];
  let bridge: ReturnType<typeof SampleData.createBridge>;
  let store: ChatStore;
  const page = (payload: JsonValue): JsonValue => {
    const params = MessagePageParams.fromJson(payload);
    const matching = all.filter(t => t.conversationId === params.conversationId && (params.beforeSequence === null || t.sequence < params.beforeSequence)
      && (params.afterSequence === null || t.sequence > params.afterSequence));
    const messages = params.afterSequence === null ? matching.slice(-params.limit) : matching.slice(0, params.limit);
    return new MessagePage(messages, all.some(t => t.sequence < (messages[0]?.sequence ?? -1)),
      all.some(t => t.sequence > (messages.at(-1)?.sequence ?? Number.MAX_SAFE_INTEGER))).toJson();
  };

  beforeEach(() => {
    all = Array.from({ length: 400 }, (_, i) => message(i));
    bridge = SampleData.createBridge().answer(MethodName.MessagePage, page).answer(MethodName.ApprovalList, () => []);
    const other = new Conversation("c2", "p1", "Other", SampleData.timestamp, SampleData.timestamp);
    bridge.answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), other.toJson()]);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    store = TestBed.inject(ChatStore);
  });

  afterEach(() => store.dispose());

  it("evicts message bodies but preserves visited entries and open-tab control choices", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    const entry = store.messageIndex().find(t => t.id === "m370");
    if (!entry)
      throw new Error("Missing message");
    entry.height = 340;
    const controls = new MessageControlState();
    controls.activityChoice.set(true);
    controls.wrappingFor(0).add(1);
    store.rememberMessageControls(entry.id, controls);
    for (let i = 0; i < 5; i++)
      await store.loadEarlierMessages();
    expect(store.messages()).toHaveLength(150);
    expect(store.messageIndex()).toHaveLength(300);
    expect(store.messages().some(t => t.id === "m370")).toBe(false);
    await store.loadMessagesAt(370);
    expect(store.messageIndex()).toHaveLength(300);
    expect(store.messageIndex().find(t => t.id === entry.id)).toBe(entry);
    expect(store.messages().length).toBeLessThanOrEqual(150);
    store.rememberPosition("c1", new ReadingPosition(entry.id, entry.sequence, 20));
    await store.selectConversation("c2");
    expect(store.messages()).toHaveLength(0);
    await store.selectConversation("c1");
    expect(store.messageIndex().find(t => t.id === entry.id)).toBe(entry);
    expect(entry.controls?.wrappingFor(0).has(1)).toBe(true);
    store.forgetPosition("c1");
    await store.selectConversation("c2");
    await store.selectConversation("c1");
    expect(store.messageIndex()).toHaveLength(50);
    expect(store.messageIndex().find(t => t.id === entry.id)?.controls).toBeNull();
  });

  it("does not evict the reading window when a new message arrives", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    await store.loadEarlierMessages();
    await store.loadEarlierMessages();
    const first = store.messages()[0];
    store.rememberPosition("c1", new ReadingPosition("m260", 260, 20));
    all.push(message(400));
    store.apply(new Event(EventName.MessageCreated, message(400).toJson()));
    expect(store.messages()).toHaveLength(150);
    expect(store.messages()[0]).toBe(first);
    expect(store.messageIndex().at(-1)?.id).toBe("m400");
    expect(store.hasLaterMessages()).toBe(true);
    await store.loadNewestMessages();
    expect(store.messages()).toHaveLength(50);
    expect(store.messages().at(-1)?.id).toBe("m400");
    expect(store.hasLaterMessages()).toBe(false);
  });

  it("lets a jump to newest supersede an older page still in flight", async () => {
    await store.initialize();
    await store.selectConversation("c1");
    let release: (value: JsonValue) => void = () => undefined;
    let olderPayload: JsonValue = null;
    bridge.answer(MethodName.MessagePage, payload => {
      if (MessagePageParams.fromJson(payload).beforeSequence !== null) {
        olderPayload = payload;
        return new Promise<JsonValue>(resolve => release = resolve);
      }
      return page(payload);
    });
    const earlier = store.loadEarlierMessages();
    await store.loadNewestMessages();
    release(page(olderPayload));
    await earlier;
    expect(store.messages()).toHaveLength(50);
    expect(store.messages()[0]?.sequence).toBe(350);
    expect(store.loadingPage()).toBe(false);
  });
});
