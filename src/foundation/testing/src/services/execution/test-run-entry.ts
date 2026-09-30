/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { writeSync } from "node:fs";

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { TestingException } from "../../exceptions/testing.exception.js";
import { TestProject } from "../../models/discovery/test-project.js";
import { Resources } from "../../resources.js";
import { TestDiscovery } from "../discovery/test-discovery.js";
import { TestReportWriter } from "../reporting/test-report-writer.js";
import { GitHubSummaryWriter } from "../reporting/git-hub-summary-writer.js";
import { TestExecutor } from "./test-executor.js";
import { TestRunner } from "./test-runner.js";

export class TestRunEntry {
  private static readonly DEFAULT_TIMEOUT_MILLISECONDS: number = 30_000;
  private static readonly FILTERS_VARIABLE: string = "CONTEXT_TEST_FILTERS";
  private static readonly SKIP_TEST_DETAILS_VARIABLE: string = "CONTEXT_SKIP_TEST_DETAILS";

  public async runAsync(): Promise<void> {
    const testProjectArguments = process.argv.slice(2);
    const summary = new GitHubSummaryWriter(process.env[Resources.gitHubSummaryVariable]);
    this.keepCoverageFromChildren();

    try {
      const filters = this.parseFilters(process.env[TestRunEntry.FILTERS_VARIABLE]);

      const testProjects: TestProject[] = [];
      for (let index = 0; index < testProjectArguments.length; index += 2) {
        const packageName = testProjectArguments[index];
        const rootDirectory = testProjectArguments[index + 1];
        if (Object.isUndefined(packageName) || Object.isUndefined(rootDirectory))
          throw new TestingException(Resources.testProjectPairRequired);

        testProjects.push(new TestProject(packageName, rootDirectory));
      }

      const runner = new TestRunner(new TestDiscovery(), new TestExecutor(TestRunEntry.DEFAULT_TIMEOUT_MILLISECONDS));
      const reporter = new TestReportWriter(!Object.isUndefined(process.env[TestRunEntry.SKIP_TEST_DETAILS_VARIABLE]));
      const result = await runner.runAsync(testProjects, filters, reporter);

      reporter.writeSummary(result);
      summary.writeTests(result);
      process.exitCode = Math.min(result.failed + Number(result.total === 0), 1);
    }
    catch (error) {
      console.error(String(error));
      summary.writeFailure(String(error));
      process.exitCode = 1;
    }

    // A leaked test resource must fail the run instead of keeping CI alive after the report.
    setTimeout(() => {
      const failure = Resources.formatUnclosedTestResources(process.getActiveResourcesInfo());
      writeSync(Resources.standardErrorDescriptor, failure);
      summary.writeFailure(failure);
      process.exit(Resources.failedExitCode);
    }, Resources.testShutdownGraceMilliseconds).unref();
  }

  // Node read the coverage folder at start and still writes this process's report; a child killed while writing its own
  // would leave a broken report that fails the gate, so children get the folder only from a test that waits for them.
  private keepCoverageFromChildren(): void {
    const directory = process.env[Resources.coverageVariable];
    if (!Object.isUndefined(directory)) {
      process.env[Resources.coverageDirectoryVariable] = directory;
      delete process.env[Resources.coverageVariable];
    }
  }

  private parseFilters(text: string | undefined): string[] {
    if (Object.isUndefined(text))
      throw new TestingException(Resources.testFiltersInvalid);

    let value: unknown;
    try {
      value = JSON.parse(text);
    }
    catch (error) {
      throw new TestingException(Resources.testFiltersInvalid, new ExceptionOptions(error));
    }

    if (!Array.isArray(value))
      throw new TestingException(Resources.testFiltersInvalid);

    const filters: string[] = [];
    for (const filter of value) {
      if (typeof filter !== "string")
        throw new TestingException(Resources.testFiltersInvalid);

      filters.push(filter);
    }

    return filters;
  }
}

await new TestRunEntry().runAsync();
