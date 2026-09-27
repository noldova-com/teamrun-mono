/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";

import { Conversation, Event, EventName, MessageStatus, MethodName } from "@noldova/teamrun-protocol";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { SampleData } from "../../fixtures/sample-data";
import { AppView } from "../../../src/app/enums/app-view";
import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelId } from "../../../src/app/enums/panel-id";
import { SettingsSection } from "../../../src/app/enums/settings-section";
import { ShortcutAction } from "../../../src/app/enums/shortcut-action";
import { TabDropTarget } from "../../../src/app/models/tab-drop-target";
import { TabGroup } from "../../../src/app/models/tab-group";
import { Resources } from "../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";
import { NavigationService } from "../../../src/app/services/navigation.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { ShortcutsService } from "../../../src/app/services/shortcuts.service";

describe("ShortcutsService", () => {
  let started: ShortcutsService | null = null;
  let opened: ChatStore | null = null;

  const press = (document: Document, key: string, modifiers: Partial<KeyboardEventInit> = {}): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers });
    document.body.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    MemoryStorage.install(window);
    started = null;
    opened = null;
  });

  afterEach(() => {
    started?.stop();
    opened?.dispose();
  });

  it("describes shortcuts", () => {
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const shortcuts = TestBed.inject(ShortcutsService);
    const described = Object.fromEntries(Resources.shortcuts.map(t => [t.action, shortcuts.describe(t)]));

    expect(described[ShortcutAction.NewConversation]).toBe("Ctrl + N");
    expect(described[ShortcutAction.StopOrBack]).toBe("Esc");
    expect(described[ShortcutAction.PreviousConversation]).toBe("Alt + ↑");
    expect(described[ShortcutAction.NewLine]).toBe("Shift + Enter");
    expect(shortcuts.keysOf(ShortcutAction.ToggleSidebar)).toBe("Ctrl + B");
    expect(shortcuts.keysOf(ShortcutAction.Back)).toBe("Alt + ←");
    expect(shortcuts.keysOf(ShortcutAction.Search)).toBe("Ctrl + K");
  });

  it("handles the window's shortcuts while started and leaves handled keys alone", async () => {
    const bridge = SampleData.createBridge()
      .answer(MethodName.ProjectList, () => [SampleData.project.toJson()])
      .answer(MethodName.ConversationCreate, () => new Conversation("c9", "p1", "New", SampleData.timestamp, SampleData.timestamp).toJson())
      .answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson())
      .answer(MethodName.MessageList, () => [SampleData.userMessage.toJson(), SampleData.withStatus(SampleData.reply, MessageStatus.Completed).toJson()])
      .answer(MethodName.MessageCancel, () => SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson());
    bridge.pickedDirectory = "D:\\picked";
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const document = TestBed.inject(DOCUMENT);
    const store = TestBed.inject(ChatStore);
    const navigation = TestBed.inject(NavigationService);
    const shortcuts = TestBed.inject(ShortcutsService);
    started = shortcuts;
    opened = store;
    await store.initialize();
    await store.selectConversation("c1");
    let focused = 0;
    shortcuts.attachComposer(() => { focused += 1; });

    press(document, ",", { ctrlKey: true });
    expect(navigation.view()).toBe(AppView.Chat);

    shortcuts.start();
    expect(press(document, ",", { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(navigation.view()).toBe(AppView.Settings);
    press(document, "Escape");
    expect(navigation.view()).toBe(AppView.Chat);
    press(document, "/", { metaKey: true });
    expect(navigation.section()).toBe(SettingsSection.Shortcuts);
    press(document, "l", { ctrlKey: true });
    expect(navigation.view()).toBe(AppView.Chat);
    await vi.waitFor(() => expect(focused).toBe(1));
    press(document, "b", { ctrlKey: true });
    expect(TestBed.inject(LayoutService).dock(DockSide.Left).collapsed).toBe(true);
    press(document, "b", { ctrlKey: true });
    expect(TestBed.inject(LayoutService).dock(DockSide.Left).collapsed).toBe(false);
    press(document, "j", { ctrlKey: true });
    expect(TestBed.inject(LayoutService).dock(DockSide.Bottom).collapsed).toBe(false);
    press(document, "E", { ctrlKey: true, shiftKey: true });
    expect(TestBed.inject(LayoutService).isOpen(PanelId.Explorer)).toBe(false);
    press(document, "D", { ctrlKey: true, shiftKey: true });
    expect(TestBed.inject(LayoutService).isOpen(PanelId.Changes)).toBe(false);
    press(document, "A", { ctrlKey: true, shiftKey: true });
    expect(TestBed.inject(LayoutService).isOpen(PanelId.Activity)).toBe(false);
    press(document, "e", { ctrlKey: true, shiftKey: true });
    expect(TestBed.inject(LayoutService).isOpen(PanelId.Explorer)).toBe(true);
    TestBed.tick();
    TestBed.inject(LayoutService).movePanel(PanelId.Changes, new TabDropTarget(TabGroup.documentsId, 0));
    expect(navigation.view()).toBe(AppView.Panel);
    expect(press(document, "w", { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(TestBed.inject(LayoutService).isOpen(PanelId.Changes)).toBe(false);
    expect(TestBed.inject(LayoutService).documents()).toEqual(["c1"]);
    expect(navigation.view()).toBe(AppView.Chat);
    expect(press(document, "w", { ctrlKey: true }).defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(TestBed.inject(LayoutService).documents()).toEqual([]));
    expect(store.selectedConversationId()).toBeNull();
    expect(press(document, "w", { ctrlKey: true }).defaultPrevented).toBe(false);
    await store.selectConversation("c1");
    press(document, "k", { ctrlKey: true });
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
    TestBed.inject(MatDialog).closeAll();

    shortcuts.attachComposer(null);
    press(document, "l", { ctrlKey: true });
    expect(focused).toBe(1);
    shortcuts.attachComposer(() => { focused += 1; });
    expect(focused).toBe(2);
    shortcuts.attachComposer(() => { focused += 1; });
    expect(focused).toBe(2);

    press(document, "n", { ctrlKey: true });
    await vi.waitFor(() => expect(store.selectedConversationId()).toBe("c9"));
    press(document, "o", { ctrlKey: true });
    await vi.waitFor(() => expect(bridge.methods.filter(t => t === MethodName.ProjectOpen)).toHaveLength(1));

    expect(press(document, "Escape").defaultPrevented).toBe(false);
    await store.selectConversation("c1");
    store.apply(new Event(EventName.MessageUpdated, SampleData.withStatus(SampleData.reply, MessageStatus.Running).toJson()));
    expect(store.runningReply()).not.toBeNull();
    expect(press(document, "Escape").defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(bridge.methods).toContain(MethodName.MessageCancel));

    const handled = new KeyboardEvent("keydown", { key: "n", ctrlKey: true, bubbles: true, cancelable: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    expect(press(document, "n").defaultPrevented).toBe(false);
    expect(press(document, "Enter", { shiftKey: true }).defaultPrevented).toBe(false);
    expect(bridge.methods.filter(t => t === MethodName.ConversationCreate)).toHaveLength(1);

    shortcuts.stop();
    press(document, ",", { ctrlKey: true });
    expect(navigation.view()).toBe(AppView.Chat);
  });

  it("steps through the recent conversations", async () => {
    const older = new Conversation("c0", "p1", "Older", "2026-09-01T08:00:00.000Z", "2026-09-01T08:00:00.000Z");
    const bridge = SampleData.createBridge()
      .answer(MethodName.ProjectList, () => [SampleData.project.toJson()])
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), older.toJson()]);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const document = TestBed.inject(DOCUMENT);
    const store = TestBed.inject(ChatStore);
    const shortcuts = TestBed.inject(ShortcutsService);
    started = shortcuts;
    opened = store;
    await store.initialize();
    await store.selectConversation("c1");
    shortcuts.start();
    expect(store.selectedConversationId()).toBe("c1");

    press(document, "ArrowDown", { altKey: true });
    await vi.waitFor(() => expect(store.selectedConversationId()).toBe("c0"));
    press(document, "ArrowDown", { altKey: true });
    await store.stepConversation(1);
    expect(store.selectedConversationId()).toBe("c0");
    press(document, "ArrowUp", { altKey: true });
    await vi.waitFor(() => expect(store.selectedConversationId()).toBe("c1"));

    TestBed.tick();
    press(document, "ArrowLeft", { altKey: true });
    await vi.waitFor(() => expect(store.selectedConversationId()).toBe("c0"));
    TestBed.tick();
    press(document, "ArrowRight", { altKey: true });
    await vi.waitFor(() => expect(store.selectedConversationId()).toBe("c1"));
  });
});
