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
import { TerminalShell, TerminalShellKind } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalShellTests {
  private static readonly json: object = { id: "wsl:Ubuntu", name: "Ubuntu", kind: "Wsl", isDefault: false };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = TerminalShell.fromJson(TerminalShellTests.json);

    Assert.areEqual(JSON.stringify(TerminalShellTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("wsl:Ubuntu", value.id);
    Assert.areEqual("Ubuntu", value.name);
    Assert.areEqual(TerminalShellKind.Wsl, value.kind);
    Assert.isFalse(value.isDefault);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    Assert.areEqual("id", Assert.throws(() => new TerminalShell(" ", "PowerShell", TerminalShellKind.PowerShell, true), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new TerminalShell("pwsh", "", TerminalShellKind.PowerShell, true), ArgumentException).parameterName);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const kind = Assert.throws(() => TerminalShell.fromJson({ ...TerminalShellTests.json, kind: "Tmux" }), JsonException);
    const isDefault = Assert.throws(() => TerminalShell.fromJson({ ...TerminalShellTests.json, isDefault: "yes" }), JsonException);

    Assert.areEqual("$.kind", kind.path);
    Assert.areEqual("$.isDefault", isDefault.path);
  }
}
