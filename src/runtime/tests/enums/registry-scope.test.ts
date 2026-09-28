/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RegistryScope } from "@noldova/teamrun-runtime";

@TestClass
export class RegistryScopeTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("System", RegistryScope.System);
    Assert.areEqual("User", RegistryScope.User);
    Assert.areEqual("Session", RegistryScope.Session);
  }
}
