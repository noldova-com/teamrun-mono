/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalScreen } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalScreenTests {
  private static readonly state: object = {
    id: "terminal-1",
    projectId: "project-1",
    shell: "zsh",
    conptyBuild: null,
    size: { columns: 80, rows: 24 },
    exitCode: 0,
    restartCount: 0,
    sequence: 3,
    stored: { start: 0, end: 0 }
  };
  private static readonly json: object = {
    state: TerminalScreenTests.state,
    screen: "\u001b[31m$\u001b[0m ls\r\n"
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalScreen.fromJson(TerminalScreenTests.json);

    Assert.areEqual(JSON.stringify(TerminalScreenTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("zsh", value.state.shell);
    Assert.areEqual("\u001b[31m$\u001b[0m ls\r\n", value.screen);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const state = Assert.throws(() => TerminalScreen.fromJson({ state: { ...TerminalScreenTests.state, shell: " " }, screen: "" }), JsonException);
    const screen = Assert.throws(() => TerminalScreen.fromJson({ ...TerminalScreenTests.json, screen: null }), JsonException);

    Assert.areEqual("$.state.shell", state.path);
    Assert.areEqual("$.screen", screen.path);
  }
}
