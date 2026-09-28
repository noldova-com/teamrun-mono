/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { PanelKind } from "../../../src/app/enums/panel-kind";
import { SplitAxis } from "../../../src/app/enums/split-axis";
import type { GroupFrame } from "../../../src/app/models/group-frame";
import { Panel } from "../../../src/app/models/panel";
import { SplitNode } from "../../../src/app/models/split.node";
import { TabGroup } from "../../../src/app/models/tab-group";
import { Resources } from "../../../src/app/resources";

describe("TabGroup", () => {
  const explorer = new Panel(PanelKind.Explorer);
  const changes = new Panel(PanelKind.Changes);
  const activity = new Panel(PanelKind.Activity);

  it("keeps its tabs unique with a valid active tab, and only the documents group may show none", () => {
    const group = new TabGroup(3, [changes, changes, activity], explorer);
    expect(group.panels).toEqual([changes, activity]);
    expect(group.activePanel).toEqual(changes);
    expect(group.isDocuments).toBe(false);
    expect(new TabGroup(3, [], null).activePanel).toBeNull();

    const documents = new TabGroup(TabGroup.documentsId, [activity], null);
    expect(documents.isDocuments).toBe(true);
    expect(documents.activePanel).toBeNull();
    expect(new TabGroup(TabGroup.documentsId, [activity], explorer).activePanel).toBeNull();
    expect(new TabGroup(TabGroup.documentsId, [activity], activity).activePanel).toEqual(activity);
  });

  it("inserts, reorders, removes and activates tabs", () => {
    const group = new TabGroup(1, [explorer, changes, activity], changes);

    expect(group.insert(explorer, 2).panels).toEqual([changes, explorer, activity]);
    expect(group.insert(explorer, 3).panels).toEqual([changes, activity, explorer]);
    expect(group.insert(activity, 0).panels).toEqual([activity, explorer, changes]);
    expect(group.insert(activity, 0).activePanel).toEqual(activity);
    expect(group.insert(changes, 1)).toBe(group);
    expect(group.insert(changes, 2)).toBe(group);
    expect(group.insert(explorer, 1).activePanel).toEqual(explorer);
    expect(new TabGroup(1, [changes], null).insert(activity, 99).panels).toEqual([changes, activity]);
    expect(new TabGroup(1, [changes], null).insert(activity, -4).panels).toEqual([activity, changes]);

    expect(group.remove(changes).activePanel).toEqual(activity);
    expect(group.remove(activity).activePanel).toEqual(changes);
    expect(group.remove(changes).remove(activity).activePanel).toEqual(explorer);
    expect(new TabGroup(1, [changes, activity], activity).remove(activity).activePanel).toEqual(changes);
    expect(group.remove(changes).remove(activity).remove(explorer).activePanel).toBeNull();
    expect(new TabGroup(1, [changes], null).remove(activity).panels).toEqual([changes]);

    expect(group.activate(activity).activePanel).toEqual(activity);
    expect(group.activate(changes)).toBe(group);
    expect(new TabGroup(1, [changes], null).activate(activity).activePanel).toEqual(changes);

    const documents = new TabGroup(TabGroup.documentsId, [changes, activity], changes);
    expect(documents.remove(changes).activePanel).toEqual(activity);
    expect(documents.remove(changes).remove(activity).activePanel).toBeNull();
    expect(new TabGroup(TabGroup.documentsId, [changes], null).remove(changes).activePanel).toBeNull();
  });

  it("tells panels of one kind apart by their instances", () => {
    const terminal = (instance: string): Panel => new Panel(PanelKind.Terminal, instance);
    const group = new TabGroup(1, [terminal("terminal-1"), terminal("terminal-2"), terminal("terminal-1")], terminal("terminal-2"));

    expect(group.panels).toEqual([terminal("terminal-1"), terminal("terminal-2")]);
    expect(group.activePanel).toEqual(terminal("terminal-2"));
    expect(group.has(terminal("terminal-1"))).toBe(true);
    expect(group.has(terminal("terminal-3"))).toBe(false);
    expect(group.insert(terminal("terminal-3"), 1).panels.map(t => t.instance)).toEqual(["terminal-1", "terminal-3", "terminal-2"]);
    expect(group.insert(terminal("terminal-1"), 2).panels.map(t => t.instance)).toEqual(["terminal-2", "terminal-1"]);
    expect(group.insert(terminal("terminal-2"), 1)).toBe(group);
    expect(group.remove(terminal("terminal-2")).activePanel).toEqual(terminal("terminal-1"));
    expect(group.remove(terminal("terminal-3"))).toBe(group);
    expect(group.activate(terminal("terminal-1")).activePanel).toEqual(terminal("terminal-1"));
    expect(group.activate(terminal("terminal-2"))).toBe(group);
    expect(group.toJson()).toEqual({ documentsGroup: false, panels: ["Terminal:terminal-1", "Terminal:terminal-2"], activePanel: "Terminal:terminal-2" });
  });

  it("acts as a single node of an arrangement", () => {
    const group = new TabGroup(4, [changes], null);
    const added = new TabGroup(5, [activity], null);
    expect(group.groups).toEqual([group]);
    expect(group.cornerGroup).toBe(group);
    expect(group.maximumId).toBe(4);
    expect(group.minimumLength(SplitAxis.Horizontal)).toBe(Resources.groupMinimumLengths[SplitAxis.Horizontal]);
    expect(group.minimumLength(SplitAxis.Vertical)).toBe(Resources.groupMinimumLengths[SplitAxis.Vertical]);
    const replacement = new TabGroup(4, [explorer], null);
    expect(group.withGroup(replacement)).toBe(replacement);
    expect(group.withGroup(added)).toBe(group);
    expect(group.withoutGroup(4)).toBeNull();
    expect(group.withoutGroup(5)).toBe(group);
    expect(group.withWeights()).toBe(group);
    expect(group.splitGroup(9, added, PanelEdge.Left, 6)).toBe(group);

    const split = group.splitGroup(4, added, PanelEdge.Left, 6);
    expect(split).toBeInstanceOf(SplitNode);
    expect(split.id).toBe(6);
    expect(split.groups).toEqual([added, group]);

    const frames: GroupFrame[] = [];
    group.arrange(new DOMRectReadOnly(1, 2, 3, 4), null, frames);
    expect(frames.map(t => [t.group, t.bounds.x, t.bounds.height, t.side])).toEqual([[group, 1, 4, null]]);
    expect(group.toJson()).toEqual({ documentsGroup: false, panels: ["Changes"], activePanel: "Changes" });
    expect(new TabGroup(TabGroup.documentsId, [], null).toJson()).toEqual({ documentsGroup: true, panels: [], activePanel: null });
  });
});
