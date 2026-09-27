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
import { SplitAxis } from "../../../src/app/enums/split-axis";
import { ArrangementReader } from "../../../src/app/models/arrangement.reader";
import { PanelArrangement } from "../../../src/app/models/panel-arrangement";
import { SplitNode } from "../../../src/app/models/split.node";
import { TabGroup } from "../../../src/app/models/tab-group";

describe("ArrangementReader", () => {
  const read = (record: Record<string, unknown>): PanelArrangement => new ArrangementReader().read(record);
  const shape = (arrangement: PanelArrangement): unknown => JSON.parse(JSON.stringify(arrangement.toJson()));

  it("reads what an arrangement writes, with the same groups, splits, weights and sizes", () => {
    const documentsId = TabGroup.documentsId;
    const arrangement = PanelArrangement.createDefault()
      .splitGroup(PanelId.Activity, 1, PanelEdge.Bottom)
      .resizeDock(DockSide.Left, 300)
      .insertTab(PanelId.Changes, documentsId, 0)
      .splitGroup(PanelId.Changes, documentsId, PanelEdge.Right);
    const split = arrangement.dock(DockSide.Left).root as SplitNode;
    const resized = arrangement.resizeSplit(split.id, [2, 1]).toggleDock(DockSide.Left);

    const restored = read(shape(resized) as Record<string, unknown>);
    expect(shape(restored)).toEqual(shape(resized));
    expect(restored.dock(DockSide.Left).collapsed).toBe(true);
    expect(restored.dock(DockSide.Left).size).toBe(300);
    expect((restored.dock(DockSide.Left).root as SplitNode).weights).toEqual([2 / 3, 1 / 3]);
    expect(restored.middle.groups.map(t => t.panels)).toEqual([[], [PanelId.Changes]]);
    expect(restored.documents.id).toBe(documentsId);
    expect(new Set(restored.groups.map(t => t.id)).size).toBe(restored.groups.length);
  });

  it("reads docks saved before they could hold splits as single groups", () => {
    const restored = read({
      docks: {
        Left: { panels: ["Explorer", "Changes"], activePanel: "Changes", size: 350, collapsed: false },
        Right: { panels: [], activePanel: null, size: null, collapsed: false },
        Bottom: { panels: ["Activity"], activePanel: "Activity", size: 240, collapsed: true }
      },
      documents: { open: ["c1"], active: "c1", preview: null }
    });

    expect(restored.dock(DockSide.Left).panels).toEqual([PanelId.Explorer, PanelId.Changes]);
    expect(restored.groupOf(PanelId.Changes)?.activePanel).toBe(PanelId.Changes);
    expect(restored.dock(DockSide.Left).size).toBe(350);
    expect(restored.dock(DockSide.Right).isEmpty).toBe(true);
    expect(restored.dock(DockSide.Bottom).collapsed).toBe(true);
    expect(restored.middle).toBe(restored.documents);
    expect(restored.documents.panels).toEqual([]);
  });

  it("drops what it cannot use and keeps the documents group in the middle", () => {
    const restored = read({
      docks: {
        Left: { root: { panels: ["Explorer", "bogus", "Explorer"], activePanel: "bogus" }, size: "wide", collapsed: "no" },
        Right: { root: { axis: "Diagonal", children: [{ panels: ["Explorer"] }, { panels: [] }, "x", { panels: ["Changes"] }], weights: [1, "2"] } },
        Bottom: { root: { documentsGroup: true, panels: ["Activity"] } }
      },
      middle: { axis: SplitAxis.Vertical, children: [{ panels: ["Activity"] }, { documentsGroup: true, panels: ["Changes"], activePanel: "Changes" }] }
    });

    expect(restored.dock(DockSide.Left).panels).toEqual([PanelId.Explorer]);
    expect(restored.groupOf(PanelId.Explorer)?.activePanel).toBe(PanelId.Explorer);
    expect(restored.dock(DockSide.Left).size).toBeNull();
    expect(restored.dock(DockSide.Left).collapsed).toBe(false);
    expect(restored.dock(DockSide.Right).root).toBeInstanceOf(TabGroup);
    expect(restored.dock(DockSide.Right).panels).toEqual([PanelId.Changes]);
    expect(restored.dock(DockSide.Bottom).panels).toEqual([PanelId.Activity]);
    expect(restored.dock(DockSide.Bottom).root).not.toBe(restored.documents);
    expect(restored.middle).toBe(restored.documents);
    expect(restored.documents.panels).toEqual([]);
    expect(restored.documents.activePanel).toBeNull();

    const weighted = read({
      docks: {},
      middle: { axis: "Vertical", children: [{ panels: ["Activity"] }, { documentsGroup: true, panels: [] }, { documentsGroup: true, panels: [] }], weights: [3, 1, 1] }
    });
    const middle = weighted.middle as SplitNode;
    expect(middle.axis).toBe(SplitAxis.Vertical);
    expect(middle.weights).toEqual([0.75, 0.25]);
    expect(weighted.documents).toBe(middle.children[1]);

    const unmarked = read({ middle: { panels: ["Changes"] } });
    const wrapped = unmarked.middle as SplitNode;
    expect([wrapped.axis, wrapped.groups.map(t => t.panels)]).toEqual([SplitAxis.Horizontal, [[], [PanelId.Changes]]]);
    expect(unmarked.documents.isDocuments).toBe(true);

    expect(shape(read({}))).toEqual(shape(new PanelArrangement([], new TabGroup(TabGroup.documentsId, [], null))));
    expect(read({ docks: [] }).dock(DockSide.Left).isEmpty).toBe(true);
    expect(read({ docks: { Left: 4 } }).dock(DockSide.Left).isEmpty).toBe(true);
    expect(read({ docks: { Left: { root: [] } } }).dock(DockSide.Left).isEmpty).toBe(true);
  });
});
