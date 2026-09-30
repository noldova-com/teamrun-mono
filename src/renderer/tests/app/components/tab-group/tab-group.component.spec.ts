/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MethodName, TerminalIdParams, TerminalOpenParams, TerminalScreen, TerminalShellKind } from "@noldova/teamrun-protocol";

import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { TerminalWindow } from "../../../fixtures/terminal-window";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { PanelKind } from "../../../../src/app/enums/panel-kind";
import type { GroupFrame } from "../../../../src/app/models/group-frame";
import { Panel } from "../../../../src/app/models/panel";
import { SplitDropTarget } from "../../../../src/app/models/split-drop-target";
import { TabDropTarget } from "../../../../src/app/models/tab-drop-target";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { PanelDragService } from "../../../../src/app/services/panel-drag.service";
import { PreferencesService } from "../../../../src/app/services/preferences.service";
import { ShellService } from "../../../../src/app/services/shell.service";
import { TerminalsService } from "../../../../src/app/services/terminals.service";
import { TabGroupComponent } from "../../../../src/app/components/tab-group/tab-group.component";

describe("TabGroupComponent", () => {
  const explorer = new Panel(PanelKind.Explorer);
  const changes = new Panel(PanelKind.Changes);
  const activity = new Panel(PanelKind.Activity);

  it("shows its tabs where its frame is, activates, closes and drags them, and carries its dock's actions at the corner", async () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [TabGroupComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    const layout = TestBed.inject(LayoutService);
    const shell = TestBed.inject(ShellService);
    const drag = TestBed.inject(PanelDragService);
    const frameOf = (panel: Panel): GroupFrame => {
      const frame = shell.geometry().frameOf(layout.arrangement().groupOf(panel)?.id ?? -1);
      if (frame === null)
        throw new Error(`${panel.key} is not drawn.`);
      return frame;
    };
    layout.movePanel(changes, new TabDropTarget(frameOf(explorer).group.id, 1));
    layout.activatePanel(explorer);
    const fixture = TestBed.createComponent(TabGroupComponent);
    fixture.componentRef.setInput("frame", frameOf(explorer));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const tabs = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>(".tr-tab"));
    const bounds = frameOf(explorer).bounds;

    expect([element.style.left, element.style.top, element.style.width, element.style.height])
      .toEqual([`${bounds.x}px`, `${bounds.y}px`, `${bounds.width}px`, `${bounds.height}px`]);
    expect(element.dataset["side"]).toBe(DockSide.Left);
    expect(element.querySelector("section")?.classList.contains("tr-dock")).toBe(true);
    expect(element.querySelector("section")?.dataset["dropGroup"]).toBe(String(frameOf(explorer).group.id));
    expect(tabs().map(t => [t.dataset["panel"], t.dataset["tabIndex"], t.getAttribute("aria-selected")]))
      .toEqual([["Explorer", "0", "true"], ["Changes", "1", "false"]]);
    expect(element.querySelector("tr-panel-content tr-sidebar")).not.toBeNull();
    expect(element.querySelector(".tr-panel-actions")?.getAttribute("aria-label")).toBe(Resources.panelActionsLabel);
    expect(element.querySelector(".tr-dock-collapse")).not.toBeNull();

    tabs()[1]!.click();
    fixture.componentRef.setInput("frame", frameOf(explorer));
    fixture.detectChanges();
    expect(layout.arrangement().groupOf(changes)?.activePanel).toEqual(changes);
    expect(element.querySelector("tr-panel-content tr-changes-panel")).not.toBeNull();

    tabs()[0]!.dispatchEvent(new PointerEvent("pointerdown", { clientX: 10, clientY: 10, button: 0, bubbles: true }));
    document.elementFromPoint = (): Element | null => tabs()[1]!;
    tabs()[1]!.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 100, 20);
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 90, clientY: 10, bubbles: true }));
    fixture.detectChanges();
    expect(drag.dragging()).toEqual(explorer);
    expect(tabs()[0]!.classList.contains("tr-dragging")).toBe(true);
    expect(element.querySelector(".tr-tabs span.flex-1")?.classList.contains("tr-drop-before")).toBe(true);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 90, clientY: 10, bubbles: true }));
    fixture.componentRef.setInput("frame", frameOf(explorer));
    fixture.detectChanges();
    expect(tabs().map(t => t.dataset["panel"])).toEqual(["Changes", "Explorer"]);

    const down = new MouseEvent("mousedown", { button: 1, bubbles: true, cancelable: true });
    tabs()[1]!.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    tabs()[1]!.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
    expect(layout.isOpen(explorer)).toBe(true);
    tabs()[1]!.querySelector(".tr-tab-label")!.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }));
    expect(layout.isOpen(explorer)).toBe(false);
    fixture.componentRef.setInput("frame", frameOf(changes));
    fixture.detectChanges();
    element.querySelector<HTMLElement>(".tr-tab-active .tr-tab-close")!.click();
    expect(layout.isOpen(changes)).toBe(false);

    layout.openPanel(activity);
    layout.movePanel(explorer, new SplitDropTarget(frameOf(activity).group.id, PanelEdge.Right));
    fixture.componentRef.setInput("frame", frameOf(activity));
    fixture.detectChanges();
    expect(element.querySelector(".tr-dock-collapse")).toBeNull();
    fixture.componentRef.setInput("frame", frameOf(explorer));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>(".tr-dock-collapse")!.click();
    expect(layout.dock(DockSide.Bottom).collapsed).toBe(true);

    layout.movePanel(explorer, new TabDropTarget(0, 0));
    layout.movePanel(activity, new SplitDropTarget(0, PanelEdge.Left));
    fixture.componentRef.setInput("frame", frameOf(activity));
    fixture.detectChanges();
    expect(element.querySelector("section")?.classList.contains("tr-panel")).toBe(true);
    expect(element.dataset["side"]).toBeUndefined();
    expect(element.querySelector(".tr-dock-collapse")).toBeNull();
    store.dispose();
  });

  it("shows each panel of one kind as its own tab and acts on that one alone", () => {
    MemoryStorage.install(window);
    const terminalWindow = TerminalWindow.install();
    onTestFinished(() => terminalWindow.restore());
    TestBed.configureTestingModule({ imports: [TabGroupComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const layout = TestBed.inject(LayoutService);
    const shell = TestBed.inject(ShellService);
    const first = new Panel(PanelKind.Terminal, "terminal-1");
    const second = new Panel(PanelKind.Terminal, "terminal-2");
    layout.openPanel(first);
    layout.openPanel(second);
    const fixture = TestBed.createComponent(TabGroupComponent);
    const render = (): void => {
      fixture.componentRef.setInput("frame", shell.geometry().frameOf(layout.arrangement().groupOf(first)?.id ?? -1));
      fixture.detectChanges();
    };
    render();
    const element = fixture.nativeElement as HTMLElement;
    const tabs = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>(".tr-tab"));

    expect(tabs().map(t => [t.dataset["panel"], t.querySelector(".tr-tab-label")?.textContent, t.getAttribute("aria-selected")])).toEqual([
      ["Activity", "Activity", "false"],
      ["Terminal:terminal-1", "Terminal", "false"],
      ["Terminal:terminal-2", "Terminal", "true"]
    ]);
    tabs()[1]!.click();
    render();
    expect(layout.arrangement().groupOf(first)?.activePanel).toEqual(first);
    expect(tabs().map(t => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    tabs()[2]!.querySelector<HTMLElement>(".tr-tab-close")!.click();
    render();
    expect(layout.isOpen(second)).toBe(false);
    expect(tabs().map(t => t.dataset["panel"])).toEqual(["Activity", "Terminal:terminal-1"]);
  });

  it("offers a new terminal with the chosen default shell or another from its menu in a group that holds terminals, also without a selected project", async () => {
    MemoryStorage.install(window);
    const terminalWindow = TerminalWindow.install();
    onTestFinished(() => terminalWindow.restore());
    let opened = 8;
    const bridge = SampleData.createBridge()
      .answer(MethodName.TerminalOpen, () => SampleData.terminal(`t${++opened}`).toJson())
      .answer(MethodName.TerminalScreen, payload => new TerminalScreen(SampleData.terminal(TerminalIdParams.fromJson(payload).terminalId), "").toJson());
    TestBed.configureTestingModule({ imports: [TabGroupComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const layout = TestBed.inject(LayoutService);
    const shell = TestBed.inject(ShellService);
    const terminals = TestBed.inject(TerminalsService);
    onTestFinished(() => terminals.stop());
    TestBed.inject(PreferencesService).setDefaultShellId("cmd");
    const fixture = TestBed.createComponent(TabGroupComponent);
    const render = (panel: Panel): void => {
      fixture.componentRef.setInput("frame", shell.geometry().frameOf(layout.arrangement().groupOf(panel)?.id ?? -1));
      fixture.detectChanges();
    };
    const element = fixture.nativeElement as HTMLElement;
    const button = (): HTMLButtonElement | null => element.querySelector<HTMLButtonElement>(".tr-terminal-new");

    render(explorer);
    expect(button()).toBeNull();
    layout.openPanel(new Panel(PanelKind.Terminal, "t1"));
    render(new Panel(PanelKind.Terminal, "t1"));
    expect(button()?.disabled).toBe(false);
    button()!.click();
    await vi.waitFor(() => expect(layout.dock(DockSide.Bottom).panels.map(t => t.instance)).toEqual([null, "t1", "t9"]));
    render(new Panel(PanelKind.Terminal, "t9"));
    expect(element.querySelector(".tr-tab-active .tr-tab-shell-icon")?.textContent).toBe(Resources.shellKindIcons[TerminalShellKind.PowerShell]);

    element.querySelector<HTMLButtonElement>(".tr-terminal-shells")!.click();
    const items = (): HTMLButtonElement[] => {
      fixture.detectChanges();
      return Array.from(document.querySelectorAll<HTMLButtonElement>(".mat-mdc-menu-panel .tr-terminal-shell"));
    };
    await vi.waitFor(() => expect(items().map(t => [t.querySelector("mat-icon")?.textContent,
      ...Array.from(t.querySelectorAll(".mat-mdc-menu-item-text > span"), s => s.textContent)])).toEqual([
      [Resources.shellKindIcons[TerminalShellKind.PowerShell], "PowerShell"],
      [Resources.shellKindIcons[TerminalShellKind.CommandPrompt], "Command Prompt", Resources.defaultShellMark]
    ]));
    items()[0]!.click();
    await vi.waitFor(() => expect(layout.dock(DockSide.Bottom).panels.map(t => t.instance)).toEqual([null, "t1", "t9", "t10"]));
    expect(bridge.requests.filter(t => t.method === MethodName.TerminalOpen).map(t => TerminalOpenParams.fromJson(t.payload).shellId)).toEqual(["cmd", "pwsh"]);
  });
});
