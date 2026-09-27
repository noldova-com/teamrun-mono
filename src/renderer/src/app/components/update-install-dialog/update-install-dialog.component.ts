/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";

import { AppUpdateStatus } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources";
import { AppUpdatesService } from "../../services/app-updates.service";

@Component({
  selector: "tr-update-install-dialog",
  imports: [MatDialogModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./update-install-dialog.component.html"
})
export class UpdateInstallDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly steps: readonly (AppUpdateStatus.Preparing | AppUpdateStatus.Installing)[] = [AppUpdateStatus.Preparing, AppUpdateStatus.Installing];
  private readonly updates: AppUpdatesService = inject(AppUpdatesService);
  protected readonly current = computed(() => this.updates.state()?.status === AppUpdateStatus.Installing ? 1 : 0);
}
