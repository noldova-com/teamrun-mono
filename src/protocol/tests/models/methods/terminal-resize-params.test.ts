/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalResizeParams, TerminalSize } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalResizeParamsTests {
  private static readonly json: object = { terminalId: "terminal-1", size: { columns: 60, rows: 12 } };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalResizeParams.fromJson(TerminalResizeParamsTests.json);

    Assert.areEqual(JSON.stringify(TerminalResizeParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("terminal-1", value.terminalId);
    Assert.areEqual(60, value.size.columns);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("terminalId", Assert.throws(() => new TerminalResizeParams("", new TerminalSize(80, 24)), ArgumentException).parameterName);
    Assert.throws(() => TerminalResizeParams.fromJson({ terminalId: "terminal-1", size: { columns: 0, rows: 12 } }), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalResizeParams.fromJson({ terminalId: "terminal-1", size: 12 }), JsonException);

    Assert.areEqual("$.size", exception.path);
  }
}
