/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, type Signal, computed, effect, inject, signal, untracked } from "@angular/core";
import { MatDialog, type MatDialogRef } from "@angular/material/dialog";

import "@noldova/teamrun-foundation-core";
import { AppUpdateCommand, AppUpdateStatus } from "@noldova/teamrun-protocol";

import { RestartChoiceDialogComponent } from "../components/restart-choice-dialog/restart-choice-dialog.component";
import { UpdateInstallDialogComponent } from "../components/update-install-dialog/update-install-dialog.component";
import { RestartChoice } from "../enums/restart-choice";
import { AppUpdatesService } from "./app-updates.service";
import { ChatStore } from "./chat-store.service";

@Injectable({ providedIn: "root" })
export class UpdateRestartService {
  private readonly updates: AppUpdatesService = inject(AppUpdatesService);
  private readonly store: ChatStore = inject(ChatStore);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly waiting = signal(false);
  private installing: MatDialogRef<UpdateInstallDialogComponent> | null = null;

  public readonly waitingFor: Signal<number | null> = computed(() => this.waiting() ? this.store.workingReplies().length : null);

  public constructor() {
    effect(() => {
      if (this.waiting() && this.store.workingReplies().length === 0)
        untracked(() => {
          this.waiting.set(false);
          void this.updates.execute(AppUpdateCommand.Install);
        });
    });
    effect(() => {
      const status = this.updates.state()?.status;
      const active = status === AppUpdateStatus.Preparing || status === AppUpdateStatus.Installing;
      untracked(() => {
        if (active && Object.isNull(this.installing))
          this.installing = this.dialog.open(UpdateInstallDialogComponent, { disableClose: true, role: "alertdialog" });
        else if (!active && !Object.isNull(this.installing)) {
          this.installing.close();
          this.installing = null;
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.installing?.close());
  }

  public restart(): void {
    const running = this.store.workingReplies().length;
    if (running === 0) {
      void this.updates.execute(AppUpdateCommand.Install);
      return;
    }
    this.dialog.open<RestartChoiceDialogComponent, number, RestartChoice>(RestartChoiceDialogComponent, { data: running })
      .afterClosed().subscribe(choice => {
        if (Object.isUndefined(choice))
          return;
        this.waiting.set(true);
        if (choice === RestartChoice.StopReplies)
          for (const reply of this.store.workingReplies())
            void this.store.cancel(reply.id);
      });
  }

  public cancelWaiting(): void {
    this.waiting.set(false);
  }
}
