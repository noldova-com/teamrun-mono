/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { ConversationRewoundPayload, DetailEventPayload, DetailKind, Event, EventName, Message, MessageAuthor, MessageDetail, MessageStatus,
  MethodName, ReplyPage, ReplyPanel, ReplySummary } from "@noldova/teamrun-protocol";

import { SampleData } from "../../fixtures/sample-data";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ReplyHistory } from "../../../src/app/services/reply-history.service";

describe("ReplyHistory", () => {
  const reply = (sequence: number, conversationId = "c1", title = `Command ${sequence}`): Message =>
    new Message(`r${sequence}`, conversationId, sequence, MessageAuthor.Provider, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Command, `${title}\nlarge output`, null, SampleData.timestamp)], SampleData.reply.provenance,
      SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);
  let messages: Message[];
  let bridge: ReturnType<typeof SampleData.createBridge>;
  let history: ReplyHistory;

  beforeEach(() => {
    messages = Array.from({ length: 250 }, (_, i) => reply(i));
    bridge = SampleData.createBridge().answer(MethodName.MessageList, () => messages.map(t => t.toJson()));
    TestBed.configureTestingModule({ providers: [ReplyHistory, { provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    history = TestBed.inject(ReplyHistory);
  });

  const select = async (): Promise<void> => {
    history.select("c1", ReplyPanel.Activity);
    await vi.waitFor(() => expect(history.loading()).toBe(false));
  };

  it("pages in both directions with bounded summaries and retains expansion in overlapping pages", async () => {
    await select();
    expect(history.items()).toHaveLength(50);
    expect(history.items()[0]?.summary.preview.sequence).toBe(249);
    expect(JSON.stringify(history.items().map(t => t.summary.toJson()))).not.toContain("large output");
    const kept = history.items()[25];
    kept?.expansion.activity.set(new Set([0]));
    await history.loadOlder();
    await history.loadOlder();
    expect(history.items()).toHaveLength(150);
    expect(history.items()[25]?.expansion).toBe(kept?.expansion);
    await history.loadOlder();
    expect(history.items()).toHaveLength(150);
    expect(history.items()[0]?.summary.preview.sequence).toBe(199);
    expect(history.hasLater()).toBe(true);
    await history.loadNewer();
    expect(history.items()).toHaveLength(150);
    expect(history.items()[0]?.summary.preview.sequence).toBe(249);
    expect(history.hasLater()).toBe(false);
    await history.loadNewest();
    expect(history.items()).toHaveLength(50);
    expect(bridge.methods).not.toContain(MethodName.MessageList);
    expect(bridge.methods).not.toContain(MethodName.MessageDetails);
  });

  it("discards a delayed response after changing conversations", async () => {
    let release: (value: JsonValue) => void = () => undefined;
    bridge.answer(MethodName.MessageActivityPage, () => new Promise<JsonValue>(resolve => release = resolve));
    history.select("c1", ReplyPanel.Activity);
    history.select(null, ReplyPanel.Activity);
    release(new ReplyPage([ReplySummary.fromMessage(reply(1))], false, false).toJson());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(history.items()).toHaveLength(0);
    expect(history.loading()).toBe(false);
  });

  it("keeps a lightweight index and expansion choices after evicting summaries, and reloads distant pages directly", async () => {
    await select();
    const first = history.items()[0];
    first?.expansion.activity.set(new Set([0]));
    first?.expansion.wrappedFiles.set(new Set(["a.ts"]));
    await history.loadOlder();
    await history.loadOlder();
    await history.loadOlder();
    expect(history.items()).toHaveLength(150);
    expect(history.index()).toHaveLength(200);
    expect(history.index()[0]?.id).toBe("r249");
    expect(history.items().some(t => t.summary.preview.id === "r249")).toBe(false);
    expect(history.index().every(t => !("summary" in t))).toBe(true);
    expect(history.index().filter(t => t.expansion !== null)).toHaveLength(1);
    const requests = bridge.requests.length;
    await history.loadAt(249);
    expect(bridge.requests.length - requests).toBe(1);
    expect(history.index()).toHaveLength(200);
    expect(history.items()[0]?.expansion).toBe(first?.expansion);
    expect(history.items()[0]?.expansion.activity().has(0)).toBe(true);
    await history.loadNewest();
    expect(history.index()).toHaveLength(200);
    history.select(null, ReplyPanel.Activity);
    expect(history.items()).toHaveLength(0);
    expect(history.index()).toHaveLength(0);
  });

  it("reconciles removed rows and rewind against the retained index", async () => {
    await select();
    await history.loadOlder();
    messages = messages.filter(t => t.id !== "r225");
    await history.loadAt(235);
    expect(history.index().some(t => t.id === "r225")).toBe(false);
    bridge.emit(new Event(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 220).toJson()));
    expect(history.index().every(t => t.sequence < 220)).toBe(true);
    expect(history.items().every(t => t.summary.preview.sequence < 220)).toBe(true);
  });

  it("replays live summaries over an older page response and coalesces detail refreshes", async () => {
    await select();
    const original = messages.at(-1);
    let release: (value: JsonValue) => void = () => undefined;
    bridge.answer(MethodName.MessageActivityPage, () => new Promise<JsonValue>(resolve => release = resolve));
    const loading = history.loadOlder();
    const updated = reply(249, "c1", "Updated");
    bridge.emit(new Event(EventName.MessageUpdated, updated.toJson()));
    release(new ReplyPage([ReplySummary.fromMessage(original ?? updated)], true, false).toJson());
    await loading;
    expect(history.items()[0]?.summary.preview.details[0]?.text).toBe("Updated");
    messages = messages.map(t => t.sequence === 249 ? reply(249, "c1", "Live") : t);
    for (let i = 0; i < 10; i++)
      bridge.emit(new Event(EventName.DetailUpdated, new DetailEventPayload("r249", new MessageDetail(0, DetailKind.Command, "Live", null, SampleData.timestamp)).toJson()));
    await vi.waitFor(() => expect(history.items()[0]?.summary.preview.details[0]?.text).toBe("Live"));
    expect(bridge.methods.filter(t => t === MethodName.MessageSummary)).toHaveLength(1);
    bridge.emit(new Event(EventName.MessageUpdated, reply(300, "another").toJson()));
    expect(history.items()[0]?.summary.preview.sequence).toBe(249);
  });

  it("preserves an older window while new replies arrive and removes rewound replies", async () => {
    await select();
    await history.loadOlder();
    await history.loadOlder();
    await history.loadOlder();
    const first = history.items()[0];
    bridge.emit(new Event(EventName.MessageCreated, reply(251).toJson()));
    expect(history.items()[0]).toBe(first);
    bridge.emit(new Event(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 175).toJson()));
    expect(history.items().every(t => t.summary.preview.sequence < 175)).toBe(true);
    expect(history.hasLater()).toBe(false);
  });

  it("keeps a full window's reading anchor when a new reply arrives", async () => {
    await select();
    await history.loadOlder();
    await history.loadOlder();
    const last = history.items().at(-1);
    history.anchorSequence = last?.summary.preview.sequence ?? null;
    bridge.emit(new Event(EventName.MessageCreated, reply(251).toJson()));
    expect(history.items()).toHaveLength(150);
    expect(history.items().at(-1)).toBe(last);
    expect(history.hasLater()).toBe(true);
  });

  it("retries failures and reloads near the reading anchor on reconnect", async () => {
    bridge.answer(MethodName.MessageActivityPage, () => { throw new Error("offline"); });
    await select();
    expect(history.error()).toBe("offline");
    bridge.handlers.delete(MethodName.MessageActivityPage);
    await history.retry();
    expect(history.items()).toHaveLength(50);
    history.anchorSequence = 225;
    bridge.emit(new Event(EventName.StateResyncRequested, null));
    await vi.waitFor(() => expect(history.loading()).toBe(false));
    expect(history.items()[0]?.summary.preview.sequence).toBe(225);
    expect(history.hasLater()).toBe(true);
    TestBed.resetTestingModule();
    expect(bridge.listenerCount).toBe(0);
  });
});
