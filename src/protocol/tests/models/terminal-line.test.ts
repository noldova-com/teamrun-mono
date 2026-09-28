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
import { TerminalLine, TerminalTextRun } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalLineTests {
  private static readonly json: object = {
    text: "ok done",
    wrapped: true,
    runs: [{ length: 2, foreground: 2, background: -1, style: 1 }, { length: 5, foreground: -1, background: -1, style: 0 }]
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalLine.fromJson(TerminalLineTests.json);

    Assert.areEqual(JSON.stringify(TerminalLineTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("ok done", value.text);
    Assert.isTrue(value.wrapped);
    Assert.areEqual(2, value.runs.length);
  }

  @TestMethod
  public keepsABlankLineWithoutRuns(): void {
    const value = new TerminalLine("", false, []);

    Assert.areEqual(0, value.runs.length);
    Assert.isFalse(value.wrapped);
  }

  @TestMethod
  public copiesItsRuns(): void {
    const runs = [new TerminalTextRun(2, -1, -1, 0)];
    const value = new TerminalLine("hi", false, runs);

    runs.push(new TerminalTextRun(1, -1, -1, 0));

    Assert.areEqual(1, value.runs.length);
  }

  @TestMethod
  public rejectsRunsThatDoNotCoverTheText(): void {
    Assert.areEqual("runs", Assert.throws(() => new TerminalLine("abc", false, [new TerminalTextRun(2, -1, -1, 0)]), ArgumentException).parameterName);
    Assert.throws(() => new TerminalLine("ab", false, [new TerminalTextRun(3, -1, -1, 0)]), ArgumentException);
    Assert.throws(() => new TerminalLine("ab", false, []), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const json = { text: "ab", wrapped: false, runs: [{ length: "2", foreground: -1, background: -1, style: 0 }] };

    const exception = Assert.throws(() => TerminalLine.fromJson(json), JsonException);

    Assert.areEqual("$.runs.0.length", exception.path);
  }
}
