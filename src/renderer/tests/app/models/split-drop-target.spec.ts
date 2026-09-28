/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { PanelKind } from "../../../src/app/enums/panel-kind";
import { Panel } from "../../../src/app/models/panel";
import { PanelArrangement } from "../../../src/app/models/panel-arrangement";
import { ShellGeometry } from "../../../src/app/models/shell-geometry";
import { SideDropTarget } from "../../../src/app/models/side-drop-target";
import { SplitDropTarget } from "../../../src/app/models/split-drop-target";

describe("SplitDropTarget", () => {
  const explorer = new Panel(PanelKind.Explorer);
  const changes = new Panel(PanelKind.Changes);

  it("splits the group, previews the half it gives the panel and compares by group and edge", () => {
    const arrangement = PanelArrangement.createDefault();
    const target = new SplitDropTarget(1, PanelEdge.Top);

    expect(target.place(arrangement, changes).dock(DockSide.Left).root?.groups.map(t => t.panels)).toEqual([[changes], [explorer]]);
    const geometry = new ShellGeometry(1920, 1045, arrangement);
    const bounds = geometry.frameOf(1)?.bounds ?? new DOMRectReadOnly();
    const half = target.preview(geometry);
    expect([half?.x, half?.y, half?.width, half?.height]).toEqual([bounds.x, bounds.y, bounds.width, (bounds.height - 4) / 2]);
    expect(new SplitDropTarget(3, PanelEdge.Top).preview(geometry)).toBeNull();

    expect(target.equals(new SplitDropTarget(1, PanelEdge.Top))).toBe(true);
    expect(target.equals(new SplitDropTarget(1, PanelEdge.Bottom))).toBe(false);
    expect(target.equals(new SplitDropTarget(2, PanelEdge.Top))).toBe(false);
    expect(target.equals(new SideDropTarget(DockSide.Left))).toBe(false);
    expect(target.equals(null)).toBe(false);
  });
});
