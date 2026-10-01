/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * A disposable git repository for the working-tree tests: initialised with one commit, files
 * written and committed on demand.
 */
export class GitRepository {
  public readonly path: string;

  public constructor(path: string) {
    this.path = path;
    mkdirSync(path, { recursive: true });
    this.git("init", "-q");
    this.git("config", "user.email", "test@example.com");
    this.git("config", "user.name", "TeamRun tests");
    this.git("config", "core.autocrlf", "false");
    this.git("config", "maintenance.auto", "false");
    this.git("config", "gc.auto", "0");
  }

  public write(name: string, content: string | Buffer): string {
    const path = join(this.path, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return path;
  }

  public commit(message: string = "commit"): void {
    this.git("add", "-A");
    this.git("commit", "-q", "-m", message, "--allow-empty");
  }

  public git(...args: string[]): string {
    return execFileSync("git", args, { cwd: this.path, encoding: "utf8", windowsHide: true });
  }
}
