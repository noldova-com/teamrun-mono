/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ShellEnvironment } from "@noldova/teamrun-runtime";

@TestClass
export class ShellEnvironmentTests {
  @TestMethod
  public ignoresTheCaseOfNamesWhenAskedAndKeepsTheLastSpelling(): void {
    const environment = new ShellEnvironment(true);

    environment.set("Path", "C:\\one");
    environment.set("PATH", "C:\\two");
    environment.set("TEMP", "C:\\temp");
    environment.delete("temp");

    Assert.areEqual("C:\\two", environment.get("path"));
    Assert.isUndefined(environment.get("TEMP"));
    Assert.areEqual(JSON.stringify({ PATH: "C:\\two" }), JSON.stringify(environment.toRecord()));
  }

  @TestMethod
  public keepsNamesThatDifferOnlyInCaseApartOtherwise(): void {
    const environment = new ShellEnvironment(false);

    environment.set("Path", "/one");
    environment.set("PATH", "/two");
    environment.delete("path");

    Assert.areEqual("/one", environment.get("Path"));
    Assert.areEqual("/two", environment.get("PATH"));
    Assert.isUndefined(environment.get("path"));
    Assert.areEqual(JSON.stringify({ Path: "/one", PATH: "/two" }), JSON.stringify(environment.toRecord()));
  }
}
