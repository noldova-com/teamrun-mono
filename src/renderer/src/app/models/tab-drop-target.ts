/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PanelId } from "../enums/panel-id";
import { DropTarget } from "./drop-target";
import type { PanelArrangement } from "./panel-arrangement";
import type { ShellGeometry } from "./shell-geometry";

export class TabDropTarget extends DropTarget {
  public readonly groupId: number;
  public readonly index: number;

  public constructor(groupId: number, index: number) {
    super();

    this.groupId = groupId;
    this.index = Math.max(0, Math.round(index));
  }

  public override place(arrangement: PanelArrangement, panel: PanelId): PanelArrangement {
    return arrangement.insertTab(panel, this.groupId, this.index);
  }

  public override preview(geometry: ShellGeometry): DOMRectReadOnly | null {
    return geometry.frameOf(this.groupId)?.bounds ?? null;
  }

  public override equals(other: DropTarget | null): boolean {
    return other instanceof TabDropTarget && other.groupId === this.groupId && other.index === this.index;
  }
}
