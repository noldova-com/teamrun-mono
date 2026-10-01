/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

/**
 * Finds the Git executable to start. A launch by name tries every PATH folder in turn, and on macOS each failed
 * attempt creates a process; Windows searches in-process and keeps the name.
 */
export default class GitExecutable {
  private static readonly NAME: string = "git";
  private static readonly WINDOWS_PLATFORM: string = "win32";

  public static locate(platform: string = process.platform, searchPath: string = process.env["PATH"] ?? ""): string {
    if (platform === GitExecutable.WINDOWS_PLATFORM)
      return GitExecutable.NAME;
    for (const directory of searchPath.split(path.delimiter)) {
      const candidate = path.join(directory, GitExecutable.NAME);
      if (path.isAbsolute(directory) && GitExecutable.isExecutableFile(candidate))
        return candidate;
    }
    return GitExecutable.NAME;
  }

  private static isExecutableFile(candidate: string): boolean {
    try {
      accessSync(candidate, constants.X_OK);
      return statSync(candidate).isFile();
    }
    catch {
      return false;
    }
  }
}
