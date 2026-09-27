/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import type { DockSide } from "../enums/dock-side";
import { ShellGeometry } from "../models/shell-geometry";
import { Resources } from "../resources";
import { LayoutService } from "./layout.service";
import { ViewportService } from "./viewport.service";

@Injectable({ providedIn: "root" })
export class ShellService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly viewport: ViewportService = inject(ViewportService);

  public readonly geometry: Signal<ShellGeometry> = computed(() =>
    new ShellGeometry(this.viewport.width(), this.viewport.height() - Resources.windowRowHeight, this.layout.arrangement()));

  public maximumSize(side: DockSide): number {
    return this.geometry().maximumSize(side);
  }
}
