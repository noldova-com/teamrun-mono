/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { SampleData } from "../../../fixtures/sample-data";
import { MemoryStorage } from "../../../fixtures/memory-storage";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelKind } from "../../../../src/app/enums/panel-kind";
import { Panel } from "../../../../src/app/models/panel";
import { TabDropTarget } from "../../../../src/app/models/tab-drop-target";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { ShellService } from "../../../../src/app/services/shell.service";
import { DockComponent } from "../../../../src/app/components/dock/dock.component";

describe("DockComponent", () => {
  const explorer = new Panel(PanelKind.Explorer);
  const changes = new Panel(PanelKind.Changes);

  it("covers its dock's area with a panel strip while collapsed and a resize handle while open, and hides when empty", () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [DockComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const layout = TestBed.inject(LayoutService);
    const shell = TestBed.inject(ShellService);
    layout.movePanel(changes, new TabDropTarget(layout.arrangement().groupOf(explorer)?.id ?? -1, 1));
    const fixture = TestBed.createComponent(DockComponent);
    fixture.componentRef.setInput("side", DockSide.Left);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const bounds = shell.geometry().dock(DockSide.Left);

    expect(element.getAttribute("data-side")).toBe(DockSide.Left);
    expect([element.style.left, element.style.top, element.style.width, element.style.height])
      .toEqual([`${bounds.x}px`, `${bounds.y}px`, `${bounds.width}px`, `${bounds.height}px`]);
    expect(element.querySelector(".tr-dock-strip")).toBeNull();
    expect(element.querySelector("tr-resize-handle")?.getAttribute("data-edge")).toBe("Right");

    const handle = element.querySelector<HTMLElement>("tr-resize-handle")!;
    handle.setPointerCapture = (): void => undefined;
    handle.releasePointerCapture = (): void => undefined;
    handle.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 100, bubbles: true }));
    handle.dispatchEvent(new PointerEvent("pointermove", { clientX: 5000, bubbles: true }));
    handle.dispatchEvent(new PointerEvent("pointerup", { clientX: 5000, bubbles: true }));
    expect(layout.dock(DockSide.Left).size).toBe(shell.maximumSize(DockSide.Left));
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(layout.dock(DockSide.Left).size).toBeNull();

    layout.toggleDock(DockSide.Left);
    fixture.detectChanges();
    const strip = element.querySelector<HTMLElement>(".tr-dock-strip")!;
    expect(strip.dataset["dropGroup"]).toBe(String(layout.dock(DockSide.Left).root?.cornerGroup.id));
    expect(strip.hasAttribute("data-drop-tabs")).toBe(true);
    expect(element.querySelector("tr-resize-handle")).toBeNull();
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>(".tr-dock-strip-button"));
    expect(buttons.map(t => t.getAttribute("aria-label"))).toEqual([Resources.panelLabels[PanelKind.Explorer], Resources.panelLabels[PanelKind.Changes]]);
    buttons[1]!.click();
    fixture.detectChanges();
    expect(layout.dock(DockSide.Left).collapsed).toBe(false);
    expect(layout.arrangement().groupOf(changes)?.activePanel).toEqual(changes);

    layout.closePanel(explorer);
    layout.closePanel(changes);
    fixture.detectChanges();
    expect(element.classList.contains("hidden")).toBe(true);
  });

  it("gives each panel of one kind its own strip button that opens that one", () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [DockComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const layout = TestBed.inject(LayoutService);
    const first = new Panel(PanelKind.Terminal, "terminal-1");
    const second = new Panel(PanelKind.Terminal, "terminal-2");
    layout.openPanel(first);
    layout.openPanel(second);
    layout.toggleDock(DockSide.Bottom);
    const fixture = TestBed.createComponent(DockComponent);
    fixture.componentRef.setInput("side", DockSide.Bottom);
    fixture.detectChanges();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(".tr-dock-strip-button"));

    expect(buttons.map(t => [t.getAttribute("aria-label"), t.textContent?.trim()])).toEqual([["Activity", "list_alt"], ["Terminal", "terminal"], ["Terminal", "terminal"]]);
    buttons[1]!.click();
    expect(layout.dock(DockSide.Bottom).collapsed).toBe(false);
    expect(layout.arrangement().groupOf(first)?.activePanel).toEqual(first);
  });
});
