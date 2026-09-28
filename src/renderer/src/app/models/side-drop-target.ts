/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DockSide } from "../enums/dock-side";
import { DropTarget } from "./drop-target";
import type { Panel } from "./panel";
import type { PanelArrangement } from "./panel-arrangement";
import type { ShellGeometry } from "./shell-geometry";

export class SideDropTarget extends DropTarget {
  public readonly side: DockSide;

  public constructor(side: DockSide) {
    super();

    this.side = side;
  }

  public override place(arrangement: PanelArrangement, panel: Panel): PanelArrangement {
    return arrangement.dockOnSide(panel, this.side);
  }

  public override preview(geometry: ShellGeometry): DOMRectReadOnly {
    return geometry.sidePreview(this.side);
  }

  public override equals(other: DropTarget | null): boolean {
    return other instanceof SideDropTarget && other.side === this.side;
  }
}
