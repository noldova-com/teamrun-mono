/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Shell } from "@noldova/teamrun-runtime";

@TestClass
export class ShellTests {
  @TestMethod
  public keepsItsNameExecutableAndACopyOfItsArguments(): void {
    const args = ["-l"];
    const shell = new Shell("zsh", "/bin/zsh", args);

    args.push("-i");

    Assert.areEqual("zsh", shell.name);
    Assert.areEqual("/bin/zsh", shell.executable);
    Assert.areEqual("-l", shell.arguments.join(" "));
  }

  @TestMethod
  public rejectsABlankNameOrExecutable(): void {
    Assert.areEqual("name", Assert.throws(() => new Shell(" ", "/bin/sh", []), ArgumentException).parameterName);
    Assert.areEqual("executable", Assert.throws(() => new Shell("sh", "", []), ArgumentException).parameterName);
  }
}
