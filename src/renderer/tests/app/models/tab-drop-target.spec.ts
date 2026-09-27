/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { PanelId } from "../../../src/app/enums/panel-id";
import { PanelArrangement } from "../../../src/app/models/panel-arrangement";
import { ShellGeometry } from "../../../src/app/models/shell-geometry";
import { SplitDropTarget } from "../../../src/app/models/split-drop-target";
import { TabDropTarget } from "../../../src/app/models/tab-drop-target";

describe("TabDropTarget", () => {
  it("adds the panel as a tab, previews the whole group and compares by group and index", () => {
    const arrangement = PanelArrangement.createDefault();
    const target = new TabDropTarget(1, 0.4);

    expect(target.index).toBe(0);
    expect(new TabDropTarget(1, -3).index).toBe(0);
    expect(target.place(arrangement, PanelId.Changes).dock(DockSide.Left).panels).toEqual([PanelId.Changes, PanelId.Explorer]);
    const geometry = new ShellGeometry(1920, 1045, arrangement);
    expect(target.preview(geometry)).toBe(geometry.frameOf(1)?.bounds);
    expect(new TabDropTarget(3, 0).preview(geometry)).toBeNull();

    expect(target.equals(new TabDropTarget(1, 0))).toBe(true);
    expect(target.equals(new TabDropTarget(1, 1))).toBe(false);
    expect(target.equals(new TabDropTarget(2, 0))).toBe(false);
    expect(target.equals(new SplitDropTarget(1, PanelEdge.Left))).toBe(false);
    expect(target.equals(null)).toBe(false);
  });
});
