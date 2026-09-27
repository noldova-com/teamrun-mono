/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { Resources } from "../../../../src/app/resources";
import { ResizeHandleComponent } from "../../../../src/app/components/resize-handle/resize-handle.component";

describe("ResizeHandleComponent", () => {
  const pointer = (element: HTMLElement, type: string, x: number, y: number, button: number = 0): void => {
    element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true, cancelable: true }));
  };

  it("reports the size along a right edge as the pointer drags, and the reset on a double-click", () => {
    const fixture = TestBed.createComponent(ResizeHandleComponent);
    fixture.componentRef.setInput("edge", PanelEdge.Right);
    fixture.componentRef.setInput("size", 400);
    const sizes: number[] = [];
    let resets = 0;
    fixture.componentInstance.resized.subscribe(t => sizes.push(t));
    fixture.componentInstance.reset.subscribe(() => { resets += 1; });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.dataset["edge"]).toBe(PanelEdge.Right);

    pointer(element, "pointermove", 150, 0);
    pointer(element, "pointerdown", 100, 0, 1);
    pointer(element, "pointermove", 150, 0);
    expect(sizes).toEqual([]);

    pointer(element, "pointerdown", 100, 0);
    fixture.detectChanges();
    expect(element.classList.contains("tr-resizing")).toBe(true);
    pointer(element, "pointermove", 150, 0);
    pointer(element, "pointermove", 60, 0);
    pointer(element, "pointerup", 60, 0);
    fixture.detectChanges();
    expect(sizes).toEqual([450, 360]);
    expect(element.classList.contains("tr-resizing")).toBe(false);
    pointer(element, "pointermove", 500, 0);
    expect(sizes).toEqual([450, 360]);

    element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(resets).toBe(1);
  });

  it("measures the panel when no size is given and grows a top edge upward", () => {
    const fixture = TestBed.createComponent(ResizeHandleComponent);
    fixture.componentRef.setInput("edge", PanelEdge.Top);
    const sizes: number[] = [];
    fixture.componentInstance.resized.subscribe(t => sizes.push(t));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.parentElement!.getBoundingClientRect = () => new DOMRect(0, 0, 800, 200);

    pointer(element, "pointerdown", 0, 500);
    pointer(element, "pointermove", 0, 440);
    pointer(element, "pointercancel", 0, 440);
    expect(sizes).toEqual([260]);
  });

  it("resizes by a step with the arrow keys along its axis and resets on Enter", () => {
    const fixture = TestBed.createComponent(ResizeHandleComponent);
    fixture.componentRef.setInput("edge", PanelEdge.Right);
    fixture.componentRef.setInput("size", 400);
    const sizes: number[] = [];
    let resets = 0;
    fixture.componentInstance.resized.subscribe(t => sizes.push(t));
    fixture.componentInstance.reset.subscribe(() => { resets += 1; });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const press = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event;
    };

    expect([element.getAttribute("role"), element.getAttribute("tabindex"), element.getAttribute("aria-orientation")]).toEqual(["separator", "0", "vertical"]);
    expect(element.getAttribute("aria-valuetext")).toBe("400 pixels");
    expect(element.getAttribute("aria-label")).toBe(Resources.resizeHandleLabel);
    expect(press("ArrowRight").defaultPrevented).toBe(true);
    press("ArrowLeft");
    expect(press("ArrowUp").defaultPrevented).toBe(false);
    expect(sizes).toEqual([400 + Resources.resizeStep, 400 - Resources.resizeStep]);
    expect(press("Enter").defaultPrevented).toBe(true);
    expect(resets).toBe(1);

    fixture.componentRef.setInput("edge", PanelEdge.Top);
    fixture.componentRef.setInput("size", null);
    fixture.detectChanges();
    element.parentElement!.getBoundingClientRect = () => new DOMRect(0, 0, 800, 200);
    expect(element.getAttribute("aria-orientation")).toBe("horizontal");
    expect(element.hasAttribute("aria-valuetext")).toBe(false);
    press("ArrowUp");
    press("ArrowDown");
    press("ArrowLeft");
    expect(sizes.slice(2)).toEqual([200 + Resources.resizeStep, 200 - Resources.resizeStep]);
  });
});
