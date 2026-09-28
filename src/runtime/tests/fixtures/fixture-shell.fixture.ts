/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";

import { type IShellLocator, Shell, ShellEnvironment } from "@noldova/teamrun-runtime";

export class FixtureShell implements IShellLocator {
  public static readonly scriptPath: string = fileURLToPath(new URL("./terminal-shell.fixture.js", import.meta.url));
  public static readonly displayName: string = "Fixture";

  public static create(): Shell {
    return new Shell(FixtureShell.displayName, process.execPath, [FixtureShell.scriptPath]);
  }

  public static environment(): ShellEnvironment {
    const environment = new ShellEnvironment(process.platform === "win32");
    for (const [name, value] of Object.entries(process.env))
      if (value !== undefined)
        environment.set(name, value);
    return environment;
  }

  public findDefault(): Shell {
    return FixtureShell.create();
  }
}
