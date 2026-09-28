/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { DockSide } from "../enums/dock-side";
import { Resources } from "../resources";
import type { LayoutNode } from "./layout.node";
import type { Panel } from "./panel";

export class Dock {
  public readonly side: DockSide;
  public readonly root: LayoutNode | null;
  public readonly size: number | null;
  public readonly collapsed: boolean;

  public constructor(side: DockSide, root: LayoutNode | null, size: number | null, collapsed: boolean) {
    this.side = side;
    this.root = root;
    this.size = Object.isNull(size) ? null : Dock.clamp(size);
    this.collapsed = collapsed;
  }

  public static createEmpty(side: DockSide): Dock {
    return new Dock(side, null, null, false);
  }

  public get isEmpty(): boolean {
    return Object.isNull(this.root);
  }

  public get panels(): readonly Panel[] {
    return this.root?.groups.flatMap(t => t.panels) ?? [];
  }

  public holds(groupId: number): boolean {
    return this.root?.groups.some(t => t.id === groupId) ?? false;
  }

  public toJson(): Record<string, unknown> {
    return { [Resources.rootField]: this.root?.toJson() ?? null, [Resources.sizeField]: this.size, [Resources.collapsedField]: this.collapsed };
  }

  public withRoot(root: LayoutNode | null): Dock {
    return root === this.root ? this : new Dock(this.side, root, this.size, this.collapsed);
  }

  public withSize(size: number | null): Dock {
    const resized = new Dock(this.side, this.root, size, this.collapsed);
    return resized.size === this.size ? this : resized;
  }

  public withCollapsed(collapsed: boolean): Dock {
    return collapsed === this.collapsed ? this : new Dock(this.side, this.root, this.size, collapsed);
  }

  private static clamp(size: number): number {
    return Math.min(Resources.dockMaximumSize, Math.max(Resources.dockMinimumSize, Math.round(size)));
  }
}
