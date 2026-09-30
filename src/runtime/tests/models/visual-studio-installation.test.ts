/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { VisualStudioInstallation } from "@noldova/teamrun-runtime";

@TestClass
export class VisualStudioInstallationTests {
  @TestMethod
  public keepsTheInstallation(): void {
    const installation = new VisualStudioInstallation("e7143cad", "Visual Studio Professional 2026", "C:\\VS");

    Assert.areEqual("e7143cad", installation.instanceId);
    Assert.areEqual("Visual Studio Professional 2026", installation.name);
    Assert.areEqual("C:\\VS", installation.path);
  }

  @TestMethod
  public rejectsBlankValues(): void {
    Assert.areEqual("instanceId", Assert.throws(() => new VisualStudioInstallation(" ", "n", "p"), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new VisualStudioInstallation("i", "", "p"), ArgumentException).parameterName);
    Assert.areEqual("path", Assert.throws(() => new VisualStudioInstallation("i", "n", " "), ArgumentException).parameterName);
  }
}
