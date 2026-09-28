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
import { SplitAxis } from "../../../src/app/enums/split-axis";
import { Dock } from "../../../src/app/models/dock";
import { Panel } from "../../../src/app/models/panel";
import { PanelArrangement } from "../../../src/app/models/panel-arrangement";
import { SplitNode } from "../../../src/app/models/split.node";
import { TabGroup } from "../../../src/app/models/tab-group";
import { Resources } from "../../../src/app/resources";

describe("PanelArrangement", () => {
  const explorer = new Panel(PanelKind.Explorer);
  const changes = new Panel(PanelKind.Changes);
  const activity = new Panel(PanelKind.Activity);
  const terminal = (instance: string): Panel => new Panel(PanelKind.Terminal, instance);
  const tabs = (arrangement: PanelArrangement, side: DockSide): readonly Panel[] => arrangement.dock(side).panels;
  const groupOf = (arrangement: PanelArrangement, panel: Panel): TabGroup => {
    const group = arrangement.groupOf(panel);
    if (group === null)
      throw new Error(`${panel.key} is not open.`);
    return group;
  };

  it("starts with each panel in its default dock, the bottom dock collapsed and an empty documents group", () => {
    const arrangement = PanelArrangement.createDefault();

    expect(tabs(arrangement, DockSide.Left)).toEqual([explorer]);
    expect(tabs(arrangement, DockSide.Right)).toEqual([changes]);
    expect(tabs(arrangement, DockSide.Bottom)).toEqual([activity]);
    expect(arrangement.dock(DockSide.Bottom).collapsed).toBe(true);
    expect(arrangement.dock(DockSide.Left).size).toBeNull();
    expect(arrangement.middle).toBe(arrangement.documents);
    expect(arrangement.documents.panels).toEqual([]);
    expect(arrangement.groups.map(t => t.id)).toEqual([1, 2, 3, TabGroup.documentsId]);
    expect(arrangement.sideOf(groupOf(arrangement, changes).id)).toBe(DockSide.Right);
    expect(arrangement.sideOf(TabGroup.documentsId)).toBeNull();
    expect(arrangement.group(99)).toBeNull();
    expect(arrangement.isOpen(activity)).toBe(true);
    expect(arrangement.isShown(activity)).toBe(false);
    expect(arrangement.isShown(explorer)).toBe(true);
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
    expect(() => new PanelArrangement([], new TabGroup(1, [explorer], null))).toThrow(Resources.missingDocumentsGroupMessage);
    expect(() => new PanelArrangement([new Dock(DockSide.Left, new TabGroup(1, [explorer], null), null, false)],
      new SplitNode(2, SplitAxis.Horizontal, [documents, new TabGroup(3, [explorer], null)], [1, 1]))).toThrow(Resources.repeatedPanelMessage);
    const bare = new PanelArrangement([], documents);
    expect([...bare.docks.keys()]).toEqual([DockSide.Left, DockSide.Right, DockSide.Bottom]);
    expect(bare.dock(DockSide.Right).isEmpty).toBe(true);
  });

  it("opens, shows, closes and toggles panels", () => {
    let arrangement = PanelArrangement.createDefault();

    arrangement = arrangement.openPanel(activity);
    expect(arrangement.dock(DockSide.Bottom).collapsed).toBe(false);
    expect(arrangement.isShown(activity)).toBe(true);
    expect(arrangement.openPanel(activity)).toBe(arrangement);

    arrangement = arrangement.closePanel(changes);
    expect(arrangement.isOpen(changes)).toBe(false);
    expect(arrangement.dock(DockSide.Right).isEmpty).toBe(true);
    expect(arrangement.closePanel(changes)).toBe(arrangement);
    arrangement = arrangement.openPanel(changes);
    expect(tabs(arrangement, DockSide.Right)).toEqual([changes]);

    arrangement = arrangement.insertTab(changes, groupOf(arrangement, explorer).id, 1).closePanel(changes).openPanel(changes);
    expect(tabs(arrangement, DockSide.Right)).toEqual([changes]);
    arrangement = arrangement.closePanel(explorer).insertTab(activity, groupOf(arrangement, changes).id, 0);
    arrangement = arrangement.openPanel(explorer);
    expect(tabs(arrangement, DockSide.Left)).toEqual([explorer]);
    arrangement = arrangement.closePanel(changes).openPanel(changes);
    expect(tabs(arrangement, DockSide.Right)).toEqual([activity, changes]);

    arrangement = arrangement.togglePanel(changes);
    expect(arrangement.isOpen(changes)).toBe(false);
    arrangement = arrangement.togglePanel(changes).activatePanel(activity);
    expect(arrangement.isShown(changes)).toBe(false);
    arrangement = arrangement.togglePanel(changes);
    expect(arrangement.isShown(changes)).toBe(true);
    arrangement = arrangement.toggleDock(DockSide.Right);
    expect(arrangement.isShown(changes)).toBe(false);
    arrangement = arrangement.togglePanel(changes);
    expect(arrangement.dock(DockSide.Right).collapsed).toBe(false);
    expect(arrangement.activatePanel(changes)).toBe(arrangement);
    arrangement = arrangement.toggleDock(DockSide.Right).activatePanel(changes);
    expect(arrangement.dock(DockSide.Right).collapsed).toBe(false);
    expect(arrangement.closePanel(explorer).activatePanel(explorer).isOpen(explorer)).toBe(false);
  });

  it("moves panels into groups, reordering within a group and closing a group its last tab leaves", () => {
    let arrangement = PanelArrangement.createDefault();
    const left = groupOf(arrangement, explorer).id;

    arrangement = arrangement.insertTab(changes, left, 0);
    expect(tabs(arrangement, DockSide.Left)).toEqual([changes, explorer]);
    expect(groupOf(arrangement, changes).activePanel).toEqual(changes);
    expect(arrangement.dock(DockSide.Right).isEmpty).toBe(true);
    arrangement = arrangement.insertTab(changes, left, 2);
    expect(tabs(arrangement, DockSide.Left)).toEqual([explorer, changes]);
    expect(arrangement.insertTab(changes, left, 2)).toBe(arrangement);
    expect(arrangement.insertTab(activity, 99, 0)).toBe(arrangement);

    arrangement = arrangement.insertTab(activity, left, 1);
    expect(arrangement.dock(DockSide.Bottom).isEmpty).toBe(true);
    arrangement = arrangement.toggleDock(DockSide.Left).insertTab(activity, left, 3);
    expect(arrangement.dock(DockSide.Left).collapsed).toBe(false);
    expect(tabs(arrangement, DockSide.Left)).toEqual([explorer, changes, activity]);

    arrangement = arrangement.insertTab(activity, TabGroup.documentsId, 0);
    expect(arrangement.documents.panels).toEqual([activity]);
    expect(arrangement.documents.activePanel).toEqual(activity);
    expect(arrangement.isShown(activity)).toBe(true);
    arrangement = arrangement.showDocuments();
    expect(arrangement.documents.activePanel).toBeNull();
    expect(arrangement.isShown(activity)).toBe(false);
    expect(arrangement.showDocuments()).toBe(arrangement);
    arrangement = arrangement.activatePanel(activity).closePanel(activity);
    expect(arrangement.documents.panels).toEqual([]);
    expect(arrangement.documents.activePanel).toBeNull();
    expect(arrangement.middle).toBe(arrangement.documents);
  });

  it("splits a group, giving the new group half of its space", () => {
    let arrangement = PanelArrangement.createDefault();
    const right = groupOf(arrangement, changes).id;

    expect(arrangement.splitGroup(changes, right, PanelEdge.Left)).toBe(arrangement);
    expect(arrangement.splitGroup(changes, 99, PanelEdge.Left)).toBe(arrangement);

    arrangement = arrangement.splitGroup(activity, right, PanelEdge.Bottom);
    const root = arrangement.dock(DockSide.Right).root as SplitNode;
    expect(root).toBeInstanceOf(SplitNode);
    expect([root.axis, root.weights, root.groups.map(t => t.panels)]).toEqual([SplitAxis.Vertical, [0.5, 0.5], [[changes], [activity]]]);
    expect(arrangement.dock(DockSide.Bottom).isEmpty).toBe(true);
    expect(arrangement.sideOf(groupOf(arrangement, activity).id)).toBe(DockSide.Right);

    arrangement = arrangement.insertTab(explorer, right, 0).splitGroup(changes, right, PanelEdge.Left);
    expect(arrangement.dock(DockSide.Left).isEmpty).toBe(true);
    expect(arrangement.dock(DockSide.Right).root?.groups.map(t => t.panels)).toEqual([[changes], [explorer], [activity]]);
    expect(new Set(arrangement.groups.map(t => t.id)).size).toBe(arrangement.groups.length);

    arrangement = arrangement.splitGroup(explorer, TabGroup.documentsId, PanelEdge.Right);
    expect(arrangement.middle.groups.map(t => t.panels)).toEqual([[], [explorer]]);
    expect(arrangement.sideOf(groupOf(arrangement, explorer).id)).toBeNull();
    arrangement = arrangement.insertTab(activity, TabGroup.documentsId, 0);
    const beside = arrangement.splitGroup(activity, TabGroup.documentsId, PanelEdge.Top);
    expect(beside.middle.groups.map(t => t.panels)).toEqual([[activity], [], [explorer]]);
    expect(beside.documents.activePanel).toBeNull();

    const collapsed = PanelArrangement.createDefault().splitGroup(changes, 3, PanelEdge.Right);
    expect(collapsed.dock(DockSide.Bottom).collapsed).toBe(false);
    expect(collapsed.dock(DockSide.Bottom).panels).toEqual([activity, changes]);
  });

  it("docks a panel along the whole outer edge of a dock", () => {
    let arrangement = PanelArrangement.createDefault();

    arrangement = arrangement.dockOnSide(changes, DockSide.Left);
    const left = arrangement.dock(DockSide.Left).root as SplitNode;
    expect([left.axis, left.groups.map(t => t.panels)]).toEqual([SplitAxis.Horizontal, [[changes], [explorer]]]);
    expect(arrangement.dock(DockSide.Right).isEmpty).toBe(true);

    arrangement = arrangement.dockOnSide(explorer, DockSide.Right);
    expect(arrangement.dock(DockSide.Right).root).toBeInstanceOf(TabGroup);
    expect(tabs(arrangement, DockSide.Right)).toEqual([explorer]);
    expect(arrangement.dock(DockSide.Left).root).toBeInstanceOf(TabGroup);

    arrangement = arrangement.dockOnSide(changes, DockSide.Bottom);
    const bottom = arrangement.dock(DockSide.Bottom).root as SplitNode;
    expect([bottom.axis, bottom.groups.map(t => t.panels)]).toEqual([SplitAxis.Vertical, [[activity], [changes]]]);
    expect(arrangement.dock(DockSide.Bottom).collapsed).toBe(false);
    expect(arrangement.dock(DockSide.Left).isEmpty).toBe(true);

    arrangement = arrangement.toggleDock(DockSide.Right);
    const same = arrangement.dockOnSide(explorer, DockSide.Right);
    expect(same.dock(DockSide.Right).root).toBe(arrangement.dock(DockSide.Right).root);
    expect(same.dock(DockSide.Right).collapsed).toBe(false);
    const initial = PanelArrangement.createDefault();
    expect(initial.dockOnSide(explorer, DockSide.Left)).toBe(initial);
  });

  it("holds several panels of one kind in every region and places, shows and closes each one alone", () => {
    let arrangement = PanelArrangement.createDefault().openPanel(terminal("terminal-1")).openPanel(terminal("terminal-2"));

    expect(tabs(arrangement, DockSide.Bottom)).toEqual([activity, terminal("terminal-1"), terminal("terminal-2")]);
    expect(arrangement.dock(DockSide.Bottom).collapsed).toBe(false);
    expect(arrangement.isShown(terminal("terminal-2"))).toBe(true);
    expect(arrangement.isShown(terminal("terminal-1"))).toBe(false);
    expect(arrangement.openPanel(terminal("terminal-1")).isShown(terminal("terminal-1"))).toBe(true);
    expect(tabs(arrangement.openPanel(terminal("terminal-1")), DockSide.Bottom)).toHaveLength(3);

    arrangement = arrangement.insertTab(terminal("terminal-2"), groupOf(arrangement, explorer).id, 1);
    expect(tabs(arrangement, DockSide.Left)).toEqual([explorer, terminal("terminal-2")]);
    expect(tabs(arrangement, DockSide.Bottom)).toEqual([activity, terminal("terminal-1")]);

    arrangement = arrangement.openPanel(terminal("terminal-3")).splitGroup(terminal("terminal-3"), groupOf(arrangement, changes).id, PanelEdge.Bottom);
    expect(arrangement.dock(DockSide.Right).root?.groups.map(t => t.panels)).toEqual([[changes], [terminal("terminal-3")]]);

    arrangement = arrangement.insertTab(terminal("terminal-1"), TabGroup.documentsId, 0).openPanel(terminal("terminal-4"))
      .splitGroup(terminal("terminal-4"), TabGroup.documentsId, PanelEdge.Right);
    expect(arrangement.middle.groups.map(t => t.panels)).toEqual([[terminal("terminal-1")], [terminal("terminal-4")]]);
    expect(arrangement.documents.activePanel).toEqual(terminal("terminal-1"));

    arrangement = arrangement.dockOnSide(terminal("terminal-2"), DockSide.Bottom);
    expect(arrangement.dock(DockSide.Bottom).root?.groups.map(t => t.panels)).toEqual([[activity], [terminal("terminal-2")]]);
    expect(tabs(arrangement, DockSide.Left)).toEqual([explorer]);

    arrangement = arrangement.closePanel(terminal("terminal-3"));
    expect(arrangement.isOpen(terminal("terminal-3"))).toBe(false);
    expect(tabs(arrangement, DockSide.Right)).toEqual([changes]);
    expect(["terminal-1", "terminal-2", "terminal-4"].map(t => arrangement.isOpen(terminal(t)))).toEqual([true, true, true]);

    const documents = new TabGroup(TabGroup.documentsId, [], null);
    const left = new Dock(DockSide.Left, new TabGroup(1, [terminal("terminal-1")], null), null, false);
    expect(() => new PanelArrangement([left], new SplitNode(2, SplitAxis.Horizontal, [documents, new TabGroup(3, [terminal("terminal-1")], null)], [1, 1])))
      .toThrow(Resources.repeatedPanelMessage);
    expect(new PanelArrangement([left], new SplitNode(2, SplitAxis.Horizontal, [documents, new TabGroup(3, [terminal("terminal-2")], null)], [1, 1])).groups)
      .toHaveLength(3);
  });

  it("drops the panels of a kind whose instances no longer exist and keeps every other panel", () => {
    const arrangement = PanelArrangement.createDefault()
      .openPanel(terminal("terminal-1"))
      .openPanel(terminal("terminal-2"))
      .dockOnSide(terminal("terminal-2"), DockSide.Right)
      .openPanel(terminal("terminal-3"))
      .insertTab(terminal("terminal-3"), TabGroup.documentsId, 0);

    const kept = arrangement.keepInstances(PanelKind.Terminal, ["terminal-1", "terminal-9"]);

    expect(kept.groups.flatMap(t => t.panels)).toEqual([explorer, changes, activity, terminal("terminal-1")]);
    expect(kept.dock(DockSide.Right).root).toBeInstanceOf(TabGroup);
    expect(kept.documents.panels).toEqual([]);
    expect(kept.documents.activePanel).toBeNull();
    expect(kept.keepInstances(PanelKind.Terminal, ["terminal-1"])).toBe(kept);
    expect(arrangement.keepInstances(PanelKind.Terminal, []).groups.flatMap(t => t.panels)).toEqual([explorer, changes, activity]);
    const initial = PanelArrangement.createDefault();
    expect(initial.keepInstances(PanelKind.Terminal, [])).toBe(initial);
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

    arrangement = arrangement.splitGroup(activity, groupOf(arrangement, explorer).id, PanelEdge.Bottom);
    const split = arrangement.dock(DockSide.Left).root as SplitNode;
    arrangement = arrangement.resizeSplit(split.id, [3, 1]);
    expect((arrangement.dock(DockSide.Left).root as SplitNode).weights).toEqual([0.75, 0.25]);
    expect(arrangement.resizeSplit(99, [1, 1])).toBe(arrangement);
    expect(arrangement.toggleDock(DockSide.Left).toggleDock(DockSide.Left).dock(DockSide.Left).collapsed).toBe(false);
  });
});
