/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { AppUpdateCommand, AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { SampleData } from "../../../fixtures/sample-data";
import { SettingsAboutComponent } from "../../../../src/app/components/settings-about/settings-about.component";

describe("SettingsAboutComponent", () => {
  it("opens the website and the latest release page in the browser", async () => {
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ imports: [SettingsAboutComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const fixture = TestBed.createComponent(SettingsAboutComponent);
    const element: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.textContent).toContain("Download the latest version");
    });

    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>("button"));
    buttons.find(t => t.textContent?.includes("teamrun.ai"))!.click();
    buttons.find(t => t.textContent?.includes("Download the latest version"))!.click();

    expect(bridge.openedUrls).toEqual(["https://teamrun.ai", "https://github.com/noldova-com/teamrun/releases/latest"]);
  });

  it("restarts to update through the restart choices, straight away when nothing is running", async () => {
    const bridge = SampleData.createBridge();
    bridge.updateState = new AppUpdateState(AppUpdateStatus.Downloaded, "0.0.4", "0.0.5", 100, null, null, false, true);
    TestBed.configureTestingModule({ imports: [SettingsAboutComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const fixture = TestBed.createComponent(SettingsAboutComponent);
    const element: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.textContent).toContain("Restart to update");
    });
    Array.from(element.querySelectorAll<HTMLButtonElement>("button")).find(t => t.textContent?.includes("Restart to update"))!.click();
    await vi.waitFor(() => expect(bridge.updateCommands).toContain(AppUpdateCommand.Install));
    expect(document.querySelector("tr-restart-choice-dialog")).toBeNull();
  });
});
