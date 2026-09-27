/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";

import "@noldova/teamrun-foundation-core";
import { AppUpdateCommand, AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources";

@Component({
  selector: "tr-app-updates",
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./app-updates.component.html"
})
export class AppUpdatesComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly statuses: typeof AppUpdateStatus = AppUpdateStatus;
  protected readonly commands: typeof AppUpdateCommand = AppUpdateCommand;
  protected readonly busy = computed(() => this.pending() || this.state()?.status === AppUpdateStatus.Checking
    || this.state()?.status === AppUpdateStatus.Downloading || this.state()?.status === AppUpdateStatus.Preparing
    || this.state()?.status === AppUpdateStatus.Installing);

  public readonly state = input<AppUpdateState | null>(null);
  public readonly error = input<string | null>(null);
  public readonly pending = input(false);
  public readonly waitingFor = input<number | null>(null);
  public readonly command = output<AppUpdateCommand>();
  public readonly openReleases = output<void>();
  public readonly cancelWaiting = output<void>();
}
