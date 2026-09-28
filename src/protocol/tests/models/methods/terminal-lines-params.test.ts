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
import { TerminalLinesParams } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalLinesParamsTests {
  private static readonly json: object = { terminalId: "terminal-1", start: 1500, limit: 200 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalLinesParams.fromJson(TerminalLinesParamsTests.json);

    Assert.areEqual(JSON.stringify(TerminalLinesParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(1500, value.start);
    Assert.areEqual(200, value.limit);
  }

  @TestMethod
  public acceptsTheLimits(): void {
    Assert.areEqual(0, new TerminalLinesParams("terminal-1", 0, 1).start);
    Assert.areEqual(500, new TerminalLinesParams("terminal-1", 0, 500).limit);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("terminalId", Assert.throws(() => new TerminalLinesParams(" ", 0, 10), ArgumentException).parameterName);
    Assert.areEqual("start", Assert.throws(() => new TerminalLinesParams("terminal-1", -1, 10), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("start", Assert.throws(() => new TerminalLinesParams("terminal-1", 0.5, 10), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("limit", Assert.throws(() => new TerminalLinesParams("terminal-1", 0, 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("limit", Assert.throws(() => new TerminalLinesParams("terminal-1", 0, 501), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("limit", Assert.throws(() => new TerminalLinesParams("terminal-1", 0, 2.5), ArgumentOutOfRangeException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalLinesParams.fromJson({ terminalId: "terminal-1", start: 0, limit: "all" }), JsonException);

    Assert.areEqual("$.limit", exception.path);
  }
}
