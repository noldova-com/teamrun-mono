/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync, spawnSync } from "node:child_process";

import VerificationScope from "./verification-scope.ts";
import type VerifiedRevisions from "./verified-revisions.ts";

export default class ChangeClassifier {
  private static readonly PUSH_EVENT: string = "push";
  private static readonly COMPARED_EVENTS: readonly string[] = ["pull_request", "merge_group", ChangeClassifier.PUSH_EVENT];
  private static readonly REVISION_PATTERN: RegExp = /^[0-9a-f]{40}$/;
  private static readonly MARKDOWN_EXTENSION: string = ".md";
  private static readonly DOCUMENTATION_FOLDERS: readonly string[] = ["docs/", ".github/"];
  private static readonly COMMAND_TIMEOUT: number = 60_000;
  private static readonly OUTPUT_LIMIT: number = 64 * 1024 * 1024;
  private static readonly MANUAL_RUN: string = "Manual runs verify everything.";
  private static readonly HISTORY_UNAVAILABLE: string = "The comparison history is unavailable.";
  private static readonly NO_VERIFIED_REVISION: string = "No earlier main revision with a successful run is in this revision's history.";
  private static readonly EMPTY_COMPARISON: string = "The comparison found no changed files.";

  private readonly directory: string;
  private readonly verifiedRevisions: VerifiedRevisions;

  public constructor(directory: string, verifiedRevisions: VerifiedRevisions) {
    this.directory = directory;
    this.verifiedRevisions = verifiedRevisions;
  }

  /**
   * Chooses between the full verification and skipping the code builds and tests. Pull requests and merge groups compare with their merge
   * base. A push skips them when a merge queue run already passed for the same tree; otherwise it compares with the newest main revision in
   * its history whose run succeeded, so a run that follows skipped, failed or batched pushes covers them all.
   */
  public async classifyAsync(eventName: string, baseRevision: string, headRevision: string): Promise<VerificationScope> {
    if (!ChangeClassifier.COMPARED_EVENTS.includes(eventName))
      return new VerificationScope(true, ChangeClassifier.MANUAL_RUN);
    if (!this.exists(headRevision))
      return new VerificationScope(true, ChangeClassifier.HISTORY_UNAVAILABLE);

    let comparison: string;
    let description: string;
    if (eventName === ChangeClassifier.PUSH_EVENT) {
      const tree = this.git(["rev-parse", `${headRevision}^{tree}`]).trim();
      if ((await this.verifiedRevisions.listQueueTreesAsync()).includes(tree))
        return new VerificationScope(false, `A merge queue run of Build and test already passed for this revision's tree ${tree}.`);
      const verified = await this.findVerifiedAsync(headRevision);
      if (verified === null)
        return new VerificationScope(true, ChangeClassifier.NO_VERIFIED_REVISION);
      comparison = verified;
      description = `${comparison}, the last main revision whose run succeeded`;
    }
    else {
      if (!this.exists(baseRevision))
        return new VerificationScope(true, ChangeClassifier.HISTORY_UNAVAILABLE);
      comparison = this.git(["merge-base", baseRevision, headRevision]).trim();
      description = `the merge base ${comparison}`;
    }

    const paths = this.git(["diff", "--no-renames", "--name-only", "-z", comparison, headRevision, "--"]).split("\0").filter(t => t.length > 0);
    if (paths.length === 0)
      return new VerificationScope(true, ChangeClassifier.EMPTY_COMPARISON);
    return paths.every(t => ChangeClassifier.isDocumentation(t))
      ? new VerificationScope(false, `Only Markdown documentation changed since ${description}.`)
      : new VerificationScope(true, `Files other than Markdown documentation changed since ${description}.`);
  }

  private static isDocumentation(changedPath: string): boolean {
    return changedPath.endsWith(ChangeClassifier.MARKDOWN_EXTENSION)
      && (!changedPath.includes("/") || ChangeClassifier.DOCUMENTATION_FOLDERS.some(t => changedPath.startsWith(t)));
  }

  private async findVerifiedAsync(headRevision: string): Promise<string | null> {
    for (const revision of await this.verifiedRevisions.listAsync())
      if (this.exists(revision) && this.succeeds(["merge-base", "--is-ancestor", revision, headRevision]))
        return revision;
    return null;
  }

  private exists(revision: string): boolean {
    return ChangeClassifier.REVISION_PATTERN.test(revision) && this.succeeds(["cat-file", "-e", `${revision}^{commit}`]);
  }

  private succeeds(args: readonly string[]): boolean {
    return spawnSync("git", [...args], { cwd: this.directory, stdio: "ignore", timeout: ChangeClassifier.COMMAND_TIMEOUT }).status === 0;
  }

  private git(args: readonly string[]): string {
    return execFileSync("git", [...args], {
      cwd: this.directory, encoding: "utf8", timeout: ChangeClassifier.COMMAND_TIMEOUT, maxBuffer: ChangeClassifier.OUTPUT_LIMIT
    });
  }
}
