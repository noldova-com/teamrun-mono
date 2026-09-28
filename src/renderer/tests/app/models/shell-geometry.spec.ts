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
import { GroupFrame } from "../../../src/app/models/group-frame";
import { Panel } from "../../../src/app/models/panel";
import { PanelArrangement } from "../../../src/app/models/panel-arrangement";
import { ShellGeometry } from "../../../src/app/models/shell-geometry";
import { TabGroup } from "../../../src/app/models/tab-group";

describe("ShellGeometry", () => {
  const changes = new Panel(PanelKind.Changes);
  const activity = new Panel(PanelKind.Activity);
  const box = (rect: DOMRectReadOnly | null | undefined): readonly number[] => (rect ? [rect.x, rect.y, rect.width, rect.height] : []);

  it("places the docks around the middle and the groups within them", () => {
    const geometry = new ShellGeometry(1920, 1045, PanelArrangement.createDefault());

    expect(box(geometry.dock(DockSide.Left))).toEqual([4, 0, 416, 1041]);
    expect(box(geometry.dock(DockSide.Right))).toEqual([1516, 0, 400, 1041]);
    expect(box(geometry.dock(DockSide.Bottom))).toEqual([424, 997, 1088, 44]);
    expect(box(geometry.middle)).toEqual([424, 0, 1088, 993]);
    expect(box(geometry.documents.bounds)).toEqual([424, 0, 1088, 993]);
    expect(geometry.documents.side).toBeNull();
    expect(geometry.groups.map(t => [t.group.id, t.side, ...box(t.bounds)])).toEqual([
      [1, DockSide.Left, 4, 0, 416, 1041],
      [2, DockSide.Right, 1516, 0, 400, 1041]
    ]);
    expect(geometry.frameOf(3)).toBeNull();
    expect(geometry.frameOf(TabGroup.documentsId)).toBe(geometry.documents);
    expect(geometry.handles).toEqual([]);
    expect(geometry.maximumSize(DockSide.Left)).toBe(896);
    expect(geometry.maximumSize(DockSide.Bottom)).toBe(813);
  });

  it("lists groups by id and splits the middle and docks with handles", () => {
    const arrangement = PanelArrangement.createDefault()
      .splitGroup(changes, TabGroup.documentsId, PanelEdge.Right)
      .openPanel(activity);
    const geometry = new ShellGeometry(1920, 1045, arrangement);

    expect(box(geometry.dock(DockSide.Right))).toEqual([1916, 0, 0, 1041]);
    expect(box(geometry.middle)).toEqual([424, 0, 1492, 777]);
    expect(geometry.groups.map(t => [t.group.id, t.side])).toEqual([[1, DockSide.Left], [3, DockSide.Bottom], [4, null]]);
    expect(box(geometry.documents.bounds)).toEqual([424, 0, 744, 777]);
    expect(box(geometry.frameOf(4)?.bounds)).toEqual([1172, 0, 744, 777]);
    expect(geometry.handles.map(t => [t.leadingId, ...box(t.bounds)])).toEqual([[TabGroup.documentsId, 1168, 0, 4, 777]]);
  });

  it("previews docking along a side and splitting a group", () => {
    const geometry = new ShellGeometry(1920, 1045, PanelArrangement.createDefault());

    expect(box(geometry.sidePreview(DockSide.Left))).toEqual([4, 0, 206, 1041]);
    expect(box(geometry.sidePreview(DockSide.Right))).toEqual([1718, 0, 198, 1041]);
    expect(box(geometry.sidePreview(DockSide.Bottom))).toEqual([424, 781, 1088, 260]);
    const empty = new ShellGeometry(1920, 1045, PanelArrangement.createDefault().closePanel(changes).resizeDock(DockSide.Right, 300));
    expect(box(empty.sidePreview(DockSide.Right))).toEqual([1616, 0, 300, 1041]);

    const bounds = new DOMRectReadOnly(100, 200, 404, 304);
    expect(box(geometry.edgeHalf(bounds, PanelEdge.Left))).toEqual([100, 200, 200, 304]);
    expect(box(geometry.edgeHalf(bounds, PanelEdge.Right))).toEqual([304, 200, 200, 304]);
    expect(box(geometry.edgeHalf(bounds, PanelEdge.Top))).toEqual([100, 200, 404, 150]);
    expect(box(geometry.edgeHalf(bounds, PanelEdge.Bottom))).toEqual([100, 354, 404, 150]);
    expect(box(geometry.edgeHalf(new DOMRectReadOnly(0, 0, 2, 2), PanelEdge.Left))).toEqual([0, 0, 0, 2]);
  });

  it("centers each side guide in the area it gives the panel and moves a group's guides clear of them", () => {
    const geometry = new ShellGeometry(1920, 1045, PanelArrangement.createDefault());

    expect(box(geometry.guideBounds(DockSide.Left))).toEqual([87, 500.5, 40, 40]);
    expect(box(geometry.guideBounds(DockSide.Right))).toEqual([1797, 500.5, 40, 40]);
    expect(box(geometry.guideBounds(DockSide.Bottom))).toEqual([948, 891, 40, 40]);

    expect(box(geometry.compassBounds(geometry.documents))).toEqual([902, 430.5, 132, 132]);
    const narrow = new GroupFrame(new TabGroup(9, [changes], null), new DOMRectReadOnly(4, 0, 300, 1041), DockSide.Left);
    expect(box(geometry.compassBounds(narrow))).toEqual([135, 454.5, 132, 132]);
    const corner = new GroupFrame(new TabGroup(9, [changes], null), new DOMRectReadOnly(0, 1000, 100, 41), null);
    expect(box(geometry.compassBounds(corner))).toEqual([4, 909, 132, 132]);
    const top = new GroupFrame(new TabGroup(9, [changes], null), new DOMRectReadOnly(1800, 0, 120, 20), null);
    expect(box(geometry.compassBounds(top))).toEqual([1784, 0, 132, 132]);
    expect(box(new ShellGeometry(100, 100, PanelArrangement.createDefault()).compassBounds(corner))).toEqual([-16, -18, 132, 132]);

    const open = new ShellGeometry(1920, 1045, PanelArrangement.createDefault().openPanel(activity));
    expect(box(open.guideBounds(DockSide.Bottom))).toEqual([948, 957, 40, 40]);
    expect(box(open.compassBounds(open.frameOf(3)!))).toEqual([902, 817, 132, 132]);
  });
});
