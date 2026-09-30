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
import { TerminalLineRange, TerminalShellKind, TerminalSize, TerminalState } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalStateTests {
  private static readonly json: object = {
    id: "terminal-1",
    projectId: "project-1",
    shell: "PowerShell",
    shellKind: "PowerShell",
    conptyBuild: 26200,
    size: { columns: 100, rows: 30 },
    exitCode: null,
    restartCount: 2,
    sequence: 17,
    stored: { start: 0, end: 250 }
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalState.fromJson(TerminalStateTests.json);

    Assert.areEqual(JSON.stringify(TerminalStateTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("terminal-1", value.id);
    Assert.areEqual("project-1", value.projectId);
    Assert.areEqual("PowerShell", value.shell);
    Assert.areEqual(TerminalShellKind.PowerShell, value.shellKind);
    Assert.areEqual(26200, value.conptyBuild);
    Assert.areEqual(100, value.size.columns);
    Assert.isNull(value.exitCode);
    Assert.areEqual(2, value.restartCount);
    Assert.areEqual(17, value.sequence);
    Assert.areEqual(250, value.stored.end);
  }

  @TestMethod
  public carriesTheExitCodeOfAnEndedShell(): void {
    const value = TerminalState.fromJson({ ...TerminalStateTests.json, exitCode: -1073741510 });

    Assert.areEqual(-1073741510, value.exitCode);
  }

  @TestMethod
  public hasNoWindowsBuildOutsideWindows(): void {
    const value = TerminalState.fromJson({ ...TerminalStateTests.json, conptyBuild: null });

    Assert.isNull(value.conptyBuild);
    Assert.isNull(value.toJson()["conptyBuild"]);
  }

  @TestMethod
  public hasNoProjectInTheHomeFolder(): void {
    const value = TerminalState.fromJson({ ...TerminalStateTests.json, projectId: null });

    Assert.isNull(value.projectId);
    Assert.isNull(value.toJson()["projectId"]);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const size = new TerminalSize(80, 24);
    const stored = new TerminalLineRange(0, 0);

    Assert.areEqual("id", Assert.throws(() => new TerminalState(" ", "p", "bash", TerminalShellKind.Bash, null, size, null, 0, 0, stored), ArgumentException).parameterName);
    Assert.areEqual("projectId", Assert.throws(() => new TerminalState("t", "", "bash", TerminalShellKind.Bash, null, size, null, 0, 0, stored), ArgumentException).parameterName);
    Assert.areEqual("shell", Assert.throws(() => new TerminalState("t", "p", " ", TerminalShellKind.Bash, null, size, null, 0, 0, stored), ArgumentException).parameterName);
    Assert.areEqual("conptyBuild", Assert.throws(() => new TerminalState("t", "p", "bash", TerminalShellKind.Bash, 0, size, null, 0, 0, stored), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("conptyBuild", Assert.throws(() => new TerminalState("t", "p", "bash", TerminalShellKind.Bash, 1.5, size, null, 0, 0, stored), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("exitCode", Assert.throws(() => new TerminalState("t", "p", "bash", TerminalShellKind.Bash, null, size, 1.5, 0, 0, stored), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("restartCount", Assert.throws(() => new TerminalState("t", "p", "bash", TerminalShellKind.Bash, null, size, null, -1, 0, stored), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("restartCount", Assert.throws(() => new TerminalState("t", "p", "bash", TerminalShellKind.Bash, null, size, null, 0.5, 0, stored), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("sequence", Assert.throws(() => new TerminalState("t", "p", "bash", TerminalShellKind.Bash, null, size, null, 0, -1, stored), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("sequence", Assert.throws(() => new TerminalState("t", "p", "bash", TerminalShellKind.Bash, null, size, null, 0, 2.5, stored), ArgumentOutOfRangeException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const size = Assert.throws(() => TerminalState.fromJson({ ...TerminalStateTests.json, size: { columns: "wide", rows: 30 } }), JsonException);
    const stored = Assert.throws(() => TerminalState.fromJson({ ...TerminalStateTests.json, stored: { start: 0 } }), JsonException);
    const exitCode = Assert.throws(() => TerminalState.fromJson({ ...TerminalStateTests.json, exitCode: "0" }), JsonException);
    const shellKind = Assert.throws(() => TerminalState.fromJson({ ...TerminalStateTests.json, shellKind: "Tmux" }), JsonException);

    Assert.areEqual("$.size.columns", size.path);
    Assert.areEqual("$.stored.end", stored.path);
    Assert.areEqual("$.exitCode", exitCode.path);
    Assert.areEqual("$.shellKind", shellKind.path);
  }
}
