/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DockSide } from "../enums/dock-side";
import type { TabGroup } from "./tab-group";

export class GroupFrame {
  public readonly group: TabGroup;
  public readonly bounds: DOMRectReadOnly;
  public readonly side: DockSide | null;

  public constructor(group: TabGroup, bounds: DOMRectReadOnly, side: DockSide | null) {
    this.group = group;
    this.bounds = bounds;
    this.side = side;
  }
}
