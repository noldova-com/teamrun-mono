/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export default class WorkflowRepositoryFixture {
  public readonly directory: string;

  private constructor(directory: string) {
    this.directory = directory;
  }

  public static async create(): Promise<WorkflowRepositoryFixture> {
    const fixture = new WorkflowRepositoryFixture(await mkdtemp(path.join(os.tmpdir(), "teamrun-workflows-")));
    fixture.git(["init", "-q", "--initial-branch=main"]);
    fixture.git(["config", "user.name", "Workflow fixture"]);
    fixture.git(["config", "user.email", "fixture@example.invalid"]);
    fixture.git(["config", "core.autocrlf", "false"]);
    fixture.git(["config", "commit.gpgsign", "false"]);
    return fixture;
  }

  public async commit(files: Readonly<Record<string, string>>): Promise<string> {
    for (const [name, content] of Object.entries(files)) {
      const filename = path.join(this.directory, name);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, content);
    }
    return this.commitStaged();
  }

  public commitStaged(): string {
    this.git(["add", "-A"]);
    this.git(["commit", "-qm", "Fixture change"]);
    return this.git(["rev-parse", "HEAD"]);
  }

  public git(args: readonly string[]): string {
    return execFileSync("git", [...args], { cwd: this.directory, encoding: "utf8", timeout: 10_000 }).trim();
  }

  public close(): Promise<void> {
    return rm(this.directory, { recursive: true, force: true });
  }
}
