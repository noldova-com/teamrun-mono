/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

import { AppUpdateCommand } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources";
import { BrandMarkComponent } from "../brand-mark/brand-mark.component";
import { BridgeService } from "../../services/bridge.service";
import { AppUpdatesService } from "../../services/app-updates.service";
import { UpdateRestartService } from "../../services/update-restart.service";
import { AppUpdatesComponent } from "../app-updates/app-updates.component";

@Component({
  selector: "tr-settings-about",
  imports: [AppUpdatesComponent, BrandMarkComponent, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-about.component.html"
})
export class SettingsAboutComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly bridge: BridgeService = inject(BridgeService);
  protected readonly updates: AppUpdatesService = inject(AppUpdatesService);
  protected readonly restart: UpdateRestartService = inject(UpdateRestartService);

  protected run(command: AppUpdateCommand): void {
    if (command === AppUpdateCommand.Install)
      this.restart.restart();
    else
      void this.updates.execute(command);
  }
}
