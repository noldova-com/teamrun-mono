/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type InputSignal, type Signal, computed, inject, input } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule, type TooltipPosition } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../../enums/dock-side";
import type { PanelEdge } from "../../enums/panel-edge";
import type { Dock } from "../../models/dock";
import { Resources } from "../../resources";
import { LayoutService } from "../../services/layout.service";
import { PanelLabels } from "../../services/panel-labels.service";
import { ShellService } from "../../services/shell.service";
import { ResizeHandleComponent } from "../resize-handle/resize-handle.component";

@Component({
  selector: "tr-dock",
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, ResizeHandleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "absolute flex",
    "[class.hidden]": "dock().isEmpty",
    "[attr.data-side]": "side()",
    "[style.left.px]": "bounds().x",
    "[style.top.px]": "bounds().y",
    "[style.width.px]": "bounds().width",
    "[style.height.px]": "bounds().height"
  },
  templateUrl: "./dock.component.html"
})
export class DockComponent {
  private readonly shell: ShellService = inject(ShellService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly labels: PanelLabels = inject(PanelLabels);
  protected readonly dock: Signal<Dock> = computed(() => this.layout.dock(this.side()));
  protected readonly bounds: Signal<DOMRectReadOnly> = computed(() => this.shell.geometry().dock(this.side()));
  protected readonly cornerId: Signal<number | null> = computed(() => this.dock().root?.cornerGroup.id ?? null);
  protected readonly isVertical: Signal<boolean> = computed(() => this.side() !== DockSide.Bottom);
  protected readonly handleEdge: Signal<PanelEdge> = computed(() => Resources.dockHandleEdges[this.side()]);
  protected readonly tooltipPosition: Signal<TooltipPosition> = computed(() => Resources.dockTooltipPositions[this.side()]);

  public readonly side: InputSignal<DockSide> = input.required<DockSide>();

  protected resize(size: number): void {
    this.layout.resizeDock(this.side(), Math.min(size, this.shell.maximumSize(this.side())));
  }
}
