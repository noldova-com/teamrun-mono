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

import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { PanelId } from "../../../../src/app/enums/panel-id";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import type { SplitNode } from "../../../../src/app/models/split.node";
import { TabDropTarget } from "../../../../src/app/models/tab-drop-target";
import { TabGroup } from "../../../../src/app/models/tab-group";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { PanelMenuComponent } from "../../../../src/app/components/panel-menu/panel-menu.component";

@Component({
  imports: [MatMenuModule, PanelMenuComponent],
  template: `<tr-panel-menu #menu [panel]="panel()" />
    <button type="button" class="tr-tab" [attr.data-panel]="panel()" [matMenuTriggerFor]="menu.menu() ?? null">{{ panel() }}</button>`
})
class PanelMenuHost {
  public readonly panel = signal(PanelId.Changes);
}

describe("PanelMenuComponent", () => {
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
      .toEqual([Resources.panelLabels[PanelId.Explorer], Resources.panelLabels[PanelId.Activity], Resources.documentsGroupLabel]);
    item(Resources.panelLabels[PanelId.Explorer]).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(layout.dock(DockSide.Left).panels).toEqual([PanelId.Explorer, PanelId.Changes]);
    expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector(".tr-tab"));

    await choose(fixture, Resources.splitLabel, Resources.splitGuideLabels[PanelEdge.Bottom]);
    const split = layout.dock(DockSide.Left).root as SplitNode;
    expect([split.axis, split.groups.map(t => t.panels)]).toEqual([SplitAxis.Vertical, [[PanelId.Explorer], [PanelId.Changes]]]);

    await choose(fixture, Resources.dockLabel, Resources.dockGuideLabels[DockSide.Right]);
    expect(layout.dock(DockSide.Right).panels).toEqual([PanelId.Changes]);
    expect(layout.dock(DockSide.Left).root).toBeInstanceOf(TabGroup);

    layout.movePanel(PanelId.Changes, new TabDropTarget(TabGroup.documentsId, 0));
    fixture.detectChanges();
    await open(fixture);
    expect(item(Resources.splitLabel).disabled).toBe(false);
    item(Resources.closePanelLabel).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(layout.isOpen(PanelId.Changes)).toBe(false);

    layout.movePanel(PanelId.Changes, new TabDropTarget(layout.arrangement().groupOf(PanelId.Explorer)?.id ?? -1, 1));
    layout.activatePanel(PanelId.Changes);
    fixture.detectChanges();
    await open(fixture);
    item(Resources.closePanelLabel).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(layout.arrangement().groupOf(PanelId.Explorer)?.activePanel).toBe(PanelId.Explorer);
  });
});
