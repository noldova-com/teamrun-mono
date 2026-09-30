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
import { TerminalLineRange } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalLineRangeTests {
  private static readonly json: object = { start: 40, end: 1200, dropped: 25 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalLineRange.fromJson(TerminalLineRangeTests.json);

    Assert.areEqual(JSON.stringify(TerminalLineRangeTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual(40, value.start);
    Assert.areEqual(1200, value.end);
    Assert.areEqual(25, value.dropped);
  }

  @TestMethod
  public allowsAnEmptyRange(): void {
    const value = new TerminalLineRange(7, 7);

    Assert.areEqual(7, value.start);
    Assert.areEqual(7, value.end);
    Assert.areEqual(0, value.dropped);
  }

  @TestMethod
  public allowsEveryLineBeforeTheStartToBeDropped(): void {
    Assert.areEqual(7, new TerminalLineRange(7, 9, 7).dropped);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.throws(() => new TerminalLineRange(-1, 3), ArgumentOutOfRangeException);
    Assert.throws(() => new TerminalLineRange(1.5, 3), ArgumentOutOfRangeException);
    Assert.throws(() => new TerminalLineRange(1, 2.5), ArgumentOutOfRangeException);
    Assert.areEqual("end", Assert.throws(() => new TerminalLineRange(5, 4), ArgumentException).parameterName);
    Assert.areEqual("dropped", Assert.throws(() => new TerminalLineRange(5, 6, -1), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("dropped", Assert.throws(() => new TerminalLineRange(5, 6, 0.5), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("dropped", Assert.throws(() => new TerminalLineRange(5, 6, 6), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalLineRange.fromJson({ start: 0, end: null }), JsonException);

    Assert.areEqual("$.end", exception.path);
    Assert.areEqual("$.dropped", Assert.throws(() => TerminalLineRange.fromJson({ start: 0, end: 0 }), JsonException).path);
  }
}
