/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelId } from "../../../src/app/enums/panel-id";
import { PanelArrangement } from "../../../src/app/models/panel-arrangement";
import { ShellGeometry } from "../../../src/app/models/shell-geometry";
import { SideDropTarget } from "../../../src/app/models/side-drop-target";
import { TabDropTarget } from "../../../src/app/models/tab-drop-target";

describe("SideDropTarget", () => {
  it("docks the panel along the side, previews the area and compares by side", () => {
    const arrangement = PanelArrangement.createDefault();
    const target = new SideDropTarget(DockSide.Right);

    expect(target.place(arrangement, PanelId.Activity).dock(DockSide.Right).panels).toEqual([PanelId.Changes, PanelId.Activity]);
    const geometry = new ShellGeometry(1920, 1045, arrangement);
    const preview = target.preview(geometry);
    const expected = geometry.sidePreview(DockSide.Right);
    expect([preview.x, preview.y, preview.width, preview.height]).toEqual([expected.x, expected.y, expected.width, expected.height]);
    expect(preview.width).toBe(198);

    expect(target.equals(new SideDropTarget(DockSide.Right))).toBe(true);
    expect(target.equals(new SideDropTarget(DockSide.Bottom))).toBe(false);
    expect(target.equals(new TabDropTarget(2, 0))).toBe(false);
    expect(target.equals(null)).toBe(false);
  });
});
