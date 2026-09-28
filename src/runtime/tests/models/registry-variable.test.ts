/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RegistryScope, RegistryVariable } from "@noldova/teamrun-runtime";

@TestClass
export class RegistryVariableTests {
  @TestMethod
  public keepsTheStoredValue(): void {
    const variable = new RegistryVariable(RegistryScope.User, "Path", "%USERPROFILE%\\bin", true);

    Assert.areEqual(RegistryScope.User, variable.scope);
    Assert.areEqual("Path", variable.name);
    Assert.areEqual("%USERPROFILE%\\bin", variable.value);
    Assert.isTrue(variable.isExpandable);
    Assert.areEqual("", new RegistryVariable(RegistryScope.System, "EMPTY", "", false).value);
  }

  @TestMethod
  public rejectsABlankName(): void {
    Assert.areEqual("name", Assert.throws(() => new RegistryVariable(RegistryScope.System, " ", "x", false), ArgumentException).parameterName);
  }
}
