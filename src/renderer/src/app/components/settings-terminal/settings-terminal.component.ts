/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type OnInit, type WritableSignal, inject, signal } from "@angular/core";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";

import { TruncatedTooltipDirective } from "../../directives/truncated-tooltip.directive";
import { Preferences } from "../../models/preferences";
import { Resources } from "../../resources";
import { PreferencesService } from "../../services/preferences.service";
import { TerminalsService } from "../../services/terminals.service";
import { SettingsRowComponent } from "../settings-row/settings-row.component";

@Component({
  selector: "tr-settings-terminal",
  imports: [MatFormFieldModule, MatInputModule, MatSelectModule, SettingsRowComponent, TruncatedTooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-terminal.component.html"
})
export class SettingsTerminalComponent implements OnInit {
  protected readonly resources: typeof Resources = Resources;
  protected readonly preferences: PreferencesService = inject(PreferencesService);
  protected readonly terminals: TerminalsService = inject(TerminalsService);
  protected readonly outputLimitInvalid: WritableSignal<boolean> = signal(false);

  public ngOnInit(): void {
    void this.terminals.loadShells();
  }

  protected setOutputLimit(limit: number): void {
    const valid = Preferences.isTerminalOutputLimit(limit);
    this.outputLimitInvalid.set(!valid);
    if (valid)
      this.preferences.setTerminalOutputLimit(limit);
  }
}
