/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type InputSignal, input } from "@angular/core";

import { PanelId } from "../../enums/panel-id";
import { ActivityPanelComponent } from "../activity-panel/activity-panel.component";
import { ChangesPanelComponent } from "../changes-panel/changes-panel.component";
import { SidebarComponent } from "../sidebar/sidebar.component";

@Component({
  selector: "tr-panel-content",
  imports: [ActivityPanelComponent, ChangesPanelComponent, SidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block h-full min-h-0 overflow-hidden", "[attr.data-panel]": "panel()" },
  templateUrl: "./panel-content.component.html"
})
export class PanelContentComponent {
  protected readonly explorer: PanelId = PanelId.Explorer;
  protected readonly changes: PanelId = PanelId.Changes;
  protected readonly activity: PanelId = PanelId.Activity;

  public readonly panel: InputSignal<PanelId> = input.required<PanelId>();
}
