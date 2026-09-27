/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { TestBed } from "@angular/core/testing";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { PanelId } from "../../../src/app/enums/panel-id";
import { SideDropTarget } from "../../../src/app/models/side-drop-target";
import { SplitDropTarget } from "../../../src/app/models/split-drop-target";
import { TabDropTarget } from "../../../src/app/models/tab-drop-target";
import { LayoutService } from "../../../src/app/services/layout.service";
import { PanelDragService } from "../../../src/app/services/panel-drag.service";

describe("PanelDragService", () => {
  const pointer = (document: Document, type: string, x: number, y: number): void => {
    document.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
  };
  const element = (document: Document, tag: string, data: Record<string, string>, parent: HTMLElement = document.body): HTMLElement => {
    const created = document.createElement(tag);
    Object.assign(created.dataset, data);
    parent.append(created);
    return created;
  };

  it("targets the tab strip, arrows, center and side guide under the pointer, and changes nothing elsewhere or on Escape", () => {
    MemoryStorage.install(window);
    const document = TestBed.inject(DOCUMENT);
    const layout = TestBed.inject(LayoutService);
    const drag = TestBed.inject(PanelDragService);
    const card = element(document, "section", { dropGroup: "1" });
    const strip = element(document, "div", { dropTabs: "" }, card);
    const tab = element(document, "button", { tabIndex: "0" }, strip);
    tab.getBoundingClientRect = (): DOMRect => new DOMRect(100, 0, 100, 20);
    const body = element(document, "div", {}, card);
    const compass = element(document, "div", { dropGroup: "1" });
    const top = element(document, "button", { dropEdge: PanelEdge.Top }, compass);
    const center = element(document, "button", { dropCenter: "" }, compass);
    const crooked = element(document, "button", { dropEdge: "Diagonal" }, compass);
    const guide = element(document, "button", { dropSide: DockSide.Right });
    const upward = element(document, "button", { dropSide: "Top" });
    const stranger = element(document, "div", { dropGroup: "99" });
    const nothing = element(document, "div", {});
    let under: Element | null = null;
    document.elementFromPoint = (): Element | null => under;
    const down = (panel: PanelId, button: number = 0): void =>
      drag.begin(panel, new PointerEvent("pointerdown", { clientX: 10, clientY: 10, button }));
    const move = (target: Element | null, x: number = 120): void => {
      under = target;
      pointer(document, "pointermove", x, 10);
    };

    down(PanelId.Changes);
    pointer(document, "pointermove", 12, 12);
    expect(drag.dragging()).toBeNull();
    pointer(document, "pointerup", 12, 12);
    expect(layout.dock(DockSide.Right).panels).toEqual([PanelId.Changes]);

    down(PanelId.Changes);
    move(tab);
    expect(drag.dragging()).toBe(PanelId.Changes);
    expect(drag.point()).toEqual([120, 10]);
    expect(document.body.classList.contains("tr-dragging-body")).toBe(true);
    expect(drag.hoveredGroup()).toBe(1);
    expect(drag.target()).toEqual(new TabDropTarget(1, 0));
    expect(drag.isDropBefore(1, 0)).toBe(true);
    expect(drag.isDropBefore(1, 1)).toBe(false);
    const target = drag.target();
    move(tab, 121);
    expect(drag.target()).toBe(target);
    pointer(document, "pointerup", 121, 10);
    expect(drag.dragging()).toBeNull();
    expect(drag.target()).toBeNull();
    expect(drag.hoveredGroup()).toBeNull();
    expect(document.body.classList.contains("tr-dragging-body")).toBe(false);
    expect(layout.dock(DockSide.Left).panels).toEqual([PanelId.Changes, PanelId.Explorer]);
    expect(layout.dock(DockSide.Right).isEmpty).toBe(true);

    down(PanelId.Changes);
    move(tab, 180);
    expect(drag.target()).toEqual(new TabDropTarget(1, 1));
    move(strip);
    expect(drag.target()).toEqual(new TabDropTarget(1, 2));
    move(center);
    expect(drag.target()).toEqual(new TabDropTarget(1, 2));
    move(top);
    expect(drag.target()).toEqual(new SplitDropTarget(1, PanelEdge.Top));
    move(crooked);
    expect(drag.target()).toBeNull();
    move(body);
    expect(drag.target()).toBeNull();
    expect(drag.hoveredGroup()).toBe(1);
    move(stranger);
    expect(drag.target()).toBeNull();
    move(upward);
    expect(drag.target()).toBeNull();
    move(nothing);
    expect(drag.hoveredGroup()).toBeNull();
    move(null);
    expect(drag.target()).toBeNull();
    move(guide);
    expect(drag.target()).toEqual(new SideDropTarget(DockSide.Right));
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    document.body.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(drag.dragging()).toBeNull();
    pointer(document, "pointerup", 120, 10);
    expect(layout.dock(DockSide.Left).panels).toEqual([PanelId.Changes, PanelId.Explorer]);

    down(PanelId.Explorer);
    const early = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    document.body.dispatchEvent(early);
    expect(early.defaultPrevented).toBe(false);
    move(guide);
    const other = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    document.body.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    pointer(document, "pointerup", 120, 10);
    expect(layout.dock(DockSide.Right).panels).toEqual([PanelId.Explorer]);

    down(PanelId.Activity);
    move(top);
    pointer(document, "pointercancel", 120, 10);
    expect(layout.dock(DockSide.Bottom).panels).toEqual([PanelId.Activity]);
    down(PanelId.Activity, 2);
    move(top);
    expect(drag.dragging()).toBeNull();
    for (const created of [card, compass, guide, upward, stranger, nothing])
      created.remove();
  });
});
