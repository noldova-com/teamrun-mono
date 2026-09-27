/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { AttachmentInput, AuthStatus, Conversation, ConversationMember, ErrorCode, MessageAttachment, MessageSendParams, MessageSendResult, MessageStatus,
  MethodName, ProviderAccount, ProviderListModelsParams, ProviderModel, UpdateCheckpoint, UpdateCheckpointPhase, UpdateCheckpointResult } from "@noldova/teamrun-protocol";

import type { FakeTeamRunBridge } from "../../../fixtures/fake-teamrun-bridge";
import { MemoryDraftStore } from "../../../fixtures/memory-draft-store";
import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { TeammateFixture } from "../../../fixtures/teammate-fixture";
import { PreferencesService } from "../../../../src/app/services/preferences.service";
import { ComposerSettings } from "../../../../src/app/models/composer-settings";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { COMPOSER_DRAFT_STORE } from "../../../../src/app/services/composer-drafts.service";
import { DraftService } from "../../../../src/app/services/draft.service";
import { ComposerComponent } from "../../../../src/app/components/composer/composer.component";

describe("ComposerComponent", () => {
  beforeEach(() => MemoryStorage.install(window));

  it("filters accounts by provider and sends with the selected local account", async () => {
    const second = new ProviderAccount("a2", "claude", "Home", "D:/home", AuthStatus.LoggedIn, null, null, null, null, "t");
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => []).answer(MethodName.ApprovalList, () => [])
      .answer(MethodName.ProviderAccountList, () => [SampleData.account.toJson(), second.toJson()])
      .answer(MethodName.ProviderModelCatalog, payload => ProviderListModelsParams.fromJson(payload).providerAccountId === "a2"
        ? [new ProviderModel("other", "Other model", "", ["low"], true, null, true).toJson()]
        : [new ProviderModel("gpt-5", "GPT5", "", ["high"], true, null, true).toJson()])
      .answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    TestBed.inject(PreferencesService).rememberComposer("c1", new ComposerSettings("codex", "gpt-5", "high", "a1"));
    const fixture = TestBed.createComponent(ComposerComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>(".tr-settings-trigger")!.click();
    await fixture.whenStable();
    const menu = document.querySelector(".mat-mdc-menu-panel")!;
    const labels = Array.from(menu.querySelectorAll(".tr-menu-label")).map(t => t.textContent?.trim());
    expect(labels.indexOf("Account")).toBeLessThan(labels.findIndex(t => t?.startsWith("Model")));
    expect(labels.indexOf("Provider")).toBeLessThan(labels.indexOf("Account"));
    expect(menu.textContent).toContain("Work · This computer");
    expect(menu.textContent).not.toContain("Home · This computer");
    Array.from(menu.querySelectorAll<HTMLButtonElement>("button[mat-menu-item]")).find(t => t.textContent?.trim().endsWith("Claude Code"))!.click();
    await fixture.whenStable();
    expect(root.querySelector(".tr-settings-trigger")?.textContent).toContain("Claude Code · Default sign-in · This computer");
    root.querySelector<HTMLButtonElement>(".tr-settings-trigger")!.click();
    await fixture.whenStable();
    const nextMenu = document.querySelector(".mat-mdc-menu-panel")!;
    expect(nextMenu.textContent).not.toContain("Work · This computer");
    Array.from(nextMenu.querySelectorAll<HTMLButtonElement>("button[mat-menu-item]")).find(t => t.textContent?.trim().endsWith("Home · This computer"))!.click();
    await fixture.whenStable();
    expect(root.querySelector(".tr-settings-trigger")?.textContent).toContain("Claude Code · Home · This computer");
    expect(root.querySelector(".tr-settings-trigger")?.textContent).not.toContain("GPT5");
    const box = root.querySelector<HTMLTextAreaElement>("textarea")!;
    box.value = "hello";
    box.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    root.querySelector("form")!.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    const params = MessageSendParams.fromJson(bridge.requests.find(t => t.method === MethodName.MessageSend)!.payload);
    expect(params.providerAccountId).toBe("a2");
    expect(params.requested?.provider).toBe("claude");
    expect(params.requested?.model).toBeNull();
    expect(params.requested?.effort).toBeNull();
  });

  it("updates the named teammate's durable model without changing the unnamed responder's settings", async () => {
    const data = new TeammateFixture();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const preferences = TestBed.inject(PreferencesService);
    preferences.rememberComposer("c1", new ComposerSettings("codex", "gpt-5", "medium", null, "alice"));
    const fixture = TestBed.createComponent(ComposerComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>(".tr-settings-trigger")!.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')).find(t => t.textContent?.trim().endsWith("gpt-5-mini"))!.click();
    await fixture.whenStable();
    expect(store.teammate("alice")?.model).toBe("gpt-5-mini");
    expect(preferences.composerFor("c1")?.model).toBe("gpt-5");
    expect(data.bridge.methods).toContain(MethodName.TeammateUpdate);
    await store.removeMember("c1", "alice");
    await fixture.whenStable();
    expect(preferences.composerFor("c1")?.responderTeammateId).toBeNull();
    expect(root.querySelector(".tr-settings-trigger")?.textContent).toContain("gpt-5");
  });
  it("completes members first without sending, resolves mentions and continues with the mentioned teammate", async () => {
    const data = new TeammateFixture();
    data.bridge.answer(MethodName.MessageSend, () => {
      data.members.push(new ConversationMember("c1", "bob", "t", null, false));
      return new MessageSendResult(SampleData.userMessage, []).toJson();
    });
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const preferences = TestBed.inject(PreferencesService);
    preferences.rememberComposer("c1", new ComposerSettings("codex", null, null, null, "alice"));
    const fixture = TestBed.createComponent(ComposerComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector(".tr-settings-trigger")?.textContent).toContain("Alice");
    expect(root.querySelector(".tr-settings-trigger [data-avatar-color]")?.getAttribute("data-avatar-color")).toBe("Cyan");
    const input = root.querySelector<HTMLTextAreaElement>("textarea")!;
    input.value = "@";
    input.setSelectionRange(1, 1);
    input.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    expect(Array.from(root.querySelectorAll('[role="option"] .truncate')).map(t => t.textContent?.trim())).toEqual(["Alice", "Bob", "Offline"]);
    expect(Array.from(root.querySelectorAll('[role="option"] [data-avatar-color]')).slice(0, 2)
      .map(t => t.getAttribute("data-avatar-color"))).toEqual(["Cyan", "Purple"]);
    for (const option of root.querySelectorAll<HTMLElement>('[role="option"]'))
      option.scrollIntoView = vi.fn();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await fixture.whenStable();
    expect(input.value).toBe("@Bob ");
    expect(data.bridge.methods).not.toContain(MethodName.MessageSend);
    root.querySelector<HTMLButtonElement>(".tr-send")!.click();
    await fixture.whenStable();
    const params = MessageSendParams.fromJson(data.bridge.requests.find(t => t.method === MethodName.MessageSend)!.payload);
    expect(params.mentionedTeammateIds).toEqual(["bob"]);
    expect(params.responderTeammateId).toBe("alice");
    expect(params.requested).toBeNull();
    expect(preferences.composerFor("c1")?.responderTeammateId).toBe("bob");
    expect(input.value).toBe("");
    fixture.destroy();
    const reopened = TestBed.createComponent(ComposerComponent);
    await reopened.whenStable();
    expect((reopened.nativeElement as HTMLElement).querySelector(".tr-settings-trigger")?.textContent).toContain("Bob");
  });

  it("continues with the last mentioned teammate only after a successful send, in the conversation that sent it", async () => {
    const data = new TeammateFixture();
    let store: ChatStore | null = null;
    let switchDuringSend = false;
    const sent = async (): Promise<JsonValue> => {
      if (!data.members.some(t => t.teammateId === "bob"))
        data.members.push(new ConversationMember("c1", "bob", "t", null, false));
      if (switchDuringSend)
        await store?.selectConversation("c2");
      return new MessageSendResult(SampleData.userMessage, []).toJson();
    };
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    data.members.push(new ConversationMember("c2", "alice", "t", null, false));
    data.bridge.answer(MethodName.MessageSend, sent)
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge }] });
    store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const preferences = TestBed.inject(PreferencesService);
    preferences.rememberComposer("c1", new ComposerSettings("codex", null, null, null));
    const fixture = TestBed.createComponent(ComposerComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLTextAreaElement>("textarea")!;
    const send = async (text: string): Promise<void> => {
      input.value = text;
      input.dispatchEvent(new Event("input"));
      await fixture.whenStable();
      root.querySelector<HTMLButtonElement>(".tr-send")!.click();
      await fixture.whenStable();
    };

    await send("@Alice and @Bob, please review");
    const first = MessageSendParams.fromJson(data.bridge.requests.filter(t => t.method === MethodName.MessageSend).at(-1)!.payload);
    expect(first.mentionedTeammateIds).toEqual(["alice", "bob"]);
    expect(preferences.composerFor("c1")?.responderTeammateId).toBe("bob");
    expect(root.querySelector(".tr-settings-trigger")?.textContent).toContain("Bob");

    data.bridge.fail(MethodName.MessageSend, ErrorCode.Unavailable, "Disconnected");
    await send("@Alice, once more");
    expect(store.error()).toBe("Disconnected");
    expect(preferences.composerFor("c1")?.responderTeammateId).toBe("bob");

    data.bridge.answer(MethodName.MessageSend, sent);
    switchDuringSend = true;
    await send("@Alice, back to you");
    expect(store.selectedConversationId()).toBe("c2");
    expect(preferences.composerFor("c1")?.responderTeammateId).toBe("alice");
    expect(preferences.composerFor("c2")?.responderTeammateId ?? null).toBeNull();
    store.dispose();
  });

  it("answers with the default responder while the chosen teammate is unavailable, and keeps the choice", async () => {
    const data = new TeammateFixture();
    data.members.push(new ConversationMember("c1", "offline", "t", null, false));
    data.bridge.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const preferences = TestBed.inject(PreferencesService);
    preferences.rememberComposer("c1", new ComposerSettings("codex", "gpt-5", "high", null, "offline"));
    const fixture = TestBed.createComponent(ComposerComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector(".tr-settings-trigger")?.textContent).not.toContain("Offline");
    const input = root.querySelector<HTMLTextAreaElement>("textarea")!;
    input.value = "Any news?";
    input.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>(".tr-send")!.click();
    await fixture.whenStable();
    const params = MessageSendParams.fromJson(data.bridge.requests.find(t => t.method === MethodName.MessageSend)!.payload);
    expect(params.responderTeammateId).toBeNull();
    expect(params.mentionedTeammateIds).toEqual([]);
    expect(params.requested?.provider).toBe("codex");
    expect(preferences.composerFor("c1")?.responderTeammateId).toBe("offline");
    store.dispose();
  });

  it("uses each model's image and effort capabilities", async () => {
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => []).answer(MethodName.ApprovalList, () => [])
      .answer(MethodName.ProviderModelCatalog, () => [
        new ProviderModel("text", "Text only", "", ["low"], true, null, false),
        new ProviderModel("image", "Image capable", "", ["high"], false, null, true)
      ].map(t => t.toJson()));
    TestBed.configureTestingModule({ imports: [ComposerComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    await TestBed.inject(ChatStore).initialize();
    await TestBed.inject(ChatStore).selectConversation("c1");
    const fixture = TestBed.createComponent(ComposerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [new File(["fixture"], "image.png", { type: "image/png" })] });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => { fixture.detectChanges(); expect(root.textContent).toContain("does not support images"); });
    expect(root.querySelector<HTMLButtonElement>(".tr-send")?.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>(".tr-settings-trigger")!.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLButtonElement>("button[mat-menu-item]")).find(t => t.textContent?.includes("Image capable"))!.click();
    await fixture.whenStable();
    expect(root.textContent).not.toContain("does not support images");
    expect(root.querySelector<HTMLButtonElement>(".tr-send")?.disabled).toBe(false);
    root.querySelector<HTMLButtonElement>(".tr-settings-trigger")!.click();
    await fixture.whenStable();
    const choices = Array.from(document.querySelectorAll<HTMLButtonElement>("button[mat-menu-item]")).map(t => t.textContent?.trim());
    expect(choices.some(t => t?.endsWith("high"))).toBe(true);
    expect(choices.some(t => t?.endsWith("low"))).toBe(false);
    expect(bridge.methods).not.toContain(MethodName.MessageSend);
  });
  it("prepares files sequentially and keeps the draft when a later preparation fails", async () => {
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => []).answer(MethodName.ApprovalList, () => []);
    let completeFirst: ((value: JsonValue) => void) | null = null;
    let uploads = 0;
    bridge.answer(MethodName.AttachmentPrepare, () => {
      uploads++;
      if (uploads === 1)
        return new Promise(resolve => completeFirst = resolve);
      throw new Error("Preparation failed");
    });
    TestBed.configureTestingModule({ imports: [ComposerComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const fixture = TestBed.createComponent(ComposerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const files = Array.from({ length: 10 }, (_, index) => {
      const file = new File(["a"], `${index}.bin`);
      Object.defineProperty(file, "size", { value: 100 * 1024 * 1024 });
      return file;
    });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: files });
    input.dispatchEvent(new Event("change"));
    await fixture.whenStable();
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(10);
    root.querySelector('form')!.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(uploads).toBe(1));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(uploads).toBe(1);
    completeFirst!(new MessageAttachment("0.bin", "application/octet-stream", 1, "D:/data/attachments/drafts/first.bin").toJson());
    await vi.waitFor(() => expect(bridge.requests.filter(t => t.method === MethodName.AttachmentDiscard)).toHaveLength(1));
    await fixture.whenStable();
    expect(uploads).toBe(2);
    expect(bridge.requests.some(t => t.method === MethodName.MessageSend)).toBe(false);
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(10);
    expect(root.querySelector('[role="alert"]')?.textContent).toContain("could not be read");
    store.dispose();
  });
  it("picks and pastes files, preserves them on failure, then sends a file-only message", async () => {
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => []).answer(MethodName.ApprovalList, () => []);
    bridge.fail(MethodName.MessageSend, ErrorCode.Unavailable, "Disconnected");
    TestBed.configureTestingModule({ imports: [ComposerComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const fixture = TestBed.createComponent(ComposerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    const form = root.querySelector('form')!;
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [file, file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await fixture.whenStable();
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { files: [file] } });
    form.dispatchEvent(paste);
    await fixture.whenStable();
    expect(paste.defaultPrevented).toBe(true);
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    root.querySelector<HTMLButtonElement>('button[aria-label="Remove attachment: notes.txt"]')!.click();
    await fixture.whenStable();
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await fixture.whenStable();
    await vi.waitFor(() => expect(bridge.requests.filter(t => t.method === MethodName.MessageSend)).toHaveLength(1));
    await fixture.whenStable();
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(2);
    expect(store.error()).toBe("Disconnected");
    const sent = bridge.requests.find(t => t.method === MethodName.MessageSend)!;
    const params = MessageSendParams.fromJson(sent.payload);
    expect(params.text).toBe("");
    expect(params.attachments.map(t => t.data)).toEqual([null, null]);
    expect(params.attachments[0]?.path).toBe("D:/data/attachments/drafts/notes.txt");
    const uploaded = bridge.requests.filter(t => t.method === MethodName.AttachmentPrepare);
    expect(uploaded.map(t => AttachmentInput.fromJson(t.payload).data)).toEqual(["aGVsbG8=", "aGVsbG8="]);
    expect(bridge.requests.filter(t => t.method === MethodName.AttachmentDiscard)).toHaveLength(2);
    bridge.answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson());
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(bridge.requests.filter(t => t.method === MethodName.MessageSend)).toHaveLength(2));
    await fixture.whenStable();
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(0);
    store.dispose();
  });

  it("restores saved attachments after rewind and rejects oversized files without losing the draft", async () => {
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => []).answer(MethodName.ApprovalList, () => []);
    bridge.fail(MethodName.MessageSend, ErrorCode.Unavailable, "Disconnected");
    TestBed.configureTestingModule({ imports: [ComposerComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const fixture = TestBed.createComponent(ComposerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    TestBed.inject(DraftService).offer("retry", [new MessageAttachment("notes.txt", "text/plain", 5, "D:/data/attachments/saved.txt")]);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(1);
    const file = new File(["a"], "too-big.bin");
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change"));
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain("100 MiB");
    expect(root.querySelectorAll('[role="listitem"]')).toHaveLength(1);
    root.querySelector('form')!.dispatchEvent(new Event("submit", { cancelable: true }));
    await fixture.whenStable();
    const sent = bridge.requests.find(t => t.method === MethodName.MessageSend)!;
    expect(MessageSendParams.fromJson(sent.payload).attachments[0]?.path).toBe("D:/data/attachments/saved.txt");
    expect(root.querySelector('textarea')?.value).toBe("retry");
    store.dispose();
  });
  it("retains the draft when the runtime rejects sending", async () => {
    const bridge = SampleData.createBridge().answer(MethodName.MessageList, () => []).answer(MethodName.ApprovalList, () => []);
    bridge.fail(MethodName.MessageSend, ErrorCode.Unavailable, "Disconnected");
    TestBed.configureTestingModule({ imports: [ComposerComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const fixture = TestBed.createComponent(ComposerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const textarea = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Keep this draft";
    textarea.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    fixture.detectChanges();
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(textarea.value).toBe("Keep this draft");
    expect((fixture.nativeElement as HTMLElement).querySelector(".tr-composer-highlight")?.textContent).toBe("Keep this draft\u200b");
    expect(store.error()).toBe("Disconnected");
    store.dispose();
  });

  it("sends on Enter once a conversation is idle", async () => {
    const bridge = SampleData.createBridge()
      .answer(MethodName.MessageList, () => [SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson()])
      .answer(MethodName.ApprovalList, () => [])
      .answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, [SampleData.reply]).toJson());
    TestBed.configureTestingModule({ imports: [ComposerComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(ComposerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const textarea = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>("textarea");
    expect(textarea?.disabled).toBe(true);

    await store.initialize();
    await store.selectConversation("c1");
    await fixture.whenStable();
    fixture.detectChanges();
    expect(textarea?.disabled).toBe(false);
    expect(bridge.methods).toContain(MethodName.ProviderModelCatalog);

    textarea!.value = "  ship it  ";
    textarea!.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    fixture.detectChanges();
    textarea!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true }));
    textarea!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await fixture.whenStable();
    fixture.detectChanges();

    const sent = bridge.requests.filter(t => t.method === MethodName.MessageSend);
    expect(sent).toHaveLength(1);
    expect((sent[0]?.payload as { text: string; requested: { provider: string } }).text).toBe("ship it");

    expect((sent[0]?.payload as { text: string; requested: { provider: string } }).requested.provider).toBe("codex");
    expect(textarea?.value).toBe("");
    expect((fixture.nativeElement as HTMLElement).querySelector(".tr-composer-highlight")?.textContent).toBe("\u200b");
    expect(textarea?.disabled).toBe(true);

    const drafts = TestBed.inject(DraftService);
    drafts.offer("ship it again");
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(textarea!.value).toBe("ship it again");
    expect((fixture.nativeElement as HTMLElement).querySelector(".tr-composer-highlight")?.textContent).toBe("ship it again\u200b");
    expect(drafts.pending()).toBeNull();
    store.dispose();
  });

  it("saves the draft for updating or quitting when no provider is available", async () => {
    const result = await prepareRestart(SampleData.createBridge().answer(MethodName.ProviderList, () => []));
    expect(result).toEqual({ ready: true, draft: "kept across the restart", composer: null });
  });

  it("saves the draft while the model list is loading and keeps the remembered composer choice", async () => {
    const remembered = new ComposerSettings("codex", "gpt-5", "high", "a1");
    const bridge = SampleData.createBridge().answer(MethodName.ProviderModelCatalog, () => new Promise<JsonValue>(() => undefined));
    const result = await prepareRestart(bridge, remembered);
    expect(result).toEqual({ ready: true, draft: "kept across the restart", composer: remembered });
  });

  it("remembers a complete composer choice when saving for a restart", async () => {
    const result = await prepareRestart(SampleData.createBridge());
    expect(result.ready).toBe(true);
    expect(result.composer?.provider).toBe("codex");
  });

  async function prepareRestart(bridge: FakeTeamRunBridge, remembered: ComposerSettings | null = null)
    : Promise<{ ready: boolean; draft: string | undefined; composer: ComposerSettings | null }> {
    const storage = new MemoryDraftStore();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }, { provide: COMPOSER_DRAFT_STORE, useValue: storage }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    const preferences = TestBed.inject(PreferencesService);
    if (remembered)
      preferences.rememberComposer("c1", remembered);
    const fixture = TestBed.createComponent(ComposerComponent);
    await fixture.whenStable();
    const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>("textarea")!;
    box.value = "kept across the restart";
    box.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    for (const listener of bridge.checkpointListeners)
      listener(new UpdateCheckpoint("restart", UpdateCheckpointPhase.Prepare).toJson());
    await vi.waitFor(() => expect(bridge.checkpoints.length).toBe(1));
    const ready = UpdateCheckpointResult.fromJson(bridge.checkpoints[0]).ready;
    for (const listener of bridge.checkpointListeners)
      listener(new UpdateCheckpoint("restart", UpdateCheckpointPhase.Resume).toJson());
    store.dispose();
    return { ready, draft: storage.drafts.get("c1")?.text, composer: preferences.composerFor("c1") };
  }
});
