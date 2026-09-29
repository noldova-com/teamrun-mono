/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalShellKind } from "@noldova/teamrun-protocol";
import { Shell } from "@noldova/teamrun-runtime";

@TestClass
export class ShellTests {
  @TestMethod
  public keepsItsIdNameKindExecutableAndACopyOfItsArguments(): void {
    const args = ["-l"];
    const shell = new Shell("/bin/zsh", "zsh", TerminalShellKind.Zsh, "/bin/zsh", args);

    args.push("-i");

    Assert.areEqual("/bin/zsh", shell.id);
    Assert.areEqual("zsh", shell.name);
    Assert.areEqual(TerminalShellKind.Zsh, shell.kind);
    Assert.areEqual("/bin/zsh", shell.executable);
    Assert.areEqual("-l", shell.arguments.join(" "));
  }

  @TestMethod
  public rejectsABlankIdNameOrExecutable(): void {
    Assert.areEqual("id", Assert.throws(() => new Shell("", "sh", TerminalShellKind.Other, "/bin/sh", []), ArgumentException).parameterName);
    Assert.areEqual("name", Assert.throws(() => new Shell("/bin/sh", " ", TerminalShellKind.Other, "/bin/sh", []), ArgumentException).parameterName);
    Assert.areEqual("executable", Assert.throws(() => new Shell("/bin/sh", "sh", TerminalShellKind.Other, "", []), ArgumentException).parameterName);
  }
}
