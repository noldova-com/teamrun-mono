/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { PanelId } from "../../../src/app/enums/panel-id";
import { SplitAxis } from "../../../src/app/enums/split-axis";
import type { GroupFrame } from "../../../src/app/models/group-frame";
import { SplitNode } from "../../../src/app/models/split.node";
import { TabGroup } from "../../../src/app/models/tab-group";
import { Resources } from "../../../src/app/resources";

describe("TabGroup", () => {
  it("keeps its tabs unique with a valid active tab, and only the documents group may show none", () => {
    const group = new TabGroup(3, [PanelId.Changes, PanelId.Changes, PanelId.Activity], PanelId.Explorer);
    expect(group.panels).toEqual([PanelId.Changes, PanelId.Activity]);
    expect(group.activePanel).toBe(PanelId.Changes);
    expect(group.isDocuments).toBe(false);
    expect(new TabGroup(3, [], null).activePanel).toBeNull();

    const documents = new TabGroup(TabGroup.documentsId, [PanelId.Activity], null);
    expect(documents.isDocuments).toBe(true);
    expect(documents.activePanel).toBeNull();
    expect(new TabGroup(TabGroup.documentsId, [PanelId.Activity], PanelId.Explorer).activePanel).toBeNull();
    expect(new TabGroup(TabGroup.documentsId, [PanelId.Activity], PanelId.Activity).activePanel).toBe(PanelId.Activity);
  });

  it("inserts, reorders, removes and activates tabs", () => {
    const group = new TabGroup(1, [PanelId.Explorer, PanelId.Changes, PanelId.Activity], PanelId.Changes);

    expect(group.insert(PanelId.Explorer, 2).panels).toEqual([PanelId.Changes, PanelId.Explorer, PanelId.Activity]);
    expect(group.insert(PanelId.Explorer, 3).panels).toEqual([PanelId.Changes, PanelId.Activity, PanelId.Explorer]);
    expect(group.insert(PanelId.Activity, 0).panels).toEqual([PanelId.Activity, PanelId.Explorer, PanelId.Changes]);
    expect(group.insert(PanelId.Activity, 0).activePanel).toBe(PanelId.Activity);
    expect(group.insert(PanelId.Changes, 1)).toBe(group);
    expect(group.insert(PanelId.Changes, 2)).toBe(group);
    expect(group.insert(PanelId.Explorer, 1).activePanel).toBe(PanelId.Explorer);
    expect(new TabGroup(1, [PanelId.Changes], null).insert(PanelId.Activity, 99).panels).toEqual([PanelId.Changes, PanelId.Activity]);
    expect(new TabGroup(1, [PanelId.Changes], null).insert(PanelId.Activity, -4).panels).toEqual([PanelId.Activity, PanelId.Changes]);

    expect(group.remove(PanelId.Changes).activePanel).toBe(PanelId.Activity);
    expect(group.remove(PanelId.Activity).activePanel).toBe(PanelId.Changes);
    expect(group.remove(PanelId.Changes).remove(PanelId.Activity).activePanel).toBe(PanelId.Explorer);
    expect(new TabGroup(1, [PanelId.Changes, PanelId.Activity], PanelId.Activity).remove(PanelId.Activity).activePanel).toBe(PanelId.Changes);
    expect(group.remove(PanelId.Changes).remove(PanelId.Activity).remove(PanelId.Explorer).activePanel).toBeNull();
    expect(new TabGroup(1, [PanelId.Changes], null).remove(PanelId.Activity).panels).toEqual([PanelId.Changes]);

    expect(group.activate(PanelId.Activity).activePanel).toBe(PanelId.Activity);
    expect(group.activate(PanelId.Changes)).toBe(group);
    expect(new TabGroup(1, [PanelId.Changes], null).activate(PanelId.Activity).activePanel).toBe(PanelId.Changes);

    const documents = new TabGroup(TabGroup.documentsId, [PanelId.Changes, PanelId.Activity], PanelId.Changes);
    expect(documents.remove(PanelId.Changes).activePanel).toBe(PanelId.Activity);
    expect(documents.remove(PanelId.Changes).remove(PanelId.Activity).activePanel).toBeNull();
    expect(new TabGroup(TabGroup.documentsId, [PanelId.Changes], null).remove(PanelId.Changes).activePanel).toBeNull();
  });

  it("acts as a single node of an arrangement", () => {
    const group = new TabGroup(4, [PanelId.Changes], null);
    const added = new TabGroup(5, [PanelId.Activity], null);
    expect(group.groups).toEqual([group]);
    expect(group.cornerGroup).toBe(group);
    expect(group.maximumId).toBe(4);
    expect(group.minimumLength(SplitAxis.Horizontal)).toBe(Resources.groupMinimumLengths[SplitAxis.Horizontal]);
    expect(group.minimumLength(SplitAxis.Vertical)).toBe(Resources.groupMinimumLengths[SplitAxis.Vertical]);
    const replacement = new TabGroup(4, [PanelId.Explorer], null);
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
