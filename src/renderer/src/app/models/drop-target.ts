/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Panel } from "./panel";
import type { PanelArrangement } from "./panel-arrangement";
import type { ShellGeometry } from "./shell-geometry";

export abstract class DropTarget {
  public abstract place(arrangement: PanelArrangement, panel: Panel): PanelArrangement;

  public abstract preview(geometry: ShellGeometry): DOMRectReadOnly | null;

  public abstract equals(other: DropTarget | null): boolean;
}
