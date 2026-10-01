/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, CoverageAnalyzer, CoverageProject, TestClass, TestingException, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CoverageAnalyzerTests {
  @TestMethod
  public async rejectsAReportWithoutAResultArray(): Promise<void> {
    await this.assertMalformedReportAsync({ result: "wrong" });
  }

  @TestMethod
  public async rejectsMalformedCoverageShapes(): Promise<void> {
    await this.assertMalformedReportAsync(null);
    await this.assertMalformedReportAsync({ result: [{ url: 1, functions: [] }] });
    await this.assertMalformedReportAsync({ result: [{ url: "node:sample", functions: "wrong" }] });
    await this.assertMalformedReportAsync({ result: [{ url: "node:sample", functions: [null] }] });
    await this.assertMalformedReportAsync({ result: [{ url: "node:sample", functions: [{ ranges: [] }] }] });
    await this.assertMalformedReportAsync({ result: [{ url: "node:sample", functions: [{ ranges: [null] }] }] });
    await this.assertMalformedReportAsync({ result: [{ url: "node:sample", functions: [{ ranges: [{ startOffset: -1, endOffset: 1, count: 1 }] }] }] });
    await this.assertMalformedReportAsync({ result: [{ url: "node:sample", functions: [{ ranges: [{ startOffset: "0", endOffset: 1, count: 1 }] }] }] });
    await this.assertMalformedReportAsync({ result: [{ url: "node:sample", functions: [{ ranges: [{ startOffset: 1, endOffset: 0, count: 1 }] }] }] });
    await this.assertMalformedReportAsync({ result: [{ url: "node:sample", functions: [{ ranges: [{ startOffset: 0, endOffset: "1", count: 1 }] }] }] });
    await this.assertMalformedReportAsync({ result: [{ url: "node:sample", functions: [{ ranges: [{ startOffset: 0, endOffset: 1, count: -1 }] }] }] });
  }

  @TestMethod
  public async rejectsANonNumericCoverageCount(): Promise<void> {
    await this.assertMalformedReportAsync({
      result: [{ url: "node:sample", functions: [{ ranges: [{ startOffset: 0, endOffset: 1, count: "1" }] }] }],
    });
  }

  @TestMethod
  public async rejectsARangeBeyondTheMeasuredFile(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, "x");
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify({
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: 2, count: 1 }] }] }],
    }));

    await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    }, TestingException);
  }

  @TestMethod
  public async rejectsAnInvalidCoverageFileUrl(): Promise<void> {
    await this.assertMalformedReportAsync({
      result: [{ url: "file://%", functions: [{ ranges: [{ startOffset: 0, endOffset: 1, count: 1 }] }] }],
    });
  }

  @TestMethod
  public async rejectsAnEmptyCoverageDirectory(): Promise<void> {
    await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync(" ", [new CoverageProject("Sample", "included", "workspace")]);
    }, ArgumentException);
  }

  @TestMethod
  public async rejectsAnEmptyProjectList(): Promise<void> {
    await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync("somewhere", []);
    }, ArgumentException);
  }

  @TestMethod
  public async failsForAnEmptyUniverse(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    }, TestingException);
  }

  @TestMethod
  public async reportsExplicitProjectIdentityAndRelativeGeneratedPath(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "line one;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 1 }] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);

    Assert.areEqual<string | undefined>("Sample", result.fileCoverages[0]?.projectName);
    Assert.areEqual<string | undefined>("sample.js", result.fileCoverages[0]?.relativePath);
  }

  @TestMethod
  public async preservesEveryDeclaredProjectIdentity(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const firstDirectory = join(coverageDirectory, "first");
    const secondDirectory = join(coverageDirectory, "second");
    await mkdir(firstDirectory);
    await mkdir(secondDirectory);

    const firstPath = join(firstDirectory, "first.js");
    const secondPath = join(secondDirectory, "second.js");
    await writeFile(firstPath, "first;\n");
    await writeFile(secondPath, "second;\n");
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify({
      result: [
        { url: pathToFileURL(firstPath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: 7, count: 1 }] }] },
        { url: pathToFileURL(secondPath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: 8, count: 1 }] }] },
      ],
    }));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [
      new CoverageProject("First", firstDirectory, firstDirectory),
      new CoverageProject("Second", secondDirectory, secondDirectory),
    ]);

    Assert.areEqual(2, result.fileCoverages.length);
    Assert.areEqual<string | undefined>("First", result.fileCoverages[0]?.projectName);
    Assert.areEqual<string | undefined>("first.js", result.fileCoverages[0]?.relativePath);
    Assert.areEqual<string | undefined>("Second", result.fileCoverages[1]?.projectName);
    Assert.areEqual<string | undefined>("second.js", result.fileCoverages[1]?.relativePath);
  }

  @TestMethod
  public async recognizesEveryTextOwnedLineBreak(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "one;\rtwo;\u2028three;\u2029four;\r\nfive;\n";
    const samplePath = join(includedDirectory, "sample.js");
    const uncoveredStart = sampleText.indexOf("three;");
    const uncoveredEnd = uncoveredStart + "three;".length;
    await writeFile(samplePath, sampleText);
    await writeFile(join(coverageDirectory, "coverage.json"), JSON.stringify({
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [
        { startOffset: 0, endOffset: sampleText.length, count: 1 },
        { startOffset: uncoveredStart, endOffset: uncoveredEnd, count: 0 },
      ] }] }],
    }));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);

    Assert.areEqual<string | undefined>("3", result.fileCoverages[0]?.uncoveredLineRanges[0]?.displayText);
  }

  @TestMethod
  public async mergesCountsAcrossReports(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "line one;\nline two;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);

    const uncoveredHere = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 0 }] }] }],
    };
    const coveredThere = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 2 }] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(uncoveredHere));
    await writeFile(join(coverageDirectory, "coverage-2.json"), JSON.stringify(coveredThere));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);

    Assert.isTrue(result.isComplete);
    Assert.areEqual<boolean | undefined>(true, result.fileCoverages[0]?.isFullyCovered);
  }

  @TestMethod
  public async mergesReportsWithDifferingBlockRangeSets(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "line one;\nline two;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);

    const withUncoveredBlock = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [
        { startOffset: 0, endOffset: sampleText.length, count: 1 },
        { startOffset: 5, endOffset: 12, count: 0 },
      ] }] }],
    };
    const withoutThatBlock = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [
        { startOffset: 0, endOffset: sampleText.length, count: 3 },
      ] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(withUncoveredBlock));
    await writeFile(join(coverageDirectory, "coverage-2.json"), JSON.stringify(withoutThatBlock));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);

    Assert.isTrue(result.isComplete);
    Assert.areEqual(1, result.blockCount);
    Assert.areEqual(1, result.takenBlockCount);
  }

  @TestMethod
  public async paintsNestedRangesSharingAStartOffset(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "line one;\nline two;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [
        { startOffset: 0, endOffset: sampleText.length, count: 1 },
        { startOffset: 0, endOffset: 7, count: 0 },
        { startOffset: 0, endOffset: 3, count: 0 },
      ] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);

    Assert.isFalse(result.isComplete);
    Assert.areEqual<string | undefined>("1", result.fileCoverages[0]?.uncoveredLineRanges[0]?.displayText);
    Assert.areEqual<number | undefined>(2, result.fileCoverages[0]?.blockCount);
    Assert.areEqual<number | undefined>(0, result.fileCoverages[0]?.takenBlockCount);
  }

  @TestMethod
  public async treatsUnclaimedPositionsAsUncovered(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "aaaa;\nbbbb;\ncccc;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 6, endOffset: 11, count: 1 }] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    const ranges = result.fileCoverages[0]?.uncoveredLineRanges ?? [];

    Assert.isFalse(result.isComplete);
    Assert.areEqual(1, ranges.length);
    Assert.areEqual<string | undefined>("1-3", ranges[0]?.displayText);
    Assert.areEqual<number | undefined>(13, result.fileCoverages[0]?.uncoveredLength);
  }

  @TestMethod
  public async reportsANeverLoadedFileAsUncovered(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "line one;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    const orphanText = "orphan one;\norphan two;\n";
    await writeFile(join(includedDirectory, "orphan.js"), orphanText);

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 1 }] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    const orphanCoverage = result.fileCoverages.find(t => t.relativePath.endsWith("orphan.js"));

    Assert.areEqual(2, result.fileCoverages.length);
    Assert.isFalse(result.isComplete);
    Assert.isDefined(orphanCoverage);
    Assert.areEqual(orphanText.length, orphanCoverage.uncoveredLength);
    Assert.areEqual<string | undefined>("1-2", orphanCoverage.uncoveredLineRanges[0]?.displayText);
  }

  @TestMethod
  public async identifiesANeverLoadedInertFileAsNonExecutable(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "line one;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    await writeFile(join(includedDirectory, "inert.js"), "/**\n * License.\n */\nexport {};\n//# sourceMappingURL=inert.js.map\n");

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 1 }] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    const inertCoverage = result.fileCoverages.find(t => t.relativePath.endsWith("inert.js"));

    Assert.areEqual(2, result.fileCoverages.length);
    Assert.isTrue(result.isComplete);
    Assert.isDefined(inertCoverage);
    Assert.isFalse(inertCoverage.isExecutable);
    Assert.isFalse(inertCoverage.isFullyCovered);
    Assert.areEqual(0, inertCoverage.totalLength);
  }

  @TestMethod
  public async mapsCoverageToTypeScriptSources(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "l1;\nl2;\nl3;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    await writeFile(`${samplePath}.map`, JSON.stringify({ version: 3, sources: ["sample.ts"], mappings: "AAKA;AACA;AACA" }));

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [
        { startOffset: 0, endOffset: sampleText.length, count: 1 },
        { startOffset: 4, endOffset: 7, count: 0 },
      ] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);

    Assert.areEqual<string | undefined>("included/sample.ts", result.fileCoverages[0]?.relativePath);
    Assert.areEqual<string | undefined>("7", result.fileCoverages[0]?.uncoveredLineRanges[0]?.displayText);
    Assert.areEqual<number | undefined>(7, result.fileCoverages[0]?.blockCoverages[0]?.line);
  }

  @TestMethod
  public async honorsTheSourceRootOfAMap(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "l1;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    await writeFile(`${samplePath}.map`, JSON.stringify({ version: 3, sourceRoot: "src/", sources: ["sample.ts"], mappings: "AAAA" }));

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 1 }] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);

    Assert.areEqual<string | undefined>("included/src/sample.ts", result.fileCoverages[0]?.relativePath);
  }

  @TestMethod
  public async failsForAMalformedMap(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "l1;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    await writeFile(`${samplePath}.map`, "not a source map");

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 1 }] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const failure = await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    }, TestingException);

    Assert.isTrue(failure.message.includes("malformed"));
  }

  @TestMethod
  public async failsForAnUnreadableMap(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "l1;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    await mkdir(`${samplePath}.map`);

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 1 }] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    }, Error);
  }

  @TestMethod
  public async sortsLineRangesThatAMapReorders(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "l1;\nl2;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    await writeFile(`${samplePath}.map`, JSON.stringify({ version: 3, sources: ["sample.ts"], mappings: "AAEA;AAFA" }));

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [
        { startOffset: 0, endOffset: sampleText.length, count: 1 },
        { startOffset: 0, endOffset: 3, count: 0 },
        { startOffset: 4, endOffset: 7, count: 0 },
      ] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    const ranges = result.fileCoverages[0]?.uncoveredLineRanges ?? [];

    Assert.areEqual<string | undefined>("1", ranges[0]?.displayText);
    Assert.areEqual<string | undefined>("3", ranges[1]?.displayText);
  }

  @TestMethod
  public async fallsBackToGeneratedLinesBeforeTheFirstMapping(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "l1;\nl2;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    await writeFile(`${samplePath}.map`, JSON.stringify({ version: 3, sources: ["sample.ts"], mappings: ";AACA" }));

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [
        { startOffset: 0, endOffset: sampleText.length, count: 1 },
        { startOffset: 0, endOffset: 3, count: 0 },
      ] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);

    Assert.areEqual<string | undefined>("included/sample.ts", result.fileCoverages[0]?.relativePath);
    Assert.areEqual<string | undefined>("1", result.fileCoverages[0]?.uncoveredLineRanges[0]?.displayText);
  }

  @TestMethod
  public async keepsTheGeneratedPathWhenAMapHasNoMappedSegment(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "l1;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    await writeFile(`${samplePath}.map`, JSON.stringify({ version: 3, sources: ["sample.ts"], mappings: String.empty }));
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify({
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 1 }] }] }],
    }));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);

    Assert.areEqual<string | undefined>("sample.js", result.fileCoverages[0]?.relativePath);
  }

  @TestMethod
  public async mergesAdjacentUncoveredLineRanges(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "aaaa;\nbbbb;\ncccc;\ndddd;\neeee;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);

    const report = {
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [
        { startOffset: 0, endOffset: sampleText.length, count: 1 },
        { startOffset: 6, endOffset: 11, count: 0 },
        { startOffset: 12, endOffset: 17, count: 0 },
        { startOffset: 24, endOffset: 29, count: 0 },
      ] }] }],
    };
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    const ranges = result.fileCoverages[0]?.uncoveredLineRanges ?? [];

    Assert.areEqual(2, ranges.length);
    Assert.areEqual<string | undefined>("2-3", ranges[0]?.displayText);
    Assert.areEqual<string | undefined>("5", ranges[1]?.displayText);
  }

  @TestMethod
  public async rejectsAMappedSourceOutsideTheDeclaredSourceDirectory(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);

    const sampleText = "l1;\n";
    const samplePath = join(includedDirectory, "sample.js");
    await writeFile(samplePath, sampleText);
    await writeFile(`${samplePath}.map`, JSON.stringify({ version: 3, sources: ["../outside/sample.ts"], mappings: "AAAA" }));
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify({
      result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 1 }] }] }],
    }));

    await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, includedDirectory)]);
    }, TestingException);
  }

  private createProject(productionDirectory: string, sourceDirectory: string): CoverageProject {
    return new CoverageProject("Sample", productionDirectory, sourceDirectory);
  }

  private async assertMalformedReportAsync(report: unknown): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);
    await writeFile(join(includedDirectory, "sample.js"), "sample;\n");
    await writeFile(join(coverageDirectory, "coverage-1.json"), JSON.stringify(report));

    await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [this.createProject(includedDirectory, coverageDirectory)]);
    }, TestingException);
  }
}
