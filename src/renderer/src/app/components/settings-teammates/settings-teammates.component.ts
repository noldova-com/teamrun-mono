/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import "@noldova/teamrun-foundation-core";
import type { Teammate } from "@noldova/teamrun-protocol";
import { ComposerSettings } from "../../models/composer-settings";
import { ConfirmRequest } from "../../models/confirm-request";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { DocumentsService } from "../../services/documents.service";
import { Formatter } from "../../services/formatter.service";
import { NavigationService } from "../../services/navigation.service";
import { PreferencesService } from "../../services/preferences.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";

@Component({
  selector: "tr-settings-teammates",
  imports: [MatButtonModule, TeammateAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-teammates.component.html"
})
export class SettingsTeammatesComponent {
  protected readonly resources = Resources;
  protected readonly store = inject(ChatStore);
  private readonly formatter = inject(Formatter);
  private readonly dialog = inject(MatDialog);
  private readonly preferences = inject(PreferencesService);
  private readonly navigation = inject(NavigationService);
  private readonly documents = inject(DocumentsService);
  protected readonly error = signal<string | null>(null);

  protected summary(teammate: Teammate): string {
    return [teammate.name, this.formatter.teammateSummary(teammate, this.store.accounts(), this.store.providers())].join(Resources.titleSeparator);
  }

  protected connection(teammate: Teammate): string {
    const account = this.store.accounts().find(t => t.id === teammate.providerAccountId);
    return Object.isUndefined(account) ? Resources.unavailableTeammateLabel
      : [this.formatter.providerName(account.provider, this.store.providers()), account.label].join(Resources.titleSeparator);
  }

  protected edit(teammate: Teammate | null): void {
    this.error.set(null);
    this.dialog.open(TeammateDialogComponent, { data: teammate, width: Resources.dialogWidth });
  }

  protected remove(teammate: Teammate): void {
    const data = new ConfirmRequest(Resources.deleteTeammateLabel, Resources.formatDeleteTeammate(teammate.name), Resources.deleteTeammateLabel);
    this.dialog.open<ConfirmDialogComponent, ConfirmRequest, boolean>(ConfirmDialogComponent, { data, width: Resources.dialogWidth })
      .afterClosed().subscribe(async confirmed => {
        if (confirmed) {
          this.error.set(null);
          if (!await this.store.deleteTeammate(teammate))
            this.error.set(this.store.error());
        }
      });
  }

  protected async createConversation(teammate: Teammate): Promise<void> {
    const conversation = await this.store.createConversation(null);
    if (Object.isNull(conversation) || !await this.store.addMember(conversation.id, teammate.id))
      return;
    const defaults = this.preferences.defaultComposer() ?? new ComposerSettings(this.store.providers()[0]!.id, null, null, null);
    this.preferences.rememberComposer(conversation.id,
      new ComposerSettings(defaults.provider, defaults.model, defaults.effort, defaults.providerAccountId, teammate.id));
    this.navigation.showChat();
    await this.documents.keepOpen(conversation.id);
  }
}
