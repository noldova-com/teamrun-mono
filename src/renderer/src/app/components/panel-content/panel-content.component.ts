/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type InputSignal, input } from "@angular/core";

import { PanelKind } from "../../enums/panel-kind";
import type { Panel } from "../../models/panel";
import { ActivityPanelComponent } from "../activity-panel/activity-panel.component";
import { ChangesPanelComponent } from "../changes-panel/changes-panel.component";
import { SidebarComponent } from "../sidebar/sidebar.component";
import { TerminalPanelComponent } from "../terminal-panel/terminal-panel.component";

@Component({
  selector: "tr-panel-content",
  imports: [ActivityPanelComponent, ChangesPanelComponent, SidebarComponent, TerminalPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block h-full min-h-0 overflow-hidden", "[attr.data-panel]": "panel().key" },
  templateUrl: "./panel-content.component.html"
})
export class PanelContentComponent {
  protected readonly explorer: PanelKind = PanelKind.Explorer;
  protected readonly changes: PanelKind = PanelKind.Changes;
  protected readonly activity: PanelKind = PanelKind.Activity;
  protected readonly terminal: PanelKind = PanelKind.Terminal;

  public readonly panel: InputSignal<Panel> = input.required<Panel>();
}
