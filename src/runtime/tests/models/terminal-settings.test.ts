/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalSettings } from "@noldova/teamrun-runtime";

@TestClass
export class TerminalSettingsTests {
  @TestMethod
  public adaptsToTheWindowsBuildAndEndsShellsWithoutASignalThere(): void {
    const settings = TerminalSettings.forPlatform("win32", "10.0.26200");

    Assert.areEqual(26200, settings.windowsBuild);
    Assert.isUndefined(settings.forceSignal);
    Assert.areEqual(2000, settings.endMilliseconds);
    Assert.areEqual(512 * 1024, settings.highWatermark);
    Assert.areEqual(128 * 1024, settings.lowWatermark);
  }

  @TestMethod
  public forcesShellsToEndWithSigkillElsewhere(): void {
    for (const platform of ["linux", "darwin"]) {
      const settings = TerminalSettings.forPlatform(platform, "24.1.0");

      Assert.isNull(settings.windowsBuild);
      Assert.areEqual("SIGKILL", settings.forceSignal);
    }
  }

  @TestMethod
  public rejectsInvalidWaitsAndWatermarks(): void {
    Assert.areEqual("endMilliseconds", Assert.throws(() => new TerminalSettings(null, "SIGKILL", 0, 10, 1), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("highWatermark", Assert.throws(() => new TerminalSettings(null, "SIGKILL", 10, 0, 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("lowWatermark", Assert.throws(() => new TerminalSettings(null, "SIGKILL", 10, 10, 10), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("lowWatermark", Assert.throws(() => new TerminalSettings(null, "SIGKILL", 10, 10, -1), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("lowWatermark", Assert.throws(() => new TerminalSettings(null, "SIGKILL", 10, 10, 0.5), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual(0, new TerminalSettings(null, undefined, 1, 1, 0).lowWatermark);
  }
}
