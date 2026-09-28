/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { MatMenuModule } from "@angular/material/menu";

import { MethodName, TerminalIdParams, TerminalScreen } from "@noldova/teamrun-protocol";

import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { TerminalWindow } from "../../../fixtures/terminal-window";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { PanelKind } from "../../../../src/app/enums/panel-kind";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { Panel } from "../../../../src/app/models/panel";
import type { SplitNode } from "../../../../src/app/models/split.node";
import { TabDropTarget } from "../../../../src/app/models/tab-drop-target";
import { TabGroup } from "../../../../src/app/models/tab-group";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { TerminalsService } from "../../../../src/app/services/terminals.service";
import { PanelMenuComponent } from "../../../../src/app/components/panel-menu/panel-menu.component";

@Component({
  imports: [MatMenuModule, PanelMenuComponent],
  template: `<tr-panel-menu #menu [panel]="panel()" />
    <button type="button" class="tr-tab" [attr.data-panel]="panel().key" [matMenuTriggerFor]="menu.menu() ?? null">{{ panel().key }}</button>
    <button #tab type="button" class="tr-context" [matContextMenuTriggerFor]="menu.menu() ?? null" (keydown)="menu.openFromKeyboard($event, tab)">
      {{ panel().key }}
    </button>`
})
class PanelMenuHost {
  public readonly panel = signal(new Panel(PanelKind.Changes));
}

describe("PanelMenuComponent", () => {
  const explorer = new Panel(PanelKind.Explorer);
  const changes = new Panel(PanelKind.Changes);

  const open = async (fixture: ComponentFixture<PanelMenuHost>): Promise<void> => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>("button")!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const item = (text: string): HTMLButtonElement => {
    const found = Array.from(document.querySelectorAll<HTMLButtonElement>(".mat-mdc-menu-panel [mat-menu-item]")).find(t => t.textContent?.trim().endsWith(text));
    if (!found)
      throw new Error(`No menu item ends with ${text}.`);
    return found;
  };
  const choose = async (fixture: ComponentFixture<PanelMenuHost>, parent: string, child: string): Promise<void> => {
    await open(fixture);
    item(parent).click();
    fixture.detectChanges();
    await fixture.whenStable();
    item(child).click();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it("moves the panel into another group, splits its group, docks it and closes it, then focuses its tab", async () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const layout = TestBed.inject(LayoutService);
    const fixture = TestBed.createComponent(PanelMenuHost);
    fixture.detectChanges();

    await open(fixture);
    expect(item(Resources.moveToLabel).disabled).toBe(false);
    expect(item(Resources.splitLabel).disabled).toBe(true);
    expect(item(Resources.dockLabel).disabled).toBe(false);
    item(Resources.moveToLabel).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(Array.from(document.querySelectorAll(".tr-panel-destination")).map(t => t.textContent?.trim()))
      .toEqual([Resources.panelLabels[PanelKind.Explorer], Resources.panelLabels[PanelKind.Activity], Resources.documentsGroupLabel]);
    item(Resources.panelLabels[PanelKind.Explorer]).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(layout.dock(DockSide.Left).panels).toEqual([explorer, changes]);
    expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector(".tr-tab"));

    await choose(fixture, Resources.splitLabel, Resources.splitGuideLabels[PanelEdge.Bottom]);
    const split = layout.dock(DockSide.Left).root as SplitNode;
    expect([split.axis, split.groups.map(t => t.panels)]).toEqual([SplitAxis.Vertical, [[explorer], [changes]]]);

    await choose(fixture, Resources.dockLabel, Resources.dockGuideLabels[DockSide.Right]);
    expect(layout.dock(DockSide.Right).panels).toEqual([changes]);
    expect(layout.dock(DockSide.Left).root).toBeInstanceOf(TabGroup);

    layout.movePanel(changes, new TabDropTarget(TabGroup.documentsId, 0));
    fixture.detectChanges();
    await open(fixture);
    expect(item(Resources.splitLabel).disabled).toBe(false);
    item(Resources.closePanelLabel).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(layout.isOpen(changes)).toBe(false);

    layout.movePanel(changes, new TabDropTarget(layout.arrangement().groupOf(explorer)?.id ?? -1, 1));
    layout.activatePanel(changes);
    fixture.detectChanges();
    await open(fixture);
    item(Resources.closePanelLabel).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(layout.arrangement().groupOf(explorer)?.activePanel).toEqual(explorer);
  });

  it("restarts a terminal and names groups by their panels' labels", async () => {
    MemoryStorage.install(window);
    const terminalWindow = TerminalWindow.install();
    onTestFinished(() => terminalWindow.restore());
    const bridge = SampleData.createBridge()
      .answer(MethodName.TerminalOpen, () => SampleData.terminal("t1").toJson())
      .answer(MethodName.TerminalScreen, () => new TerminalScreen(SampleData.terminal("t1"), "").toJson())
      .answer(MethodName.TerminalRestart, () => SampleData.terminal("t1").toJson());
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    await TestBed.inject(ChatStore).initialize();
    const terminals = TestBed.inject(TerminalsService);
    onTestFinished(() => terminals.stop());
    await terminals.open();
    const fixture = TestBed.createComponent(PanelMenuHost);
    fixture.detectChanges();

    await open(fixture);
    expect(document.querySelector(".tr-terminal-restart")).toBeNull();
    item(Resources.moveToLabel).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(Array.from(document.querySelectorAll(".tr-panel-destination")).map(t => t.textContent?.trim())).toContain("Activity, PowerShell");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.panel.set(new Panel(PanelKind.Terminal, "t1"));
    fixture.detectChanges();
    await open(fixture);
    item(Resources.restartTerminalLabel).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(bridge.requests.filter(t => t.method === MethodName.TerminalRestart).map(t => t.payload)).toEqual([new TerminalIdParams("t1").toJson()]);
  });

  it("opens below its tab with Shift+F10 and leaves other keys alone", async () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(PanelMenuHost);
    fixture.detectChanges();
    const tab = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(".tr-context")!;
    const press = (key: string, shiftKey: boolean): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true });
      tab.dispatchEvent(event);
      return event;
    };

    expect(press("F10", false).defaultPrevented).toBe(false);
    expect(press("Enter", true).defaultPrevented).toBe(false);
    expect(document.querySelector(".mat-mdc-menu-panel")).toBeNull();
    expect(press("F10", true).defaultPrevented).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(item(Resources.moveToLabel)).not.toBeNull();
  });

  it("moves and closes only its own panel of a kind and focuses that panel's tab", async () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const layout = TestBed.inject(LayoutService);
    const first = new Panel(PanelKind.Terminal, "terminal-1");
    const second = new Panel(PanelKind.Terminal, "terminal-2");
    layout.openPanel(first);
    layout.openPanel(second);
    const fixture = TestBed.createComponent(PanelMenuHost);
    fixture.componentInstance.panel.set(first);
    fixture.detectChanges();

    await choose(fixture, Resources.dockLabel, Resources.dockGuideLabels[DockSide.Right]);
    expect(layout.dock(DockSide.Right).panels).toEqual([changes, first]);
    expect(layout.dock(DockSide.Bottom).panels).toEqual([new Panel(PanelKind.Activity), second]);
    expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector(".tr-tab"));

    await open(fixture);
    item(Resources.closePanelLabel).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(layout.isOpen(first)).toBe(false);
    expect(layout.isOpen(second)).toBe(true);
  });
});
