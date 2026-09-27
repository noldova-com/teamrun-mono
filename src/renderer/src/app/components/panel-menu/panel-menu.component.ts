/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy, Component, EnvironmentInjector, type InputSignal, type Signal, afterNextRender, computed, inject, input, viewChild
} from "@angular/core";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { type MatMenu, MatMenuModule } from "@angular/material/menu";

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../../enums/dock-side";
import { PanelEdge } from "../../enums/panel-edge";
import type { PanelId } from "../../enums/panel-id";
import type { DropTarget } from "../../models/drop-target";
import { SideDropTarget } from "../../models/side-drop-target";
import { SplitDropTarget } from "../../models/split-drop-target";
import { TabDropTarget } from "../../models/tab-drop-target";
import type { TabGroup } from "../../models/tab-group";
import { Resources } from "../../resources";
import { LayoutService } from "../../services/layout.service";

@Component({
  selector: "tr-panel-menu",
  imports: [MatDividerModule, MatIconModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "contents" },
  templateUrl: "./panel-menu.component.html"
})
export class PanelMenuComponent {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);

  protected readonly resources: typeof Resources = Resources;
  protected readonly edges: readonly PanelEdge[] = Object.values(PanelEdge);
  protected readonly sides: readonly DockSide[] = Object.values(DockSide);
  protected readonly group: Signal<TabGroup | null> = computed(() => this.layout.arrangement().groupOf(this.panel()));
  protected readonly destinations: Signal<readonly TabGroup[]> = computed(() => this.layout.arrangement().groups.filter(t => !t.has(this.panel())));
  protected readonly canSplit: Signal<boolean> = computed(() => {
    const group = this.group();
    return !Object.isNull(group) && (group.isDocuments || group.panels.length > 1);
  });

  public readonly panel: InputSignal<PanelId> = input.required<PanelId>();
  public readonly menu: Signal<MatMenu | undefined> = viewChild<MatMenu>("panelMenu");

  protected labelOf(group: TabGroup): string {
    return group.isDocuments ? Resources.documentsGroupLabel : group.panels.map(t => Resources.panelLabels[t]).join(Resources.groupLabelJoiner);
  }

  protected moveTo(group: TabGroup): void {
    this.move(new TabDropTarget(group.id, group.panels.length));
  }

  protected split(edge: PanelEdge): void {
    const group = this.group();
    if (!Object.isNull(group))
      this.move(new SplitDropTarget(group.id, edge));
  }

  protected dock(side: DockSide): void {
    this.move(new SideDropTarget(side));
  }

  protected close(): void {
    const group = this.group();
    this.layout.closePanel(this.panel());
    const next = Object.isNull(group) ? null : this.layout.arrangement().group(group.id)?.activePanel ?? null;
    if (!Object.isNull(next))
      this.focusTab(next);
  }

  private move(target: DropTarget): void {
    const panel = this.panel();
    this.layout.movePanel(panel, target);
    this.focusTab(panel);
  }

  private focusTab(panel: PanelId): void {
    afterNextRender(() => this.document.querySelector<HTMLElement>(Resources.formatPanelTabSelector(panel))?.focus(), { injector: this.environment });
  }
}
