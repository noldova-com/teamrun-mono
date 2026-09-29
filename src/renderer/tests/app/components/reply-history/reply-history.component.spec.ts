/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DetailKind, Event as RuntimeEvent, EventName, Message, MessageAuthor, MessageDetail, MessageStatus, MethodName, ReplyPanel } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { ReplyHistory } from "../../../../src/app/services/reply-history.service";
import { ReplyHistoryComponent } from "../../../../src/app/components/reply-history/reply-history.component";

describe("ReplyHistoryComponent", () => {
  const reply = (sequence: number): Message => new Message(`r${sequence}`, "c1", sequence, MessageAuthor.Provider, null, MessageStatus.Completed,
    [new MessageDetail(0, DetailKind.Command, `Run ${sequence}\noutput ${sequence}`, null, SampleData.timestamp),
      new MessageDetail(1, DetailKind.FileChange, "Edit a.ts", { tool: "Edit", input: { file_path: "a.ts", old_string: "old", new_string: "new" } }, SampleData.timestamp)],
    SampleData.reply.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp);

  it("renders a small range, lazily loads outputs, and restores expansion after scrolling away", async () => {
    const messages = Array.from({ length: 250 }, (_, i) => reply(i));
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => messages.map(t => t.toJson()));
    TestBed.configureTestingModule({ imports: [ReplyHistoryComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const chat = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(ReplyHistoryComponent);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    fixture.detectChanges();
    await chat.initialize();
    await chat.selectConversation("c1");
    await fixture.whenStable();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const scroller = element.querySelector<HTMLElement>(".tr-scroller");
    if (!scroller)
      throw new Error("missing scroller");
    const history = fixture.debugElement.injector.get(ReplyHistory);
    expect(history.items()).toHaveLength(50);
    expect(element.querySelectorAll("tr-reply-history-row").length).toBeLessThan(15);
    expect(bridge.methods).not.toContain(MethodName.MessageDetails);
    element.querySelector<HTMLButtonElement>("tr-activity-block button")?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector("pre")?.textContent).toContain("output 249");
    expect(bridge.methods.filter(t => t === MethodName.MessageDetails)).toHaveLength(1);
    Object.defineProperty(scroller, "scrollHeight", { value: 6000, configurable: true });
    Object.defineProperty(scroller, "clientHeight", { value: 300, configurable: true });
    scroller.scrollTop = 2500;
    scroller.dispatchEvent(new Event("scroll"));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('[data-message-id="r249"]')).toBeNull();
    expect(history.items()[0]?.expansion.activity().has(0)).toBe(true);
    scroller.scrollTop = 0;
    scroller.dispatchEvent(new Event("scroll"));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector("pre")?.textContent).toContain("output 249");
    });
    expect(bridge.methods.filter(t => t === MethodName.MessageDetails)).toHaveLength(2);
    fixture.destroy();
    chat.dispose();
  });

  it("loads diffs on expansion and anchors the reading position when new replies arrive", async () => {
    const messages = Array.from({ length: 100 }, (_, i) => reply(i));
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => messages.map(t => t.toJson()));
    TestBed.configureTestingModule({ imports: [ReplyHistoryComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const chat = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(ReplyHistoryComponent);
    fixture.componentRef.setInput("panel", ReplyPanel.Changes);
    fixture.detectChanges();
    await chat.initialize();
    await chat.selectConversation("c1");
    await fixture.whenStable();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain("a.ts");
    expect(element.querySelector(".tr-diff")).toBeNull();
    element.querySelector<HTMLButtonElement>("tr-edited-files-card li button")?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector(".tr-diff")?.textContent).toContain("old");
    const scroller = element.querySelector<HTMLElement>(".tr-scroller");
    if (!scroller)
      throw new Error("missing scroller");
    Object.defineProperty(scroller, "scrollHeight", { value: 6000, configurable: true });
    Object.defineProperty(scroller, "clientHeight", { value: 300, configurable: true });
    scroller.scrollTop = 800;
    scroller.dispatchEvent(new Event("scroll"));
    fixture.detectChanges();
    bridge.emit(new RuntimeEvent(EventName.MessageCreated, reply(100).toJson()));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scroller.scrollTop).toBe(920);
    fixture.destroy();
    chat.dispose();
  });

  it("preserves the known extent across eviction and a scrollbar jump into discarded content", async () => {
    const messages = Array.from({ length: 400 }, (_, i) => reply(i));
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => messages.map(t => t.toJson()));
    TestBed.configureTestingModule({ imports: [ReplyHistoryComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const chat = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(ReplyHistoryComponent);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    fixture.detectChanges();
    await chat.initialize();
    await chat.selectConversation("c1");
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const scroller = element.querySelector<HTMLElement>(".tr-scroller");
    const space = element.querySelector<HTMLElement>(".overflow-clip");
    if (!scroller || !space)
      throw new Error("missing scroller");
    Object.defineProperty(scroller, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(scroller, "scrollHeight", { get: () => Number.parseFloat(space.style.height), configurable: true });
    const history = fixture.debugElement.injector.get(ReplyHistory);
    for (let page = 0; page < 5; page++) {
      const count = history.index().length;
      scroller.scrollTop = count * 120 - 350;
      scroller.dispatchEvent(new Event("scroll"));
      fixture.detectChanges();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(history.index().length).toBeGreaterThan(count);
      });
    }
    expect(history.index().length).toBeGreaterThan(150);
    expect(history.items().length).toBeLessThanOrEqual(150);
    const extent = space.style.height;
    const top = 1200;
    const id = history.index()[10]?.id;
    scroller.scrollTop = top;
    scroller.dispatchEvent(new Event("scroll"));
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector(`[data-message-id="${id}"]`)).not.toBeNull();
    });
    expect(scroller.scrollTop).toBe(top);
    expect(space.style.height).toBe(extent);
    fixture.destroy();
    chat.dispose();
  });
});
