/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { Conversation, DetailKind, Message, MessageAuthor, MessageStatus, MethodName } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { MessageListComponent } from "../../../../src/app/components/message-list/message-list.component";

describe("MessageListComponent", () => {
  const metrics = (element: HTMLElement, scrollHeight: number, clientHeight: number): void => {
    Object.defineProperty(element, "scrollHeight", { value: scrollHeight, configurable: true });
    Object.defineProperty(element, "clientHeight", { value: clientHeight, configurable: true });
  };
  const scroll = (element: HTMLElement, top: number): void => {
    element.scrollTop = top;
    element.dispatchEvent(new Event("scroll"));
  };

  it("follows the end, leaves on the first step up beyond the end's zone, and comes back on the button", async () => {
    const bridge = SampleData.createBridge()
      .answer(MethodName.MessageList, () => [SampleData.userMessage.toJson(), SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson()])
      .answer(MethodName.ApprovalList, () => []);
    TestBed.configureTestingModule({ imports: [MessageListComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(MessageListComponent);
    const element = fixture.nativeElement as HTMLElement;
    const scroller = element.querySelector<HTMLElement>("div")!;
    let top = 0;
    Object.defineProperty(scroller, "scrollTop", { get: () => top, set: (value: number) => { top = value; }, configurable: true });
    metrics(scroller, 1000, 300);
    fixture.detectChanges();
    await store.initialize();
    await store.selectConversation("c1");
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise(resolve => queueMicrotask(() => resolve(undefined)));
    fixture.detectChanges();
    const button = (): HTMLButtonElement | null => element.querySelector<HTMLButtonElement>(".tr-scroll-down");

    expect(element.querySelectorAll("tr-message-card")).toHaveLength(2);
    expect(top).toBe(1000);
    expect(button()).toBeNull();

    scroll(scroller, 960);
    scroll(scroller, 920);
    fixture.detectChanges();
    expect(button()).toBeNull();

    scroll(scroller, 590);
    fixture.detectChanges();
    expect(button()).toBeNull();
    scroll(scroller, 575);
    fixture.detectChanges();
    expect(button()).not.toBeNull();

    scroll(scroller, 578);
    fixture.detectChanges();
    expect(button()).not.toBeNull();
    button()!.click();
    fixture.detectChanges();
    expect(top).toBe(1000);
    expect(button()).toBeNull();

    metrics(scroller, 2000, 300);
    scroll(scroller, 1690);
    fixture.detectChanges();
    expect(button()).toBeNull();
    scroll(scroller, 1200);
    fixture.detectChanges();
    expect(button()).not.toBeNull();
    scroll(scroller, 1900);
    fixture.detectChanges();
    expect(button()).toBeNull();
  });

  it("scrolls to the message a search hit names and lights it up", async () => {
    const bridge = SampleData.createBridge()
      .answer(MethodName.MessageList, () => [SampleData.userMessage.toJson(), SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson()])
      .answer(MethodName.ApprovalList, () => []);
    TestBed.configureTestingModule({ imports: [MessageListComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(MessageListComponent);
    const element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await store.initialize();
    await store.selectConversation("c1");
    await fixture.whenStable();
    fixture.detectChanges();
    const target = element.querySelector<HTMLElement>("[data-message-id='m2']")!;
    store.focusMessage("m2");
    fixture.detectChanges();
    await new Promise(resolve => queueMicrotask(() => resolve(undefined)));
    fixture.detectChanges();

    expect(element.querySelector<HTMLElement>(".tr-scroller")!.scrollTop).toBe(120);
    expect(target.classList.contains("tr-flash")).toBe(true);
    expect(store.focusMessageId()).toBeNull();
    fixture.detectChanges();
    expect(element.querySelector(".tr-scroll-down")).not.toBeNull();
  });

  it("renders only the messages around the viewport and keeps the height of the rest", async () => {
    const many = Array.from({ length: 60 }, (_, i) => new Message(`n${i}`, "c1", i, MessageAuthor.User, null, MessageStatus.Completed,
      [SampleData.detail(0, DetailKind.Text, `t${i}`)], null, SampleData.timestamp, null, SampleData.timestamp));
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => many.map(t => t.toJson())).answer(MethodName.ApprovalList, () => []);
    TestBed.configureTestingModule({ imports: [MessageListComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(MessageListComponent);
    const element = fixture.nativeElement as HTMLElement;
    const scroller = element.querySelector<HTMLElement>("div")!;
    let top = 0;
    Object.defineProperty(scroller, "scrollTop", { get: () => top, set: (value: number) => { top = value; }, configurable: true });
    metrics(scroller, 7200, 300);
    fixture.detectChanges();
    await store.initialize();
    await store.selectConversation("c1");
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise(resolve => queueMicrotask(() => resolve(undefined)));
    fixture.detectChanges();
    fixture.detectChanges();
    const space = scroller.querySelector<HTMLElement>(".tr-message-space")!;
    const content = space.firstElementChild as HTMLElement;
    const cards = (): string[] => Array.from(element.querySelectorAll("tr-message-card")).map(t => t.getAttribute("data-message-id") ?? "");

    expect(cards().length).toBeLessThan(60);
    expect(cards().at(-1)).toBe("n59");
    expect(Number.parseInt(content.style.top, 10)).toBeGreaterThan(0);
    expect(space.style.height).toBe("7200px");

    scroll(scroller, 0);
    fixture.detectChanges();
    expect(cards()[0]).toBe("n0");
    expect(cards().length).toBeLessThan(60);
    expect(content.style.top).toBe("0px");
    expect(space.style.height).toBe("7200px");
  });

  it("keeps the end or reading position when cards grow or the viewport resizes", async () => {
    const stub = { measure: (_entries: readonly ResizeObserverEntry[]): void => { } };
    const observed = new Set<Element>();
    class ResizeObserverStub {
      public constructor(callback: (entries: readonly ResizeObserverEntry[]) => void) { stub.measure = callback; }
      public observe(element: Element): void { observed.add(element); }
      public unobserve(element: Element): void { observed.delete(element); }
      public disconnect(): void { observed.clear(); }
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
    try {
      const many = Array.from({ length: 60 }, (_, i) => new Message(`n${i}`, "c1", i, MessageAuthor.User, null, MessageStatus.Completed,
        [SampleData.detail(0, DetailKind.Text, `t${i}`)], null, SampleData.timestamp, null, SampleData.timestamp));
      const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => many.map(t => t.toJson())).answer(MethodName.ApprovalList, () => []);
      TestBed.configureTestingModule({ imports: [MessageListComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
      const store = TestBed.inject(ChatStore);
      const fixture = TestBed.createComponent(MessageListComponent);
      const element = fixture.nativeElement as HTMLElement;
      const scroller = element.querySelector<HTMLElement>("div")!;
      let top = 0;
      Object.defineProperty(scroller, "scrollTop", { get: () => top, set: (value: number) => { top = value; }, configurable: true });
      metrics(scroller, 7200, 300);
      fixture.detectChanges();
      await store.initialize();
    await store.selectConversation("c1");
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(resolve => queueMicrotask(() => resolve(undefined)));
      fixture.detectChanges();
      fixture.detectChanges();
      const entry = (id: string, height: number): ResizeObserverEntry => ({
        target: element.querySelector(`[data-message-id='${id}']`)!, borderBoxSize: [{ blockSize: height, inlineSize: 500 }], contentRect: { height }
      } as unknown as ResizeObserverEntry);
      expect(top).toBe(7200);
      expect(observed.has(scroller)).toBe(true);
      const viewportEntry = { target: scroller, borderBoxSize: [], contentRect: { height: 100 } } as unknown as ResizeObserverEntry;

      scroll(scroller, 7160);
      fixture.detectChanges();
      metrics(scroller, 7260, 300);
      stub.measure([entry("n59", 180)]);
      expect(element.querySelector<HTMLElement>(".tr-message-space")!.style.height).toBe("7260px");
      expect(top).toBe(7220);
      fixture.detectChanges();
      expect(top).toBe(7220);
      expect(element.querySelector(".tr-scroll-down")).toBeNull();

      metrics(scroller, 7260, 100);
      stub.measure([viewportEntry]);
      fixture.detectChanges();
      expect(top).toBe(7420);
      metrics(scroller, 7260, 500);
      stub.measure([viewportEntry]);
      fixture.detectChanges();
      expect(top).toBe(7020);
      expect(element.querySelector(".tr-scroll-down")).toBeNull();

      scroll(scroller, 3000);
      fixture.detectChanges();
      stub.measure([entry("n20", 280)]);
      expect(top).toBe(3160);
      expect(element.querySelector<HTMLElement>(".tr-message-space")!.style.height).toBe("7420px");
      fixture.detectChanges();
      expect(top).toBe(3160);
      expect(element.querySelector<HTMLElement>(".tr-message-space")!.style.height).toBe("7420px");
      expect(element.querySelector(".tr-scroll-down")).not.toBeNull();
      metrics(scroller, 7260, 200);
      stub.measure([viewportEntry]);
      fixture.detectChanges();
      expect(top).toBe(3160);
      expect(element.querySelector(".tr-scroll-down")).not.toBeNull();
    } finally {
      delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });

  it("stops observing the cards that leave the window before its measurement returns", async () => {
    const stub = { measure: (_entries: readonly ResizeObserverEntry[]): void => { } };
    const observed = new Set<Element>();
    class ResizeObserverStub {
      public constructor(callback: (entries: readonly ResizeObserverEntry[]) => void) { stub.measure = callback; }
      public observe(element: Element): void { observed.add(element); }
      public unobserve(element: Element): void { observed.delete(element); }
      public disconnect(): void { observed.clear(); }
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
    try {
      const many = Array.from({ length: 60 }, (_, i) => new Message(`n${i}`, "c1", i, MessageAuthor.User, null, MessageStatus.Completed,
        [SampleData.detail(0, DetailKind.Text, `t${i}`)], null, SampleData.timestamp, null, SampleData.timestamp));
      const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => many.map(t => t.toJson())).answer(MethodName.ApprovalList, () => []);
      TestBed.configureTestingModule({ imports: [MessageListComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
      const store = TestBed.inject(ChatStore);
      const fixture = TestBed.createComponent(MessageListComponent);
      const element = fixture.nativeElement as HTMLElement;
      const scroller = element.querySelector<HTMLElement>("div")!;
      let top = 0;
      Object.defineProperty(scroller, "scrollTop", { get: () => top, set: (value: number) => { top = value; }, configurable: true });
      metrics(scroller, 7200, 300);
      fixture.detectChanges();
      await store.initialize();
      await store.selectConversation("c1");
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise(resolve => queueMicrotask(() => resolve(undefined)));
      fixture.detectChanges();
      fixture.detectChanges();
      const before = Array.from(element.querySelectorAll("[data-message-id]"));
      expect(before.length).toBeGreaterThan(2);
      expect(before.every(t => observed.has(t))).toBe(true);

      metrics(scroller, 8580, 300);
      stub.measure([{
        target: element.querySelector("[data-message-id='n59']")!, borderBoxSize: [{ blockSize: 1500, inlineSize: 500 }], contentRect: { height: 1500 }
      } as unknown as ResizeObserverEntry]);

      expect(before.filter(t => !t.isConnected).length).toBeGreaterThan(0);
      expect(Array.from(observed).filter(t => !t.isConnected)).toEqual([]);
      fixture.detectChanges();
      expect(Array.from(element.querySelectorAll("[data-message-id]")).every(t => observed.has(t))).toBe(true);
    } finally {
      delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });

  it("reports where the reader is and goes back there when the tab returns", async () => {
    const many = Array.from({ length: 60 }, (_, i) => new Message(`n${i}`, "c1", i, MessageAuthor.User, null, MessageStatus.Completed,
      [SampleData.detail(0, DetailKind.Text, `t${i}`)], null, SampleData.timestamp, null, SampleData.timestamp));
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge()
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()])
      .answer(MethodName.MessageList, payload => (payload as { conversationId: string }).conversationId === "c1" ? many.map(t => t.toJson()) : [])
      .answer(MethodName.ApprovalList, () => []);
    TestBed.configureTestingModule({ imports: [MessageListComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(MessageListComponent);
    const element = fixture.nativeElement as HTMLElement;
    const scroller = element.querySelector<HTMLElement>("div")!;
    let top = 0;
    Object.defineProperty(scroller, "scrollTop", { get: () => top, set: (value: number) => { top = value; }, configurable: true });
    metrics(scroller, 7200, 300);
    fixture.detectChanges();
    await store.initialize();
    await store.selectConversation("c1");
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise(resolve => queueMicrotask(() => resolve(undefined)));
    fixture.detectChanges();
    fixture.detectChanges();

    scroll(scroller, 3000);
    scroll(scroller, 3640);
    fixture.detectChanges();
    await store.selectConversation("c2");
    fixture.detectChanges();
    await store.selectConversation("c1");
    fixture.detectChanges();
    await vi.waitFor(() => expect(top).toBe(3640));
    expect(store.pendingPosition()).toBeNull();
    expect(element.querySelector(".tr-scroll-down")).not.toBeNull();
  });
});
