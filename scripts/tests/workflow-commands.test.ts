/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mock, test } from "node:test";
import { fileURLToPath } from "node:url";

import ClassifyChanges from "../classify-changes.ts";
import WorkflowRepositoryFixture from "./workflows/fixtures/workflow-repository.fixture.ts";
import WorkflowScriptFixture from "./workflows/fixtures/workflow-script.fixture.ts";

mock.module("../script.ts", { exports: { default: WorkflowScriptFixture } });
const { default: TestWorkflows } = await import("../test-workflows.ts");

class WorkflowCommandsTests {
  public static register(): void {
    test("the test entry point type-checks first, enforces complete coverage and propagates prerequisite failures", async () => {
      await new TestWorkflows().runAsync();
      assert.deepEqual(WorkflowScriptFixture.calls[0], ["--project", "scripts/tsconfig.json"]);
      for (const option of ["--test-coverage-lines=100", "--test-coverage-branches=100", "--test-coverage-functions=100", "--test-coverage-include-all",
        "--test-coverage-exclude=scripts/tests/**", "scripts/tests/workflows/*.test.ts", "scripts/tests/workflow-commands.test.ts"])
        assert.ok(WorkflowScriptFixture.calls[1]?.includes(option), option);
      WorkflowScriptFixture.calls.length = 0;
      WorkflowScriptFixture.failCompilation = true;
      await assert.rejects(new TestWorkflows().runAsync(), /Compilation failed/);
      assert.equal(WorkflowScriptFixture.calls.length, 1);
      WorkflowScriptFixture.failCompilation = false;
      const preload = new URL("./workflows/fixtures/workflow-command.fixture.ts", import.meta.url).href;
      const command = fileURLToPath(new URL("../test-workflows.ts", import.meta.url));
      const child = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", preload, command], { encoding: "utf8", timeout: 10_000 });
      assert.equal(child.status, 0, child.stderr);
    });

    test("the classification command writes the selected scope to the step outputs and summary, and requires both", async t => {
      const repository = await WorkflowRepositoryFixture.create();
      t.after(() => repository.close());
      const verified = await repository.commit({ "src/index.ts": "one" });
      const head = await repository.commit({ "docs/guide.md": "guide" });
      const output = path.join(repository.directory, "outputs");
      const summary = path.join(repository.directory, "summary");
      t.mock.method(globalThis, "fetch", async (url: URL) =>
        Response.json({ workflow_runs: url.searchParams.get("event") === "merge_group" ? [] : [{ head_sha: verified }] }));
      const environment = { GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, GITHUB_REPOSITORY: "noldova-com/teamrun", GH_TOKEN: "fixture-token",
        EVENT_NAME: "push", HEAD_SHA: head };

      await assert.rejects(new ClassifyChanges().runAsync({ ...environment, GITHUB_STEP_SUMMARY: "" }, repository.directory), /GITHUB_STEP_SUMMARY/);
      await assert.rejects(new ClassifyChanges().runAsync({ ...environment, GITHUB_OUTPUT: undefined }, repository.directory), /GITHUB_OUTPUT/);
      await assert.rejects(new ClassifyChanges().runAsync({ GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary }, repository.directory), /owner\/name/);
      await new ClassifyChanges().runAsync(environment, repository.directory);
      await new ClassifyChanges().runAsync({ ...environment, EVENT_NAME: undefined, HEAD_SHA: undefined }, repository.directory);
      assert.equal(await readFile(output, "utf8"), "run-code=false\nrun-code=true\n");
      assert.match(await readFile(summary, "utf8"), new RegExp(`^Code builds and tests are not required\\. Only Markdown documentation changed since ${verified}.*\nFull build .*Manual runs`));
      const child = spawnSync(process.execPath, [fileURLToPath(new URL("../classify-changes.ts", import.meta.url))], {
        cwd: repository.directory, env: { ...process.env, GITHUB_OUTPUT: "" }, encoding: "utf8", timeout: 10_000
      });
      assert.equal(child.status, 1);
      assert.match(child.stderr, /GITHUB_OUTPUT/);
    });

    test("main runs are never cancelled by a later push, and the classification reads the run history with a read-only token", async () => {
      const workflow = await readFile(".github/workflows/build-and-test.yml", "utf8");
      assert.ok(workflow.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"));
      const classification = workflow.slice(workflow.indexOf("\n  changes:\n"), workflow.indexOf("\n  build:\n"));
      assert.match(classification, /permissions:\n {6}actions: read\n {6}contents: read\n/);
      assert.ok(classification.includes("GH_TOKEN: ${{ github.token }}"));
      assert.ok(classification.includes("run: node scripts/classify-changes.ts"));
      assert.ok(workflow.includes("npm run test:workflows"));
      assert.doesNotMatch(workflow, /contents: write|actions: write/);
    });

    test("merge groups run both required checks, the linked-issue one from its own workflow without permissions", async () => {
      const checks = await readFile(".github/workflows/build-and-test.yml", "utf8");
      const linked = await readFile(".github/workflows/require-linked-issue.yml", "utf8");
      const queued = await readFile(".github/workflows/require-linked-issue-merge-group.yml", "utf8");
      const trigger = "  merge_group:\n    types: [checks_requested]\n    branches: [main]\n";
      assert.ok(checks.includes(trigger));
      assert.ok(checks.includes("BASE_SHA: ${{ github.event.pull_request.base.sha || github.event.merge_group.base_sha }}"));
      assert.ok(checks.includes("HEAD_SHA: ${{ github.event.pull_request.head.sha || github.event.merge_group.head_sha || github.sha }}"));
      assert.ok(checks.includes("\npermissions:\n  contents: read\n\n"));
      assert.ok(linked.includes("\non:\n  pull_request_target:\n"));
      assert.doesNotMatch(linked, /merge_group/);
      assert.ok(linked.includes("\npermissions:\n  issues: read\n  pull-requests: read\n\n"));
      assert.ok(queued.includes(`\non:\n${trigger}\npermissions: {}\n`));
      assert.equal((queued.match(/\n {4}name: /g) ?? []).length, 1);
      assert.ok(queued.includes("\n    name: Require linked issue\n"));
      assert.doesNotMatch(queued, /\bif:|pull_request|push:|workflow_dispatch|secrets\.|github\.token/);
    });

    test("each target runs its package tests and its UI workflows in parallel jobs that the required aggregate check needs", async () => {
      const workflow = await readFile(".github/workflows/build-and-test.yml", "utf8");
      assert.ok(workflow.includes("name: Build and test (${{ matrix.target }}, ${{ matrix.suite }})"));
      assert.ok(workflow.includes("suite: [packages, UI]\n        target: [Linux x64, Linux ARM64, Windows x64, Windows ARM64, macOS x64, macOS ARM64]\n"));
      for (const step of ["Run package tests and coverage gate", "Check build contracts", "Check release contracts", "Check packaging contracts", "Check workflow scripts"])
        assert.ok(workflow.includes(`- name: ${step}\n        if: matrix.suite == 'packages'\n`), step);
      for (const step of ["Check desktop tooling", "Run renderer tests", "Run desktop UI workflows"])
        assert.ok(workflow.includes(`- name: ${step}\n        if: matrix.suite == 'UI'\n`), step);
      assert.ok(workflow.includes("- name: Prepare Electron runtime\n        if: matrix.suite == 'UI' || runner.os == 'Windows'\n"));
      assert.ok(workflow.includes("name: logs-${{ matrix.suite }}-${{ matrix.runner }}-${{ matrix.architecture }}-${{ github.run_attempt }}"));
      assert.ok(workflow.includes("name: Build and test (all targets)\n    needs: [changes, build, validate]\n"));
    });
  }
}

WorkflowCommandsTests.register();
