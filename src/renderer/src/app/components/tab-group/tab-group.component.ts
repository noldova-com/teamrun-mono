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
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";

import { TruncatedTooltipDirective } from "../../directives/truncated-tooltip.directive";
import type { DockSide } from "../../enums/dock-side";
import { PanelKind } from "../../enums/panel-kind";
import type { GroupFrame } from "../../models/group-frame";
import type { Panel } from "../../models/panel";
import type { TabGroup } from "../../models/tab-group";
import { Resources } from "../../resources";
import { LayoutService } from "../../services/layout.service";
import { PanelDragService } from "../../services/panel-drag.service";
import { PanelLabels } from "../../services/panel-labels.service";
import { TerminalsService } from "../../services/terminals.service";
import { PanelContentComponent } from "../panel-content/panel-content.component";
import { PanelMenuComponent } from "../panel-menu/panel-menu.component";

@Component({
  selector: "tr-tab-group",
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, PanelContentComponent, PanelMenuComponent, TruncatedTooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "absolute flex min-h-0 min-w-0 flex-col",
    "[attr.data-group]": "group().id",
    "[attr.data-side]": "frame().side",
    "[style.left.px]": "frame().bounds.x",
    "[style.top.px]": "frame().bounds.y",
    "[style.width.px]": "frame().bounds.width",
    "[style.height.px]": "frame().bounds.height"
  },
  templateUrl: "./tab-group.component.html"
})
export class TabGroupComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly drag: PanelDragService = inject(PanelDragService);
  protected readonly labels: PanelLabels = inject(PanelLabels);
  protected readonly terminals: TerminalsService = inject(TerminalsService);
  protected readonly group: Signal<TabGroup> = computed(() => this.frame().group);
  protected readonly holdsTerminals: Signal<boolean> = computed(() => this.group().panels.some(t => t.kind === PanelKind.Terminal));
  protected readonly dockSide: Signal<DockSide | null> = computed(() => {
    const side = this.frame().side;
    return !Object.isNull(side) && this.layout.dock(side).root?.cornerGroup.id === this.group().id ? side : null;
  });

  public readonly frame: InputSignal<GroupFrame> = input.required<GroupFrame>();

  protected close(event: globalThis.Event, panel: Panel): void {
    event.stopPropagation();
    this.layout.closePanel(panel);
  }

  protected onTabMouseDown(event: MouseEvent): void {
    if (event.button === Resources.middleButton)
      event.preventDefault();
  }

  protected onTabAuxClick(event: MouseEvent, panel: Panel): void {
    if (event.button !== Resources.middleButton)
      return;
    event.preventDefault();
    this.close(event, panel);
  }
}
