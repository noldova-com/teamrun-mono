/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalExit } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalExitTests {
  @TestMethod
  public roundTripsTheExitCodeThroughJson(): void {
    const value = TerminalExit.fromJson({ code: -1073741510 });

    Assert.areEqual("{\"code\":-1073741510}", JSON.stringify(value.toJson()));
    Assert.areEqual(-1073741510, value.code);
  }

  @TestMethod
  public carriesAnExitWithoutACode(): void {
    const value = TerminalExit.fromJson({ code: null });

    Assert.isNull(value.code);
    Assert.areEqual("{\"code\":null}", JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsACodeThatIsNotAnInteger(): void {
    Assert.areEqual("code", Assert.throws(() => new TerminalExit(1.5), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("code", Assert.throws(() => new TerminalExit(Number.NaN), ArgumentOutOfRangeException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const text = Assert.throws(() => TerminalExit.fromJson({ code: "0" }), JsonException);
    const missing = Assert.throws(() => TerminalExit.fromJson({}, "$.exit"), JsonException);

    Assert.areEqual("$.code", text.path);
    Assert.areEqual("$.exit.code", missing.path);
  }
}
