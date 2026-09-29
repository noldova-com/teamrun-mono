/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstatSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, TerminalShellKind } from "@noldova/teamrun-protocol";
import { ShellEnvironment, ShellLocator } from "@noldova/teamrun-runtime";

@TestClass
export class ShellLocatorTests {
  @TestMethod
  public prefersPowerShell7FromThePathOnWindows(): void {
    const locator = new ShellLocator("win32", () => null, t => t === "C:\\Tools\\pwsh.exe", () => null);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ Path: "C:\\Windows;;C:\\Tools\\", ProgramFiles: "C:\\Program Files" }));

    Assert.areEqual("PowerShell", shell.name);
    Assert.areEqual("C:\\Tools\\pwsh.exe", shell.executable);
    Assert.areEqual(0, shell.arguments.length);
  }

  @TestMethod
  public findsPowerShell7InProgramFilesWhenThePathLacksIt(): void {
    const locator = new ShellLocator("win32", () => null, t => t === "C:\\Program Files\\PowerShell\\7\\pwsh.exe", () => null);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ ProgramFiles: "C:\\Program Files", SystemRoot: "C:\\Windows" }));

    Assert.areEqual("C:\\Program Files\\PowerShell\\7\\pwsh.exe", shell.executable);
  }

  @TestMethod
  public findsTheMicrosoftStoreAliasOfPowerShell7(): void {
    const alias = "C:\\Users\\Person\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe";
    const locator = new ShellLocator("win32", () => null, t => t === alias, () => null);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ LOCALAPPDATA: "C:\\Users\\Person\\AppData\\Local", SystemRoot: "C:\\Windows" }));

    Assert.areEqual("PowerShell", shell.name);
    Assert.areEqual(alias, shell.executable);
  }

  @TestMethod
  public fallsBackToWindowsPowerShell(): void {
    const locator = new ShellLocator("win32", () => null, () => false, () => null);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ Path: "C:\\Windows", SystemRoot: "D:\\Windows" }));

    Assert.areEqual("Windows PowerShell", shell.name);
    Assert.areEqual("D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", shell.executable);
  }

  @TestMethod
  public refusesWhenWindowsDoesNotNameItsFolder(): void {
    const locator = new ShellLocator("win32", () => null, () => false, () => null);

    const exception = Assert.throws(() => locator.findDefault(ShellLocatorTests.windowsEnvironment({})), ServiceException);

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
  }

  @TestMethod
  public startsTheLoginShellAsALoginShellElsewhere(): void {
    const locator = new ShellLocator("darwin", () => "/bin/zsh", () => false, () => null);

    const shell = locator.findDefault(new ShellEnvironment(false));

    Assert.areEqual("zsh", shell.name);
    Assert.areEqual("/bin/zsh", shell.executable);
    Assert.areEqual("-l", shell.arguments.join(" "));
  }

  @TestMethod
  public usesTheShellVariableAndThenShWhenNoLoginShellIsRecorded(): void {
    const environment = new ShellEnvironment(false);
    environment.set("SHELL", "/usr/bin/fish");
    const failing = new ShellLocator("linux", () => { throw new Error("no user record"); }, () => false, () => null);
    const blank = new ShellLocator("linux", () => " ", () => false, () => null);
    const missing = new ShellLocator("linux", () => null, () => false, () => null);

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
    const shells = ShellLocator.fromPlatform(process.platform).findAll(environment);
    const loginShell = ShellLocator.fromPlatform("linux").findDefault(new ShellEnvironment(false));

    Assert.isDefined(lstatSync(shell.executable, { throwIfNoEntry: false }));
    Assert.isTrue(shells.some(t => t.id === shell.id));
    Assert.isTrue(shells.every(t => !Object.isUndefined(lstatSync(t.executable, { throwIfNoEntry: false }))));
    Assert.areEqual("-l", loginShell.arguments.join(" "));
  }

  @TestMethod
  public listsTheInstalledWindowsShellsWithTheDefaultFirst(): void {
    const installed = ["C:\\Program Files\\PowerShell\\7\\pwsh.exe", "C:\\Program Files\\Git\\bin\\bash.exe"];
    const locator = new ShellLocator("win32", () => null, t => installed.includes(t), () => null);

    const shells = locator.findAll(ShellLocatorTests.windowsEnvironment({ ProgramFiles: "C:\\Program Files", SystemRoot: "C:\\Windows" }));

    Assert.areEqual("pwsh,windows-powershell,cmd,git-bash", shells.map(t => t.id).join(","));
    Assert.areEqual("PowerShell,Windows PowerShell,Command Prompt,Git Bash", shells.map(t => t.name).join(","));
    Assert.areEqual([TerminalShellKind.PowerShell, TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt, TerminalShellKind.Bash].join(","),
      shells.map(t => t.kind).join(","));
    Assert.areEqual("C:\\Windows\\System32\\cmd.exe", shells[2]?.executable);
    Assert.areEqual("C:\\Program Files\\Git\\bin\\bash.exe", shells[3]?.executable);
    Assert.areEqual("--login -i", shells[3]?.arguments.join(" "));
  }

  @TestMethod
  public findsGitBashThroughThePathAndItsOtherInstallFolders(): void {
    const onPath = new ShellLocator("win32", () => null,
      t => ["D:\\Tools\\Git\\cmd\\git.exe", "D:\\Tools\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\bin\\bash.exe"].includes(t), () => null);
    const forUser = new ShellLocator("win32", () => null, t => t === "C:\\Users\\Person\\AppData\\Local\\Programs\\Git\\bin\\bash.exe", () => null);
    const for32Bit = new ShellLocator("win32", () => null, t => t === "C:\\Program Files (x86)\\Git\\bin\\bash.exe", () => null);
    const environment = ShellLocatorTests.windowsEnvironment({
      Path: "D:\\Other\\cmd;D:\\Tools\\Git\\cmd\\", ProgramFiles: "C:\\Program Files", "ProgramFiles(x86)": "C:\\Program Files (x86)",
      LOCALAPPDATA: "C:\\Users\\Person\\AppData\\Local", SystemRoot: "C:\\Windows"
    });
    const gitBash = (locator: ShellLocator): string | undefined => locator.findAll(environment).find(t => t.id === "git-bash")?.executable;

    Assert.areEqual("D:\\Tools\\Git\\bin\\bash.exe", gitBash(onPath));
    Assert.areEqual("C:\\Users\\Person\\AppData\\Local\\Programs\\Git\\bin\\bash.exe", gitBash(forUser));
    Assert.areEqual("C:\\Program Files (x86)\\Git\\bin\\bash.exe", gitBash(for32Bit));
    Assert.areEqual("windows-powershell,cmd", new ShellLocator("win32", () => null, () => false, () => null).findAll(environment).map(t => t.id).join(","));
  }

  @TestMethod
  public refusesToListWindowsShellsWhenWindowsDoesNotNameItsFolder(): void {
    const locator = new ShellLocator("win32", () => null, () => true, () => null);

    const exception = Assert.throws(() => locator.findAll(ShellLocatorTests.windowsEnvironment({ ProgramFiles: "C:\\Program Files" })), ServiceException);

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
  }

  @TestMethod
  public listsTheLoginShellFirstAndThenTheOtherListedShellsElsewhere(): void {
    const listed = "# List of acceptable shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/zsh\n/usr/bin/tmux\n/usr/local/bin/fish\n/opt/missing/ksh\n\nrelative/dash\n";
    const locator = new ShellLocator("darwin", () => "/bin/zsh", t => t !== "/opt/missing/ksh", () => listed);
    const bare = new ShellLocator("linux", () => "/bin/bash", () => true, () => null);

    const shells = locator.findAll(new ShellEnvironment(false));

    Assert.areEqual("/bin/zsh,/bin/sh,/bin/bash,/usr/local/bin/fish", shells.map(t => t.id).join(","));
    Assert.areEqual("zsh,sh,bash,fish", shells.map(t => t.name).join(","));
    Assert.areEqual([TerminalShellKind.Zsh, TerminalShellKind.Other, TerminalShellKind.Bash, TerminalShellKind.Fish].join(","),
      shells.map(t => t.kind).join(","));
    Assert.isTrue(shells.every(t => t.arguments.join(" ") === "-l"));
    Assert.areEqual("/bin/bash", bare.findAll(new ShellEnvironment(false)).map(t => t.id).join(","));
  }

  @TestMethod
  public readsTheListedShellsFromTheirFileWhenItExists(): void {
    const directory = mkdtempSync(path.join(tmpdir(), "teamrun-shells-"));
    try {
      const listed = path.join(directory, "shells");
      const root = path.parse(process.cwd()).root;
      const existing = `/${process.cwd().slice(root.length).replaceAll("\\", "/")}`;
      writeFileSync(listed, `${existing}\n`);

      const found = ShellLocator.fromPlatform("linux", listed).findAll(new ShellEnvironment(false));
      const missing = ShellLocator.fromPlatform("linux", path.join(directory, "missing")).findAll(new ShellEnvironment(false));
      const folder = ShellLocator.fromPlatform("linux", directory).findAll(new ShellEnvironment(false));

      Assert.isTrue(found.some(t => t.id === existing));
      Assert.areEqual(1, missing.length);
      Assert.areEqual(1, folder.length);
    }
    finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
