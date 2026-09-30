/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";

import { Conversation, MethodName } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { NavigationService } from "../../../../src/app/services/navigation.service";
import { AppView } from "../../../../src/app/enums/app-view";
import { SidebarComponent } from "../../../../src/app/components/sidebar/sidebar.component";

describe("SidebarComponent", () => {
  it("brings conversations forward from Settings on single and double click, keeping the Settings tab", async () => {
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge().answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    TestBed.configureTestingModule({ imports: [SidebarComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const navigation = TestBed.inject(NavigationService);
    const fixture = TestBed.createComponent(SidebarComponent);
    await store.initialize();
    await store.selectConversation("c1");
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.tr-conversation-row > button:first-child'));
    navigation.openSettings();
    buttons.find(t => t.textContent?.includes(SampleData.conversation.title))!.click();
    await fixture.whenStable();
    expect(navigation.view()).toBe(AppView.Chat);
    expect(navigation.settingsOpen()).toBe(true);
    navigation.openSettings();
    buttons.find(t => t.textContent?.includes("Second"))!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await fixture.whenStable();
    expect(navigation.view()).toBe(AppView.Chat);
    expect(store.selectedConversationId()).toBe("c2");
    expect(TestBed.inject(LayoutService).previewDocument()).toBeNull();
    expect(navigation.settingsOpen()).toBe(true);
    store.dispose();
  });
  it("lists projects and recent conversations, starts chats, and opens the settings", async () => {
    const second = new Conversation("c2", "p2", "Other talk", "2026-09-11T08:00:00.000Z", "2026-09-11T08:00:00.000Z");
    const created = new Conversation("c3", "p2", "Created", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge()
      .answer(MethodName.ProjectList, () => [SampleData.project.toJson(), SampleData.otherProject.toJson()])
      .answer(MethodName.ConversationList, payload =>
        (payload as { projectId: string }).projectId === "p1" ? [SampleData.conversation.toJson()] : [second.toJson()])
      .answer(MethodName.ConversationCreate, () => created.toJson());
    TestBed.configureTestingModule({ imports: [SidebarComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(SidebarComponent);
    await store.initialize();
    await store.selectConversation("c1");
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? "";

    expect(text).not.toContain(Resources.pinnedTitle);
    expect(text).toContain(SampleData.project.name.toUpperCase().toLowerCase());
    expect(store.recentConversations().map(t => t.id)).toEqual(["c2", "c1"]);
    expect(text.indexOf(SampleData.conversation.title)).toBeLessThan(text.indexOf(second.title));
    expect(store.selectedConversationId()).toBe("c1");

    await store.selectConversation("c2");
    expect(store.selectedProjectId()).toBe("p2");
    fixture.detectChanges();
    expect(element.querySelector(".tr-conversation-row.tr-nav-row-selected")?.textContent).toContain(second.title);
    expect(element.querySelector(".tr-project-row.tr-nav-row-selected")).toBeNull();

    const projectRows = element.querySelectorAll(".tr-project-row");
    projectRows[1]!.querySelector<HTMLButtonElement>(".tr-row-actions")!.click();
    fixture.detectChanges();
    document.querySelector<HTMLButtonElement>(".mat-mdc-menu-panel button")!.click();
    await vi.waitFor(() => expect(store.selectedConversationId()).toBe("c3"));
    fixture.detectChanges();
    expect(store.conversationsOf("p2").map(t => t.id)).toEqual(["c2", "c3"]);
    expect(element.textContent).toContain(created.title);

    const newChat = Array.from(element.querySelectorAll<HTMLButtonElement>("nav > button")).find(t => t.textContent?.includes(Resources.newConversationLabel));
    newChat!.click();
    await vi.waitFor(() => expect(bridge.methods.filter(t => t === MethodName.ConversationCreate)).toHaveLength(2));

    TestBed.inject(LayoutService).togglePin("c1");
    fixture.detectChanges();
    expect(element.textContent).toContain(Resources.pinnedTitle);
    const row = element.querySelectorAll(".tr-conversation-row")[1]!;
    expect(row.querySelector("button")?.classList.contains("tr-row-actions")).toBe(false);
    expect(row.querySelector(".tr-row-actions")).not.toBeNull();
    expect(element.querySelector("mat-progress-spinner")?.nextElementSibling?.classList.contains("tr-row-actions")).toBe(true);
    expect(element.querySelectorAll("mat-progress-spinner").length).toBe(1);
    expect(element.querySelector<HTMLElement>("mat-progress-spinner")!.style.width).toBe(`${Resources.conversationSpinnerDiameter}px`);
    const nested = (): string[] => Array.from(element.querySelectorAll(".tr-conversation-row.tr-nav-row-nested")).map(t => t.textContent?.trim() ?? "");
    expect(nested().length).toBe(store.conversationsOf("p1").length + store.conversationsOf("p2").length - 1);
    expect(nested().some(t => t.includes(SampleData.conversation.title))).toBe(false);
    expect(element.querySelectorAll(".tr-conversation-row:not(.tr-nav-row-nested)").length).toBe(1);
    TestBed.inject(LayoutService).toggleProject("p2");
    fixture.detectChanges();
    expect(nested().length).toBe(store.conversationsOf("p1").length - 1);
    expect(projectRows[1]!.querySelector(".tr-nav-twistie")?.getAttribute("aria-expanded")).toBe("false");
    TestBed.inject(LayoutService).toggleProject("p2");
    fixture.detectChanges();
    expect(nested().length).toBe(store.conversationsOf("p1").length + store.conversationsOf("p2").length - 1);
    const shown = store.selectedConversationId();
    projectRows[1]!.querySelector<HTMLButtonElement>("button.truncate")!.click();
    fixture.detectChanges();
    expect(projectRows[1]!.querySelector(".tr-nav-twistie")?.getAttribute("aria-expanded")).toBe("false");
    expect(nested().length).toBe(store.conversationsOf("p1").length - 1);
    expect(store.selectedConversationId()).toBe(shown);
    projectRows[1]!.querySelector<HTMLButtonElement>("button.truncate")!.click();
    fixture.detectChanges();
    expect(projectRows[1]!.querySelector(".tr-nav-twistie")?.getAttribute("aria-expanded")).toBe("true");
    store.dispose();
  });

  it("asks for a folder before the first chat when no project is open", async () => {
    const bridge = SampleData.createBridge().answer(MethodName.ProjectList, () => []);
    TestBed.configureTestingModule({ imports: [SidebarComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const fixture = TestBed.createComponent(SidebarComponent);
    await store.initialize();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const newChat = Array.from(element.querySelectorAll<HTMLButtonElement>("nav > button")).find(t => t.textContent?.includes(Resources.newConversationLabel));
    newChat!.click();
    await fixture.whenStable();

    expect(bridge.methods).not.toContain(MethodName.ConversationCreate);
    expect(element.textContent).toContain(Resources.noProjects);
    store.dispose();
  });

  it("asks before deleting a conversation and before forgetting a project", async () => {
    const bridge = SampleData.createBridge().answer(MethodName.ConversationDelete, () => null).answer(MethodName.ProjectForget, () => null);
    TestBed.configureTestingModule({ imports: [SidebarComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const dialogs = TestBed.inject(MatDialog);
    const fixture = TestBed.createComponent(SidebarComponent);
    await store.initialize();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const menuItem = (label: string): HTMLButtonElement =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".mat-mdc-menu-panel button")).find(t => t.textContent?.includes(label))!;

    element.querySelector<HTMLButtonElement>(".tr-conversation-row .tr-row-actions")!.click();
    fixture.detectChanges();
    menuItem(Resources.deleteConversationLabel).click();
    fixture.detectChanges();
    expect(dialogs.openDialogs).toHaveLength(1);
    expect(bridge.methods).not.toContain(MethodName.ConversationDelete);
    dialogs.openDialogs[0]!.close(true);
    await vi.waitFor(() => expect(bridge.methods).toContain(MethodName.ConversationDelete));

    element.querySelector<HTMLButtonElement>(".tr-project-row .tr-row-actions")!.click();
    fixture.detectChanges();
    menuItem(Resources.forgetProjectLabel).click();
    fixture.detectChanges();
    expect(dialogs.openDialogs).toHaveLength(1);
    dialogs.openDialogs[0]!.close(undefined);
    await vi.waitFor(() => expect(dialogs.openDialogs).toHaveLength(0));
    expect(bridge.methods).not.toContain(MethodName.ProjectForget);
  });

  it("pins and unpins from the row menu and shows the projects in the layout's order", async () => {
    const bridge = SampleData.createBridge()
      .answer(MethodName.ProjectList, () => [SampleData.project.toJson(), SampleData.otherProject.toJson()])
      .answer(MethodName.ConversationList, payload => (payload as { projectId: string }).projectId === "p1" ? [SampleData.conversation.toJson()] : []);
    TestBed.configureTestingModule({ imports: [SidebarComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const layout = TestBed.inject(LayoutService);
    const fixture = TestBed.createComponent(SidebarComponent);
    await store.initialize();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const menuItem = (label: string): HTMLButtonElement =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".mat-mdc-menu-panel button")).find(t => t.textContent?.includes(label))!;
    const projectNames = (): string[] => Array.from(element.querySelectorAll(".tr-project-row button.truncate")).map(t => t.textContent?.trim() ?? "");

    expect(element.textContent).not.toContain(Resources.pinnedTitle);
    element.querySelector<HTMLButtonElement>(".tr-conversation-row .tr-row-actions")!.click();
    fixture.detectChanges();
    menuItem(Resources.pinLabel).click();
    fixture.detectChanges();
    expect(layout.pinnedConversations()).toEqual(["c1"]);
    expect(element.textContent).toContain(Resources.pinnedTitle);
    expect(element.querySelectorAll(".tr-conversation-row:not(.tr-nav-row-nested)").length).toBe(1);
    expect(element.querySelectorAll(".tr-conversation-row.tr-nav-row-nested").length).toBe(0);
    expect(element.textContent?.split(Resources.noConversations).length).toBe(2);

    element.querySelector<HTMLButtonElement>(".tr-conversation-row .tr-row-actions")!.click();
    fixture.detectChanges();
    menuItem(Resources.unpinLabel).click();
    fixture.detectChanges();
    expect(layout.pinnedConversations()).toEqual([]);
    expect(element.textContent).not.toContain(Resources.pinnedTitle);
    expect(element.querySelectorAll(".tr-conversation-row.tr-nav-row-nested").length).toBe(1);

    expect(projectNames()).toEqual([SampleData.project.name, SampleData.otherProject.name]);
    layout.orderProjects(["p2", "p1"]);
    fixture.detectChanges();
    expect(projectNames()).toEqual([SampleData.otherProject.name, SampleData.project.name]);
  });

  it("shows a project's conversations in the order the layout keeps, the rest newest first", async () => {
    const second = new Conversation("c2", "p1", "Second", "2026-09-11T08:00:00.000Z", "2026-09-11T08:00:00.000Z");
    const third = new Conversation("c3", "p1", "Third", "2026-09-11T09:00:00.000Z", "2026-09-11T09:00:00.000Z");
    const bridge = SampleData.createBridge()
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson(), third.toJson()]);
    TestBed.configureTestingModule({ imports: [SidebarComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const layout = TestBed.inject(LayoutService);
    const fixture = TestBed.createComponent(SidebarComponent);
    await store.initialize();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const nested = (): string[] =>
      Array.from(element.querySelectorAll(".tr-conversation-row.tr-nav-row-nested button.truncate")).map(t => t.textContent?.trim() ?? "");

    expect(nested()).toEqual([third.title, second.title, SampleData.conversation.title]);
    layout.orderConversations("p1", ["c2", "zz"]);
    fixture.detectChanges();
    expect(nested()).toEqual([second.title, third.title, SampleData.conversation.title]);
    expect(element.querySelectorAll(".tr-drop-list .tr-drop-list .tr-drag-item").length).toBe(3);

    layout.togglePin("c2");
    fixture.detectChanges();
    expect(nested()).toEqual([third.title, SampleData.conversation.title]);
    expect(element.querySelectorAll(".tr-conversation-row:not(.tr-nav-row-nested) button.truncate")[0]?.textContent?.trim()).toBe(second.title);
    layout.togglePin("c2");
    fixture.detectChanges();
    expect(nested()).toEqual([second.title, third.title, SampleData.conversation.title]);
  });

  it("counts only the unpinned conversations behind a project's Show more", async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      new Conversation(`n${i}`, "p1", `Talk ${i}`, `2026-09-11T${String(i).padStart(2, "0")}:00:00.000Z`, `2026-09-11T${String(i).padStart(2, "0")}:00:00.000Z`));
    const bridge = SampleData.createBridge().answer(MethodName.ConversationList, () => many.map(t => t.toJson()));
    TestBed.configureTestingModule({ imports: [SidebarComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const layout = TestBed.inject(LayoutService);
    const fixture = TestBed.createComponent(SidebarComponent);
    await store.initialize();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const nestedCount = (): number => element.querySelectorAll(".tr-conversation-row.tr-nav-row-nested").length;

    expect(nestedCount()).toBe(10);
    expect(element.querySelector(".tr-show-more")?.textContent?.trim()).toBe(Resources.formatShowMore(2));
    layout.togglePin("n11");
    fixture.detectChanges();
    expect(nestedCount()).toBe(10);
    expect(element.querySelector(".tr-show-more")?.textContent?.trim()).toBe(Resources.formatShowMore(1));
    layout.togglePin("n10");
    fixture.detectChanges();
    expect(nestedCount()).toBe(10);
    expect(element.querySelector(".tr-show-more")).toBeNull();
  });
});
