/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Assert, CoverageAnalyzer, CoverageProject, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class FileCoverageAnalyzerTests {
  @TestMethod
  public async ignoresWhitespaceOnlyV8BranchesWithoutHidingUncoveredStatements(): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), "teamrun-coverage-whitespace-"));
    try {
      const included = join(directory, "included");
      await mkdir(included);
      const source = "async function run() { try { return 1; } catch { return 2; }\n        finally { await cleanup(); } }";
      const path = join(included, "sample.js");
      await writeFile(path, source);
      const whitespace = source.indexOf("\n");
      const ranges = [{ startOffset: 0, endOffset: source.length, count: 1 }, { startOffset: whitespace, endOffset: whitespace + 9, count: 0 }];
      const report = { result: [{ url: pathToFileURL(path).href, functions: [{ ranges }] }] };
      const reportPath = join(directory, "coverage.json");
      const projects = [new CoverageProject("Sample", included, included)];
      await writeFile(reportPath, JSON.stringify(report));
      const covered = await new CoverageAnalyzer().analyzeAsync(directory, projects);
      Assert.isTrue(covered.isComplete);
      Assert.areEqual(0, covered.fileCoverages[0]?.blockCount);
      const statement = source.indexOf("return 2;");
      ranges.push({ startOffset: statement, endOffset: statement + 9, count: 0 });
      await writeFile(reportPath, JSON.stringify(report));
      const uncovered = await new CoverageAnalyzer().analyzeAsync(directory, projects);
      Assert.isFalse(uncovered.isComplete);
      Assert.areEqual(1, uncovered.fileCoverages[0]?.blockCount);
      Assert.areEqual(0, uncovered.fileCoverages[0]?.takenBlockCount);
    }
    finally { await rm(directory, { recursive: true, force: true }); }
  }

  @TestMethod
  public async reportsUncoveredLinesOfIncludedFilesOnly(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "line one;\nline two;\nline three;\nline four;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    const excludedPath = join(coverageDirectory, "excluded.js");
    await writeFile(excludedPath, sampleText);

    const report = {
      result: [
        {
          url: pathToFileURL(samplePath).href,
          functions: [{ ranges: [
            { startOffset: 0, endOffset: sampleText.length, count: 1 },
            { startOffset: 10, endOffset: 20, count: 0 },
            { startOffset: 20, endOffset: 31, count: 0 },
          ] }],
        },
        {
          url: pathToFileURL(excludedPath).href,
          functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 0 }] }],
        },
        {
          url: "node:internal/modules",
          functions: [{ ranges: [{ startOffset: 0, endOffset: 10, count: 0 }] }],
        },
      ],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));
    await writeFile(join(coverageDirectory, "ignored.txt"), "not a report");

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [new CoverageProject("Sample", includedDirectory, coverageDirectory)]);

    Assert.areEqual(1, result.fileCoverages.length);
    Assert.isFalse(result.isComplete);
    Assert.areEqual(1, result.incompleteFileCoverages.length);
    Assert.areEqual(1, result.fileCoverages[0]?.uncoveredLineRanges.length);
    Assert.areEqual<string | undefined>("2-3", result.fileCoverages[0]?.uncoveredLineRanges[0]?.displayText);
    Assert.areEqual<number | undefined>(2, result.fileCoverages[0]?.blockCount);
    Assert.areEqual<number | undefined>(0, result.fileCoverages[0]?.takenBlockCount);
    Assert.areEqual<string | undefined>("sample.js", result.fileCoverages[0]?.relativePath);
  }
}
