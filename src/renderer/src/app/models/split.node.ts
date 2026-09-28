/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { DockSide } from "../enums/dock-side";
import type { PanelEdge } from "../enums/panel-edge";
import { SplitAxis } from "../enums/split-axis";
import { Resources } from "../resources";
import type { GroupFrame } from "./group-frame";
import { LayoutNode } from "./layout.node";
import { SplitHandle } from "./split-handle";
import type { TabGroup } from "./tab-group";

export class SplitNode extends LayoutNode {
  private readonly first: LayoutNode;
  private readonly last: LayoutNode;

  public readonly axis: SplitAxis;
  public readonly children: readonly LayoutNode[];
  public readonly weights: readonly number[];

  public constructor(id: number, axis: SplitAxis, children: readonly LayoutNode[], weights: readonly number[]) {
    super(id);
    const first = children[0];
    const last = children[children.length - 1];
    if (children.length < 2 || weights.length !== children.length || Object.isUndefined(first) || Object.isUndefined(last))
      throw new RangeError(Resources.invalidSplitMessage);

    const valid = weights.map(t => (Number.isFinite(t) && t > 0 ? t : 0));
    const total = valid.reduce((sum, t) => sum + t, 0);
    this.first = first;
    this.last = last;
    this.axis = axis;
    this.children = [...children];
    this.weights = total > 0 ? valid.map(t => t / total) : valid.map(() => 1 / valid.length);
  }

  public static beside(node: LayoutNode, added: LayoutNode, edge: PanelEdge, id: number): SplitNode {
    const children = Resources.leadingEdges.includes(edge) ? [added, node] : [node, added];
    return new SplitNode(id, Resources.edgeAxes[edge], children, [1, 1]);
  }

  public static join(id: number, axis: SplitAxis, children: readonly LayoutNode[], weights: readonly number[]): LayoutNode | null {
    return children.length > 1 ? new SplitNode(id, axis, children, weights) : children[0] ?? null;
  }

  public override get groups(): readonly TabGroup[] {
    return this.children.flatMap(t => t.groups);
  }

  public override get cornerGroup(): TabGroup {
    return (this.axis === SplitAxis.Horizontal ? this.last : this.first).cornerGroup;
  }

  public override get maximumId(): number {
    return Math.max(this.id, ...this.children.map(t => t.maximumId));
  }

  public override minimumLength(axis: SplitAxis): number {
    const minimums = this.children.map(t => t.minimumLength(axis));
    return axis === this.axis ? minimums.reduce((sum, t) => sum + t, Resources.shellGap * (minimums.length - 1)) : Math.max(...minimums);
  }

  public override withGroup(group: TabGroup): LayoutNode {
    return this.withChildren(this.children.map(t => t.withGroup(group)));
  }

  public override withoutGroup(id: number): LayoutNode | null {
    const kept = this.children.map(t => t.withoutGroup(id));
    if (kept.every((t, index) => t === this.children[index]))
      return this;
    const children = kept.filter((t): t is LayoutNode => !Object.isNull(t));
    const weights = this.weights.filter((_, index) => !Object.isNull(kept[index] ?? null));
    return SplitNode.join(this.id, this.axis, children, weights);
  }

  public override splitGroup(id: number, added: TabGroup, edge: PanelEdge, splitId: number): LayoutNode {
    return this.withChildren(this.children.map(t => t.splitGroup(id, added, edge, splitId)));
  }

  public override withWeights(splitId: number, weights: readonly number[]): LayoutNode {
    if (splitId === this.id)
      return new SplitNode(this.id, this.axis, this.children, weights);
    return this.withChildren(this.children.map(t => t.withWeights(splitId, weights)));
  }

  public override arrange(bounds: DOMRectReadOnly, side: DockSide | null, frames: GroupFrame[], handles: SplitHandle[]): void {
    const horizontal = this.axis === SplitAxis.Horizontal;
    const start = horizontal ? bounds.x : bounds.y;
    const total = horizontal ? bounds.width : bounds.height;
    const available = Math.max(0, total - Resources.shellGap * (this.children.length - 1));
    const minimums = this.children.map(t => t.minimumLength(this.axis));
    const floor = minimums.reduce((sum, t) => sum + t, 0);
    const shared = available - floor;
    let exact = start;
    let position = start;
    this.children.forEach((child, index) => {
      const minimum = minimums[index] ?? 0;
      exact += shared >= 0 ? minimum + shared * (this.weights[index] ?? 0) : available * minimum / floor;
      const last = index === this.children.length - 1;
      const end = Math.max(position, last ? start + total : Math.round(exact));
      child.arrange(this.slice(bounds, position, end - position), side, frames, handles);
      if (last)
        return;
      handles.push(new SplitHandle(this, index, child.id, this.slice(bounds, end, Resources.shellGap), end - position, minimum, shared));
      exact += Resources.shellGap;
      position = end + Resources.shellGap;
    });
  }

  public override toJson(): Record<string, unknown> {
    return { [Resources.axisField]: this.axis, [Resources.childrenField]: this.children.map(t => t.toJson()), [Resources.weightsField]: [...this.weights] };
  }

  private withChildren(children: readonly LayoutNode[]): LayoutNode {
    return children.every((t, index) => t === this.children[index]) ? this : new SplitNode(this.id, this.axis, children, this.weights);
  }

  private slice(bounds: DOMRectReadOnly, position: number, length: number): DOMRectReadOnly {
    if (this.axis === SplitAxis.Horizontal)
      return new DOMRectReadOnly(position, bounds.y, length, bounds.height);
    return new DOMRectReadOnly(bounds.x, position, bounds.width, length);
  }
}
