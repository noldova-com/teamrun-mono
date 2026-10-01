/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { delimiter, join, relative } from "node:path";

import { Assert, Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WorkingTree } from "@noldova/teamrun-core";

import { GitRepository } from "../../fixtures/git-repository.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class WorkingTreeTests {
  @TestMethod
  public async detectsSameSizeEditsWhenCachedFileTimesAreUnchanged(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const repository = new GitRepository(join(directory.path, "repo"));
    repository.git("config", "core.trustctime", "false");
    repository.git("config", "core.checkStat", "minimal");
    const file = repository.write("base.txt", "one\n");
    const timestamp = new Date(Date.now() - 5000);
    utimesSync(file, timestamp, timestamp);
    repository.commit("base");
    const original = statSync(file);
    const index = join(repository.path, ".git", "index");
    utimesSync(index, original.atime, original.mtime);
    const originalIndex = readFileSync(index);
    const tree = (await WorkingTree.capture(repository.path))!;
    await tree.snapshot("racy");
    writeFileSync(file, "two\n");
    utimesSync(file, original.atime, original.mtime);

    Assert.areEqual(1, (await tree.changesSince()).length);
    Assert.areEqual(1, await tree.restore("racy"));
    Assert.areEqual("one\n", readFileSync(file, "utf8"));
    Assert.areEqual(originalIndex.toString("hex"), readFileSync(index).toString("hex"));
  }

  @TestMethod
  public async marksFallbackObservationsIncompleteWhenEitherTreeExceedsTheCap(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const repository = new GitRepository(join(directory.path, "repo"));
    repository.write("a.txt", "a\n");
    repository.write("b.txt", "b\n");
    repository.commit();
    repository.git("mv", "a.txt", "renamed.txt");
    rmSync(join(repository.path, "b.txt"));
    const capped = await WorkingTree.capture(repository.path, 1);
    Assert.isNotNull(capped);
    Assert.isFalse(capped.hasCompleteEvidence);
    Assert.areEqual(0, (await capped.changesSince()).length);
    repository.write("new.txt", "new\n");
    rmSync(join(repository.path, "renamed.txt"));
    const fallback = await capped.changesSince();
    Assert.isTrue(fallback.some(t => t.path.endsWith("renamed.txt") && t.kind === "delete"));
    Assert.isTrue(fallback.some(t => t.path.endsWith("new.txt") && t.kind === "update"));
    Assert.isTrue(fallback.every(t => t.diff === null));

    const growing = new GitRepository(join(directory.path, "growing"));
    growing.write("first.txt", "first");
    const before = await WorkingTree.capture(growing.path, 1);
    Assert.isNotNull(before);
    Assert.isTrue(before.hasCompleteEvidence);
    growing.write("second.txt", "second");
    await before.changesSince();
    Assert.isFalse(before.hasCompleteEvidence);
  }

  @TestMethod
  public async isAbsentOutsideARepository(): Promise<void> {
    using directory = new TemporaryDataDirectory();

    Assert.isNull(await WorkingTree.capture(directory.path));
  }

  @TestMethod
  public async reportsAddedUpdatedDeletedAndRenamedFilesSinceTheSnapshot(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const repository = new GitRepository(join(directory.path, "repo"));
    repository.write("base.txt", "one\ntwo\n");
    repository.write("gone.txt", "bye\n");
    repository.write("moved.txt", "moving\n");
    repository.write("dirty.txt", "dirty\n");
    repository.commit("base");
    repository.write("dirty.txt", "still dirty\n");
    repository.write("stays.txt", "untracked before and after\n");

    const tree = await WorkingTree.capture(repository.path);
    repository.write("sub/new.txt", "hello\nworld\n");
    repository.write("base.txt", "one\nthree\n");
    repository.write("binary.bin", Buffer.from([0, 1, 2, 3]));
    rmSync(join(repository.path, "gone.txt"));
    repository.git("mv", "moved.txt", "renamed.txt");
    repository.write("dirty.txt", "dirty\n");
    const changes = await tree!.changesSince();

    Assert.areEqual(realpathSync.native(repository.path).toLowerCase(), tree!.root.toLowerCase());
    const byName = new Map(changes.map(t => [t.path.slice(tree!.root.length + 1).replaceAll("\\", "/"), t]));
    Assert.areEqual("base.txt,binary.bin,dirty.txt,gone.txt,moved.txt,renamed.txt,sub/new.txt", [...byName.keys()].sort().join(","));
    Assert.areEqual("add", byName.get("sub/new.txt")?.kind);
    Assert.isTrue(byName.get("sub/new.txt")?.diff?.includes("+hello\n+world") ?? false);
    Assert.isTrue(byName.get("dirty.txt")?.diff?.includes("-still dirty\n+dirty") ?? false);
    Assert.areEqual("update", byName.get("base.txt")?.kind);
    Assert.isTrue(byName.get("base.txt")?.diff?.includes("-two") ?? false);
    Assert.isTrue(byName.get("base.txt")?.diff?.includes("+three") ?? false);
    Assert.areEqual("delete", byName.get("gone.txt")?.kind);
    Assert.isTrue(byName.get("gone.txt")?.diff?.includes("-bye") ?? false);
    Assert.areEqual("add", byName.get("binary.bin")?.kind);
    Assert.isNull(byName.get("binary.bin")?.diff);
    Assert.areEqual("add", byName.get("renamed.txt")?.kind);
  }

  @TestMethod
  public async keepsAndRestoresSnapshotsOfTheWholeTree(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const repository = new GitRepository(join(directory.path, "repo"));
    repository.write("base.txt", "one\n");
    repository.commit("base");
    repository.write("dirty.txt", "dirty\n");
    const tree = await WorkingTree.capture(repository.path);

    const ref = await tree!.snapshot("reply-1");
    repository.write("base.txt", "two\n");
    repository.write("dirty.txt", "dirtier\n");
    repository.write("added.txt", "new\n");
    rmSync(join(repository.path, "dirty.txt"));
    const restored = await tree!.restore("reply-1");

    Assert.areEqual("refs/teamrun/snapshots/reply-1", ref);
    Assert.isTrue(await tree!.hasSnapshot("reply-1"));
    Assert.isFalse(await tree!.hasSnapshot("reply-9"));
    Assert.areEqual(3, restored);
    Assert.areEqual("one\n", readFileSync(join(repository.path, "base.txt"), "utf8"));
    Assert.areEqual("dirty\n", readFileSync(join(repository.path, "dirty.txt"), "utf8"));
    Assert.isFalse(existsSync(join(repository.path, "added.txt")));
    Assert.isFalse(existsSync(join(repository.path, ".git", "teamrun-index")));
    Assert.isNull(await tree!.restore("reply-9"));
    await tree!.dropSnapshot("reply-1");
    await tree!.dropSnapshot("reply-9");
    Assert.isFalse(await tree!.hasSnapshot("reply-1"));
  }

  @TestMethod
  public async snapshotsARepositoryWithoutCommitsAndGivesUpWhenGitIsGone(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const fresh = new GitRepository(join(directory.path, "fresh"));
    fresh.write("only.txt", "here\n");
    const tree = await WorkingTree.capture(fresh.path);
    Assert.isNotNull(await tree!.snapshot("reply-1"));
    fresh.write("only.txt", "changed\n");
    Assert.areEqual(1, await tree!.restore("reply-1"));
    Assert.areEqual("here\n", readFileSync(join(fresh.path, "only.txt"), "utf8"));

    const broken = new GitRepository(join(directory.path, "broken"));
    const brokenTree = await WorkingTree.capture(broken.path);
    rmSync(join(broken.path, ".git"), { recursive: true, force: true });
    writeFileSync(join(broken.path, ".git"), "gitdir: " + join(directory.path, "nowhere"));

    Assert.isNull(await brokenTree!.snapshot("reply-2"));

    const large = new GitRepository(join(directory.path, "large"));
    large.write("a.txt", "a\n");
    large.write("b.txt", "b\n");
    const guarded = await WorkingTree.capture(large.path, 1);
    Assert.isNull(await guarded!.snapshot("reply-3"));
    Assert.isFalse(await guarded!.hasSnapshot("reply-3"));
    const allowed = await WorkingTree.capture(large.path, 2);
    Assert.isNotNull(await allowed!.snapshot("reply-3"));
  }

  @TestMethod
  public async hasNoDiffForAStagedFileWithoutACommitAndCapsLongAdditions(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const repository = new GitRepository(join(directory.path, "fresh"));
    const tree = await WorkingTree.capture(repository.path);
    repository.write("staged.txt", "staged\n");
    repository.git("add", "staged.txt");
    repository.write("long.txt", Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n"));
    repository.write("big.txt", "x".repeat(1024 * 1024 + 1));

    const changes = await tree!.changesSince();

    const byName = new Map(changes.map(t => [t.path.slice(tree!.root.length + 1), t]));
    Assert.areEqual("add", byName.get("staged.txt")?.kind);
    Assert.isTrue(byName.get("staged.txt")?.diff?.includes("+staged") ?? false);
    Assert.areEqual(400, byName.get("long.txt")?.diff?.split("\n").length);
    Assert.isNull(byName.get("big.txt")?.diff);
  }

  @TestMethod
  public async attributesChangesAgainstTheStartingFilesAndKeepsTheRealIndex(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const repository = new GitRepository(join(directory.path, "repo"));
    repository.write("base.txt", "committed\n");
    repository.commit();
    repository.write("base.txt", "user staged\n");
    repository.git("add", "base.txt");
    repository.write("base.txt", "user staged\nuser unstaged\n");
    repository.write("untracked before.txt", "keep me\n");
    const index = join(repository.path, ".git", "index");
    const initialIndex = readFileSync(index);
    const tree = (await WorkingTree.capture(repository.path))!;
    await tree.snapshot("reply-1");
    Assert.isTrue(initialIndex.equals(readFileSync(index)));
    repository.write("base.txt", "user staged\nuser unstaged\nprovider\n");
    rmSync(join(repository.path, "untracked before.txt"));
    repository.commit("provider committed the changes");
    const changes = await tree.changesSince();
    const base = changes.find(t => t.path.endsWith("base.txt"))!;
    Assert.isTrue(base.diff?.includes("+provider") ?? false);
    Assert.isFalse(base.diff?.includes("-committed") ?? true);
    Assert.isTrue(changes.some(t => t.path.endsWith("untracked before.txt") && t.kind === "delete"));
    repository.write("staged after.txt", "staged content\n");
    repository.git("add", "staged after.txt");
    const beforeRestore = readFileSync(index);
    await tree.restore("reply-1");
    Assert.isTrue(beforeRestore.equals(readFileSync(index)));
    Assert.areEqual("user staged\nuser unstaged\n", readFileSync(join(repository.path, "base.txt"), "utf8"));
    Assert.areEqual("keep me\n", readFileSync(join(repository.path, "untracked before.txt"), "utf8"));
  }

  @TestMethod
  public locatesTheFirstExecutableGitFileInAnAbsolutePathFolder(): void {
    using directory = new TemporaryDataDirectory();
    const [gitFolder, first, second] = ["folder", "first", "second"].map(t => join(directory.path, t));
    mkdirSync(join(gitFolder!, "git"), { recursive: true });
    for (const folder of [first!, second!]) {
      mkdirSync(folder);
      writeFileSync(join(folder, "git"), String.empty, { mode: 0o755 });
    }
    const searchPath = [join(directory.path, "missing"), gitFolder, first, second].join(delimiter);
    Assert.areEqual(join(first!, "git"), WorkingTree.locateGit("darwin", searchPath));
  }

  @TestMethod
  public keepsTheGitNameOnWindowsOrWithoutAnExecutableOnPath(): void {
    using directory = new TemporaryDataDirectory();
    writeFileSync(join(directory.path, "git"), String.empty, { mode: 0o755 });
    Assert.areEqual("git", WorkingTree.locateGit("win32", directory.path));
    Assert.areEqual("git", WorkingTree.locateGit("darwin", undefined));
    Assert.areEqual("git", WorkingTree.locateGit("darwin", join(directory.path, "missing")));
  }

  @TestMethod
  public skipsRelativeFoldersAndGitFilesWithoutExecutePermission(): void {
    using directory = new TemporaryDataDirectory();
    const [plain, executable] = ["plain", "executable"].map(t => join(directory.path, t));
    mkdirSync(plain!);
    mkdirSync(executable!);
    writeFileSync(join(plain!, "git"), String.empty, { mode: 0o644 });
    writeFileSync(join(executable!, "git"), String.empty, { mode: 0o755 });
    const searchPath = [relative(process.cwd(), executable!), plain, executable].join(delimiter);
    Assert.areEqual(join(executable!, "git"), WorkingTree.locateGit("linux", searchPath));
  }
}

if (process.platform === "win32")
  Skip("Windows files have no execute permission, and a relative path to another drive is absolute.")(WorkingTreeTests.prototype.skipsRelativeFoldersAndGitFilesWithoutExecutePermission);
