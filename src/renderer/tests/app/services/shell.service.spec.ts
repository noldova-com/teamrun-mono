/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { DockSide } from "../../../src/app/enums/dock-side";
import { Resources } from "../../../src/app/resources";
import { LayoutService } from "../../../src/app/services/layout.service";
import { ShellService } from "../../../src/app/services/shell.service";
import { ViewportService } from "../../../src/app/services/viewport.service";

const resize = (width: number, height: number): void => {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.dispatchEvent(new Event(Resources.resizeEvent));
};

describe("ShellService", () => {
  it("lays the shell out for the window and the arrangement, and caps what a sash may take", () => {
    MemoryStorage.install(window);
    resize(1920, 1080);
    const viewport = TestBed.inject(ViewportService);
    const shell = TestBed.inject(ShellService);
    const layout = TestBed.inject(LayoutService);
    const gap = Resources.shellGap;
    const padding = Resources.shellPadding;
    const left = Resources.defaultDockSizes.Left;
    const right = Resources.defaultDockSizes.Right;

    expect(viewport.width()).toBe(1920);
    expect(viewport.height()).toBe(1080);
    const middle = shell.geometry().middle;
    expect([middle.x, middle.y, middle.width, middle.height])
      .toEqual([padding + left + gap, 0, 1920 - 2 * padding - left - right - 2 * gap, 1080 - Resources.windowRowHeight - padding - Resources.dockStripSize - gap]);
    expect(shell.geometry().dock(DockSide.Left).width).toBe(left);
    expect(shell.maximumSize(DockSide.Left)).toBe(Resources.dockMaximumSize - gap);

    resize(1000, 700);
    expect(shell.geometry().middle.width).toBe(Resources.documentMinimumSize);
    expect(shell.geometry().dock(DockSide.Right).width).toBe(right);
    const squeezed = 1000 - 2 * padding - right - gap - Resources.documentMinimumSize;
    expect(shell.geometry().dock(DockSide.Left).width).toBe(squeezed - gap);
    expect(shell.maximumSize(DockSide.Left)).toBe(squeezed - gap);

    const before = shell.geometry();
    layout.showDocument("c1");
    expect(shell.geometry()).toBe(before);
    layout.resizeDock(DockSide.Right, 800);
    expect(shell.geometry()).not.toBe(before);
    resize(1920, 1080);
    expect(shell.geometry().dock(DockSide.Right).width).toBe(800);
  });
});
