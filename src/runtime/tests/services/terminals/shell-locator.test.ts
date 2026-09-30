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
import { ShellEnvironment, ShellLocator, VisualStudioInstallation } from "@noldova/teamrun-runtime";

@TestClass
export class ShellLocatorTests {
  private static readonly noDistributions = (): Promise<readonly string[]> => Promise.resolve([]);
  private static readonly noVisualStudios = (): Promise<readonly VisualStudioInstallation[]> => Promise.resolve([]);

  @TestMethod
  public prefersPowerShell7FromThePathOnWindows(): void {
    const locator = new ShellLocator("win32", "x64", () => null, t => t === "C:\\Tools\\pwsh.exe",
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ Path: "C:\\Windows;;C:\\Tools\\", ProgramFiles: "C:\\Program Files" }));

    Assert.areEqual("PowerShell", shell.name);
    Assert.areEqual("C:\\Tools\\pwsh.exe", shell.executable);
    Assert.areEqual(0, shell.arguments.length);
  }

  @TestMethod
  public findsPowerShell7InProgramFilesWhenThePathLacksIt(): void {
    const locator = new ShellLocator("win32", "x64", () => null, t => t === "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ ProgramFiles: "C:\\Program Files", SystemRoot: "C:\\Windows" }));

    Assert.areEqual("C:\\Program Files\\PowerShell\\7\\pwsh.exe", shell.executable);
  }

  @TestMethod
  public findsTheMicrosoftStoreAliasOfPowerShell7(): void {
    const alias = "C:\\Users\\Person\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe";
    const locator = new ShellLocator("win32", "x64", () => null, t => t === alias,
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ LOCALAPPDATA: "C:\\Users\\Person\\AppData\\Local", SystemRoot: "C:\\Windows" }));

    Assert.areEqual("PowerShell", shell.name);
    Assert.areEqual(alias, shell.executable);
  }

  @TestMethod
  public fallsBackToWindowsPowerShell(): void {
    const locator = new ShellLocator("win32", "x64", () => null, () => false,
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    const shell = locator.findDefault(ShellLocatorTests.windowsEnvironment({ Path: "C:\\Windows", SystemRoot: "D:\\Windows" }));

    Assert.areEqual("Windows PowerShell", shell.name);
    Assert.areEqual("D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", shell.executable);
  }

  @TestMethod
  public refusesWhenWindowsDoesNotNameItsFolder(): void {
    const locator = new ShellLocator("win32", "x64", () => null, () => false,
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    const exception = Assert.throws(() => locator.findDefault(ShellLocatorTests.windowsEnvironment({})), ServiceException);

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
  }

  @TestMethod
  public startsTheLoginShellAsALoginShellElsewhere(): void {
    const locator = new ShellLocator("darwin", "x64", () => "/bin/zsh", () => false,
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    const shell = locator.findDefault(new ShellEnvironment(false));

    Assert.areEqual("zsh", shell.name);
    Assert.areEqual("/bin/zsh", shell.executable);
    Assert.areEqual("-l", shell.arguments.join(" "));
  }

  @TestMethod
  public usesTheShellVariableAndThenShWhenNoLoginShellIsRecorded(): void {
    const environment = new ShellEnvironment(false);
    environment.set("SHELL", "/usr/bin/fish");
    const failing = new ShellLocator("linux", "x64", () => { throw new Error("no user record"); }, () => false,
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);
    const blank = new ShellLocator("linux", "x64", () => " ", () => false,
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);
    const missing = new ShellLocator("linux", "x64", () => null, () => false,
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    Assert.areEqual("/usr/bin/fish", failing.findDefault(environment).executable);
    Assert.areEqual("fish", blank.findDefault(environment).name);
    Assert.areEqual("/bin/sh", missing.findDefault(new ShellEnvironment(false)).executable);
  }

  @TestMethod
  public async findsAShellThatExistsOnThisComputer(): Promise<void> {
    const environment = new ShellEnvironment(process.platform === "win32");
    for (const [name, value] of Object.entries(process.env))
      if (value !== undefined)
        environment.set(name, value);

    const shell = ShellLocator.fromPlatform(process.platform).findDefault(environment);
    const shells = await ShellLocator.fromPlatform(process.platform).findAll(environment);
    const loginShell = ShellLocator.fromPlatform("linux").findDefault(new ShellEnvironment(false));

    Assert.isDefined(lstatSync(shell.executable, { throwIfNoEntry: false }));
    Assert.isTrue(shells.some(t => t.id === shell.id));
    Assert.isTrue(shells.every(t => !Object.isUndefined(lstatSync(t.executable, { throwIfNoEntry: false }))));
    Assert.areEqual("-l", loginShell.arguments.join(" "));
  }

  @TestMethod
  public async listsTheInstalledWindowsShellsWithTheDefaultFirst(): Promise<void> {
    const installed = ["C:\\Program Files\\PowerShell\\7\\pwsh.exe", "C:\\Program Files\\Git\\bin\\bash.exe"];
    const locator = new ShellLocator("win32", "x64", () => null, t => installed.includes(t),
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    const shells = await locator.findAll(ShellLocatorTests.windowsEnvironment({ ProgramFiles: "C:\\Program Files", SystemRoot: "C:\\Windows" }));

    Assert.areEqual("pwsh,windows-powershell,cmd,git-bash", shells.map(t => t.id).join(","));
    Assert.areEqual("PowerShell,Windows PowerShell,Command Prompt,Git Bash", shells.map(t => t.name).join(","));
    Assert.areEqual([TerminalShellKind.PowerShell, TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt, TerminalShellKind.Bash].join(","),
      shells.map(t => t.kind).join(","));
    Assert.areEqual("C:\\Windows\\System32\\cmd.exe", shells[2]?.executable);
    Assert.areEqual("C:\\Program Files\\Git\\bin\\bash.exe", shells[3]?.executable);
    Assert.areEqual("--login -i", shells[3]?.arguments.join(" "));
  }

  @TestMethod
  public async findsGitBashThroughThePathAndItsOtherInstallFolders(): Promise<void> {
    const onPath = new ShellLocator("win32", "x64", () => null,
      t => ["D:\\Tools\\Git\\cmd\\git.exe", "D:\\Tools\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\bin\\bash.exe"].includes(t),
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);
    const forUser = new ShellLocator("win32", "x64", () => null, t => t === "C:\\Users\\Person\\AppData\\Local\\Programs\\Git\\bin\\bash.exe",
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);
    const for32Bit = new ShellLocator("win32", "x64", () => null, t => t === "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);
    const environment = ShellLocatorTests.windowsEnvironment({
      Path: "D:\\Other\\cmd;D:\\Tools\\Git\\cmd\\", ProgramFiles: "C:\\Program Files", "ProgramFiles(x86)": "C:\\Program Files (x86)",
      LOCALAPPDATA: "C:\\Users\\Person\\AppData\\Local", SystemRoot: "C:\\Windows"
    });
    const gitBash = async (locator: ShellLocator): Promise<string | undefined> => (await locator.findAll(environment)).find(t => t.id === "git-bash")?.executable;

    Assert.areEqual("D:\\Tools\\Git\\bin\\bash.exe", await gitBash(onPath));
    Assert.areEqual("C:\\Users\\Person\\AppData\\Local\\Programs\\Git\\bin\\bash.exe", await gitBash(forUser));
    Assert.areEqual("C:\\Program Files (x86)\\Git\\bin\\bash.exe", await gitBash(for32Bit));
    const none = new ShellLocator("win32", "x64", () => null, () => false, () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);
    Assert.areEqual("windows-powershell,cmd", (await none.findAll(environment)).map(t => t.id).join(","));
  }

  @TestMethod
  public async refusesToListWindowsShellsWhenWindowsDoesNotNameItsFolder(): Promise<void> {
    const locator = new ShellLocator("win32", "x64", () => null, () => true,
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    const exception = await Assert.throwsAsync(() => locator.findAll(ShellLocatorTests.windowsEnvironment({ ProgramFiles: "C:\\Program Files" })),
      ServiceException);

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
  }

  @TestMethod
  public async listsTheLoginShellFirstAndThenTheOtherListedShellsElsewhere(): Promise<void> {
    const listed = "# List of acceptable shells\n/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/zsh\n/usr/bin/tmux\n/usr/local/bin/fish\n/opt/missing/ksh\n\nrelative/dash\n";
    const locator = new ShellLocator("darwin", "x64", () => "/bin/zsh", t => t !== "/opt/missing/ksh", () => listed, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);
    const bare = new ShellLocator("linux", "x64", () => "/bin/bash", () => true,
      () => null, ShellLocatorTests.noDistributions, ShellLocatorTests.noVisualStudios);

    const shells = await locator.findAll(new ShellEnvironment(false));

    Assert.areEqual("/bin/zsh,/bin/sh,/bin/bash,/usr/local/bin/fish", shells.map(t => t.id).join(","));
    Assert.areEqual("zsh,sh,bash,fish", shells.map(t => t.name).join(","));
    Assert.areEqual([TerminalShellKind.Zsh, TerminalShellKind.Other, TerminalShellKind.Bash, TerminalShellKind.Fish].join(","),
      shells.map(t => t.kind).join(","));
    Assert.isTrue(shells.every(t => t.arguments.join(" ") === "-l"));
    Assert.areEqual("/bin/bash", (await bare.findAll(new ShellEnvironment(false))).map(t => t.id).join(","));
  }

  @TestMethod
  public async readsTheListedShellsFromTheirFileWhenItExists(): Promise<void> {
    const directory = mkdtempSync(path.join(tmpdir(), "teamrun-shells-"));
    try {
      const listed = path.join(directory, "shells");
      const root = path.parse(process.cwd()).root;
      const existing = `/${process.cwd().slice(root.length).replaceAll("\\", "/")}`;
      writeFileSync(listed, `${existing}\n`);

      const found = await ShellLocator.fromPlatform("linux", listed).findAll(new ShellEnvironment(false));
      const missing = await ShellLocator.fromPlatform("linux", path.join(directory, "missing")).findAll(new ShellEnvironment(false));
      const folder = await ShellLocator.fromPlatform("linux", directory).findAll(new ShellEnvironment(false));

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

  @TestMethod
  public async readsTheWindowsShellsThroughWindowsPowerShellAndVswhere(): Promise<void> {
    const locator = ShellLocator.fromPlatform("win32");

    const exception = await Assert.throwsAsync(() => locator.findAll(ShellLocatorTests.windowsEnvironment({ SystemRoot: tmpdir(), "ProgramFiles(x86)": tmpdir() })),
      ServiceException);

    Assert.areEqual("TeamRun could not read the WSL distributions from Windows. Windows PowerShell could not start.", exception.message);
  }

  @TestMethod
  public async listsTheWslDistributionsWithoutDockerDesktopAfterTheOtherWindowsShells(): Promise<void> {
    const locator = new ShellLocator("win32", "x64", () => null, () => false, () => null,
      () => Promise.resolve(["Ubuntu", "docker-desktop", "Docker-Desktop-Data", "Debian 12"]), ShellLocatorTests.noVisualStudios);

    const shells = await locator.findAll(ShellLocatorTests.windowsEnvironment({ SystemRoot: "C:\\Windows" }));

    Assert.areEqual("windows-powershell,cmd,wsl-Ubuntu,wsl-Debian 12", shells.map(t => t.id).join(","));
    Assert.areEqual("Ubuntu", shells[2]?.name);
    Assert.areEqual(TerminalShellKind.Wsl, shells[2]?.kind);
    Assert.areEqual("C:\\Windows\\System32\\wsl.exe", shells[3]?.executable);
    Assert.areEqual("-d|Debian 12", shells[3]?.arguments.join("|"));
  }

  @TestMethod
  public async offersTheVisualStudioDeveloperShellsWhoseFilesExist(): Promise<void> {
    const professional = "C:\\Program Files\\Microsoft Visual Studio\\18\\Professional";
    const buildTools = "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\O'Brien Tools";
    const installed = [`${professional}\\Common7\\Tools\\VsDevCmd.bat`, `${professional}\\Common7\\Tools\\Microsoft.VisualStudio.DevShell.dll`,
      `${buildTools}\\Common7\\Tools\\Microsoft.VisualStudio.DevShell.dll`, "C:\\Program Files\\PowerShell\\7\\pwsh.exe"];
    const installations = [new VisualStudioInstallation("e7143cad", "Visual Studio Professional 2026", professional),
      new VisualStudioInstallation("58a90faf", "SQL Server Management Studio 22", "C:\\Program Files\\SSMS"),
      new VisualStudioInstallation("1b2c3d4e", "Visual Studio Build Tools 2022", buildTools)];
    const arm = new ShellLocator("win32", "arm64", () => null, t => installed.includes(t), () => null, ShellLocatorTests.noDistributions,
      () => Promise.resolve(installations));
    const unknown = new ShellLocator("win32", "riscv64", () => null, t => installed.includes(t), () => null, ShellLocatorTests.noDistributions,
      () => Promise.resolve(installations.slice(0, 1)));
    const environment = ShellLocatorTests.windowsEnvironment({ ProgramFiles: "C:\\Program Files", SystemRoot: "C:\\Windows" });

    const shells = await arm.findAll(environment);
    const command = shells.find(t => t.id === "vs-e7143cad-cmd");
    const powerShell = shells.find(t => t.id === "vs-e7143cad-powershell");
    const quoted = shells.find(t => t.id === "vs-1b2c3d4e-powershell");

    Assert.areEqual("pwsh,windows-powershell,cmd,vs-e7143cad-cmd,vs-e7143cad-powershell,vs-1b2c3d4e-powershell", shells.map(t => t.id).join(","));
    Assert.areEqual("Developer Command Prompt (Visual Studio Professional 2026)", command?.name);
    Assert.areEqual(TerminalShellKind.CommandPrompt, command?.kind);
    Assert.areEqual("C:\\Windows\\System32\\cmd.exe", command?.executable);
    Assert.areEqual(`/k|${professional}\\Common7\\Tools\\VsDevCmd.bat|-startdir=none|-arch=arm64|-host_arch=arm64`, command?.arguments.join("|"));
    Assert.areEqual("Developer PowerShell (Visual Studio Professional 2026)", powerShell?.name);
    Assert.areEqual(TerminalShellKind.PowerShell, powerShell?.kind);
    Assert.areEqual("C:\\Program Files\\PowerShell\\7\\pwsh.exe", powerShell?.executable);
    Assert.areEqual(`-NoExit|-Command|& { Microsoft.PowerShell.Core\\Import-Module '${professional}\\Common7\\Tools\\Microsoft.VisualStudio.DevShell.dll'; ` +
      `Microsoft.VisualStudio.DevShell\\Enter-VsDevShell -VsInstallPath '${professional}' -SkipAutomaticLocation -DevCmdArguments '-arch=arm64 -host_arch=arm64' }`,
      powerShell?.arguments.join("|"));
    Assert.isTrue(quoted?.arguments[2]?.includes("-VsInstallPath 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\O''Brien Tools'") ?? false);
    Assert.isTrue((await unknown.findAll(environment)).find(t => t.id === "vs-e7143cad-cmd")?.arguments.includes("-arch=riscv64") ?? false);
    Assert.areEqual("amd64", (await new ShellLocator("win32", "x64", () => null, t => installed.includes(t), () => null, ShellLocatorTests.noDistributions,
      () => Promise.resolve(installations.slice(0, 1))).findAll(environment)).find(t => t.id === "vs-e7143cad-cmd")?.arguments.at(-1)?.split("=")[1]);
  }

  @TestMethod
  public async usesWindowsPowerShellForTheDeveloperPowerShellWithoutPowerShell7(): Promise<void> {
    const folder = "C:\\VS";
    const locator = new ShellLocator("win32", "x64", () => null, t => t === "C:\\VS\\Common7\\Tools\\Microsoft.VisualStudio.DevShell.dll", () => null,
      ShellLocatorTests.noDistributions, () => Promise.resolve([new VisualStudioInstallation("a1", "Visual Studio Community 2026", folder)]));

    const shells = await locator.findAll(ShellLocatorTests.windowsEnvironment({ SystemRoot: "C:\\Windows" }));

    Assert.areEqual("windows-powershell,cmd,vs-a1-powershell", shells.map(t => t.id).join(","));
    Assert.areEqual("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", shells[2]?.executable);
  }

  private static windowsEnvironment(variables: Record<string, string>): ShellEnvironment {
    const environment = new ShellEnvironment(true);
    for (const [name, value] of Object.entries(variables))
      environment.set(name, value);
    return environment;
  }
}
