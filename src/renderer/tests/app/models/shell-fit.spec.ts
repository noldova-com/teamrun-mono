/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelKind } from "../../../src/app/enums/panel-kind";
import { Resources } from "../../../src/app/resources";
import { Dock } from "../../../src/app/models/dock";
import { Panel } from "../../../src/app/models/panel";
import { ShellFit } from "../../../src/app/models/shell-fit";
import { TabGroup } from "../../../src/app/models/tab-group";

const open = (side: DockSide, size: number | null = null): Dock => new Dock(side, new TabGroup(1, [new Panel(PanelKind.Explorer)], null), size, false);
const collapsed = (side: DockSide): Dock => new Dock(side, new TabGroup(1, [new Panel(PanelKind.Explorer)], null), null, true);
const empty = (side: DockSide): Dock => new Dock(side, null, null, false);
const gap = Resources.shellGap;
const chrome = Resources.shellPadding * 2;

describe("ShellFit", () => {
  it("gives every dock its size and the document the rest while the rest is enough", () => {
    const fit = ShellFit.of(1920, [open(DockSide.Left, 416), open(DockSide.Right, 400)]);

    expect(fit.track(DockSide.Left)).toBe(416 + gap);
    expect(fit.track(DockSide.Right)).toBe(400 + gap);
    expect(fit.document).toBe(1920 - chrome - 416 - gap - 400 - gap);
    expect(fit.maximum(DockSide.Left)).toBe(Resources.dockMaximumSize);
  });

  it("takes the default size for a dock without one, the strip for a collapsed one, and nothing for an empty one", () => {
    const fit = ShellFit.of(1600, [open(DockSide.Left), collapsed(DockSide.Right)]);

    expect(fit.track(DockSide.Left)).toBe(Resources.defaultDockSizes[DockSide.Left] + gap);
    expect(fit.track(DockSide.Right)).toBe(Resources.dockStripSize + gap);
    expect(ShellFit.of(1600, [empty(DockSide.Left), empty(DockSide.Right)]).track(DockSide.Left)).toBe(0);
    expect(ShellFit.of(1600, [empty(DockSide.Left), empty(DockSide.Right)]).document).toBe(1600 - chrome);
    expect(fit.track(DockSide.Bottom)).toBe(0);
  });

  it("shrinks the first dock down to the minimum before the second, and the document only after both", () => {
    const left = open(DockSide.Left, 600);
    const right = open(DockSide.Right, 500);
    const wanted = 600 + gap + 500 + gap;

    const enough = ShellFit.of(chrome + wanted + Resources.documentMinimumSize, [left, right]);
    expect(enough.track(DockSide.Left)).toBe(600 + gap);
    expect(enough.document).toBe(Resources.documentMinimumSize);
    expect(enough.maximum(DockSide.Left)).toBe(600 + gap);

    const short = ShellFit.of(chrome + wanted + Resources.documentMinimumSize - 100, [left, right]);
    expect(short.track(DockSide.Left)).toBe(500 + gap);
    expect(short.track(DockSide.Right)).toBe(500 + gap);
    expect(short.document).toBe(Resources.documentMinimumSize);

    const shorter = ShellFit.of(chrome + wanted + Resources.documentMinimumSize - 500, [left, right]);
    expect(shorter.track(DockSide.Left)).toBe(Resources.dockMinimumSize + gap);
    expect(shorter.track(DockSide.Right)).toBe(500 + gap - (500 - (600 - Resources.dockMinimumSize)));
    expect(shorter.document).toBe(Resources.documentMinimumSize);

    const least = ShellFit.of(chrome + 2 * (Resources.dockMinimumSize + gap) + 100, [left, right]);
    expect(least.track(DockSide.Left)).toBe(Resources.dockMinimumSize + gap);
    expect(least.track(DockSide.Right)).toBe(Resources.dockMinimumSize + gap);
    expect(least.document).toBe(100);
    expect(least.maximum(DockSide.Right)).toBe(Resources.dockMinimumSize + gap);
  });

  it("leaves a collapsed dock its strip and an empty dock nothing while the others give way", () => {
    const size = chrome + Resources.dockStripSize + gap + Resources.documentMinimumSize + 300 + gap;
    const fit = ShellFit.of(size, [collapsed(DockSide.Left), open(DockSide.Right, 400)]);

    expect(fit.track(DockSide.Left)).toBe(Resources.dockStripSize + gap);
    expect(fit.track(DockSide.Right)).toBe(300 + gap);
    expect(fit.document).toBe(Resources.documentMinimumSize);
  });

  it("fits one dock down the height the same way", () => {
    const fit = ShellFit.of(chrome + 260 + gap + Resources.documentMinimumSize - 40, [open(DockSide.Bottom, 260)]);

    expect(fit.track(DockSide.Bottom)).toBe(220 + gap);
    expect(fit.document).toBe(Resources.documentMinimumSize);
  });
});
