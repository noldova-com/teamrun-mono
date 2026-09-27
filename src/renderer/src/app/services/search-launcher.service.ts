/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";

import "@noldova/teamrun-foundation-core";
import type { ConversationSearchHit } from "@noldova/teamrun-protocol";

import { SearchDialogComponent } from "../components/search-dialog/search-dialog.component";
import { Resources } from "../resources";
import { ChatStore } from "./chat-store.service";
import { NavigationService } from "./navigation.service";

@Injectable({ providedIn: "root" })
export class SearchLauncher {
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly store: ChatStore = inject(ChatStore);
  private readonly navigation: NavigationService = inject(NavigationService);

  public open(): void {
    const opened = this.dialog.open<SearchDialogComponent, void, ConversationSearchHit>(SearchDialogComponent, {
      width: Resources.searchDialogWidth, position: { top: Resources.searchDialogTop },
      panelClass: Resources.quickInputPanelClass, backdropClass: Resources.quickInputBackdropClass
    });
    opened.afterClosed().subscribe(hit => {
      if (Object.isUndefined(hit))
        return;
      this.navigation.showChat();
      void this.store.showMessage(hit);
    });
  }
}
