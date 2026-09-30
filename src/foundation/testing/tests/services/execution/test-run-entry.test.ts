/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

import { EntryRun } from "../../fixtures/execution/entry-run.fixture.js";

@TestClass
export class TestRunEntryTests {
  @TestMethod
  @TestData("finishesCleanly", 0, null)
  @TestData("passesButLeaksATimer", 1, "resources remain open: Timeout")
  @TestData("failsAndLeaksATimer", 1, "resources remain open: Timeout")
  @TestData("passesButLeaksAWorkerThread", 1, "Node names no open resource; a worker thread or a native handle keeps it alive")
  public async exitsAfterReportingEvenWhenATestLeaksAResource(method: string, code: number, failure: string | null): Promise<void> {
    const leaked = !Object.isNull(failure);
    const directory = await mkdtemp(join(tmpdir(), "teamrun-entry-lifetime-"));
    try {
      const fixture = new URL("../../fixtures/execution/entry-lifetime.fixture.js", import.meta.url).href;
      await writeFile(join(directory, "lifetime.test.js"), `export { EntryLifetimeFixture as EntryLifetimeTests } from ${JSON.stringify(fixture)};\n`);
      const summaryPath = join(directory, "summary.md");
      const result = await this.runEntryArgumentsAsync(["TestPackage", directory], JSON.stringify([method]), summaryPath);
      const summary = await readFile(summaryPath, "utf8");
      Assert.areEqual(code, result.exitCode, result.errorOutput);
      Assert.areEqual(leaked, result.errorOutput.includes("Failing the run"));
      if (!Object.isNull(failure))
        Assert.isTrue(result.errorOutput.includes(failure), result.errorOutput);
      Assert.isTrue(summary.includes("## TeamRun Package Test Report"));
      Assert.isTrue(summary.includes("| Total: | 1 |"));
      Assert.areEqual(leaked, summary.includes("### Package test execution failed"));
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async reportsAContractViolationAsACleanVerdict(): Promise<void> {
    const rootDirectory = await mkdtemp(join(tmpdir(), "context-entry-"));
    await writeFile(join(rootDirectory, "empty.test.js"), "export {};\n");

    const entryRun = await this.runEntryAsync("TestPackage", rootDirectory);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("TestingException"));
    Assert.isTrue(entryRun.errorOutput.includes("yields no test class"));
    Assert.isFalse(entryRun.errorOutput.includes("    at "));
  }

  @TestMethod
  public async failsAnEmptySelectionLoudly(): Promise<void> {
    const rootDirectory = await mkdtemp(join(tmpdir(), "context-entry-"));

    const entryRun = await this.runEntryAsync("TestPackage", rootDirectory);

    Assert.areEqual(1, entryRun.exitCode);
  }

  @TestMethod
  public async rejectsAnIncompleteProjectPair(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync(["TestPackage"]);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("requires a package name and a root directory"));
  }

  @TestMethod
  public async reportsRunnerFailuresInTheJobSummary(): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), "teamrun-entry-summary-"));
    try {
      const summaryPath = join(directory, "summary.md");
      const result = await this.runEntryArgumentsAsync(["TestPackage"], "[]", summaryPath);
      Assert.areEqual(1, result.exitCode);
      const summary = await readFile(summaryPath, "utf8");
      Assert.isTrue(summary.includes("Package test execution failed"));
      Assert.isTrue(summary.includes("requires a package name and a root directory"));
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async rejectsAnEmptyPackageName(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([String.empty, "compiled/tests"]);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("ArgumentException"));
  }

  @TestMethod
  public async rejectsAnEmptyRootDirectory(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync(["TestPackage", String.empty]);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("ArgumentException"));
  }

  @TestMethod
  public async rejectsMalformedFilters(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "not-json");

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("test filters must be a JSON array of strings"));
  }

  @TestMethod
  public async rejectsMissingFilters(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], null);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("test filters must be a JSON array of strings"));
  }

  @TestMethod
  public async rejectsFiltersThatAreNotAnArray(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "{}");

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("test filters must be a JSON array of strings"));
  }

  @TestMethod
  public async rejectsNonStringFilters(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "[1]");

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("test filters must be a JSON array of strings"));
  }

  @TestMethod
  public async acceptsStringFilters(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "[\"sample\"]");

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isFalse(entryRun.errorOutput.includes("test filters must be a JSON array of strings"));
  }

  private runEntryAsync(packageName: string, rootDirectory: string): Promise<EntryRun> {
    return this.runEntryArgumentsAsync([packageName, rootDirectory]);
  }

  private async runEntryArgumentsAsync(arguments_: readonly string[], filters: string | null = "[]", summaryPath?: string): Promise<EntryRun> {
    const environment = { ...process.env };
    // Fixture subprocesses must not append their deliberately failing results to the real CI summary.
    delete environment["GITHUB_STEP_SUMMARY"];
    if (!Object.isUndefined(summaryPath))
      environment["GITHUB_STEP_SUMMARY"] = summaryPath;
    if (Object.isNull(filters))
      delete environment["CONTEXT_TEST_FILTERS"];
    else
      environment["CONTEXT_TEST_FILTERS"] = filters;

    // The entry's stderr goes to a file, as in CI, so the child's open resources are its own and not pipes to this process.
    const directory = await mkdtemp(join(tmpdir(), "teamrun-entry-output-"));
    const errorPath = join(directory, "stderr.log");
    const errorFile = openSync(errorPath, "w");
    try {
      const exitCode = await new Promise<number>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["node_modules/@noldova/teamrun-foundation-testing/services/execution/test-run-entry.js", ...arguments_],
          { env: environment, shell: false, timeout: 5000, stdio: ["ignore", "ignore", errorFile] });
        child.on("close", t => resolve(t ?? -1));
        child.on("error", reject);
      });
      return new EntryRun(exitCode, await readFile(errorPath, "utf8"));
    }
    finally {
      closeSync(errorFile);
      await rm(directory, { recursive: true, force: true });
    }
  }
}
