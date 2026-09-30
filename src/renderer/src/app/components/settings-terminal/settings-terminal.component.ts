/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type OnInit, inject } from "@angular/core";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";

import { Resources } from "../../resources";
import { PreferencesService } from "../../services/preferences.service";
import { TerminalsService } from "../../services/terminals.service";
import { SettingsRowComponent } from "../settings-row/settings-row.component";

@Component({
  selector: "tr-settings-terminal",
  imports: [MatFormFieldModule, MatSelectModule, SettingsRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-terminal.component.html"
})
export class SettingsTerminalComponent implements OnInit {
  protected readonly resources: typeof Resources = Resources;
  protected readonly preferences: PreferencesService = inject(PreferencesService);
  protected readonly terminals: TerminalsService = inject(TerminalsService);

  public ngOnInit(): void {
    void this.terminals.loadShells();
  }
}
