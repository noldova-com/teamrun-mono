/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { Conversation, MethodName } from "@noldova/teamrun-protocol";

import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { AppView } from "../../../../src/app/enums/app-view";
import { PanelKind } from "../../../../src/app/enums/panel-kind";
import { ImageSource } from "../../../../src/app/models/image-source";
import { Panel } from "../../../../src/app/models/panel";
import { TabDropTarget } from "../../../../src/app/models/tab-drop-target";
import { TabGroup } from "../../../../src/app/models/tab-group";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { DocumentsService } from "../../../../src/app/services/documents.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { NavigationService } from "../../../../src/app/services/navigation.service";
import { DocumentTabsComponent } from "../../../../src/app/components/document-tabs/document-tabs.component";

describe("DocumentTabsComponent", () => {
  const changes = new Panel(PanelKind.Changes);
  const activity = new Panel(PanelKind.Activity);

  it("switches image tabs and closes them with the cross or middle click without closing conversations", async () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [DocumentTabsComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const store = TestBed.inject(ChatStore);
    const navigation = TestBed.inject(NavigationService);
    await store.initialize();
    await store.selectConversation("c1");
    const fixture = TestBed.createComponent(DocumentTabsComponent);
    navigation.openImage(new ImageSource("1", "first.png", "D:/first.png", null));
    navigation.openImage(new ImageSource("2", "second.png", "D:/second.png", null));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const tabs = (): HTMLButtonElement[] => Array.from(root.querySelectorAll<HTMLButtonElement>('.tr-image-tab'));
    expect(tabs()).toHaveLength(2);
    tabs()[0]!.click();
    fixture.detectChanges();
    expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
    tabs()[1]!.dispatchEvent(new MouseEvent('auxclick', { button: 2, bubbles: true }));
    expect(navigation.images()).toHaveLength(2);
    tabs()[1]!.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(tabs()).toHaveLength(1);
    expect(store.selectedConversationId()).toBe('c1');
    tabs()[0]!.querySelector<HTMLElement>('.tr-tab-close')!.click();
    fixture.detectChanges();
    expect(navigation.images()).toHaveLength(0);
    expect(navigation.view()).toBe(AppView.Chat);
    expect(store.selectedConversationId()).toBe('c1');
    store.dispose();
  });
  it("shows the open conversations, switches on a click, and closes on the cross", async () => {
    MemoryStorage.install(window);
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge().answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    TestBed.configureTestingModule({ imports: [DocumentTabsComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    TestBed.inject(DocumentsService);
    const fixture = TestBed.createComponent(DocumentTabsComponent);
    const element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(element.classList.contains("hidden")).toBe(true);

    await store.initialize();
    await store.selectConversation("c1");
    TestBed.tick();
    await store.selectConversation("c2");
    fixture.detectChanges();
    const tabs = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>(".tr-tab"));
    expect(element.classList.contains("hidden")).toBe(false);
    expect(tabs().map(t => t.querySelector("span")?.textContent)).toEqual(["First", "Second"]);
    expect(tabs()[1]!.classList.contains("tr-tab-active")).toBe(true);
    expect(tabs()[0]!.querySelector("mat-progress-spinner")).not.toBeNull();
    expect(tabs()[1]!.querySelector("mat-progress-spinner")).toBeNull();

    tabs()[0]!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(store.selectedConversationId()).toBe("c1");
    expect(tabs()[0]!.classList.contains("tr-tab-active")).toBe(true);

    tabs()[0]!.querySelector<HTMLElement>(".tr-tab-close")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(TestBed.inject(LayoutService).documents()).toEqual(["c2"]);
    expect(store.selectedConversationId()).toBe("c2");

    const navigation = TestBed.inject(NavigationService);
    navigation.openSettings();
    fixture.detectChanges();
    const settingsTab = (): HTMLButtonElement => element.querySelector<HTMLButtonElement>(".tr-settings-tab")!;
    expect(settingsTab().classList.contains("tr-tab-active")).toBe(true);
    expect(tabs()[0]!.classList.contains("tr-tab-active")).toBe(false);
    tabs()[0]!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(navigation.view()).toBe(AppView.Chat);
    expect(settingsTab()).not.toBeNull();
    expect(settingsTab().classList.contains("tr-tab-active")).toBe(false);
    settingsTab().click();
    fixture.detectChanges();
    expect(navigation.view()).toBe(AppView.Settings);
    settingsTab().querySelector<HTMLElement>(".tr-tab-close")!.click();
    fixture.detectChanges();
    expect(element.querySelector(".tr-settings-tab")).toBeNull();
    expect(navigation.view()).toBe(AppView.Chat);
    store.dispose();
  });

  it("middle-closes background, active, and Settings tabs without deleting conversations or cancelling replies", async () => {
    MemoryStorage.install(window);
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge().answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    TestBed.configureTestingModule({ imports: [DocumentTabsComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const layout = TestBed.inject(LayoutService);
    TestBed.inject(DocumentsService);
    const fixture = TestBed.createComponent(DocumentTabsComponent);
    const element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await store.initialize();
    await store.selectConversation("c1");
    TestBed.tick();
    await store.selectConversation("c2");
    fixture.detectChanges();
    const first = element.querySelector<HTMLElement>('[data-conversation-id="c1"] .tr-tab-label')!;
    const right = new MouseEvent("auxclick", { button: 2, bubbles: true, cancelable: true });
    first.dispatchEvent(right);
    expect(right.defaultPrevented).toBe(false);
    expect(layout.documents()).toEqual(["c1", "c2"]);
    const down = new MouseEvent("mousedown", { button: 1, bubbles: true, cancelable: true });
    first.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    const middle = new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true });
    first.dispatchEvent(middle);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(middle.defaultPrevented).toBe(true);
    expect(layout.documents()).toEqual(["c2"]);
    expect(store.selectedConversationId()).toBe("c2");
    expect(store.hasConversation("c1")).toBe(true);
    expect(bridge.methods).not.toContain(MethodName.ConversationDelete);
    expect(bridge.methods).not.toContain(MethodName.MessageCancel);

    const navigation = TestBed.inject(NavigationService);
    navigation.openSettings();
    fixture.detectChanges();
    element.querySelector(".tr-settings-tab .tr-tab-label")!.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(navigation.settingsOpen()).toBe(false);
    expect(navigation.view()).toBe(AppView.Chat);
    element.querySelector('[data-conversation-id="c2"]')!.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(layout.documents()).toEqual([]);
    expect(store.selectedConversationId()).toBeNull();
    store.dispose();
  });

  it("shows panels placed among the conversations after them, and switches, drags and closes them", async () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [DocumentTabsComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const store = TestBed.inject(ChatStore);
    const layout = TestBed.inject(LayoutService);
    const navigation = TestBed.inject(NavigationService);
    TestBed.inject(DocumentsService);
    const fixture = TestBed.createComponent(DocumentTabsComponent);
    const element = fixture.nativeElement as HTMLElement;
    const panels = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>(".tr-panel-tab"));
    layout.movePanel(changes, new TabDropTarget(TabGroup.documentsId, 0));
    fixture.detectChanges();
    expect(element.classList.contains("hidden")).toBe(false);
    expect(panels().map(t => [t.dataset["panel"], t.dataset["tabIndex"], t.getAttribute("aria-selected")])).toEqual([["Changes", "0", "true"]]);
    expect(panels()[0]!.textContent).toContain(Resources.panelLabels[PanelKind.Changes]);
    expect(element.querySelector(".tr-tab-strip")?.hasAttribute("data-drop-tabs")).toBe(true);

    await store.initialize();
    await store.selectConversation("c1");
    TestBed.tick();
    navigation.showChat();
    fixture.detectChanges();
    expect(element.querySelector('[data-conversation-id="c1"]')?.classList.contains("tr-tab-active")).toBe(true);
    expect(panels()[0]!.classList.contains("tr-tab-active")).toBe(false);
    panels()[0]!.click();
    fixture.detectChanges();
    expect(navigation.view()).toBe(AppView.Panel);
    expect(element.querySelector('[data-conversation-id="c1"]')?.classList.contains("tr-tab-active")).toBe(false);

    layout.movePanel(activity, new TabDropTarget(TabGroup.documentsId, 0));
    fixture.detectChanges();
    expect(panels().map(t => t.dataset["panel"])).toEqual(["Activity", "Changes"]);
    element.dataset["dropGroup"] = String(TabGroup.documentsId);
    panels()[1]!.dispatchEvent(new PointerEvent("pointerdown", { clientX: 10, clientY: 10, button: 0, bubbles: true }));
    document.elementFromPoint = (): Element | null => element.querySelector(".tr-tab-strip > span.flex-1");
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 60, clientY: 10, bubbles: true }));
    fixture.detectChanges();
    expect(panels()[1]!.classList.contains("tr-dragging")).toBe(true);
    expect(element.querySelector(".tr-tab-strip > span.flex-1")?.classList.contains("tr-drop-before")).toBe(true);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 60, clientY: 10, bubbles: true }));
    fixture.detectChanges();
    expect(panels().map(t => t.dataset["panel"])).toEqual(["Activity", "Changes"]);
    expect(navigation.panel()).toEqual(changes);

    navigation.showChat();
    element.querySelector<HTMLButtonElement>(".tr-documents-menu")!.click();
    fixture.detectChanges();
    const listed = document.querySelector<HTMLButtonElement>(".tr-documents-panel-item")!;
    expect(listed.textContent).toContain(Resources.panelLabels[PanelKind.Activity]);
    listed.click();
    fixture.detectChanges();
    expect(navigation.panel()).toEqual(activity);

    panels()[0]!.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
    expect(layout.isOpen(activity)).toBe(true);
    panels()[0]!.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(layout.isOpen(activity)).toBe(false);
    panels()[0]!.querySelector<HTMLElement>(".tr-tab-close")!.click();
    fixture.detectChanges();
    expect(panels()).toHaveLength(0);
    expect(navigation.view()).toBe(AppView.Chat);
    store.dispose();
  });

  it("shows each panel of one kind among the conversations as its own tab", () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [DocumentTabsComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const layout = TestBed.inject(LayoutService);
    const navigation = TestBed.inject(NavigationService);
    const fixture = TestBed.createComponent(DocumentTabsComponent);
    const element = fixture.nativeElement as HTMLElement;
    const panels = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>(".tr-panel-tab"));
    const first = new Panel(PanelKind.Terminal, "terminal-1");
    const second = new Panel(PanelKind.Terminal, "terminal-2");
    layout.movePanel(first, new TabDropTarget(TabGroup.documentsId, 0));
    layout.movePanel(second, new TabDropTarget(TabGroup.documentsId, 1));
    fixture.detectChanges();

    expect(panels().map(t => [t.dataset["panel"], t.querySelector(".truncate")?.textContent, t.getAttribute("aria-selected")])).toEqual([
      ["Terminal:terminal-1", "Terminal", "false"],
      ["Terminal:terminal-2", "Terminal", "true"]
    ]);
    panels()[0]!.click();
    fixture.detectChanges();
    expect(navigation.panel()).toEqual(first);
    panels()[0]!.querySelector<HTMLElement>(".tr-tab-close")!.click();
    fixture.detectChanges();
    expect(panels().map(t => t.dataset["panel"])).toEqual(["Terminal:terminal-2"]);
    expect(navigation.panel()).toEqual(second);
  });
});
