/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError, TestStep } from "@playwright/test/reporter";

export default class GitHubUiReporter implements Reporter {
  private static readonly DIRECTORY: string = "_build/ui-results";
  private static readonly SUMMARY_FILE: string = "summary.md";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly MAIN_WINDOW: string = "main-window";
  private static readonly MAIN_WINDOW_FILE: string = "main-window.png";
  private static readonly ROW_LIMIT: number = 50;
  private static readonly DETAIL_LIMIT: number = 10;
  private static readonly TEXT_LIMIT: number = 2_000;
  private static readonly PASSED: string = "Passed";
  private static readonly EXPECTED_FAILURE: string = "Expected failure";
  private static readonly FAILED: string = "Failed";
  private static readonly FLAKY: string = "Flaky";
  private static readonly SKIPPED: string = "Skipped";
  private static readonly NOT_RUN: string = "Not run";
  private static readonly OUTCOMES: readonly string[] = [
    GitHubUiReporter.PASSED, GitHubUiReporter.EXPECTED_FAILURE, GitHubUiReporter.FAILED,
    GitHubUiReporter.FLAKY, GitHubUiReporter.SKIPPED, GitHubUiReporter.NOT_RUN
  ];

  private suite: Suite | null = null;
  private readonly errors: TestError[] = [];
  private errorCount: number = 0;

  public onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite;
  }

  public onError(error: TestError): void {
    this.errorCount++;
    if (this.errors.length < GitHubUiReporter.DETAIL_LIMIT)
      this.errors.push(error);
  }

  public async onEnd(result: FullResult): Promise<{ status: FullResult["status"] }> {
    const tests = this.suite?.allTests() ?? [];
    let status: FullResult["status"] = this.errorCount > 0 || this.suite === null || tests.length === 0 ? "failed" : result.status;
    const directory = path.resolve(GitHubUiReporter.DIRECTORY);
    try {
      mkdirSync(directory, { recursive: true });
      const screenshot = tests.flatMap(t => t.results).flatMap(t => t.attachments)
        .find(t => t.name === GitHubUiReporter.MAIN_WINDOW && t.contentType === "image/png" && t.path !== undefined);
      if (screenshot?.path !== undefined)
        copyFileSync(screenshot.path, path.join(directory, GitHubUiReporter.MAIN_WINDOW_FILE));
    }
    catch (error) {
      this.onError({ message: String(error) });
      status = "failed";
    }

    const markdown = this.format(tests, result, status);
    try {
      writeFileSync(path.join(directory, GitHubUiReporter.SUMMARY_FILE), markdown);
      const summary = process.env[GitHubUiReporter.SUMMARY_VARIABLE];
      if (summary !== undefined && summary.length > 0)
        appendFileSync(summary, markdown);
    }
    catch (error) {
      console.error("Desktop UI report could not be written.", error);
      status = "failed";
    }
    return { status };
  }

  private format(tests: readonly TestCase[], result: FullResult, status: FullResult["status"]): string {
    const outcomes = tests.map(t => GitHubUiReporter.outcome(t));
    const lines = [
      `\n## TeamRun Desktop UI Test Report\n\nPlatform: ${process.platform} ${process.arch}\n`,
      "| Result | Value |", "| --- | ---: |",
      `| Status | ${status} |`, `| Total | ${tests.length} |`,
      ...GitHubUiReporter.OUTCOMES.map(t => `| ${t} | ${outcomes.filter(value => value === t).length} |`),
      `| Runner errors | ${this.errorCount} |`, `| Time | ${(result.duration / 1_000).toFixed(2)} s |`, ""
    ];
    if (this.suite === null || tests.length === 0)
      lines.push("No test results were discovered; this is not a passing UI run.\n");
    else {
      lines.push("| Test | Outcome | Time |", "| --- | --- | ---: |");
      for (const test of tests.slice(0, GitHubUiReporter.ROW_LIMIT)) {
        const last = test.results.at(-1);
        const reason = test.annotations.filter(t => t.type === "skip" || t.type === "fixme").map(t => t.description).filter(t => t !== undefined).join("; ");
        lines.push(`| ${GitHubUiReporter.escape(test.titlePath().filter(t => t.length > 0).join(" › "))} | ${GitHubUiReporter.outcome(test)}${reason.length > 0 ? ": " + GitHubUiReporter.escape(reason) : ""} | ${last === undefined ? "—" : (last.duration / 1_000).toFixed(2) + " s"} |`);
      }
      if (tests.length > GitHubUiReporter.ROW_LIMIT)
        lines.push(`\nShowing ${GitHubUiReporter.ROW_LIMIT} of ${tests.length} tests; totals cover the entire run. See the full UI artifact for the remaining tests.`);
    }

    const errors = [...this.errors];
    let errorCount = this.errorCount;
    for (const test of tests) {
      if (test.outcome() === "expected")
        continue;
      for (const error of test.results.at(-1)?.errors ?? []) {
        errorCount++;
        if (errors.length < GitHubUiReporter.DETAIL_LIMIT)
          errors.push(error);
      }
    }
    if (errors.length > 0) {
      lines.push("\n<details><summary>UI failure details</summary>\n");
      for (const error of errors)
        lines.push(`<pre>${GitHubUiReporter.escape(error.message ?? error.value ?? "Error details unavailable.")}</pre>`);
      if (errorCount > errors.length)
        lines.push(`\nShowing ${errors.length} of ${errorCount} errors; see the full UI artifact for the remaining details.`);
      lines.push("\n</details>");
    }

    const unfinished = tests.filter(t => t.outcome() === "unexpected").flatMap(test => test.results.slice(-1).flatMap(result =>
      GitHubUiReporter.unfinished(result.steps).map(step => {
        const title = [...test.titlePath().filter(t => t.length > 0), ...step.titlePath()].join(" › ");
        return `${title} (started ${((step.startTime.getTime() - result.startTime.getTime()) / 1_000).toFixed(2)} s into the test)`;
      })));
    if (unfinished.length > 0) {
      lines.push("\n<details><summary>Steps still running when failed tests ended</summary>\n");
      for (const step of unfinished.slice(0, GitHubUiReporter.DETAIL_LIMIT))
        lines.push(`- ${GitHubUiReporter.escape(step)}`);
      if (unfinished.length > GitHubUiReporter.DETAIL_LIMIT)
        lines.push(`\nShowing ${GitHubUiReporter.DETAIL_LIMIT} of ${unfinished.length} unfinished steps; see the HTML report in the full UI artifact for the remaining steps.`);
      lines.push("\n</details>");
    }
    return lines.join("\n") + "\n";
  }

  private static unfinished(steps: readonly TestStep[]): TestStep[] {
    return steps.filter(t => t.duration < 0).flatMap(step => {
      const inner = GitHubUiReporter.unfinished(step.steps);
      return inner.length > 0 ? inner : [step];
    });
  }

  private static outcome(test: TestCase): string {
    const last = test.results.at(-1);
    if (last === undefined || last.status === "skipped" && test.expectedStatus !== "skipped")
      return GitHubUiReporter.NOT_RUN;
    switch (test.outcome()) {
      case "expected": return test.expectedStatus === "failed" ? GitHubUiReporter.EXPECTED_FAILURE : GitHubUiReporter.PASSED;
      case "unexpected": return GitHubUiReporter.FAILED;
      case "flaky": return GitHubUiReporter.FLAKY;
      case "skipped": return GitHubUiReporter.SKIPPED;
    }
  }

  private static escape(value: string): string {
    const plain = stripVTControlCharacters(value);
    const clipped = plain.length > GitHubUiReporter.TEXT_LIMIT ? plain.slice(0, GitHubUiReporter.TEXT_LIMIT) + "… [truncated]" : plain;
    return clipped.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll("|", "&#124;").replaceAll("[", "&#91;").replaceAll("]", "&#93;")
      .replaceAll("`", "&#96;").replaceAll("*", "&#42;").replaceAll("_", "&#95;").replaceAll("\\", "&#92;")
      .replaceAll("\r", "").replaceAll("\n", "&#10;");
  }
}
