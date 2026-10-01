/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import GitExecutable from "../../../git-executable.ts";
import ReleaseCandidate from "../../../release/release-candidate.ts";

export default class ReleaseFixture {
  public readonly directory: string;
  public readonly candidate: ReleaseCandidate;
  public readonly input: string;
  public readonly output: string;

  private constructor(directory: string, candidate: ReleaseCandidate) {
    this.directory = directory;
    this.candidate = candidate;
    this.input = path.join(directory, "input");
    this.output = path.join(directory, "output");
  }

  public static async create(version: string = "1.2.3"): Promise<ReleaseFixture> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "teamrun-release-"));
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ version }));
    await writeFile(path.join(directory, "package-lock.json"), JSON.stringify({ version, packages: { "": { version } } }));
    const git = (args: readonly string[]): string => execFileSync(GitExecutable.locate(), [...args], { cwd: directory, encoding: "utf8", timeout: 10_000 });
    git(["init", "-q", "--initial-branch=main"]);
    git(["config", "user.name", "Release fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "core.autocrlf", "false"]);
    git(["add", "."]);
    git(["commit", "-qm", "Fixture"]);
    git(["tag", `v${version}`]);
    git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
    return new ReleaseFixture(directory, new ReleaseCandidate(`v${version}`, directory));
  }

  public git(args: readonly string[]): string {
    return execFileSync(GitExecutable.locate(), [...args], { cwd: this.directory, encoding: "utf8", timeout: 10_000 }).trim();
  }

  public async seed(signedPlatforms: readonly string[] = []): Promise<void> {
    await rm(this.input, { recursive: true, force: true });
    await rm(this.output, { recursive: true, force: true });
    const version = this.candidate.version.value;
    for (const platform of ["windows", "mac", "linux"]) {
      for (const architecture of ["x64", "arm64"]) {
        const target = `${platform}-${architecture}`;
        const directory = path.join(this.input, target);
        await mkdir(directory, { recursive: true });
        const suffixes = platform === "windows" ? [".exe", ".exe.blockmap"] : platform === "mac" ? [".dmg", ".zip", ".zip.blockmap"] : [".AppImage"];
        const names = [...suffixes.map(t => `TeamRun-${target}${t}`), platform === "mac" ? "latest-mac.yml" : platform === "linux" ? "latest-linux.yml" : "latest.yml"];
        const files = [];
        for (const name of names) {
          const bytes = Buffer.from(`Fixture bytes for ${name}`);
          await writeFile(path.join(directory, name), bytes);
          files.push({ name, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
        }
        await writeFile(path.join(directory, `package-report-${target}.json`), JSON.stringify({ version,
          sourceRevision: this.candidate.revision, targetPlatform: platform, targetArchitecture: architecture,
          hostPlatform: platform === "windows" ? "win32" : platform === "mac" ? "darwin" : "linux", hostArchitecture: architecture,
          signingRequested: signedPlatforms.includes(platform), files }));
      }
    }
  }

  public async readReport(): Promise<Record<string, unknown>> {
    return JSON.parse(await readFile(path.join(this.input, "windows-x64/package-report-windows-x64.json"), "utf8"));
  }

  public async writeReport(value: unknown): Promise<void> {
    await writeFile(path.join(this.input, "windows-x64/package-report-windows-x64.json"), JSON.stringify(value));
  }

  public async close(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
  }
}
