/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { parseArgs } from "node:util";

import InstalledTerminalCheck from "./packaging/installed-terminal-check.ts";
import PackageException from "./packaging/package.exception.ts";

export default class CheckInstalledTerminal {
  private static readonly OPTIONS = { executable: { type: "string" }, resources: { type: "string" } } as const;
  private static readonly USAGE: string = "Use --executable <installed TeamRun executable> --resources <its resources folder>.";
  private static readonly ANSWERED: string = "The installed TeamRun ran a command in a terminal.";

  public async run(args: readonly string[]): Promise<void> {
    const { values } = parseArgs({ args: [...args], options: CheckInstalledTerminal.OPTIONS, strict: true, allowPositionals: false });
    if (values.executable === undefined || values.resources === undefined)
      throw new PackageException(CheckInstalledTerminal.USAGE);
    await new InstalledTerminalCheck(values.executable, values.resources).run();
    process.stdout.write(`${CheckInstalledTerminal.ANSWERED}\n`);
  }
}

if (import.meta.main)
  await new CheckInstalledTerminal().run(process.argv.slice(2));
