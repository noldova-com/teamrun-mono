/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../enums/dock-side";
import { Resources } from "../resources";
import { Dock } from "./dock";

export class ShellFit {
  private readonly tracks: ReadonlyMap<DockSide, number>;

  public readonly document: number;

  private constructor(tracks: ReadonlyMap<DockSide, number>, document: number) {
    this.tracks = tracks;
    this.document = document;
  }

  public static of(size: number, docks: readonly Dock[]): ShellFit {
    const wanted = docks.map(dock => ShellFit.wanted(dock));
    const chrome = Resources.shellPadding * 2;
    const rest = size - chrome - wanted.reduce((sum, value) => sum + value, 0);
    if (rest >= Resources.documentMinimumSize)
      return ShellFit.build(docks, wanted, rest);

    let deficit = Resources.documentMinimumSize - rest;
    const fitted = docks.map((dock, index) => {
      const wish = wanted[index] ?? 0;
      const cut = Math.min(deficit, Math.max(0, wish - ShellFit.floor(dock)));
      deficit -= cut;
      return wish - cut;
    });

    return ShellFit.build(docks, fitted, Resources.documentMinimumSize - deficit);
  }

  public track(side: DockSide): number {
    return this.tracks.get(side) ?? 0;
  }

  public maximum(side: DockSide): number {
    return Math.min(Resources.dockMaximumSize, this.track(side) + Math.max(0, this.document - Resources.documentMinimumSize));
  }

  private static build(docks: readonly Dock[], tracks: readonly number[], document: number): ShellFit {
    const map = new Map<DockSide, number>();
    docks.forEach((dock, index) => map.set(dock.side, tracks[index] ?? 0));

    return new ShellFit(map, document);
  }

  private static wanted(dock: Dock): number {
    if (dock.isEmpty)
      return 0;
    if (dock.collapsed)
      return Resources.dockStripSize + Resources.shellGap;

    return (dock.size ?? Resources.defaultDockSizes[dock.side]) + Resources.shellGap;
  }

  private static floor(dock: Dock): number {
    if (dock.isEmpty)
      return 0;
    if (dock.collapsed)
      return Resources.dockStripSize + Resources.shellGap;

    return Resources.dockMinimumSize + Resources.shellGap;
  }
}
