/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Compiles every package's test project and runs the suite through the foundation Testing package, then
 * enforces the coverage gate for an unfiltered run.
 *
 * @example
 * npm run test - runs the complete suite with the coverage gate.
 * npm run test -- JsonReaderTests - runs the tests matching a filter; coverage is skipped.
 * npm run test -- --skip-test-details --skip-coverage-details - compact output.
 */

import path from "node:path";

import Config from "./config.ts";
import BuildEvidence from "./build/build-evidence.ts";
import Script from "./script.ts";

export class Test extends Script {
  private static readonly TEST_ENTRY_PATH: string = "node_modules/@noldova/teamrun-foundation-testing/services/execution/test-run-entry.js";
  private static readonly SOURCE_MAPS_OPTION: string = "--enable-source-maps";
  private static readonly PROJECT_OPTION: string = "--project";
  private static readonly OPTION_PREFIX: string = "--";
  private static readonly SKIP_TEST_DETAILS_OPTION: string = "--skip-test-details";
  private static readonly SKIP_COVERAGE_DETAILS_OPTION: string = "--skip-coverage-details";
  private static readonly FILTERS_VARIABLE: string = "CONTEXT_TEST_FILTERS";
  private static readonly SKIP_TEST_DETAILS_VARIABLE: string = "CONTEXT_SKIP_TEST_DETAILS";
  private static readonly COVERAGE_VARIABLE: string = "NODE_V8_COVERAGE";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly ENABLED_VALUE: string = "1";
  private static readonly KNOWN_OPTIONS: readonly string[] = [Test.SKIP_TEST_DETAILS_OPTION, Test.SKIP_COVERAGE_DETAILS_OPTION];

  public override async runAsync(): Promise<void> {
    const options = new Set<string>();
    const filters: string[] = [];
    for (const argument of process.argv.slice(2)) {
      if (!argument.startsWith(Test.OPTION_PREFIX)) {
        filters.push(argument);
        continue;
      }
      if (!Test.KNOWN_OPTIONS.includes(argument))
        throw new Error(`Unknown option "${argument}". Known options: ${Test.KNOWN_OPTIONS.join(", ")}.`);
      options.add(argument);
    }

    await BuildEvidence.requireCurrent();
    const testProjectArguments = await this.compileTestProjectsAsync();
    this.writeLog("");
    const environment: Record<string, string> = {};
    environment[Test.FILTERS_VARIABLE] = JSON.stringify(filters);
    if (options.has(Test.SKIP_TEST_DETAILS_OPTION))
      environment[Test.SKIP_TEST_DETAILS_VARIABLE] = Test.ENABLED_VALUE;

    const measureCoverage = filters.length === 0;
    if (measureCoverage) {
      await this.removeDirectoryAsync(Config.COVERAGE_FOLDER);
      await this.createDirectoryAsync(Config.COVERAGE_FOLDER);
      environment[Test.COVERAGE_VARIABLE] = Config.COVERAGE_FOLDER;
    }

    try {
      await this.executeProcessAsync(process.execPath, [Test.SOURCE_MAPS_OPTION, Test.TEST_ENTRY_PATH, ...testProjectArguments], process.cwd(), false, environment);
    }
    catch (error) {
      this.writeLog(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }

    if (!measureCoverage) {
      this.writeLog("Coverage gate skipped for a filtered run.");
      return;
    }

    await this.enforceCoverageAsync(options.has(Test.SKIP_COVERAGE_DETAILS_OPTION));
  }

  private async compileTestProjectsAsync(): Promise<readonly string[]> {
    const testProjectArguments: string[] = [];
    for (const packageInfo of Config.PACKAGES) {
      const projectPath = path.join(packageInfo.directory, Config.TESTS_DIRECTORY_NAME, Config.PROJECT_FILE_NAME);
      if (!await this.pathExistsAsync(projectPath))
        continue;

      const buildDirectory = path.join(Config.TEST_BUILD_FOLDER, packageInfo.name);
      const progress = `Compiling tests of "${packageInfo.packageName}"...`;
      this.writeLog(progress);
      await this.removeDirectoryAsync(buildDirectory);
      await this.executeTypeScriptCompilerAsync([Test.PROJECT_OPTION, projectPath]);
      this.writeLog(`${progress} Done.`, true);
      testProjectArguments.push(packageInfo.packageName, buildDirectory);
    }

    if (testProjectArguments.length === 0)
      throw new Error("No test projects were found.");

    return testProjectArguments;
  }

  private async enforceCoverageAsync(skipCoveredDetails: boolean): Promise<void> {
    const testing = await import("@noldova/teamrun-foundation-testing");
    const projects = Config.PACKAGES.filter(t => t.gated).map(t => new testing.CoverageProject(
      t.packageName,
      path.join(Config.NODE_MODULES_FOLDER, t.packageName),
      path.join(t.directory, Config.SOURCE_DIRECTORY_NAME)));
    const coverage = await new testing.CoverageAnalyzer().analyzeAsync(Config.COVERAGE_FOLDER, projects);

    this.writeLog("");
    for (const line of new testing.CoverageReportWriter().formatLines(coverage, skipCoveredDetails))
      this.writeLog(line);
    new testing.GitHubSummaryWriter(process.env[Test.SUMMARY_VARIABLE]).writeCoverage(coverage);

    if (!coverage.isComplete) {
      this.writeLog("Production coverage is incomplete.");
      process.exitCode = 1;
    }
  }
}

const test = new Test();
await test.runAsync();
