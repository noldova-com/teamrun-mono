/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { accessSync, constants, copyFileSync, existsSync, rmSync, statSync, utimesSync } from "node:fs";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";

import { Guid } from "@noldova/teamrun-foundation-core";

import { WorkingTreeChange } from "../../models/working-tree-change.js";
import { Resources } from "../../resources.js";

const run = promisify(execFile);

export class WorkingTree {
  public readonly root: string;
  private readonly before: ReadonlyMap<string, string | null>;
  private readonly maximumSnapshotFiles: number;
  private readonly baseline: string | null;
  private completeEvidence: boolean;

  private constructor(root: string, before: ReadonlyMap<string, string | null>, maximumSnapshotFiles: number, baseline: string | null) {
    this.root = root;
    this.before = before;
    this.maximumSnapshotFiles = maximumSnapshotFiles;
    this.baseline = baseline;
    this.completeEvidence = !Object.isNull(baseline);
  }

  public get hasCompleteEvidence(): boolean {
    return this.completeEvidence;
  }

  public static async capture(directory: string, maximumSnapshotFiles: number = Resources.maximumSnapshotFiles): Promise<WorkingTree | null> {
    let top: string;
    try {
      top = (await WorkingTree.git(directory, Resources.gitTopLevelArguments)).trim();
    }
    catch {
      return null;
    }
    const root = resolve(top);

    const before = await WorkingTree.readStates(root);
    return new WorkingTree(root, before, maximumSnapshotFiles, await WorkingTree.writeTree(root, maximumSnapshotFiles));
  }

  public static locateGit(platform: string, searchPath: string | undefined): string {
    if (platform === Resources.windowsPlatform || Object.isUndefined(searchPath))
      return Resources.gitExecutable;
    for (const directory of searchPath.split(delimiter)) {
      const candidate = join(directory, Resources.gitExecutable);
      if (isAbsolute(directory) && WorkingTree.isExecutableFile(candidate))
        return candidate;
    }

    return Resources.gitExecutable;
  }

  public async snapshot(name: string): Promise<string | null> {
    const ref = Resources.formatSnapshotRef(name);
    if (Object.isNull(this.baseline))
      return null;
    try {
      const commit = (await WorkingTree.git(this.root, Resources.formatCommitTreeArguments(this.baseline, Resources.formatSnapshotMessage(name)))).trim();
      await WorkingTree.git(this.root, Resources.formatUpdateRefArguments(ref, commit));
      return ref;
    }
    catch {
      return null;
    }
  }

  public async hasSnapshot(name: string): Promise<boolean> {
    try {
      await WorkingTree.git(this.root, Resources.formatVerifyRefArguments(Resources.formatSnapshotRef(name)));
      return true;
    }
    catch {
      return false;
    }
  }

  public async restore(name: string): Promise<number | null> {
    if (!(await this.hasSnapshot(name)))
      return null;
    const index = await WorkingTree.createIndexPath(this.root);
    const environment = { ...process.env, [Resources.gitIndexVariable]: index };
    try {
      await WorkingTree.git(this.root, Resources.gitAddAllArguments, null, environment);
      const before = (await WorkingTree.git(this.root, Resources.gitWriteTreeArguments, null, environment)).trim();
      const ref = Resources.formatSnapshotRef(name);
      const changes = await WorkingTree.git(this.root, Resources.formatTreeChangesArguments(before, ref));
      await WorkingTree.git(this.root, Resources.formatReadTreeArguments(ref), null, environment);
      return changes.split(Resources.nullSeparator).filter(t => t.length > 0).length / 2;
    }
    finally {
      rmSync(index, { force: true });
    }
  }

  public async dropSnapshot(name: string): Promise<void> {
    await WorkingTree.git(this.root, Resources.formatDeleteRefArguments(Resources.formatSnapshotRef(name)));
  }

  public async changesSince(): Promise<readonly WorkingTreeChange[]> {
    if (!Object.isNull(this.baseline)) {
      const after = await WorkingTree.writeTree(this.root, this.maximumSnapshotFiles);
      if (!Object.isNull(after))
        return this.compareTrees(this.baseline, after);
    }
    this.completeEvidence = false;
    const after = await WorkingTree.readStates(this.root);
    const changes: WorkingTreeChange[] = [];
    for (const path of new Set([...this.before.keys(), ...after.keys()])) {
      if (this.before.get(path) === after.get(path))
        continue;
      const absolute = join(this.root, path);
      changes.push(new WorkingTreeChange(absolute, existsSync(absolute) ? Resources.updateKind : Resources.deleteKind, null));
    }

    return changes;
  }

  private async compareTrees(before: string, after: string): Promise<readonly WorkingTreeChange[]> {
    const tokens = (await WorkingTree.git(this.root, Resources.formatTreeChangesArguments(before, after))).split(Resources.nullSeparator);
    const changes: WorkingTreeChange[] = [];
    for (const [index, path] of tokens.entries()) {
      if (index % 2 === 0)
        continue;
      const status = tokens[index - 1];
      const kind = status === Resources.addedStatusCode ? Resources.addKind : status === Resources.deletedStatusCode ? Resources.deleteKind : Resources.updateKind;
      const diff = await WorkingTree.git(this.root, Resources.formatTreeDiffArguments(before, after, path));
      const bounded = Buffer.byteLength(diff, Resources.utf8Encoding) > Resources.maximumDiffBytes || diff.includes(Resources.binaryDiffMarker)
        ? null : diff.split(Resources.lineSeparator).slice(0, Resources.maximumDiffLines).join(Resources.lineSeparator);
      changes.push(new WorkingTreeChange(join(this.root, path), kind, bounded));
    }
    return changes;
  }

  private static async createIndexPath(root: string): Promise<string> {
    const directory = resolve(root, (await WorkingTree.git(root, Resources.gitDirArguments)).trim());
    const index = join(directory, Resources.formatSnapshotIndexFileName(Guid.createVersion7().toString()));
    const current = resolve(root, (await WorkingTree.git(root, Resources.gitIndexPathArguments)).trim());
    if (existsSync(current)) {
      const metadata = statSync(current);
      copyFileSync(current, index);
      utimesSync(index, metadata.atime, metadata.mtime);
    }
    return index;
  }

  private static async writeTree(root: string, maximumFiles: number): Promise<string | null> {
    const listed = await WorkingTree.git(root, Resources.gitListFilesArguments);
    if (new Set(listed.split(Resources.nullSeparator).filter(t => t.length > 0)).size > maximumFiles)
      return null;
    const index = await WorkingTree.createIndexPath(root);
    const environment = { ...process.env, [Resources.gitIndexVariable]: index };
    try {
      await WorkingTree.git(root, Resources.gitAddAllArguments, null, environment);
      return (await WorkingTree.git(root, Resources.gitWriteTreeArguments, null, environment)).trim();
    }
    finally {
      rmSync(index, { force: true });
    }
  }

  private static async readStates(root: string): Promise<Map<string, string | null>> {
    const entries = WorkingTree.parseStatus(await WorkingTree.git(root, Resources.gitStatusArguments));
    const present = entries.filter(t => !t.deleted).map(t => t.path);
    const hashed = present.length === 0 ? String.empty : await WorkingTree.git(root, Resources.gitHashArguments, present.map(t => JSON.stringify(t)).join(Resources.lineSeparator));
    const hashes = hashed.trim().split(Resources.lineSeparator);
    const states = new Map<string, string | null>();
    let index = 0;
    for (const entry of entries)
      states.set(entry.path, entry.deleted ? null : `${entry.untracked ? Resources.untrackedStatus : String.empty}${hashes[index++]}`);

    return states;
  }

  private static parseStatus(output: string): { path: string; untracked: boolean; deleted: boolean }[] {
    const tokens = output.split(Resources.nullSeparator).filter(t => t.length > 0);
    const entries: { path: string; untracked: boolean; deleted: boolean }[] = [];
    let skipNext = false;
    for (const token of tokens) {
      if (skipNext) {
        skipNext = false;
        continue;
      }
      const code = token.slice(0, 2);
      skipNext = Resources.renamedStatusCodes.includes(code.charAt(0));
      entries.push({ path: token.slice(3), untracked: code === Resources.untrackedStatus, deleted: code.includes(Resources.deletedStatusCode) });
    }

    return entries;
  }

  private static isExecutableFile(path: string): boolean {
    try {
      accessSync(path, constants.X_OK);
      return statSync(path).isFile();
    }
    catch {
      return false;
    }
  }

  private static async git(directory: string, args: readonly string[], input: string | null = null, env: NodeJS.ProcessEnv = process.env): Promise<string> {
    const environment = { ...env, [Resources.gitOptionalLocksVariable]: Resources.gitOptionalLocksDisabled };
    const child = run(WorkingTree.locateGit(process.platform, env[Resources.pathVariable]), [...args], {
      cwd: directory, maxBuffer: Resources.gitOutputLimit, windowsHide: true, env: environment, timeout: Resources.gitTimeout
    });
    const stdin = child.child.stdin;
    if (!Object.isNull(input) && !Object.isNull(stdin))
      stdin.end(input);
    const { stdout } = await child;

    return stdout;
  }
}
