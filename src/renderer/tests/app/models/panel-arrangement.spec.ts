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
import { Dock } from "../../../src/app/models/dock";
import { PanelArrangement } from "../../../src/app/models/panel-arrangement";
import { SplitNode } from "../../../src/app/models/split.node";
import { TabGroup } from "../../../src/app/models/tab-group";
import { Resources } from "../../../src/app/resources";

describe("PanelArrangement", () => {
  const tabs = (arrangement: PanelArrangement, side: DockSide): readonly PanelId[] => arrangement.dock(side).panels;
  const groupOf = (arrangement: PanelArrangement, panel: PanelId): TabGroup => {
    const group = arrangement.groupOf(panel);
    if (group === null)
      throw new Error(`${panel} is not open.`);
    return group;
  };

  it("starts with each panel in its default dock, the bottom dock collapsed and an empty documents group", () => {
    const arrangement = PanelArrangement.createDefault();

    expect(tabs(arrangement, DockSide.Left)).toEqual([PanelId.Explorer]);
    expect(tabs(arrangement, DockSide.Right)).toEqual([PanelId.Changes]);
    expect(tabs(arrangement, DockSide.Bottom)).toEqual([PanelId.Activity]);
    expect(arrangement.dock(DockSide.Bottom).collapsed).toBe(true);
    expect(arrangement.dock(DockSide.Left).size).toBeNull();
    expect(arrangement.middle).toBe(arrangement.documents);
    expect(arrangement.documents.panels).toEqual([]);
    expect(arrangement.groups.map(t => t.id)).toEqual([1, 2, 3, TabGroup.documentsId]);
    expect(arrangement.sideOf(groupOf(arrangement, PanelId.Changes).id)).toBe(DockSide.Right);
    expect(arrangement.sideOf(TabGroup.documentsId)).toBeNull();
    expect(arrangement.group(99)).toBeNull();
    expect(arrangement.isOpen(PanelId.Activity)).toBe(true);
    expect(arrangement.isShown(PanelId.Activity)).toBe(false);
    expect(arrangement.isShown(PanelId.Explorer)).toBe(true);
    expect(() => arrangement.dock("Top" as DockSide)).toThrow(RangeError);
    expect(arrangement.toJson()).toEqual({
      docks: {
        Left: { root: { documentsGroup: false, panels: ["Explorer"], activePanel: "Explorer" }, size: null, collapsed: false },
        Right: { root: { documentsGroup: false, panels: ["Changes"], activePanel: "Changes" }, size: null, collapsed: false },
        Bottom: { root: { documentsGroup: false, panels: ["Activity"], activePanel: "Activity" }, size: null, collapsed: true }
      },
      middle: { documentsGroup: true, panels: [], activePanel: null }
    });
  });

  it("requires the documents group in the middle and each panel in one place", () => {
    const documents = new TabGroup(TabGroup.documentsId, [], null);
    expect(() => new PanelArrangement([], new TabGroup(1, [PanelId.Explorer], null))).toThrow(Resources.missingDocumentsGroupMessage);
    expect(() => new PanelArrangement([new Dock(DockSide.Left, new TabGroup(1, [PanelId.Explorer], null), null, false)],
      new SplitNode(2, SplitAxis.Horizontal, [documents, new TabGroup(3, [PanelId.Explorer], null)], [1, 1]))).toThrow(Resources.repeatedPanelMessage);
    const bare = new PanelArrangement([], documents);
    expect([...bare.docks.keys()]).toEqual([DockSide.Left, DockSide.Right, DockSide.Bottom]);
    expect(bare.dock(DockSide.Right).isEmpty).toBe(true);
  });

  it("opens, shows, closes and toggles panels", () => {
    let arrangement = PanelArrangement.createDefault();

    arrangement = arrangement.openPanel(PanelId.Activity);
    expect(arrangement.dock(DockSide.Bottom).collapsed).toBe(false);
    expect(arrangement.isShown(PanelId.Activity)).toBe(true);
    expect(arrangement.openPanel(PanelId.Activity)).toBe(arrangement);

    arrangement = arrangement.closePanel(PanelId.Changes);
    expect(arrangement.isOpen(PanelId.Changes)).toBe(false);
    expect(arrangement.dock(DockSide.Right).isEmpty).toBe(true);
    expect(arrangement.closePanel(PanelId.Changes)).toBe(arrangement);
    arrangement = arrangement.openPanel(PanelId.Changes);
    expect(tabs(arrangement, DockSide.Right)).toEqual([PanelId.Changes]);

    arrangement = arrangement.insertTab(PanelId.Changes, groupOf(arrangement, PanelId.Explorer).id, 1).closePanel(PanelId.Changes).openPanel(PanelId.Changes);
    expect(tabs(arrangement, DockSide.Right)).toEqual([PanelId.Changes]);
    arrangement = arrangement.closePanel(PanelId.Explorer).insertTab(PanelId.Activity, groupOf(arrangement, PanelId.Changes).id, 0);
    arrangement = arrangement.openPanel(PanelId.Explorer);
    expect(tabs(arrangement, DockSide.Left)).toEqual([PanelId.Explorer]);
    arrangement = arrangement.closePanel(PanelId.Changes).openPanel(PanelId.Changes);
    expect(tabs(arrangement, DockSide.Right)).toEqual([PanelId.Activity, PanelId.Changes]);

    arrangement = arrangement.togglePanel(PanelId.Changes);
    expect(arrangement.isOpen(PanelId.Changes)).toBe(false);
    arrangement = arrangement.togglePanel(PanelId.Changes).activatePanel(PanelId.Activity);
    expect(arrangement.isShown(PanelId.Changes)).toBe(false);
    arrangement = arrangement.togglePanel(PanelId.Changes);
    expect(arrangement.isShown(PanelId.Changes)).toBe(true);
    arrangement = arrangement.toggleDock(DockSide.Right);
    expect(arrangement.isShown(PanelId.Changes)).toBe(false);
    arrangement = arrangement.togglePanel(PanelId.Changes);
    expect(arrangement.dock(DockSide.Right).collapsed).toBe(false);
    expect(arrangement.activatePanel(PanelId.Changes)).toBe(arrangement);
    arrangement = arrangement.toggleDock(DockSide.Right).activatePanel(PanelId.Changes);
    expect(arrangement.dock(DockSide.Right).collapsed).toBe(false);
    expect(arrangement.closePanel(PanelId.Explorer).activatePanel(PanelId.Explorer).isOpen(PanelId.Explorer)).toBe(false);
  });

  it("moves panels into groups, reordering within a group and closing a group its last tab leaves", () => {
    let arrangement = PanelArrangement.createDefault();
    const left = groupOf(arrangement, PanelId.Explorer).id;

    arrangement = arrangement.insertTab(PanelId.Changes, left, 0);
    expect(tabs(arrangement, DockSide.Left)).toEqual([PanelId.Changes, PanelId.Explorer]);
    expect(groupOf(arrangement, PanelId.Changes).activePanel).toBe(PanelId.Changes);
    expect(arrangement.dock(DockSide.Right).isEmpty).toBe(true);
    arrangement = arrangement.insertTab(PanelId.Changes, left, 2);
    expect(tabs(arrangement, DockSide.Left)).toEqual([PanelId.Explorer, PanelId.Changes]);
    expect(arrangement.insertTab(PanelId.Changes, left, 2)).toBe(arrangement);
    expect(arrangement.insertTab(PanelId.Activity, 99, 0)).toBe(arrangement);

    arrangement = arrangement.insertTab(PanelId.Activity, left, 1);
    expect(arrangement.dock(DockSide.Bottom).isEmpty).toBe(true);
    arrangement = arrangement.toggleDock(DockSide.Left).insertTab(PanelId.Activity, left, 3);
    expect(arrangement.dock(DockSide.Left).collapsed).toBe(false);
    expect(tabs(arrangement, DockSide.Left)).toEqual([PanelId.Explorer, PanelId.Changes, PanelId.Activity]);

    arrangement = arrangement.insertTab(PanelId.Activity, TabGroup.documentsId, 0);
    expect(arrangement.documents.panels).toEqual([PanelId.Activity]);
    expect(arrangement.documents.activePanel).toBe(PanelId.Activity);
    expect(arrangement.isShown(PanelId.Activity)).toBe(true);
    arrangement = arrangement.showDocuments();
    expect(arrangement.documents.activePanel).toBeNull();
    expect(arrangement.isShown(PanelId.Activity)).toBe(false);
    expect(arrangement.showDocuments()).toBe(arrangement);
    arrangement = arrangement.activatePanel(PanelId.Activity).closePanel(PanelId.Activity);
    expect(arrangement.documents.panels).toEqual([]);
    expect(arrangement.documents.activePanel).toBeNull();
    expect(arrangement.middle).toBe(arrangement.documents);
  });

  it("splits a group, giving the new group half of its space", () => {
    let arrangement = PanelArrangement.createDefault();
    const right = groupOf(arrangement, PanelId.Changes).id;

    expect(arrangement.splitGroup(PanelId.Changes, right, PanelEdge.Left)).toBe(arrangement);
    expect(arrangement.splitGroup(PanelId.Changes, 99, PanelEdge.Left)).toBe(arrangement);

    arrangement = arrangement.splitGroup(PanelId.Activity, right, PanelEdge.Bottom);
    const root = arrangement.dock(DockSide.Right).root as SplitNode;
    expect(root).toBeInstanceOf(SplitNode);
    expect([root.axis, root.weights, root.groups.map(t => t.panels)]).toEqual([SplitAxis.Vertical, [0.5, 0.5], [[PanelId.Changes], [PanelId.Activity]]]);
    expect(arrangement.dock(DockSide.Bottom).isEmpty).toBe(true);
    expect(arrangement.sideOf(groupOf(arrangement, PanelId.Activity).id)).toBe(DockSide.Right);

    arrangement = arrangement.insertTab(PanelId.Explorer, right, 0).splitGroup(PanelId.Changes, right, PanelEdge.Left);
    expect(arrangement.dock(DockSide.Left).isEmpty).toBe(true);
    expect(arrangement.dock(DockSide.Right).root?.groups.map(t => t.panels)).toEqual([[PanelId.Changes], [PanelId.Explorer], [PanelId.Activity]]);
    expect(new Set(arrangement.groups.map(t => t.id)).size).toBe(arrangement.groups.length);

    arrangement = arrangement.splitGroup(PanelId.Explorer, TabGroup.documentsId, PanelEdge.Right);
    expect(arrangement.middle.groups.map(t => t.panels)).toEqual([[], [PanelId.Explorer]]);
    expect(arrangement.sideOf(groupOf(arrangement, PanelId.Explorer).id)).toBeNull();
    arrangement = arrangement.insertTab(PanelId.Activity, TabGroup.documentsId, 0);
    const beside = arrangement.splitGroup(PanelId.Activity, TabGroup.documentsId, PanelEdge.Top);
    expect(beside.middle.groups.map(t => t.panels)).toEqual([[PanelId.Activity], [], [PanelId.Explorer]]);
    expect(beside.documents.activePanel).toBeNull();

    const collapsed = PanelArrangement.createDefault().splitGroup(PanelId.Changes, 3, PanelEdge.Right);
    expect(collapsed.dock(DockSide.Bottom).collapsed).toBe(false);
    expect(collapsed.dock(DockSide.Bottom).panels).toEqual([PanelId.Activity, PanelId.Changes]);
  });

  it("docks a panel along the whole outer edge of a dock", () => {
    let arrangement = PanelArrangement.createDefault();

    arrangement = arrangement.dockOnSide(PanelId.Changes, DockSide.Left);
    const left = arrangement.dock(DockSide.Left).root as SplitNode;
    expect([left.axis, left.groups.map(t => t.panels)]).toEqual([SplitAxis.Horizontal, [[PanelId.Changes], [PanelId.Explorer]]]);
    expect(arrangement.dock(DockSide.Right).isEmpty).toBe(true);

    arrangement = arrangement.dockOnSide(PanelId.Explorer, DockSide.Right);
    expect(arrangement.dock(DockSide.Right).root).toBeInstanceOf(TabGroup);
    expect(tabs(arrangement, DockSide.Right)).toEqual([PanelId.Explorer]);
    expect(arrangement.dock(DockSide.Left).root).toBeInstanceOf(TabGroup);

    arrangement = arrangement.dockOnSide(PanelId.Changes, DockSide.Bottom);
    const bottom = arrangement.dock(DockSide.Bottom).root as SplitNode;
    expect([bottom.axis, bottom.groups.map(t => t.panels)]).toEqual([SplitAxis.Vertical, [[PanelId.Activity], [PanelId.Changes]]]);
    expect(arrangement.dock(DockSide.Bottom).collapsed).toBe(false);
    expect(arrangement.dock(DockSide.Left).isEmpty).toBe(true);

    arrangement = arrangement.toggleDock(DockSide.Right);
    const same = arrangement.dockOnSide(PanelId.Explorer, DockSide.Right);
    expect(same.dock(DockSide.Right).root).toBe(arrangement.dock(DockSide.Right).root);
    expect(same.dock(DockSide.Right).collapsed).toBe(false);
    const initial = PanelArrangement.createDefault();
    expect(initial.dockOnSide(PanelId.Explorer, DockSide.Left)).toBe(initial);
  });

  it("resizes docks and splits and keeps unchanged arrangements", () => {
    let arrangement = PanelArrangement.createDefault();

    arrangement = arrangement.resizeDock(DockSide.Left, 5000.4);
    expect(arrangement.dock(DockSide.Left).size).toBe(Resources.dockMaximumSize);
    expect(arrangement.resizeDock(DockSide.Left, 9000)).toBe(arrangement);
    arrangement = arrangement.resizeDock(DockSide.Left, 1);
    expect(arrangement.dock(DockSide.Left).size).toBe(Resources.dockMinimumSize);
    arrangement = arrangement.resizeDock(DockSide.Left, null);
    expect(arrangement.dock(DockSide.Left).size).toBeNull();

    arrangement = arrangement.splitGroup(PanelId.Activity, groupOf(arrangement, PanelId.Explorer).id, PanelEdge.Bottom);
    const split = arrangement.dock(DockSide.Left).root as SplitNode;
    arrangement = arrangement.resizeSplit(split.id, [3, 1]);
    expect((arrangement.dock(DockSide.Left).root as SplitNode).weights).toEqual([0.75, 0.25]);
    expect(arrangement.resizeSplit(99, [1, 1])).toBe(arrangement);
    expect(arrangement.toggleDock(DockSide.Left).toggleDock(DockSide.Left).dock(DockSide.Left).collapsed).toBe(false);
  });
});
