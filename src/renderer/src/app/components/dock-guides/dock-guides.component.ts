/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../../enums/dock-side";
import { PanelEdge } from "../../enums/panel-edge";
import type { GroupFrame } from "../../models/group-frame";
import type { ShellGeometry } from "../../models/shell-geometry";
import { SideDropTarget } from "../../models/side-drop-target";
import { SplitDropTarget } from "../../models/split-drop-target";
import { TabDropTarget } from "../../models/tab-drop-target";
import { Resources } from "../../resources";
import { PanelDragService } from "../../services/panel-drag.service";
import { PanelLabels } from "../../services/panel-labels.service";
import { ShellService } from "../../services/shell.service";

@Component({
  selector: "tr-dock-guides",
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "contents" },
  templateUrl: "./dock-guides.component.html"
})
export class DockGuidesComponent {
  private readonly shell: ShellService = inject(ShellService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly drag: PanelDragService = inject(PanelDragService);
  protected readonly labels: PanelLabels = inject(PanelLabels);
  protected readonly sides: readonly DockSide[] = Object.values(DockSide);
  protected readonly edges: readonly PanelEdge[] = Object.values(PanelEdge);
  protected readonly ghostOffset: number = Resources.ghostOffset;
  protected readonly geometry: Signal<ShellGeometry> = this.shell.geometry;
  protected readonly preview: Signal<DOMRectReadOnly | null> = computed(() => this.drag.target()?.preview(this.geometry()) ?? null);
  protected readonly compass: Signal<GroupFrame | null> = computed(() => {
    const panel = this.drag.dragging();
    const id = this.drag.hoveredGroup();
    const frame = Object.isNull(id) ? null : this.geometry().frameOf(id);
    if (Object.isNull(panel) || Object.isNull(frame) || (frame.group.has(panel) && frame.group.panels.length === 1 && !frame.group.isDocuments))
      return null;
    return frame;
  });

  protected isSide(side: DockSide): boolean {
    return new SideDropTarget(side).equals(this.drag.target());
  }

  protected isSplit(frame: GroupFrame, edge: PanelEdge): boolean {
    return new SplitDropTarget(frame.group.id, edge).equals(this.drag.target());
  }

  protected isCenter(frame: GroupFrame): boolean {
    return new TabDropTarget(frame.group.id, frame.group.panels.length).equals(this.drag.target());
  }
}
