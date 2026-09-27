/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { UpdateInstallDialogComponent } from "../../../../src/app/components/update-install-dialog/update-install-dialog.component";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";

describe("UpdateInstallDialogComponent", () => {
  it("lists the steps and marks the current one as preparation hands over to the installer", async () => {
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ imports: [UpdateInstallDialogComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const fixture = TestBed.createComponent(UpdateInstallDialogComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const current = (): string | undefined => element.querySelector('[aria-current="step"] span')?.textContent?.trim();

    bridge.emitUpdate(new AppUpdateState(AppUpdateStatus.Preparing, "0.0.4", "0.0.5", 100, null, null, false, true));
    await fixture.whenStable();
    expect(element.querySelector("h2")?.textContent?.trim()).toBe("Installing update");
    expect(element.textContent).toContain("TeamRun will restart when the installation finishes.");
    expect(element.querySelector("mat-progress-bar")).not.toBeNull();
    expect(current()).toBe("Saving workspaces and stopping runtimes");
    expect(element.querySelectorAll("li.tr-muted")).toHaveLength(1);

    bridge.emitUpdate(new AppUpdateState(AppUpdateStatus.Installing, "0.0.4", "0.0.5", 100, null, null, false, true));
    await fixture.whenStable();
    expect(current()).toBe("Installing the update");
    expect(element.querySelectorAll("li.tr-muted")).toHaveLength(0);
    expect(element.querySelector("li mat-icon")?.textContent?.trim()).toBe("check");
  });
});
