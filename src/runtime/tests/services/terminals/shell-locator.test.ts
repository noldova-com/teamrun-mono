/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstatSync } from "node:fs";

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode } from "@noldova/teamrun-protocol";
import { ShellEnvironment, ShellLocator } from "@noldova/teamrun-runtime";

@TestClass
export class ShellLocatorTests {
  @TestMethod
  public prefersPowerShell7FromThePathOnWindows(): void {
    const locator = new ShellLocator("win32", () => null, t => t === "C:\\Tools\\pwsh.exe");

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ Path: "C:\\Windows;;C:\\Tools\\", ProgramFiles: "C:\\Program Files" }));

    Assert.areEqual("PowerShell", shell.name);
    Assert.areEqual("C:\\Tools\\pwsh.exe", shell.executable);
    Assert.areEqual(0, shell.arguments.length);
  }

  @TestMethod
  public findsPowerShell7InProgramFilesWhenThePathLacksIt(): void {
    const locator = new ShellLocator("win32", () => null, t => t === "C:\\Program Files\\PowerShell\\7\\pwsh.exe");

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ ProgramFiles: "C:\\Program Files", SystemRoot: "C:\\Windows" }));

    Assert.areEqual("C:\\Program Files\\PowerShell\\7\\pwsh.exe", shell.executable);
  }

  @TestMethod
  public findsTheMicrosoftStoreAliasOfPowerShell7(): void {
    const alias = "C:\\Users\\Person\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe";
    const locator = new ShellLocator("win32", () => null, t => t === alias);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ LOCALAPPDATA: "C:\\Users\\Person\\AppData\\Local", SystemRoot: "C:\\Windows" }));

    Assert.areEqual("PowerShell", shell.name);
    Assert.areEqual(alias, shell.executable);
  }

  @TestMethod
  public fallsBackToWindowsPowerShell(): void {
    const locator = new ShellLocator("win32", () => null, () => false);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ Path: "C:\\Windows", SystemRoot: "D:\\Windows" }));

    Assert.areEqual("Windows PowerShell", shell.name);
    Assert.areEqual("D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", shell.executable);
  }

  @TestMethod
  public refusesWhenWindowsDoesNotNameItsFolder(): void {
    const locator = new ShellLocator("win32", () => null, () => false);

    const exception = Assert.throws(() => locator.findDefault(ShellLocatorTests.windowsEnvironment({})), ServiceException);

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
  }

  @TestMethod
  public startsTheLoginShellAsALoginShellElsewhere(): void {
    const locator = new ShellLocator("darwin", () => "/bin/zsh", () => false);

    const shell = locator.findDefault(new ShellEnvironment(false));

    Assert.areEqual("zsh", shell.name);
    Assert.areEqual("/bin/zsh", shell.executable);
    Assert.areEqual("-l", shell.arguments.join(" "));
  }

  @TestMethod
  public usesTheShellVariableAndThenShWhenNoLoginShellIsRecorded(): void {
    const environment = new ShellEnvironment(false);
    environment.set("SHELL", "/usr/bin/fish");
    const failing = new ShellLocator("linux", () => { throw new Error("no user record"); }, () => false);
    const blank = new ShellLocator("linux", () => " ", () => false);
    const missing = new ShellLocator("linux", () => null, () => false);

    Assert.areEqual("/usr/bin/fish", failing.findDefault(environment).executable);
    Assert.areEqual("fish", blank.findDefault(environment).name);
    Assert.areEqual("/bin/sh", missing.findDefault(new ShellEnvironment(false)).executable);
  }

  @TestMethod
  public findsAShellThatExistsOnThisComputer(): void {
    const environment = new ShellEnvironment(process.platform === "win32");
    for (const [name, value] of Object.entries(process.env))
      if (value !== undefined)
        environment.set(name, value);

    const shell = ShellLocator.fromPlatform(process.platform).findDefault(environment);
    const loginShell = ShellLocator.fromPlatform("linux").findDefault(new ShellEnvironment(false));

    Assert.isDefined(lstatSync(shell.executable, { throwIfNoEntry: false }));
    Assert.areEqual("-l", loginShell.arguments.join(" "));
  }

  @TestMethod
  public skipsSearchPathEntriesItCannotInspect(): void {
    const environment = ShellLocatorTests.windowsEnvironment({ Path: "C:\\bad\u0000folder", SystemRoot: "C:\\Windows" });

    const shell = ShellLocator.fromPlatform("win32").findDefault(environment);

    Assert.areEqual("Windows PowerShell", shell.name);
  }

  private static windowsEnvironment(variables: Record<string, string>): ShellEnvironment {
    const environment = new ShellEnvironment(true);
    for (const [name, value] of Object.entries(variables))
      environment.set(name, value);
    return environment;
  }
}
