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
import { TerminalSize } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalSizeTests {
  private static readonly json: object = { columns: 120, rows: 30 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalSize.fromJson(TerminalSizeTests.json);

    Assert.areEqual(JSON.stringify(TerminalSizeTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(120, value.columns);
    Assert.areEqual(30, value.rows);
  }

  @TestMethod
  public comparesColumnsAndRows(): void {
    const size = new TerminalSize(80, 24);

    Assert.isTrue(size.equals(new TerminalSize(80, 24)));
    Assert.isFalse(size.equals(new TerminalSize(81, 24)));
    Assert.isFalse(size.equals(new TerminalSize(80, 25)));
  }

  @TestMethod
  public acceptsTheSmallestAndLargestSizes(): void {
    Assert.areEqual(2, new TerminalSize(2, 1).columns);
    Assert.areEqual(1, new TerminalSize(2, 1).rows);
    Assert.areEqual(1000, new TerminalSize(1000, 1000).columns);
    Assert.areEqual(1000, new TerminalSize(1000, 1000).rows);
  }

  @TestMethod
  public rejectsSizesOutOfRange(): void {
    for (const [columns, rows] of [[1, 24], [1001, 24], [80.5, 24], [80, 0], [80, 1001], [80, 24.5]] as const)
      Assert.throws(() => new TerminalSize(columns, rows), ArgumentOutOfRangeException);
  }

  @TestMethod
  public fitsASpaceToTheNearestAllowedSize(): void {
    Assert.isTrue(TerminalSize.fitting(120.6, 30.2).equals(new TerminalSize(120, 30)));
    Assert.isTrue(TerminalSize.fitting(0, 0).equals(new TerminalSize(2, 1)));
    Assert.isTrue(TerminalSize.fitting(5000, 2000).equals(new TerminalSize(1000, 1000)));
    Assert.throws(() => TerminalSize.fitting(Number.NaN, 24), ArgumentOutOfRangeException);
    Assert.throws(() => TerminalSize.fitting(80, Number.NaN), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalSize.fromJson({ columns: 80, rows: "24" }), JsonException);

    Assert.areEqual("$.rows", exception.path);
  }
}
