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
import { TerminalOpenParams, TerminalSize } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalOpenParamsTests {
  private static readonly json: object = { projectId: "project-1", shellId: "wsl:Ubuntu", size: { columns: 132, rows: 40 } };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalOpenParams.fromJson(TerminalOpenParamsTests.json);

    Assert.areEqual(JSON.stringify(TerminalOpenParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("project-1", value.projectId);
    Assert.areEqual("wsl:Ubuntu", value.shellId);
    Assert.areEqual(132, value.size.columns);
    Assert.areEqual(40, value.size.rows);
  }

  @TestMethod
  public opensTheDefaultShellInTheHomeFolderWithoutAProjectOrShell(): void {
    const json = { projectId: null, shellId: null, size: { columns: 80, rows: 24 } };
    const value = TerminalOpenParams.fromJson(json);

    Assert.isNull(value.projectId);
    Assert.isNull(value.shellId);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("projectId", Assert.throws(() => new TerminalOpenParams(" ", null, new TerminalSize(80, 24)), ArgumentException).parameterName);
    Assert.areEqual("shellId", Assert.throws(() => new TerminalOpenParams(null, "", new TerminalSize(80, 24)), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalOpenParams.fromJson({ projectId: "project-1", shellId: null, size: { columns: 80 } }), JsonException);

    Assert.areEqual("$.size.rows", exception.path);
  }
}
