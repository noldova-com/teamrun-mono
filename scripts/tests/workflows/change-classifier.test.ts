/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ChangeClassifier from "../../workflows/change-classifier.ts";
import type VerificationScope from "../../workflows/verification-scope.ts";
import VerifiedRevisions from "../../workflows/verified-revisions.ts";
import WorkflowRepositoryFixture from "./fixtures/workflow-repository.fixture.ts";

class ChangeClassifierTests {
  private static readonly MISSING: string = "0".repeat(40);

  public static register(): void {
    test("a push compares with the newest revision in its history whose main run succeeded, covering every push since", async t => {
      const repository = await WorkflowRepositoryFixture.create();
      t.after(() => repository.close());
      const verified = await repository.commit({ "src/index.ts": "one" });
      const code = await repository.commit({ "src/index.ts": "two" });
      const documentation = await repository.commit({ "README.md": "readme", "docs/guide.md": "guide", ".github/CONTRIBUTING.md": "contributing" });
      repository.git(["switch", "-q", "-c", "elsewhere", verified]);
      const unrelated = await repository.commit({ "other.md": "other" });
      const push = (revisions: readonly string[], head: string): Promise<VerificationScope> =>
        new ChangeClassifier(repository.directory, ChangeClassifierTests.listing(revisions)).classifyAsync("push", "", head);

      const batched = await push([unrelated, ChangeClassifierTests.MISSING, verified], documentation);
      assert.deepEqual([batched.runCode, batched.reason],
        [true, `Files other than Markdown documentation changed since ${verified}, the last main revision whose run succeeded.`]);
      const shortcut = await push([code, verified], documentation);
      assert.deepEqual([shortcut.runCode, shortcut.reason], [false, `Only Markdown documentation changed since ${code}, the last main revision whose run succeeded.`]);
      const unverified = await push([unrelated, ChangeClassifierTests.MISSING], documentation);
      assert.deepEqual([unverified.runCode, unverified.reason], [true, "No earlier main revision with a successful run is in this revision's history."]);
      const rerun = await push([documentation], documentation);
      assert.deepEqual([rerun.runCode, rerun.reason], [true, "The comparison found no changed files."]);
    });

    test("a pull request compares with its merge base and skips code checks only for Markdown at the root, in docs or in .github", async t => {
      const repository = await WorkflowRepositoryFixture.create();
      t.after(() => repository.close());
      const start = await repository.commit({ "src/index.ts": "one", "docs/guide.md": "guide" });
      repository.git(["switch", "-q", "-c", "change"]);
      const documentation = await repository.commit({ "README.md": "readme", "docs/guide.md": "changed", ".github/CONTRIBUTING.md": "contributing" });
      repository.git(["switch", "-q", "main"]);
      const moved = await repository.commit({ "src/index.ts": "two" });
      const pullRequest = (head: string): Promise<VerificationScope> =>
        new ChangeClassifier(repository.directory, ChangeClassifierTests.listing([])).classifyAsync("pull_request", moved, head);

      const shortcut = await pullRequest(documentation);
      assert.deepEqual([shortcut.runCode, shortcut.reason], [false, `Only Markdown documentation changed since the merge base ${start}.`]);
      repository.git(["switch", "-q", "change"]);
      for (const change of [{ "src/notes.md": "notes" }, { "docs/diagram.png": "image" }, { "scripts/README.md": "scripts" }]) {
        const head = await repository.commit(change);
        assert.equal((await pullRequest(head)).runCode, true, JSON.stringify(change));
        repository.git(["reset", "-q", "--hard", documentation]);
      }
      repository.git(["mv", "docs/guide.md", "src/guide.md"]);
      assert.equal((await pullRequest(repository.commitStaged())).runCode, true);
    });

    test("a push skips the code checks when a merge queue run passed for the same tree, even under another commit", async t => {
      const repository = await WorkflowRepositoryFixture.create();
      t.after(() => repository.close());
      const verified = await repository.commit({ "src/index.ts": "one" });
      const queued = await repository.commit({ "src/index.ts": "two" });
      const tree = repository.git(["rev-parse", `${queued}^{tree}`]);
      const pushed = repository.git(["commit-tree", tree, "-p", verified, "-m", "The same tree under another commit"]);
      const push = (trees: readonly string[], head: string): Promise<VerificationScope> =>
        new ChangeClassifier(repository.directory, ChangeClassifierTests.listing([verified], trees)).classifyAsync("push", "", head);

      assert.notEqual(pushed, queued);
      for (const head of [queued, pushed]) {
        const skipped = await push([ChangeClassifierTests.MISSING, tree], head);
        assert.deepEqual([skipped.runCode, skipped.reason], [false, `A merge queue run of Build and test already passed for this revision's tree ${tree}.`]);
      }
      const other = await push([repository.git(["rev-parse", `${verified}^{tree}`])], pushed);
      assert.deepEqual([other.runCode, other.reason],
        [true, `Files other than Markdown documentation changed since ${verified}, the last main revision whose run succeeded.`]);
    });

    test("a merge group compares with the commit it builds on, which holds main and the entries ahead of it", async t => {
      const repository = await WorkflowRepositoryFixture.create();
      t.after(() => repository.close());
      const ahead = await repository.commit({ "src/index.ts": "one" });
      const documentation = await repository.commit({ "docs/guide.md": "guide" });
      const code = await repository.commit({ "src/index.ts": "two" });
      const group = (base: string, head: string): Promise<VerificationScope> =>
        new ChangeClassifier(repository.directory, ChangeClassifierTests.listing([])).classifyAsync("merge_group", base, head);

      const shortcut = await group(ahead, documentation);
      assert.deepEqual([shortcut.runCode, shortcut.reason], [false, `Only Markdown documentation changed since the merge base ${ahead}.`]);
      const full = await group(documentation, code);
      assert.deepEqual([full.runCode, full.reason], [true, `Files other than Markdown documentation changed since the merge base ${documentation}.`]);
    });

    test("manual runs, unknown revisions and unavailable history select the full verification", async t => {
      const repository = await WorkflowRepositoryFixture.create();
      t.after(() => repository.close());
      const head = await repository.commit({ "README.md": "readme" });
      const classifier = new ChangeClassifier(repository.directory, ChangeClassifierTests.listing([head]));

      assert.equal((await classifier.classifyAsync("workflow_dispatch", "", head)).reason, "Manual runs verify everything.");
      for (const [eventName, base, revision] of [["push", "", ""], ["push", "", ChangeClassifierTests.MISSING], ["pull_request", "", head],
        ["pull_request", ChangeClassifierTests.MISSING, head], ["pull_request", head, "HEAD"], ["merge_group", "", head]]) {
        const scope = await classifier.classifyAsync(eventName!, base!, revision!);
        assert.deepEqual([scope.runCode, scope.reason], [true, "The comparison history is unavailable."], `${eventName} ${base} ${revision}`);
      }
    });
  }

  private static listing(revisions: readonly string[], trees: readonly string[] = []): VerifiedRevisions {
    return new VerifiedRevisions("noldova-com/teamrun", "fixture-token", async url => Response.json({
      workflow_runs: new URL(String(url)).searchParams.get("event") === "merge_group"
        ? trees.map(t => ({ head_commit: { tree_id: t } }))
        : revisions.map(t => ({ head_sha: t }))
    }));
  }
}

ChangeClassifierTests.register();
