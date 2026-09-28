/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalIdParams } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalIdParamsTests {
  private static readonly json: object = { terminalId: "terminal-1" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalIdParams.fromJson(TerminalIdParamsTests.json);

    Assert.areEqual(JSON.stringify(TerminalIdParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("terminal-1", value.terminalId);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("terminalId", Assert.throws(() => new TerminalIdParams(" "), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalIdParams.fromJson({ terminalId: "" }), JsonException);

    Assert.areEqual("$.terminalId", exception.path);
  }
}
