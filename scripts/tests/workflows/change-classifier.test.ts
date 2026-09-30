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
      assert.equal(batched.runCode, true);
      assert.equal(batched.reason, `Compared with ${verified}, the last main revision whose run succeeded.`);
      const shortcut = await push([code, verified], documentation);
      assert.equal(shortcut.runCode, false);
      assert.equal(shortcut.reason, `Compared with ${code}, the last main revision whose run succeeded.`);
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
      assert.deepEqual([shortcut.runCode, shortcut.reason], [false, `Compared with the merge base ${start}.`]);
      repository.git(["switch", "-q", "change"]);
      for (const change of [{ "src/notes.md": "notes" }, { "docs/diagram.png": "image" }, { "scripts/README.md": "scripts" }]) {
        const head = await repository.commit(change);
        assert.equal((await pullRequest(head)).runCode, true, JSON.stringify(change));
        repository.git(["reset", "-q", "--hard", documentation]);
      }
      repository.git(["mv", "docs/guide.md", "src/guide.md"]);
      assert.equal((await pullRequest(repository.commitStaged())).runCode, true);
    });

    test("manual runs, unknown revisions and unavailable history select the full verification", async t => {
      const repository = await WorkflowRepositoryFixture.create();
      t.after(() => repository.close());
      const head = await repository.commit({ "README.md": "readme" });
      const classifier = new ChangeClassifier(repository.directory, ChangeClassifierTests.listing([head]));

      assert.equal((await classifier.classifyAsync("workflow_dispatch", "", head)).reason, "Manual runs verify everything.");
      for (const [eventName, base, revision] of [["push", "", ""], ["push", "", ChangeClassifierTests.MISSING], ["pull_request", "", head],
        ["pull_request", ChangeClassifierTests.MISSING, head], ["pull_request", head, "HEAD"]]) {
        const scope = await classifier.classifyAsync(eventName!, base!, revision!);
        assert.deepEqual([scope.runCode, scope.reason], [true, "The comparison history is unavailable."], `${eventName} ${base} ${revision}`);
      }
    });
  }

  private static listing(revisions: readonly string[]): VerifiedRevisions {
    return new VerifiedRevisions("noldova-com/teamrun", "fixture-token", async () => Response.json({ workflow_runs: revisions.map(t => ({ head_sha: t })) }));
  }
}

ChangeClassifierTests.register();
