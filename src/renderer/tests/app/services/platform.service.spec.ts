/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { TestBed } from "@angular/core/testing";

import { SampleData } from "../../fixtures/sample-data";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { PlatformService } from "../../../src/app/services/platform.service";

describe("PlatformService", () => {
  it("marks the document on macOS and leaves it alone elsewhere", async () => {
    const bridge = SampleData.createBridge();
    bridge.info = { dataDirectory: "/data", productVersion: "0.0.1-test", platform: "darwin" };
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const document = TestBed.inject(DOCUMENT);

    const platform = TestBed.inject(PlatformService);
    expect(platform.isMac()).toBe(false);
    await platform.ready;
    expect(document.documentElement.classList.contains("tr-mac")).toBe(true);
    expect(platform.isMac()).toBe(true);
    document.documentElement.classList.remove("tr-mac");

    TestBed.resetTestingModule();
    const windows = SampleData.createBridge();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: windows }] });
    await TestBed.inject(PlatformService).ready;
    expect(document.documentElement.classList.contains("tr-mac")).toBe(false);
    expect(TestBed.inject(PlatformService).isMac()).toBe(false);
  });
});
