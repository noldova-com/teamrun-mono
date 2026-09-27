/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DockSide } from "../enums/dock-side";
import type { PanelEdge } from "../enums/panel-edge";
import type { SplitAxis } from "../enums/split-axis";
import type { GroupFrame } from "./group-frame";
import type { SplitHandle } from "./split-handle";
import type { TabGroup } from "./tab-group";

export abstract class LayoutNode {
  public readonly id: number;

  protected constructor(id: number) {
    this.id = id;
  }

  public abstract get groups(): readonly TabGroup[];

  public abstract get cornerGroup(): TabGroup;

  public abstract get maximumId(): number;

  public abstract minimumLength(axis: SplitAxis): number;

  public abstract withGroup(group: TabGroup): LayoutNode;

  public abstract withoutGroup(id: number): LayoutNode | null;

  public abstract splitGroup(id: number, added: TabGroup, edge: PanelEdge, splitId: number): LayoutNode;

  public abstract withWeights(splitId: number, weights: readonly number[]): LayoutNode;

  public abstract arrange(bounds: DOMRectReadOnly, side: DockSide | null, frames: GroupFrame[], handles: SplitHandle[]): void;

  public abstract toJson(): Record<string, unknown>;
}
