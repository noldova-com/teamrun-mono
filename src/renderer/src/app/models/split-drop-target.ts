/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { PanelEdge } from "../enums/panel-edge";
import type { PanelId } from "../enums/panel-id";
import { DropTarget } from "./drop-target";
import type { PanelArrangement } from "./panel-arrangement";
import type { ShellGeometry } from "./shell-geometry";

export class SplitDropTarget extends DropTarget {
  public readonly groupId: number;
  public readonly edge: PanelEdge;

  public constructor(groupId: number, edge: PanelEdge) {
    super();

    this.groupId = groupId;
    this.edge = edge;
  }

  public override place(arrangement: PanelArrangement, panel: PanelId): PanelArrangement {
    return arrangement.splitGroup(panel, this.groupId, this.edge);
  }

  public override preview(geometry: ShellGeometry): DOMRectReadOnly | null {
    const frame = geometry.frameOf(this.groupId);
    return Object.isNull(frame) ? null : geometry.edgeHalf(frame.bounds, this.edge);
  }

  public override equals(other: DropTarget | null): boolean {
    return other instanceof SplitDropTarget && other.groupId === this.groupId && other.edge === this.edge;
  }
}
