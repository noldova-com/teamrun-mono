/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { MatDialog } from "@angular/material/dialog";
import { MatTooltip } from "@angular/material/tooltip";

import { Conversation, ConversationRewindResult, DetailKind, Message, MessageDetail, MessageIdParams, MessageStatus, MethodName } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
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
      original.inReplyTo, original.status, original.details, original.provenance, original.createdAt, original.endedAt, [], "alice", "OldName"));
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
    expect([...element.querySelectorAll("tr-markdown")].every(t => t.parentElement?.classList.contains("tr-interim"))).toBe(true);
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
});
