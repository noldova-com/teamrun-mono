/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import * as api from "@noldova/teamrun-desktop";

@TestClass
export class DesktopApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const expected = ["BridgeGateway", "DesktopInfo", "DesktopSettings", "Resources", "RuntimeConnection", "SenderInfo", "SenderPolicy", "TimedAttacher", "WindowState", "WindowStateStore"];

    expected.push("UpdateSettings", "UpdateService", "ReleaseUpdateInfo", "UpdateSignatureException", "WindowsSignatureVerifier");
    expected.push("RendererCheckpoint", "UpdateParticipant", "RestartCoordinator", "RestartProcesses", "UpdatePeer");
    Assert.areEqual([...expected].sort().join(","), Object.keys(api).sort().join(","));
  }
}
