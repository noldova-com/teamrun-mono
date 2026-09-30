/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { MatDialog } from "@angular/material/dialog";
import { MatTooltip } from "@angular/material/tooltip";

import {
  Conversation, ConversationRewindResult, DetailEventPayload, DetailKind, Event, EventName, Message, MessageDetail, MessageIdParams, MessageStatus, MethodName
} from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { VisibleText } from "../../../fixtures/visible-text";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { DraftService } from "../../../../src/app/services/draft.service";
import { MessageCardComponent } from "../../../../src/app/components/message-card/message-card.component";

describe("MessageCardComponent", () => {
  it("renders a deleted teammate with its historical name and former-teammate state", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    await TestBed.inject(ChatStore).initialize();
    const original = SampleData.withStatus(SampleData.reply, MessageStatus.Completed);
    const fixture = TestBed.createComponent(MessageCardComponent);
    fixture.componentRef.setInput("message", new Message(original.id, original.conversationId, original.sequence, original.author,
      original.inReplyTo, original.status, original.details, original.provenance, original.createdAt, original.startedAt, original.endedAt, [],
      "alice", "OldName"));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector("header")?.textContent).toContain("OldName");
    expect(root.querySelector("header .tr-teammate-unavailable")).not.toBeNull();
    expect(root.querySelector("header [role=img]")?.getAttribute("aria-label")).toContain("Former teammate");
    expect(root.querySelector("header [data-avatar-color]")?.getAttribute("data-avatar-color")).toBe("Cyan");
  });
  it("keeps live progress below the reply and completed activity controls above it", async () => {
    const running = SampleData.withStatus(SampleData.reply, MessageStatus.Running, [
      SampleData.detail(0, DetailKind.Text, "I am checking the project."),
      SampleData.detail(1, DetailKind.Reasoning, "Internal reasoning fixture"),
      SampleData.detail(2, DetailKind.Command, "pwsh.exe -Command " + "long-command ".repeat(30))
    ]);
    const cancelled: string[] = [];
    const bridge = SampleData.createBridge().answer(MethodName.MessageCancel, payload => {
      cancelled.push(MessageIdParams.fromJson(payload).messageId);
      return SampleData.withStatus(running, MessageStatus.Cancelled).toJson();
    });
    TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const fixture = TestBed.createComponent(MessageCardComponent);
    fixture.componentRef.setInput("message", running);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const status = element.querySelector<HTMLElement>(".tr-reply-status")!;
    const activity = element.querySelector("tr-activity-block")!;
    expect(activity.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(status.nextElementSibling?.querySelector(".tr-message-action")).not.toBeNull();
    expect(status.textContent).toContain("Working for");
    expect(status.textContent).not.toContain("long-command");
    expect(status.querySelector("mat-spinner")).not.toBeNull();
    expect(element.querySelector("header")?.textContent).not.toContain(Resources.cancelLabel);
    [...status.querySelectorAll<HTMLButtonElement>("button")].find(t => t.textContent?.includes(Resources.cancelLabel))!.click();
    await fixture.whenStable();
    expect(cancelled).toEqual([running.id]);

    fixture.componentRef.setInput("message", SampleData.withStatus(running, MessageStatus.Completed));
    fixture.detectChanges();
    const summary = element.querySelector<HTMLElement>(".tr-reply-summary")!;
    expect(summary.previousElementSibling?.tagName).toBe("HEADER");
    expect(summary.textContent).toContain(Resources.formatWorkedFor("0s"));
    expect(summary.textContent).not.toContain(Resources.cancelLabel);
    expect(element.querySelector(".tr-reply-status")).toBeNull();
    expect(summary.querySelector("mat-spinner")).toBeNull();
    expect(element.querySelector("tr-activity-block")).toBeNull();
    summary.querySelector<HTMLElement>(".tr-activity-chevron")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector("tr-activity-block")).not.toBeNull();
    expect(summary.querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
    expect(summary.compareDocumentPosition(element.querySelector("tr-activity-block")!) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(element.textContent).toContain("Internal reasoning fixture");
    expect(element.textContent).toContain("long-command");
    summary.querySelector<HTMLElement>(".tr-activity-chevron")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(summary.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
    expect(element.querySelector("tr-activity-block")).toBeNull();
    expect(element.textContent).not.toContain("Internal reasoning fixture");
    expect(element.textContent).toContain("I am checking the project.");
  });

  it("shows a reply waiting for its turn without a timer, and times it from the moment it starts", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    try {
      vi.setSystemTime(Date.parse(SampleData.timestamp) + 3_000);
      TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
      const fixture = TestBed.createComponent(MessageCardComponent);
      const pending = SampleData.withStatus(SampleData.reply, MessageStatus.Pending);
      fixture.componentRef.setInput("message", pending);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      const status = (): string => element.querySelector(".tr-reply-status")?.textContent ?? "";

      expect(status()).toContain("Waiting for its turn");
      expect(status()).not.toContain("Working for");
      expect(element.querySelector("header")?.textContent).toContain("Pending");
      vi.advanceTimersByTime(5_000);
      fixture.detectChanges();
      expect(status()).toContain("Waiting for its turn");

      fixture.componentRef.setInput("message", SampleData.withStatus(pending, MessageStatus.Running));
      fixture.detectChanges();
      expect(status()).toContain("Working for 8s");
      vi.advanceTimersByTime(2_000);
      fixture.detectChanges();
      expect(status()).toContain("Working for 10s");
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("says Thinking… while the provider thinks without text, keeping the spinner and Stop, until the next detail arrives", async () => {
    const running = SampleData.withStatus(SampleData.reply, MessageStatus.Running, []);
    const bridge = SampleData.createBridge().answer(MethodName.MessageListOpen, () => [running.toJson()]);
    TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    const fixture = TestBed.createComponent(MessageCardComponent);
    fixture.componentRef.setInput("message", running);
    const status = (): HTMLElement => {
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(".tr-reply-status")!;
    };

    expect(status().textContent).toContain("Working for");
    bridge.emit(new Event(EventName.ReplyThinking, new MessageIdParams(running.id).toJson()));
    expect(status().textContent).toContain(Resources.thinkingLabel);
    expect(status().textContent).not.toContain("Working for");
    expect(status().querySelector("mat-spinner")).not.toBeNull();
    expect(status().textContent).toContain(Resources.cancelLabel);
    expect(status().querySelector("[aria-live]")).toBeNull();
    bridge.emit(new Event(EventName.DetailAppended, new DetailEventPayload(running.id, SampleData.detail(0, DetailKind.Reasoning, "Planning")).toJson()));
    expect(status().textContent).toContain("Working for");
    store.dispose();
  });

  it("keeps completion timing for a reply with no tool activity, without an empty activity toggle", () => {
    TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(MessageCardComponent);
    fixture.componentRef.setInput("message", SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Done.")]));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector(".tr-reply-summary")?.textContent).toContain(Resources.formatWorkedFor("0s"));
    expect(element.querySelector(".tr-activity-toggle")).toBeNull();
    fixture.componentRef.setInput("message", SampleData.userMessage);
    fixture.detectChanges();
    expect(element.querySelector(".tr-reply-status")).toBeNull();
    expect(element.querySelector(".tr-reply-summary")).toBeNull();
  });

  it("keeps an answer followed by the working tree's note as the answer and shows the note under the reply", () => {
    TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(MessageCardComponent);
    fixture.componentRef.setInput("message", SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      SampleData.detail(0, DetailKind.Text, "Done."),
      new MessageDetail(1, DetailKind.Note, "Git evidence may omit changes.", { source: "workingTree" }, SampleData.timestamp)
    ]));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector("tr-markdown")?.parentElement?.classList.contains("tr-interim")).toBe(false);
    expect(element.querySelector(".tr-activity-toggle")).toBeNull();
    expect(element.querySelector(".tr-evidence-note")?.textContent).toContain("Git evidence may omit changes.");
  });

  it("shows a running reply's text as ordinary text until a later step follows it, and the same once it ends", () => {
    TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(MessageCardComponent);
    const element = fixture.nativeElement as HTMLElement;
    const interim = (message: Message): (boolean | undefined)[] => {
      fixture.componentRef.setInput("message", message);
      fixture.detectChanges();
      return [...element.querySelectorAll("tr-markdown")].map(t => t.parentElement?.classList.contains("tr-interim"));
    };
    const narration = new MessageDetail(0, DetailKind.Text, "Looking at the project.", null, SampleData.timestamp);
    const step = new MessageDetail(1, DetailKind.Command, "npm test", null, SampleData.timestamp);
    const answer = new MessageDetail(2, DetailKind.Text, "All tests pass.", null, SampleData.timestamp);

    expect(interim(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [narration]))).toEqual([false]);
    expect(interim(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [narration, step]))).toEqual([true]);
    expect(interim(SampleData.withStatus(SampleData.reply, MessageStatus.Running, [narration, step, answer]))).toEqual([true, false]);
    expect(interim(SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [narration, step, answer]))).toEqual([true, false]);
  });

  it("shows a running reply's consecutive thoughts as one step titled by its latest paragraph until the answer follows it", () => {
    TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(MessageCardComponent);
    const lines = (details: MessageDetail[]): string[] => {
      fixture.componentRef.setInput("message", SampleData.withStatus(SampleData.reply, MessageStatus.Running, details));
      fixture.detectChanges();
      return [...(fixture.nativeElement as HTMLElement).querySelectorAll("tr-activity-block li button span")].map(t => t.textContent ?? String.empty);
    };
    const thoughts = [0, 1, 2].map(t => new MessageDetail(t, DetailKind.Reasoning, `Thought ${t}.`, null, SampleData.timestamp));

    expect(lines(thoughts)).toEqual(["Thought 2."]);
    expect(lines([...thoughts, new MessageDetail(3, DetailKind.Text, "The answer.", null, SampleData.timestamp)])).toEqual(["Thought 0."]);
  });

  it("copies what the user wrote and what the reply answered", async () => {
    const written: string[] = [];
    const clipboard = { writeText: (text: string): Promise<void> => { written.push(text); return Promise.resolve(); } };
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(MessageCardComponent);
    const element = fixture.nativeElement as HTMLElement;
    const reply = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      new MessageDetail(0, DetailKind.Text, "Looking.", null, SampleData.timestamp),
      new MessageDetail(1, DetailKind.Note, "Read: a.ts", { tool: "Read", toolUseId: "t1" }, SampleData.timestamp),
      new MessageDetail(2, DetailKind.Text, "First.", null, SampleData.timestamp),
      new MessageDetail(3, DetailKind.Text, "Second.", null, SampleData.timestamp)
    ]);

    fixture.componentRef.setInput("message", SampleData.userMessage);
    fixture.detectChanges();
    expect(element.querySelectorAll(".tr-message-action")).toHaveLength(2);
    expect(element.querySelector(".tr-message-action")?.getAttribute("aria-label")).toBe(Resources.rewindLabel);
    expect(element.getAttribute("data-message-id")).toBe(SampleData.userMessage.id);
    expect(element.querySelector(".tr-bubble")?.nextElementSibling?.querySelector(".tr-message-meta")).not.toBeNull();
    const userCopy = fixture.debugElement.query(By.css('[aria-label="Copy message"]'));
    expect(userCopy.injector.get(MatTooltip).message).toBe(Resources.copyMessageLabel);
    element.querySelectorAll<HTMLButtonElement>(".tr-message-action")[1]!.click();
    fixture.detectChanges();
    expect(userCopy.injector.get(MatTooltip).message).toBe(Resources.copiedLabel);
    expect(userCopy.nativeElement.getAttribute("aria-label")).toBe(Resources.copiedLabel);
    fixture.componentRef.setInput("message", reply);
    fixture.detectChanges();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    element.querySelector<HTMLButtonElement>(".tr-message-action")!.click();
    await fixture.whenStable();

    expect(written).toEqual([SampleData.userMessage.details.map(t => t.text).join("\n\n"), "Looking.\n\nFirst.\n\nSecond."]);
    fixture.detectChanges();
    const copyButton = (): HTMLButtonElement => element.querySelector<HTMLButtonElement>(".tr-message-action")!;
    expect(copyButton().classList.contains(Resources.copiedClass)).toBe(true);
    expect(copyButton().textContent?.trim()).toBe(Resources.copiedIcon);
    const replyTooltip = fixture.debugElement.query(By.css(".tr-message-action")).injector.get(MatTooltip);
    expect(replyTooltip.message).toBe(Resources.copiedLabel);
    expect(copyButton().getAttribute("aria-label")).toBe(Resources.copiedLabel);
    vi.advanceTimersByTime(Resources.copiedDuration);
    vi.useRealTimers();
    fixture.detectChanges();
    expect(copyButton().classList.contains(Resources.copiedClass)).toBe(false);
    expect(copyButton().textContent?.trim()).toBe(Resources.icons["copy"]);
    expect(replyTooltip.message).toBe(Resources.copyMessageLabel);
    expect(copyButton().getAttribute("aria-label")).toBe(Resources.copyMessageLabel);
    const interim = [...element.querySelectorAll("tr-markdown")].map(t => t.parentElement?.classList.contains("tr-interim"));
    expect(interim).toEqual([true, false, false]);
    expect(element.querySelector("tr-activity-block")).toBeNull();
    expect(element.textContent).toContain(Resources.formatWorkedFor("0s"));
    element.querySelector<HTMLButtonElement>(".tr-activity-toggle")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector("tr-activity-block")).not.toBeNull();
    expect(element.textContent).toContain("Read 1 file");
    fixture.componentRef.setInput("message", SampleData.withStatus(reply, MessageStatus.Running));
    fixture.detectChanges();
    expect([...element.querySelectorAll("tr-markdown")].map(t => t.parentElement?.classList.contains("tr-interim"))).toEqual([true, false, false]);
  });

  it("puts the rewound message into the box", async () => {
    const marked = new Conversation("c1", "p1", "Chat", SampleData.timestamp, SampleData.timestamp, true);
    const bridge = SampleData.createBridge()
      .answer(MethodName.ConversationRewind, () => new ConversationRewindResult(marked, ["m1", "m2"], null).toJson());
    TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    await TestBed.inject(ChatStore).initialize();
    await TestBed.inject(ChatStore).selectConversation("c1");
    const fixture = TestBed.createComponent(MessageCardComponent);
    fixture.componentRef.setInput("message", SampleData.userMessage);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(".tr-message-action")!.click();
    const dialogs = TestBed.inject(MatDialog);
    expect(dialogs.openDialogs).toHaveLength(1);
    dialogs.openDialogs[0]!.close(false);
    await vi.waitFor(() => expect(TestBed.inject(DraftService).pending()).toBe("hello"));
    expect(bridge.methods).toContain(MethodName.ConversationRewind);
  });

  describe("while a reply streams", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      TestBed.configureTestingModule({ imports: [MessageCardComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    });
    afterEach(() => vi.useRealTimers());

    const answer = "The answer is being written while you watch it appear on the screen.";
    const running = (...details: MessageDetail[]): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Running, details);
    const frames = (fixture: ComponentFixture<MessageCardComponent>, count: number): void => {
      for (let frame = 0; frame < count; frame++) {
        vi.advanceTimersByTime(16);
        fixture.detectChanges();
      }
    };
    const shown = (fixture: ComponentFixture<MessageCardComponent>): string => VisibleText.of((fixture.nativeElement as HTMLElement).querySelector("tr-markdown")!);

    it("reveals an answer that appears in a live reply, and shows an answer that was already there at once", () => {
      const live = TestBed.createComponent(MessageCardComponent);
      live.componentRef.setInput("message", running());
      live.detectChanges();
      live.componentRef.setInput("message", running(SampleData.detail(0, DetailKind.Text, answer)));
      live.detectChanges();
      const seen: string[] = [shown(live)];
      for (let frame = 0; frame < 400; frame++) {
        frames(live, 1);
        seen.push(shown(live));
      }

      expect(seen[0]).toBe("");
      expect(seen.at(-1)).toBe(answer);
      expect(new Set(seen).size).toBeGreaterThan(20);

      const revisited = TestBed.createComponent(MessageCardComponent);
      revisited.componentRef.setInput("message", running(SampleData.detail(0, DetailKind.Text, answer)));
      revisited.detectChanges();
      expect(shown(revisited)).toBe(answer);
    });

    it("reveals a thought that appears in a live reply", () => {
      const live = TestBed.createComponent(MessageCardComponent);
      live.componentRef.setInput("message", running());
      live.detectChanges();
      live.componentRef.setInput("message", running(SampleData.detail(0, DetailKind.Reasoning, "Weighing the options")));
      live.detectChanges();
      const title = (): string => (live.nativeElement as HTMLElement).querySelector("tr-activity-block li button span")?.textContent ?? String.empty;

      expect(title()).toBe("");
      frames(live, 300);
      expect(title()).toBe("Weighing the options");
    });

    it("copies and rewinds with the whole answer while it is still being revealed", () => {
      const written: string[] = [];
      Object.defineProperty(navigator, "clipboard", { value: { writeText: (text: string): Promise<void> => { written.push(text); return Promise.resolve(); } }, configurable: true });
      const live = TestBed.createComponent(MessageCardComponent);
      live.componentRef.setInput("message", running());
      live.detectChanges();
      live.componentRef.setInput("message", running(SampleData.detail(0, DetailKind.Text, answer)));
      live.detectChanges();
      frames(live, 3);
      expect(shown(live).length).toBeLessThan(answer.length);

      (live.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(".tr-message-action")[0]!.click();

      expect(written).toEqual([answer]);
    });

    it("shows the rest quickly once the reply has ended, without waiting for it to end the status", () => {
      const live = TestBed.createComponent(MessageCardComponent);
      live.componentRef.setInput("message", running());
      live.detectChanges();
      live.componentRef.setInput("message", running(SampleData.detail(0, DetailKind.Text, answer)));
      live.detectChanges();
      frames(live, 5);

      live.componentRef.setInput("message", SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, answer)]));
      live.detectChanges();
      expect((live.nativeElement as HTMLElement).querySelector(".tr-reply-status")).toBeNull();
      expect(shown(live).length).toBeLessThan(answer.length);
      frames(live, 60);

      expect(shown(live)).toBe(answer);
    });
  });
});
