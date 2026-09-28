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
import { TerminalTextRun, TerminalTextStyle } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalTextRunTests {
  private static readonly json: object = { length: 5, foreground: 1, background: 0x1102030, style: 9 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalTextRun.fromJson(TerminalTextRunTests.json);

    Assert.areEqual(JSON.stringify(TerminalTextRunTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(5, value.length);
    Assert.areEqual(1, value.foreground);
    Assert.areEqual(0x1102030, value.background);
    Assert.areEqual(TerminalTextStyle.Bold | TerminalTextStyle.Underline, value.style);
  }

  @TestMethod
  public acceptsDefaultPaletteAndRgbColors(): void {
    for (const color of [-1, 0, 255, 0x1000000, 0x1ffffff]) {
      Assert.areEqual(color, new TerminalTextRun(1, color, -1, 0).foreground);
      Assert.areEqual(color, new TerminalTextRun(1, -1, color, 0).background);
    }
    Assert.areEqual(0x1ff, new TerminalTextRun(1, -1, -1, 0x1ff).style);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new TerminalTextRun(0, -1, -1, 0), ArgumentOutOfRangeException);
    Assert.throws(() => new TerminalTextRun(1.5, -1, -1, 0), ArgumentOutOfRangeException);
    for (const color of [-2, 256, 0xffffff, 0x2000000, 1.5]) {
      Assert.areEqual("foreground", Assert.throws(() => new TerminalTextRun(1, color, -1, 0), ArgumentOutOfRangeException).parameterName);
      Assert.areEqual("background", Assert.throws(() => new TerminalTextRun(1, -1, color, 0), ArgumentOutOfRangeException).parameterName);
    }
    for (const style of [-1, 512, 0.5])
      Assert.areEqual("style", Assert.throws(() => new TerminalTextRun(1, -1, -1, style), ArgumentOutOfRangeException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalTextRun.fromJson({ length: 1, foreground: "red", background: -1, style: 0 }), JsonException);

    Assert.areEqual("$.foreground", exception.path);
  }
}
