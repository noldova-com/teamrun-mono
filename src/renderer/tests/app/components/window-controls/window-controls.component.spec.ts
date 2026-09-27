/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { WindowControlsComponent } from "../../../../src/app/components/window-controls/window-controls.component";
import { AppView } from "../../../../src/app/enums/app-view";
import { SettingsSection } from "../../../../src/app/enums/settings-section";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { NavigationService } from "../../../../src/app/services/navigation.service";
import { UpdateRestartService } from "../../../../src/app/services/update-restart.service";

describe("WindowControlsComponent", () => {
  it("shows the update indicator while an update is available, downloading or ready, and opens About", async () => {
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ imports: [WindowControlsComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const fixture = TestBed.createComponent(WindowControlsComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const indicator = (): HTMLButtonElement | null => element.querySelector(".tr-update-open");
    const show = async (state: AppUpdateState): Promise<void> => {
      bridge.emitUpdate(state);
      await fixture.whenStable();
    };
    expect(indicator()).toBeNull();

    const available = new AppUpdateState(AppUpdateStatus.Available, "0.0.4", "0.0.5", null, null, null, false);
    const cases: readonly (readonly [AppUpdateState, string | null])[] = [
      [available, "Update 0.0.5 available"],
      [new AppUpdateState(AppUpdateStatus.Downloading, "0.0.4", "0.0.5", 42, null, null, false), "Downloading update 0.0.5: 42%"],
      [new AppUpdateState(AppUpdateStatus.Downloaded, "0.0.4", "0.0.5", 100, null, null, false, true), "Update 0.0.5 ready to install"],
      [new AppUpdateState(AppUpdateStatus.Downloaded, "0.0.4", "0.0.5", 100, "Installation is not enabled.", null, true), "Update 0.0.5 downloaded"],
      [new AppUpdateState(AppUpdateStatus.Error, "0.0.4", "0.0.5", null, "The download failed.", null, false), "Update 0.0.5 needs attention"],
      [new AppUpdateState(AppUpdateStatus.UpToDate, "0.0.4", null, null, null, null, false), null],
      [new AppUpdateState(AppUpdateStatus.Error, "0.0.4", null, null, "The check failed.", null, false), null],
      [new AppUpdateState(AppUpdateStatus.Disabled, "0.0.4", null, null, "This installation cannot update itself.", null, false), null]
    ];
    for (const [state, label] of cases) {
      await show(state);
      expect(indicator()?.getAttribute("aria-label") ?? null).toBe(label);
    }

    await show(available);
    indicator()!.click();
    const navigation = TestBed.inject(NavigationService);
    expect(navigation.view()).toBe(AppView.Settings);
    expect(navigation.section()).toBe(SettingsSection.About);
  });

  it("tells when a restart waits for running replies", async () => {
    const bridge = SampleData.createBridge();
    const waitingFor = signal<number | null>(2);
    TestBed.configureTestingModule({
      imports: [WindowControlsComponent],
      providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }, { provide: UpdateRestartService, useValue: { waitingFor } }]
    });
    const fixture = TestBed.createComponent(WindowControlsComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const label = (): string | null => element.querySelector(".tr-update-open")?.getAttribute("aria-label") ?? null;
    bridge.emitUpdate(new AppUpdateState(AppUpdateStatus.Downloaded, "0.0.4", "0.0.5", 100, null, null, false, true));
    await fixture.whenStable();
    expect(label()).toBe("Restarts for update 0.0.5 when 2 replies finish");
    waitingFor.set(1);
    await fixture.whenStable();
    expect(label()).toBe("Restarts for update 0.0.5 when 1 reply finishes");
    waitingFor.set(null);
    await fixture.whenStable();
    expect(label()).toBe("Update 0.0.5 ready to install");
  });
});
