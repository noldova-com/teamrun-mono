/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstatSync } from "node:fs";
import { userInfo } from "node:os";
import { posix, win32 } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode } from "@noldova/teamrun-protocol";

import type { IShellLocator } from "../../interfaces/i-shell-locator.js";
import { Shell } from "../../models/shell.js";
import type { ShellEnvironment } from "../../models/shell-environment.js";
import { Resources } from "../../resources.js";

export class ShellLocator implements IShellLocator {
  private readonly platform: string;
  private readonly userShell: () => string | null;
  private readonly exists: (path: string) => boolean;

  public constructor(platform: string, userShell: () => string | null, exists: (path: string) => boolean) {
    this.platform = platform;
    this.userShell = userShell;
    this.exists = exists;
  }

  public static fromPlatform(platform: string): ShellLocator {
    return new ShellLocator(platform, () => userInfo().shell, t => ShellLocator.hasEntry(t));
  }

  public findDefault(environment: ShellEnvironment): Shell {
    return this.platform === Resources.windowsPlatform ? this.findWindowsDefault(environment) : this.findLoginShell(environment);
  }

  private findWindowsDefault(environment: ShellEnvironment): Shell {
    const directories = (environment.get(Resources.pathVariable) ?? String.empty).split(Resources.windowsPathSeparator);
    const programFiles = environment.get(Resources.programFilesVariable);
    if (!Object.isUndefined(programFiles))
      directories.push(win32.join(programFiles, ...Resources.powerShellDirectorySegments));
    const localAppData = environment.get(Resources.localAppDataVariable);
    if (!Object.isUndefined(localAppData))
      directories.push(win32.join(localAppData, ...Resources.appAliasDirectorySegments));
    const powerShell = directories.filter(t => !String.isNullOrWhitespace(t)).map(t => win32.join(t, Resources.powerShellExecutable)).find(t => this.exists(t));
    if (!Object.isUndefined(powerShell))
      return new Shell(Resources.powerShellName, powerShell, []);

    const systemRoot = environment.get(Resources.systemRootVariable);
    if (Object.isUndefined(systemRoot))
      throw new ServiceException(ErrorCode.Unavailable, Resources.systemRootMissing);
    return new Shell(Resources.windowsPowerShellName, win32.join(systemRoot, ...Resources.windowsPowerShellSegments), []);
  }

  private findLoginShell(environment: ShellEnvironment): Shell {
    const executable = this.readUserShell() ?? environment.get(Resources.shellVariable) ?? Resources.defaultUnixShell;
    return new Shell(posix.basename(executable), executable, [Resources.loginShellArgument]);
  }

  private static hasEntry(path: string): boolean {
    try {
      return !Object.isUndefined(lstatSync(path, { throwIfNoEntry: false }));
    }
    catch {
      return false;
    }
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
}
