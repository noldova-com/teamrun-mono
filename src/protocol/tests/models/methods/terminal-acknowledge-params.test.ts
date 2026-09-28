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
import { TerminalAcknowledgeParams } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalAcknowledgeParamsTests {
  private static readonly json: object = { terminalId: "terminal-1", characters: 4096 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalAcknowledgeParams.fromJson(TerminalAcknowledgeParamsTests.json);

    Assert.areEqual(JSON.stringify(TerminalAcknowledgeParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("terminal-1", value.terminalId);
    Assert.areEqual(4096, value.characters);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("terminalId", Assert.throws(() => new TerminalAcknowledgeParams(" ", 1), ArgumentException).parameterName);
    Assert.areEqual("characters", Assert.throws(() => new TerminalAcknowledgeParams("terminal-1", 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("characters", Assert.throws(() => new TerminalAcknowledgeParams("terminal-1", 1.5), ArgumentOutOfRangeException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalAcknowledgeParams.fromJson({ terminalId: "terminal-1", characters: "all" }), JsonException);

    Assert.areEqual("$.characters", exception.path);
  }
}
