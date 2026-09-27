/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";

import { RestartChoice } from "../../enums/restart-choice";
import { Resources } from "../../resources";

@Component({
  selector: "tr-restart-choice-dialog",
  imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./restart-choice-dialog.component.html"
})
export class RestartChoiceDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly choices: typeof RestartChoice = RestartChoice;
  protected readonly running: number = inject<number>(MAT_DIALOG_DATA);
  private readonly dialog: MatDialogRef<RestartChoiceDialogComponent, RestartChoice> = inject(MatDialogRef);

  protected choose(choice: RestartChoice): void {
    this.dialog.close(choice);
  }

  protected dismiss(): void {
    this.dialog.close();
  }
}
