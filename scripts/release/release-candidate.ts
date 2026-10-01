/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

import GitExecutable from "../git-executable.ts";
import PackageException from "../packaging/package.exception.ts";
import ReleaseVersion from "./release-version.ts";

export default class ReleaseCandidate {
  private static readonly COMMAND_TIMEOUT: number = 30_000;
  private static readonly REVISION_PATTERN: RegExp = /^[a-f0-9]{40}$/;
  private static readonly TAG_PREFIX_REQUIRED: string = "A release tag must start with v.";
  private static readonly REVISION_MISMATCH: string = "The release tag changed from the validated revision.";
  private static readonly VERSION_MISMATCH: string = "The tag must match package.json and both root versions in package-lock.json.";

  public static readonly REPOSITORY: string = "noldova-com/teamrun";

  public readonly tag: string;
  public readonly version: ReleaseVersion;
  public readonly revision: string;
  public readonly releaseDate: string;

  public constructor(tag: string, directory: string = process.cwd(), expectedRevision?: string) {
    if (!tag.startsWith("v"))
      throw new PackageException(ReleaseCandidate.TAG_PREFIX_REQUIRED);
    const version = new ReleaseVersion(tag.slice(1));
    const git = (args: readonly string[]): string => execFileSync(GitExecutable.locate(), [...args],
      { cwd: directory, encoding: "utf8", timeout: ReleaseCandidate.COMMAND_TIMEOUT }).trim();
    const revision = git(["rev-parse", "--verify", `refs/tags/${tag}^{commit}`]);
    if (!ReleaseCandidate.REVISION_PATTERN.test(revision) || expectedRevision !== undefined && revision !== expectedRevision)
      throw new PackageException(ReleaseCandidate.REVISION_MISMATCH);
    git(["merge-base", "--is-ancestor", revision, "refs/remotes/origin/main"]);
    const manifest: unknown = JSON.parse(git(["show", `${revision}:package.json`]));
    const lock: unknown = JSON.parse(git(["show", `${revision}:package-lock.json`]));
    if (!ReleaseCandidate.hasVersion(manifest, version.value) || !ReleaseCandidate.hasVersion(lock, version.value)
      || !("packages" in lock) || typeof lock.packages !== "object" || lock.packages === null
      || !("" in lock.packages) || !ReleaseCandidate.hasVersion(lock.packages[""], version.value))
      throw new PackageException(ReleaseCandidate.VERSION_MISMATCH);
    const releaseDate = new Date(git(["show", "-s", "--format=%cI", revision])).toISOString();

    this.tag = tag;
    this.version = version;
    this.revision = revision;
    this.releaseDate = releaseDate;
  }

  public writeOutputs(filename: string): void {
    appendFileSync(filename, `revision=${this.revision}\nversion=${this.version.value}\n`);
  }

  private static hasVersion(value: unknown, version: string): value is object {
    return typeof value === "object" && value !== null && "version" in value && value.version === version;
  }
}
