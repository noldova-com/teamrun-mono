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
import { PanelKind } from "../../../../src/app/enums/panel-kind";
import { Panel } from "../../../../src/app/models/panel";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { PanelDragService } from "../../../../src/app/services/panel-drag.service";
import { ShellService } from "../../../../src/app/services/shell.service";
import { DockGuidesComponent } from "../../../../src/app/components/dock-guides/dock-guides.component";

describe("DockGuidesComponent", () => {
  it("shows the side guides, the group guides under the pointer, the landing preview and the dragged tab while dragging", () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [DockGuidesComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const layout = TestBed.inject(LayoutService);
    const shell = TestBed.inject(ShellService);
    const drag = TestBed.inject(PanelDragService);
    const fixture = TestBed.createComponent(DockGuidesComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const explorer = layout.arrangement().groupOf(new Panel(PanelKind.Explorer))?.id ?? -1;
    const changes = layout.arrangement().groupOf(new Panel(PanelKind.Changes))?.id ?? -1;
    const card = (group: number): HTMLElement => {
      const created = document.createElement("section");
      created.dataset["dropGroup"] = String(group);
      document.body.append(created);
      return created;
    };
    const explorerCard = card(explorer);
    const changesCard = card(changes);
    let under: Element | null = null;
    document.elementFromPoint = (): Element | null => under;
    const move = (target: Element | null): void => {
      under = target;
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 300, clientY: 200, bubbles: true }));
      fixture.detectChanges();
    };
    const box = (target: HTMLElement | null): readonly string[] => [target?.style.left ?? "", target?.style.top ?? "", target?.style.width ?? "", target?.style.height ?? ""];
    const pixels = (rect: DOMRectReadOnly): readonly string[] => [`${rect.x}px`, `${rect.y}px`, `${rect.width}px`, `${rect.height}px`];
    expect(element.children).toHaveLength(0);

    drag.begin(new Panel(PanelKind.Changes), new PointerEvent("pointerdown", { clientX: 10, clientY: 10, button: 0 }));
    move(changesCard);
    expect(Array.from(element.querySelectorAll<HTMLElement>(".tr-dock-guide-edge")).map(t => [t.dataset["dropSide"], t.style.left, t.style.top]))
      .toEqual(Object.values(DockSide).map(side => [side, `${shell.geometry().guideBounds(side).x}px`, `${shell.geometry().guideBounds(side).y}px`]));
    expect(element.querySelector(".tr-dock-compass")).toBeNull();
    expect(element.querySelector(".tr-drop-preview")).toBeNull();
    expect(element.querySelector(".tr-drag-ghost")?.textContent).toContain(Resources.panelLabels[PanelKind.Changes]);
    expect(element.querySelector<HTMLElement>(".tr-drag-ghost")?.style.left).toBe(`${300 + Resources.ghostOffset}px`);

    move(explorerCard);
    const compass = element.querySelector<HTMLElement>(".tr-dock-compass")!;
    const frame = shell.geometry().frameOf(explorer)!;
    const bounds = shell.geometry().compassBounds(frame);
    expect([compass.dataset["dropGroup"], compass.style.left, compass.style.top]).toEqual([String(explorer), `${bounds.x}px`, `${bounds.y}px`]);
    expect(Array.from(compass.querySelectorAll<HTMLElement>("[data-drop-edge]")).map(t => [t.dataset["dropEdge"], t.getAttribute("aria-label")]))
      .toEqual(Object.values(PanelEdge).map(edge => [edge, Resources.splitGuideLabels[edge]]));
    expect(compass.querySelector("[data-drop-center]")?.getAttribute("aria-label")).toBe(Resources.addAsTabLabel);

    move(compass.querySelector('[data-drop-edge="Top"]'));
    expect(compass.querySelector('[data-drop-edge="Top"]')?.classList.contains("tr-dock-guide-active")).toBe(true);
    expect(box(element.querySelector(".tr-drop-preview"))).toEqual(pixels(shell.geometry().edgeHalf(frame.bounds, PanelEdge.Top)));
    move(compass.querySelector("[data-drop-center]"));
    expect(compass.querySelector("[data-drop-center]")?.classList.contains("tr-dock-guide-active")).toBe(true);
    expect(box(element.querySelector(".tr-drop-preview"))).toEqual(pixels(frame.bounds));
    move(element.querySelector('[data-drop-side="Bottom"]'));
    expect(element.querySelector(".tr-dock-compass")).toBeNull();
    expect(element.querySelector('[data-drop-side="Bottom"]')?.classList.contains("tr-dock-guide-active")).toBe(true);
    expect(box(element.querySelector(".tr-drop-preview"))).toEqual(pixels(shell.geometry().sidePreview(DockSide.Bottom)));

    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 300, clientY: 200, bubbles: true }));
    fixture.detectChanges();
    expect(element.children).toHaveLength(0);
    expect(layout.dock(DockSide.Bottom).panels).toEqual([new Panel(PanelKind.Activity), new Panel(PanelKind.Changes)]);
    explorerCard.remove();
    changesCard.remove();
  });
});
