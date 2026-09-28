/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { PanelId } from "../../../../src/app/enums/panel-id";
import type { GroupFrame } from "../../../../src/app/models/group-frame";
import { SplitDropTarget } from "../../../../src/app/models/split-drop-target";
import { TabDropTarget } from "../../../../src/app/models/tab-drop-target";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { PanelDragService } from "../../../../src/app/services/panel-drag.service";
import { ShellService } from "../../../../src/app/services/shell.service";
import { TabGroupComponent } from "../../../../src/app/components/tab-group/tab-group.component";

describe("TabGroupComponent", () => {
  it("shows its tabs where its frame is, activates, closes and drags them, and carries its dock's actions at the corner", async () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [TabGroupComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const store = TestBed.inject(ChatStore);
    await store.initialize();
    const layout = TestBed.inject(LayoutService);
    const shell = TestBed.inject(ShellService);
    const drag = TestBed.inject(PanelDragService);
    const frameOf = (panel: PanelId): GroupFrame => {
      const frame = shell.geometry().frameOf(layout.arrangement().groupOf(panel)?.id ?? -1);
      if (frame === null)
        throw new Error(`${panel} is not drawn.`);
      return frame;
    };
    layout.movePanel(PanelId.Changes, new TabDropTarget(frameOf(PanelId.Explorer).group.id, 1));
    layout.activatePanel(PanelId.Explorer);
    const fixture = TestBed.createComponent(TabGroupComponent);
    fixture.componentRef.setInput("frame", frameOf(PanelId.Explorer));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const tabs = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>(".tr-tab"));
    const bounds = frameOf(PanelId.Explorer).bounds;

    expect([element.style.left, element.style.top, element.style.width, element.style.height])
      .toEqual([`${bounds.x}px`, `${bounds.y}px`, `${bounds.width}px`, `${bounds.height}px`]);
    expect(element.dataset["side"]).toBe(DockSide.Left);
    expect(element.querySelector("section")?.classList.contains("tr-dock")).toBe(true);
    expect(element.querySelector("section")?.dataset["dropGroup"]).toBe(String(frameOf(PanelId.Explorer).group.id));
    expect(tabs().map(t => [t.dataset["panel"], t.dataset["tabIndex"], t.getAttribute("aria-selected")]))
      .toEqual([[PanelId.Explorer, "0", "true"], [PanelId.Changes, "1", "false"]]);
    expect(element.querySelector("tr-panel-content tr-sidebar")).not.toBeNull();
    expect(element.querySelector(".tr-panel-actions")?.getAttribute("aria-label")).toBe(Resources.panelActionsLabel);
    expect(element.querySelector(".tr-dock-collapse")).not.toBeNull();

    tabs()[1]!.click();
    fixture.componentRef.setInput("frame", frameOf(PanelId.Explorer));
    fixture.detectChanges();
    expect(layout.arrangement().groupOf(PanelId.Changes)?.activePanel).toBe(PanelId.Changes);
    expect(element.querySelector("tr-panel-content tr-changes-panel")).not.toBeNull();

    tabs()[0]!.dispatchEvent(new PointerEvent("pointerdown", { clientX: 10, clientY: 10, button: 0, bubbles: true }));
    document.elementFromPoint = (): Element | null => tabs()[1]!;
    tabs()[1]!.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 100, 20);
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 90, clientY: 10, bubbles: true }));
    fixture.detectChanges();
    expect(drag.dragging()).toBe(PanelId.Explorer);
    expect(tabs()[0]!.classList.contains("tr-dragging")).toBe(true);
    expect(element.querySelector(".tr-tabs span.flex-1")?.classList.contains("tr-drop-before")).toBe(true);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 90, clientY: 10, bubbles: true }));
    fixture.componentRef.setInput("frame", frameOf(PanelId.Explorer));
    fixture.detectChanges();
    expect(tabs().map(t => t.dataset["panel"])).toEqual([PanelId.Changes, PanelId.Explorer]);

    const down = new MouseEvent("mousedown", { button: 1, bubbles: true, cancelable: true });
    tabs()[1]!.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    tabs()[1]!.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
    expect(layout.isOpen(PanelId.Explorer)).toBe(true);
    tabs()[1]!.querySelector(".tr-tab-label")!.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }));
    expect(layout.isOpen(PanelId.Explorer)).toBe(false);
    fixture.componentRef.setInput("frame", frameOf(PanelId.Changes));
    fixture.detectChanges();
    element.querySelector<HTMLElement>(".tr-tab-active .tr-tab-close")!.click();
    expect(layout.isOpen(PanelId.Changes)).toBe(false);

    layout.openPanel(PanelId.Activity);
    layout.movePanel(PanelId.Explorer, new SplitDropTarget(frameOf(PanelId.Activity).group.id, PanelEdge.Right));
    fixture.componentRef.setInput("frame", frameOf(PanelId.Activity));
    fixture.detectChanges();
    expect(element.querySelector(".tr-dock-collapse")).toBeNull();
    fixture.componentRef.setInput("frame", frameOf(PanelId.Explorer));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>(".tr-dock-collapse")!.click();
    expect(layout.dock(DockSide.Bottom).collapsed).toBe(true);

    layout.movePanel(PanelId.Explorer, new TabDropTarget(0, 0));
    layout.movePanel(PanelId.Activity, new SplitDropTarget(0, PanelEdge.Left));
    fixture.componentRef.setInput("frame", frameOf(PanelId.Activity));
    fixture.detectChanges();
    expect(element.querySelector("section")?.classList.contains("tr-panel")).toBe(true);
    expect(element.dataset["side"]).toBeUndefined();
    expect(element.querySelector(".tr-dock-collapse")).toBeNull();
    store.dispose();
  });
});
