/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../enums/dock-side";
import { PanelEdge } from "../enums/panel-edge";
import { SplitAxis } from "../enums/split-axis";
import { Resources } from "../resources";
import { GroupFrame } from "./group-frame";
import type { PanelArrangement } from "./panel-arrangement";
import { ShellFit } from "./shell-fit";
import type { SplitHandle } from "./split-handle";

export class ShellGeometry {
  private readonly arrangement: PanelArrangement;
  private readonly across: ShellFit;
  private readonly down: ShellFit;
  private readonly width: number;
  private readonly inner: number;
  private readonly docks: ReadonlyMap<DockSide, DOMRectReadOnly>;
  private readonly frames: readonly GroupFrame[];

  public readonly middle: DOMRectReadOnly;
  public readonly documents: GroupFrame;
  public readonly groups: readonly GroupFrame[];
  public readonly handles: readonly SplitHandle[];

  public constructor(width: number, height: number, arrangement: PanelArrangement) {
    const padding = Resources.shellPadding;
    const gap = Resources.shellGap;
    const across = ShellFit.of(width, [arrangement.dock(DockSide.Left), arrangement.dock(DockSide.Right)]);
    const down = ShellFit.of(height, [arrangement.dock(DockSide.Bottom)]);
    const inner = Math.max(0, height - padding);
    const left = across.track(DockSide.Left);
    const right = across.track(DockSide.Right);
    const middle = new DOMRectReadOnly(padding + left, 0, Math.max(0, width - 2 * padding - left - right), Math.max(0, inner - down.track(DockSide.Bottom)));
    const docks = new Map<DockSide, DOMRectReadOnly>([
      [DockSide.Left, new DOMRectReadOnly(padding, 0, Math.max(0, left - gap), inner)],
      [DockSide.Right, new DOMRectReadOnly(width - padding - Math.max(0, right - gap), 0, Math.max(0, right - gap), inner)],
      [DockSide.Bottom, new DOMRectReadOnly(middle.x, middle.bottom + gap, middle.width, Math.max(0, down.track(DockSide.Bottom) - gap))]
    ]);
    const frames: GroupFrame[] = [];
    const handles: SplitHandle[] = [];
    for (const dock of arrangement.docks.values())
      if (!Object.isNull(dock.root) && !dock.collapsed)
        dock.root.arrange(docks.get(dock.side) ?? middle, dock.side, frames, handles);
    arrangement.middle.arrange(middle, null, frames, handles);
    this.arrangement = arrangement;
    this.across = across;
    this.down = down;
    this.width = width;
    this.inner = inner;
    this.docks = docks;
    this.frames = frames;
    this.middle = middle;
    this.documents = frames.find(t => t.group.isDocuments) ?? new GroupFrame(arrangement.documents, middle, null);
    this.groups = frames.filter(t => !t.group.isDocuments).sort((a, b) => a.group.id - b.group.id);
    this.handles = handles;
  }

  public dock(side: DockSide): DOMRectReadOnly {
    return this.docks.get(side) ?? new DOMRectReadOnly();
  }

  public maximumSize(side: DockSide): number {
    return (side === DockSide.Bottom ? this.down : this.across).maximum(side) - Resources.shellGap;
  }

  public frameOf(groupId: number): GroupFrame | null {
    return this.frames.find(t => t.group.id === groupId) ?? null;
  }

  public edgeStrip(bounds: DOMRectReadOnly, edge: PanelEdge, length: number): DOMRectReadOnly {
    switch (edge) {
      case PanelEdge.Left:
        return new DOMRectReadOnly(bounds.x, bounds.y, length, bounds.height);
      case PanelEdge.Right:
        return new DOMRectReadOnly(bounds.right - length, bounds.y, length, bounds.height);
      case PanelEdge.Top:
        return new DOMRectReadOnly(bounds.x, bounds.y, bounds.width, length);
      case PanelEdge.Bottom:
        return new DOMRectReadOnly(bounds.x, bounds.bottom - length, bounds.width, length);
    }
  }

  public edgeHalf(bounds: DOMRectReadOnly, edge: PanelEdge): DOMRectReadOnly {
    const length = Resources.edgeAxes[edge] === SplitAxis.Horizontal ? bounds.width : bounds.height;
    return this.edgeStrip(bounds, edge, Math.max(0, (length - Resources.shellGap) / 2));
  }

  public sidePreview(side: DockSide): DOMRectReadOnly {
    const dock = this.arrangement.dock(side);
    if (!dock.isEmpty && !dock.collapsed)
      return this.edgeHalf(this.dock(side), Resources.dockEdges[side]);
    return this.edgeStrip(this.span(side), Resources.dockEdges[side], dock.size ?? Resources.defaultDockSizes[side]);
  }

  public guideBounds(side: DockSide): DOMRectReadOnly {
    const area = this.sidePreview(side);
    return this.centered(area.x + area.width / 2, area.y + area.height / 2, Resources.guideSize);
  }

  public compassBounds(frame: GroupFrame): DOMRectReadOnly {
    const size = Resources.compassSize;
    let bounds = this.centered(frame.bounds.x + frame.bounds.width / 2, frame.bounds.y + frame.bounds.height / 2, size);
    for (const side of Object.values(DockSide))
      bounds = this.clearOf(bounds, this.guideBounds(side), Resources.dockEdges[side]);
    return new DOMRectReadOnly(
      this.clamp(bounds.x, Resources.shellPadding, this.width - Resources.shellPadding - size),
      this.clamp(bounds.y, 0, this.inner - size),
      size,
      size);
  }

  private span(side: DockSide): DOMRectReadOnly {
    if (side === DockSide.Bottom)
      return new DOMRectReadOnly(this.middle.x, 0, this.middle.width, this.inner);
    return new DOMRectReadOnly(Resources.shellPadding, 0, Math.max(0, this.width - 2 * Resources.shellPadding), this.inner);
  }

  private centered(x: number, y: number, size: number): DOMRectReadOnly {
    return new DOMRectReadOnly(x - size / 2, y - size / 2, size, size);
  }

  private clearOf(bounds: DOMRectReadOnly, guide: DOMRectReadOnly, edge: PanelEdge): DOMRectReadOnly {
    const margin = Resources.guideInset;
    if (bounds.x >= guide.right + margin || bounds.right <= guide.x - margin || bounds.y >= guide.bottom + margin || bounds.bottom <= guide.y - margin)
      return bounds;
    switch (edge) {
      case PanelEdge.Left:
        return new DOMRectReadOnly(guide.right + margin, bounds.y, bounds.width, bounds.height);
      case PanelEdge.Right:
        return new DOMRectReadOnly(guide.x - margin - bounds.width, bounds.y, bounds.width, bounds.height);
      case PanelEdge.Top:
        return new DOMRectReadOnly(bounds.x, guide.bottom + margin, bounds.width, bounds.height);
      case PanelEdge.Bottom:
        return new DOMRectReadOnly(bounds.x, guide.y - margin - bounds.height, bounds.width, bounds.height);
    }
  }

  private clamp(value: number, low: number, high: number): number {
    return low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value));
  }
}
