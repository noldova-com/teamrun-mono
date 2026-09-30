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
import { Resources, TerminalOpenParams, TerminalSize } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalOpenParamsTests {
  private static readonly json: object = { projectId: "project-1", shellId: "wsl:Ubuntu", size: { columns: 132, rows: 40 }, storedLimit: 52428800 };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalOpenParams.fromJson(TerminalOpenParamsTests.json);

    Assert.areEqual(JSON.stringify(TerminalOpenParamsTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("project-1", value.projectId);
    Assert.areEqual("wsl:Ubuntu", value.shellId);
    Assert.areEqual(132, value.size.columns);
    Assert.areEqual(40, value.size.rows);
    Assert.areEqual(52428800, value.storedLimit);
  }

  @TestMethod
  public opensTheDefaultShellInTheHomeFolderWithoutAProjectOrShell(): void {
    const json = { projectId: null, shellId: null, size: { columns: 80, rows: 24 }, storedLimit: 104857600 };
    const value = TerminalOpenParams.fromJson(json);

    Assert.isNull(value.projectId);
    Assert.isNull(value.shellId);
    Assert.areEqual(Resources.defaultTerminalStoredLimit, new TerminalOpenParams(null, null, new TerminalSize(80, 24)).storedLimit);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("projectId", Assert.throws(() => new TerminalOpenParams(" ", null, new TerminalSize(80, 24)), ArgumentException).parameterName);
    Assert.areEqual("shellId", Assert.throws(() => new TerminalOpenParams(null, "", new TerminalSize(80, 24)), ArgumentException).parameterName);
    for (const limit of [Resources.minimumTerminalStoredLimit - 1, Resources.maximumTerminalStoredLimit + 1, Resources.defaultTerminalStoredLimit + 0.5])
      Assert.areEqual("storedLimit", Assert.throws(() => new TerminalOpenParams(null, null, new TerminalSize(80, 24), limit), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual(Resources.minimumTerminalStoredLimit, new TerminalOpenParams(null, null, new TerminalSize(80, 24), Resources.minimumTerminalStoredLimit).storedLimit);
    Assert.areEqual(Resources.maximumTerminalStoredLimit, new TerminalOpenParams(null, null, new TerminalSize(80, 24), Resources.maximumTerminalStoredLimit).storedLimit);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => TerminalOpenParams.fromJson({ projectId: "project-1", shellId: null, size: { columns: 80 } }), JsonException);

    Assert.areEqual("$.size.rows", exception.path);
    Assert.areEqual("$.storedLimit", Assert.throws(() => TerminalOpenParams.fromJson({ projectId: null, shellId: null, size: { columns: 80, rows: 24 } }), JsonException).path);
  }
}
