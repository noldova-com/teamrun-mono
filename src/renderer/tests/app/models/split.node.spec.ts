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
import type { GroupFrame } from "../../../src/app/models/group-frame";
import type { SplitHandle } from "../../../src/app/models/split-handle";
import { SplitNode } from "../../../src/app/models/split.node";
import { TabGroup } from "../../../src/app/models/tab-group";
import { Resources } from "../../../src/app/resources";

describe("SplitNode", () => {
  const explorer = new TabGroup(1, [PanelId.Explorer], null);
  const changes = new TabGroup(2, [PanelId.Changes], null);
  const activity = new TabGroup(3, [PanelId.Activity], null);
  const width = Resources.groupMinimumLengths[SplitAxis.Horizontal];
  const height = Resources.groupMinimumLengths[SplitAxis.Vertical];
  const gap = Resources.shellGap;

  const arrange = (node: SplitNode, bounds: DOMRectReadOnly): { frames: GroupFrame[]; handles: SplitHandle[] } => {
    const frames: GroupFrame[] = [];
    const handles: SplitHandle[] = [];
    node.arrange(bounds, DockSide.Left, frames, handles);
    return { frames, handles };
  };

  it("needs two or more parts with a weight each and shares by normalized weights", () => {
    expect(() => new SplitNode(9, SplitAxis.Horizontal, [explorer], [1])).toThrow(RangeError);
    expect(() => new SplitNode(9, SplitAxis.Horizontal, [explorer, changes], [1])).toThrow(Resources.invalidSplitMessage);
    expect(new SplitNode(9, SplitAxis.Horizontal, [explorer, changes], [1, 3]).weights).toEqual([0.25, 0.75]);
    expect(new SplitNode(9, SplitAxis.Horizontal, [explorer, changes], [-1, Number.NaN]).weights).toEqual([0.5, 0.5]);
    expect(new SplitNode(9, SplitAxis.Horizontal, [explorer, changes], [0, 2]).weights).toEqual([0, 1]);

    expect(SplitNode.join(9, SplitAxis.Vertical, [], [])).toBeNull();
    expect(SplitNode.join(9, SplitAxis.Vertical, [explorer], [1])).toBe(explorer);
    expect(SplitNode.join(9, SplitAxis.Vertical, [explorer, changes], [1, 1])).toBeInstanceOf(SplitNode);

    const right = SplitNode.beside(explorer, changes, PanelEdge.Right, 9);
    expect([right.axis, right.children]).toEqual([SplitAxis.Horizontal, [explorer, changes]]);
    const top = SplitNode.beside(explorer, changes, PanelEdge.Top, 9);
    expect([top.axis, top.children]).toEqual([SplitAxis.Vertical, [changes, explorer]]);
    expect(SplitNode.beside(explorer, changes, PanelEdge.Bottom, 9).children).toEqual([explorer, changes]);
  });

  it("finds, replaces, removes and splits groups, closing splits left with one part", () => {
    const stack = new SplitNode(5, SplitAxis.Vertical, [changes, activity], [0.3, 0.7]);
    const node = new SplitNode(4, SplitAxis.Horizontal, [explorer, stack], [0.4, 0.6]);

    expect(node.groups).toEqual([explorer, changes, activity]);
    expect(node.cornerGroup).toBe(changes);
    expect(stack.cornerGroup).toBe(changes);
    expect(new SplitNode(6, SplitAxis.Vertical, [stack, explorer], [1, 1]).cornerGroup).toBe(changes);
    expect(node.maximumId).toBe(5);
    expect(node.minimumLength(SplitAxis.Horizontal)).toBe(width * 2 + gap);
    expect(node.minimumLength(SplitAxis.Vertical)).toBe(height * 2 + gap);

    const renamed = new TabGroup(3, [PanelId.Activity, PanelId.Explorer], null);
    expect(node.withGroup(new TabGroup(8, [], null))).toBe(node);
    expect(node.withGroup(renamed).groups).toEqual([explorer, changes, renamed]);

    expect(node.withoutGroup(8)).toBe(node);
    const closed = node.withoutGroup(2);
    expect(closed).toBeInstanceOf(SplitNode);
    expect(closed?.groups).toEqual([explorer, activity]);
    expect((closed as SplitNode).weights).toEqual([0.4, 0.6]);
    expect(stack.withoutGroup(2)).toBe(activity);
    expect(new SplitNode(6, SplitAxis.Vertical, [explorer, changes, activity], [0.2, 0.3, 0.5]).withoutGroup(2)?.toJson())
      .toEqual({ axis: "Vertical", children: [explorer.toJson(), activity.toJson()], weights: [0.2 / 0.7, 0.5 / 0.7] });

    const added = new TabGroup(7, [PanelId.Activity], null);
    expect(node.splitGroup(9, added, PanelEdge.Top, 8)).toBe(node);
    const split = node.splitGroup(1, added, PanelEdge.Top, 8);
    expect(split.groups).toEqual([added, explorer, changes, activity]);
    expect(split.maximumId).toBe(8);

    expect(node.withWeights(9, [1, 1])).toBe(node);
    expect((node.withWeights(4, [1, 3]) as SplitNode).weights).toEqual([0.25, 0.75]);
    expect(((node.withWeights(5, [1, 1]) as SplitNode).children[1] as SplitNode).weights).toEqual([0.5, 0.5]);
    expect(node.toJson()).toEqual({ axis: "Horizontal", children: [explorer.toJson(), stack.toJson()], weights: [0.4, 0.6] });
  });

  it("gives each part its minimum and shares the rest by weight, with a handle in each gap", () => {
    const node = new SplitNode(4, SplitAxis.Horizontal, [explorer, changes], [0.25, 0.75]);
    const total = width * 2 + gap + 400;
    const { frames, handles } = arrange(node, new DOMRectReadOnly(10, 20, total, 300));

    expect(frames.map(t => [t.group.id, t.bounds.x, t.bounds.y, t.bounds.width, t.bounds.height, t.side]))
      .toEqual([[1, 10, 20, width + 100, 300, DockSide.Left], [2, 10 + width + 100 + gap, 20, width + 300, 300, DockSide.Left]]);
    expect(handles).toHaveLength(1);
    const handle = handles[0]!;
    expect([handle.split, handle.index, handle.leadingId, handle.leadingLength, handle.edge]).toEqual([node, 0, 1, width + 100, PanelEdge.Right]);
    expect([handle.bounds.x, handle.bounds.y, handle.bounds.width, handle.bounds.height]).toEqual([10 + width + 100, 20, gap, 300]);

    expect(handle.weightsFor(width + 200)).toEqual([0.5, 0.5]);
    expect(handle.weightsFor(0)).toEqual([0, 1]);
    expect(handle.weightsFor(10_000)).toEqual([1, 0]);
    expect(handle.balancedWeights).toEqual([0.5, 0.5]);
  });

  it("shrinks parts in proportion to their minimums when the minimums do not fit", () => {
    const node = new SplitNode(4, SplitAxis.Vertical, [explorer, changes, activity], [0.1, 0.1, 0.8]);
    const total = height + 2 * gap + 50;
    const { frames, handles } = arrange(node, new DOMRectReadOnly(0, 0, 200, total));

    expect(frames.map(t => t.bounds.height)).toEqual([Math.round((height + 50) / 3), Math.round((height + 50) / 3), total - 2 * gap - 2 * Math.round((height + 50) / 3)]);
    expect(frames.map(t => t.bounds.width)).toEqual([200, 200, 200]);
    expect(handles.map(t => [t.edge, t.bounds.height, t.leadingId])).toEqual([[PanelEdge.Bottom, gap, 1], [PanelEdge.Bottom, gap, 2]]);
    expect(handles[0]!.weightsFor(500)).toBe(node.weights);

    const squeezed = arrange(new SplitNode(4, SplitAxis.Horizontal, [explorer, changes], [1, 1]), new DOMRectReadOnly(0, 0, 2, 10));
    expect(squeezed.frames.map(t => t.bounds.width)).toEqual([0, 0]);
  });

  it("arranges nested splits within their share", () => {
    const stack = new SplitNode(5, SplitAxis.Vertical, [changes, activity], [0.5, 0.5]);
    const node = new SplitNode(4, SplitAxis.Horizontal, [explorer, stack], [0.5, 0.5]);
    const { frames, handles } = arrange(node, new DOMRectReadOnly(0, 0, width * 2 + gap + 100, height * 2 + gap + 100));

    expect(frames.map(t => [t.group.id, t.bounds.x, t.bounds.y, t.bounds.width, t.bounds.height])).toEqual([
      [1, 0, 0, width + 50, height * 2 + gap + 100],
      [2, width + 50 + gap, 0, width + 50, height + 50],
      [3, width + 50 + gap, height + 50 + gap, width + 50, height + 50]
    ]);
    expect(handles.map(t => [t.split.id, t.leadingId, t.edge])).toEqual([[4, 1, PanelEdge.Right], [5, 2, PanelEdge.Bottom]]);
  });
});
