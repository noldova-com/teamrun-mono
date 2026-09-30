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
import { TerminalLine, TerminalLinePage, TerminalLineRange, TerminalTextRun } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalLinePageTests {
  private static readonly json: object = {
    start: 10,
    lines: [
      { text: "one", wrapped: false, runs: [{ length: 3, foreground: -1, background: -1, style: 0 }] },
      { text: "", wrapped: false, runs: [] }
    ],
    stored: { start: 10, end: 12, dropped: 4 }
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalLinePage.fromJson(TerminalLinePageTests.json);

    Assert.areEqual(JSON.stringify(TerminalLinePageTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(10, value.start);
    Assert.areEqual("one", value.lines[0]?.text);
    Assert.areEqual(12, value.stored.end);
  }

  @TestMethod
  public allowsAnEmptyPageAtTheEnd(): void {
    const value = new TerminalLinePage(12, [], new TerminalLineRange(10, 12));

    Assert.areEqual(0, value.lines.length);
  }

  @TestMethod
  public copiesItsLines(): void {
    const lines = [new TerminalLine("a", false, [new TerminalTextRun(1, -1, -1, 0)])];
    const value = new TerminalLinePage(0, lines, new TerminalLineRange(0, 2));

    lines.push(new TerminalLine("", false, []));

    Assert.areEqual(1, value.lines.length);
  }

  @TestMethod
  public rejectsPagesOutsideTheStoredLines(): void {
    const line = new TerminalLine("", false, []);
    const stored = new TerminalLineRange(10, 12);

    Assert.areEqual("lines", Assert.throws(() => new TerminalLinePage(9, [], stored), ArgumentException).parameterName);
    Assert.throws(() => new TerminalLinePage(11, [line, line], stored), ArgumentException);
    Assert.throws(() => new TerminalLinePage(13, [], stored), ArgumentException);
    Assert.throws(() => new TerminalLinePage(10.5, [], stored), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const json = { start: 0, lines: [{ text: 5, wrapped: false, runs: [] }], stored: { start: 0, end: 1, dropped: 0 } };

    const exception = Assert.throws(() => TerminalLinePage.fromJson(json), JsonException);

    Assert.areEqual("$.lines.0.text", exception.path);
  }
}
