/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstatSync, readFileSync, statSync } from "node:fs";
import { userInfo } from "node:os";
import { posix, win32 } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode, TerminalShellKind } from "@noldova/teamrun-protocol";

import type { IShellLocator } from "../../interfaces/i-shell-locator.js";
import { Shell } from "../../models/shell.js";
import type { ShellEnvironment } from "../../models/shell-environment.js";
import { Resources } from "../../resources.js";

export class ShellLocator implements IShellLocator {
  private readonly platform: string;
  private readonly userShell: () => string | null;
  private readonly exists: (path: string) => boolean;
  private readonly listedShells: () => string | null;

  public constructor(platform: string, userShell: () => string | null, exists: (path: string) => boolean, listedShells: () => string | null) {
    this.platform = platform;
    this.userShell = userShell;
    this.exists = exists;
    this.listedShells = listedShells;
  }

  public static fromPlatform(platform: string, listedShellsPath: string = Resources.listedShellsPath): ShellLocator {
    return new ShellLocator(platform, () => userInfo().shell, t => ShellLocator.hasEntry(t), () => ShellLocator.readText(listedShellsPath));
  }

  public findDefault(environment: ShellEnvironment): Shell {
    return this.platform === Resources.windowsPlatform ? this.findWindowsDefault(environment) : this.findLoginShell(environment);
  }

  public findAll(environment: ShellEnvironment): readonly Shell[] {
    return this.platform === Resources.windowsPlatform ? this.findWindowsShells(environment) : this.findUnixShells(environment);
  }

  private findWindowsDefault(environment: ShellEnvironment): Shell {
    return this.findPowerShell(environment) ?? ShellLocator.windowsPowerShell(ShellLocator.systemRoot(environment));
  }

  private findWindowsShells(environment: ShellEnvironment): Shell[] {
    const systemRoot = ShellLocator.systemRoot(environment);
    const shells = [this.findPowerShell(environment), ShellLocator.windowsPowerShell(systemRoot), ShellLocator.commandPrompt(systemRoot),
      this.findGitBash(environment)];
    return shells.filter((t): t is Shell => !Object.isNull(t));
  }

  private findPowerShell(environment: ShellEnvironment): Shell | null {
    const directories = ShellLocator.searchPath(environment);
    const programFiles = environment.get(Resources.programFilesVariable);
    if (!Object.isUndefined(programFiles))
      directories.push(win32.join(programFiles, ...Resources.powerShellDirectorySegments));
    const localAppData = environment.get(Resources.localAppDataVariable);
    if (!Object.isUndefined(localAppData))
      directories.push(win32.join(localAppData, ...Resources.appAliasDirectorySegments));
    const executable = directories.map(t => win32.join(t, Resources.powerShellExecutable)).find(t => this.exists(t));
    return Object.isUndefined(executable) ? null
      : new Shell(Resources.powerShellId, Resources.powerShellName, TerminalShellKind.PowerShell, executable, []);
  }

  private findGitBash(environment: ShellEnvironment): Shell | null {
    const installations = ShellLocator.searchPath(environment)
      .filter(t => win32.basename(t).toLowerCase() === Resources.gitCommandFolder && this.exists(win32.join(t, Resources.gitExecutable)))
      .map(t => win32.dirname(t));
    for (const variable of [Resources.programFilesVariable, Resources.programFilesX86Variable]) {
      const folder = environment.get(variable);
      if (!Object.isUndefined(folder))
        installations.push(win32.join(folder, ...Resources.gitInstallSegments));
    }
    const localAppData = environment.get(Resources.localAppDataVariable);
    if (!Object.isUndefined(localAppData))
      installations.push(win32.join(localAppData, ...Resources.gitUserInstallSegments));
    const executable = installations.map(t => win32.join(t, ...Resources.gitBashSegments)).find(t => this.exists(t));
    return Object.isUndefined(executable) ? null
      : new Shell(Resources.gitBashId, Resources.gitBashName, TerminalShellKind.Bash, executable, Resources.gitBashArguments);
  }

  private findLoginShell(environment: ShellEnvironment): Shell {
    return ShellLocator.unixShell(this.readUserShell() ?? environment.get(Resources.shellVariable) ?? Resources.defaultUnixShell);
  }

  private findUnixShells(environment: ShellEnvironment): Shell[] {
    const shells = [this.findLoginShell(environment)];
    for (const executable of this.readListedShells()) {
      const shell = ShellLocator.unixShell(executable);
      if (!Resources.nonShellNames.includes(shell.name) && !shells.some(t => t.name === shell.name) && this.exists(executable))
        shells.push(shell);
    }
    return shells;
  }

  private readListedShells(): readonly string[] {
    const text = this.listedShells();
    return Object.isNull(text) ? [] : text.split(Resources.outputLinePattern).map(t => t.trim()).filter(t => posix.isAbsolute(t));
  }

  private readUserShell(): string | null {
    let shell: string | null;
    try {
      shell = this.userShell();
    }
    catch {
      return null;
    }
    return String.isNullOrWhitespace(shell) ? null : shell;
  }

  private static searchPath(environment: ShellEnvironment): string[] {
    return (environment.get(Resources.pathVariable) ?? String.empty).split(Resources.windowsPathSeparator).filter(t => !String.isNullOrWhitespace(t));
  }

  private static systemRoot(environment: ShellEnvironment): string {
    const systemRoot = environment.get(Resources.systemRootVariable);
    if (Object.isUndefined(systemRoot))
      throw new ServiceException(ErrorCode.Unavailable, Resources.systemRootMissing);
    return systemRoot;
  }

  private static windowsPowerShell(systemRoot: string): Shell {
    return new Shell(Resources.windowsPowerShellId, Resources.windowsPowerShellName, TerminalShellKind.PowerShell,
      win32.join(systemRoot, ...Resources.windowsPowerShellSegments), []);
  }

  private static commandPrompt(systemRoot: string): Shell {
    return new Shell(Resources.commandPromptId, Resources.commandPromptName, TerminalShellKind.CommandPrompt,
      win32.join(systemRoot, ...Resources.commandPromptSegments), []);
  }

  private static unixShell(executable: string): Shell {
    const name = posix.basename(executable);
    return new Shell(executable, name, Resources.unixShellKinds.get(name) ?? TerminalShellKind.Other, executable, [Resources.loginShellArgument]);
  }

  private static hasEntry(path: string): boolean {
    try {
      return !Object.isUndefined(lstatSync(path, { throwIfNoEntry: false }));
    }
    catch {
      return false;
    }
  }

  private static readText(path: string): string | null {
    return statSync(path, { throwIfNoEntry: false })?.isFile() === true ? readFileSync(path, Resources.listedShellsEncoding) : null;
  }
}
