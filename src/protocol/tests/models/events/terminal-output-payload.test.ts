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
import { TerminalLineRange, TerminalOutputPayload } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalOutputPayloadTests {
  private static readonly json: object = { terminalId: "terminal-1", sequence: 4, data: "hello\r\n", stored: { start: 0, end: 31 } };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalOutputPayload.fromJson(TerminalOutputPayloadTests.json);

    Assert.areEqual(JSON.stringify(TerminalOutputPayloadTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(4, value.sequence);
    Assert.areEqual("hello\r\n", value.data);
    Assert.areEqual(31, value.stored.end);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const stored = new TerminalLineRange(0, 0);

    Assert.areEqual("terminalId", Assert.throws(() => new TerminalOutputPayload(" ", 1, "x", stored), ArgumentException).parameterName);
    Assert.areEqual("sequence", Assert.throws(() => new TerminalOutputPayload("t", 0, "x", stored), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("sequence", Assert.throws(() => new TerminalOutputPayload("t", 1.5, "x", stored), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("data", Assert.throws(() => new TerminalOutputPayload("t", 1, "", stored), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalOutputPayload.fromJson({ ...TerminalOutputPayloadTests.json, stored: { start: "0", end: 1 } }), JsonException);

    Assert.areEqual("$.stored.start", exception.path);
  }
}
