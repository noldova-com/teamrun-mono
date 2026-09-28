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
import { TerminalInputParams } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalInputParamsTests {
  private static readonly json: object = { terminalId: "terminal-1", data: "git status\r" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalInputParams.fromJson(TerminalInputParamsTests.json);

    Assert.areEqual(JSON.stringify(TerminalInputParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("git status\r", value.data);
  }

  @TestMethod
  public acceptsWhitespaceAndControlCharacters(): void {
    Assert.areEqual(" ", new TerminalInputParams("terminal-1", " ").data);
    Assert.areEqual("\u0003", new TerminalInputParams("terminal-1", "\u0003").data);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("terminalId", Assert.throws(() => new TerminalInputParams(" ", "x"), ArgumentException).parameterName);
    Assert.areEqual("data", Assert.throws(() => new TerminalInputParams("terminal-1", ""), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalInputParams.fromJson({ terminalId: "terminal-1", data: 13 }), JsonException);

    Assert.areEqual("$.data", exception.path);
  }
}
