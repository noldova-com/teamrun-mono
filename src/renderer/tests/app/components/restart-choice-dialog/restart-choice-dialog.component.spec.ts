/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

import { RestartChoiceDialogComponent } from "../../../../src/app/components/restart-choice-dialog/restart-choice-dialog.component";
import { RestartChoice } from "../../../../src/app/enums/restart-choice";
import { Resources } from "../../../../src/app/resources";

describe("RestartChoiceDialogComponent", () => {
  it("counts the running replies and closes with the chosen way to restart", async () => {
    const closed: (RestartChoice | undefined)[] = [];
    TestBed.configureTestingModule({
      imports: [RestartChoiceDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: 2 },
        { provide: MatDialogRef, useValue: { close: (value?: RestartChoice) => closed.push(value) } }
      ]
    });
    const fixture = TestBed.createComponent(RestartChoiceDialogComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector("h2")?.textContent?.trim()).toBe("Restart to update?");
    expect(element.textContent).toContain("2 replies are still running.");
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>("button"));
    expect(buttons.map(t => t.textContent?.trim())).toEqual(["Cancel", "Stop and restart", "Restart when finished"]);
    buttons[2]!.click();
    buttons[1]!.click();
    buttons[0]!.click();
    expect(closed).toEqual([RestartChoice.WhenFinished, RestartChoice.StopReplies, undefined]);
    expect(Resources.formatRunningReplies(1)).toBe("1 reply is still running.");
    expect(Resources.formatRestartWaiting(1)).toBe("Restarts when 1 reply finishes");
    expect(Resources.formatRestartWaiting(3)).toBe("Restarts when 3 replies finish");
  });
});
