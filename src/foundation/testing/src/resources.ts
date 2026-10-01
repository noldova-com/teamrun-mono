/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly standardErrorDescriptor: number = 2;
  public static readonly failedExitCode: number = 1;
  public static readonly testShutdownGraceMilliseconds: number = 1000;
  public static readonly gitHubSummaryVariable: string = "GITHUB_STEP_SUMMARY";
  public static readonly coverageVariable: string = "NODE_V8_COVERAGE";
  public static readonly coverageDirectoryVariable: string = "CONTEXT_COVERAGE_DIRECTORY";
  public static readonly temporaryDirectoryPrefix: string = "teamrun-test-run-";
  public static readonly temporaryDirectoryVariables: readonly string[] = ["TMPDIR", "TEMP", "TMP"];
  public static readonly temporaryRemovalRetries: number = 5;
  public static readonly summaryDetailLimit: number = 20_000;
  public static readonly summaryEncoding: BufferEncoding = "utf8";
  public static readonly summaryNewline: string = "\n";
  public static readonly summaryTestHeading: string = "## TeamRun Package Test Report";
  public static readonly summaryCoverageHeading: string = "### Package coverage";
  public static readonly summaryFailureHeading: string = "### Package test execution failed";
  public static readonly summaryTableHeading: string = "| Metric | Result |";
  public static readonly summaryTableSeparator: string = "| --- | ---: |";
  public static readonly summaryFilesLabel: string = "Test files";
  public static readonly summaryCoveredFilesLabel: string = "Fully covered executable files";
  public static readonly summaryGateLabel: string = "Coverage gate";
  public static readonly summaryPassed: string = "Passed";
  public static readonly summaryFailed: string = "Failed";
  public static readonly summaryWriteFailed: string = "Could not write the GitHub job summary; see the console report.";

  public static readonly assertionFailed: string = "Assertion failed.";
  public static readonly expectedTrue: string = "Expected the condition to be true.";
  public static readonly expectedFalse: string = "Expected the condition to be false.";
  public static readonly expectedEqual: string = "Expected the values to be equal.";
  public static readonly expectedNotEqual: string = "Expected the values to be different.";
  public static readonly expectedNull: string = "Expected the value to be null.";
  public static readonly expectedNotNull: string = "Expected the value not to be null.";
  public static readonly expectedUndefined: string = "Expected the value to be undefined.";
  public static readonly expectedDefined: string = "Expected the value to be defined.";
  public static readonly expectedInstanceOf: string = "Expected the value to be an instance of the specified type.";
  public static readonly expectedThrow: string = "Expected the action to throw.";
  public static readonly expectedThrowType: string = "Expected the action to throw the specified exception type.";
  public static readonly expectedNoThrow: string = "Expected the action not to throw.";
  public static readonly testTimedOut: string = "The test did not settle within the allotted timeout.";
  public static readonly durationInvalid: string = "The duration must be a non-negative finite number of milliseconds.";
  public static readonly methodResultIdentityInvalid: string = "Every method result must belong to this package and class.";
  public static readonly lineInvalid: string = "The line must be a positive integer.";
  public static readonly startLineInvalid: string = "The start line must be a positive integer.";
  public static readonly endLineInvalid: string = "The end line must be an integer no smaller than the start line.";
  public static readonly totalLengthInvalid: string = "The total length must be a non-negative integer.";
  public static readonly uncoveredLengthInvalid: string = "The uncovered length must be a non-negative integer no larger than the total length.";
  public static readonly uncoveredRangesInvalid: string = "The uncovered line ranges and the uncovered length must agree: both empty or both present.";
  public static readonly nonExecutableBlocksInvalid: string = "A non-executable file cannot contain coverage blocks.";
  public static readonly timeoutInvalid: string = "The timeout must be a positive integer of milliseconds.";
  public static readonly testProjectPairRequired: string = "Each test project requires a package name and a root directory.";
  public static readonly testFiltersInvalid: string = "The test filters must be a JSON array of strings.";
  public static readonly categoryFilterPrefix: string = "category:";
  public static readonly categoryMarkInvalid: string = "A category mark must carry a non-empty collection of non-whitespace string names.";
  public static readonly skipReasonInvalid: string = "A skip mark must carry a non-whitespace string reason.";
  public static readonly testDataMarkInvalid: string = "A test-data mark must carry a non-empty collection of test-data entries.";
  public static readonly testDataIdentityInvalid: string = "Test data and its index must either both be present or both be absent.";
  public static readonly testDataIndexInvalid: string = "The test-data index must be a non-negative integer.";
  public static readonly coverageUniverseEmpty: string = "The coverage projects contain no production JavaScript files; the coverage universe is empty.";
  public static readonly generatedLineInvalid: string = "The generated line must be a positive integer.";
  public static readonly generatedColumnInvalid: string = "The generated column must be a non-negative integer.";
  public static readonly sourceMapSegmentFieldCountInvalid: string = "A source map segment must contain one, four, or five fields.";
  public static readonly sourceMapGeneratedColumnInvalid: string = "A source map generated column cannot be negative.";
  public static readonly sourceMapGeneratedColumnOrderInvalid: string = "Source map segments must be ordered by generated column.";
  public static readonly sourceMapOriginalPositionInvalid: string = "A source map segment refers to an invalid original position.";
  public static readonly sourceMapNameIndexInvalid: string = "A source map segment refers to an invalid name index.";
  public static readonly sourceMapIntegerUnsupported: string = "A source map mapping value exceeds the supported integer range.";
  public static readonly sourceMapMappingTruncated: string = "A source map contains a truncated mapping value.";
  public static readonly coverageFileHeading: string = "File";
  public static readonly coverageHeading: string = "Coverage";
  public static readonly coverageBlockSeparator: string = "/";
  public static readonly blocksHeading: string = "Blocks";
  public static readonly coverageNotApplicable: string = "-";
  public static readonly coveragePercentSuffix: string = "%";
  public static readonly directorySeparator: string = "/";
  public static readonly windowsDirectorySeparator: string = "\\";
  public static readonly emptyExport: string = "export {};";
  public static readonly lineCommentPrefix: string = "//";
  public static readonly lineFeed: string = "\n";
  public static readonly reportIndent: string = "  ";
  public static readonly tableBottomLeft: string = "└";
  public static readonly tableBottomMiddle: string = "┴";
  public static readonly tableBottomRight: string = "┘";
  public static readonly tableHorizontal: string = "─";
  public static readonly tableMiddle: string = "┼";
  public static readonly tableMiddleLeft: string = "├";
  public static readonly tableMiddleRight: string = "┤";
  public static readonly tableTopLeft: string = "┌";
  public static readonly tableTopMiddle: string = "┬";
  public static readonly tableTopRight: string = "┐";
  public static readonly tableVertical: string = "│";
  public static readonly testReportSeparator: string = "----------------------------------------";
  public static readonly totalLabel: string = "Total:";
  public static readonly timeLabel: string = "Time:";
  public static readonly passedLabel: string = "Passed:";
  public static readonly failedLabel: string = "Failed:";
  public static readonly skippedLabel: string = "Skipped:";
  public static readonly passedMark: string = "✓";
  public static readonly failedMark: string = "✘";
  public static readonly skippedMark: string = "○";
  public static readonly millisecondUnit: string = "ms";
  public static readonly expectedLabel: string = "expected:";
  public static readonly actualLabel: string = "actual:";
  public static readonly threwLabel: string = "threw:";

  public static outcomeCannotCarryFailure(outcome: string): string {
    return `A ${outcome} result cannot carry a failure.`;
  }

  public static outcomeCannotCarrySkipReason(outcome: string): string {
    return `A ${outcome} result cannot carry a skip reason.`;
  }

  public static runResultCountMismatch(resultCount: number, selectedCount: number): string {
    return `The run produced ${resultCount} results for ${selectedCount} selected tests.`;
  }

  public static methodNotCallable(methodName: string, className: string): string {
    return `Method "${methodName}" of "${className}" is not callable.`;
  }

  public static unmarkedNamedTestClass(exportName: string, filePath: string): string {
    return `Export "${exportName}" in "${filePath}" is named like a test class but is not marked with @TestClass.`;
  }

  public static markedTestClassWithoutRequiredName(exportName: string, filePath: string, requiredSuffix: string): string {
    return `Export "${exportName}" in "${filePath}" is marked with @TestClass but its name does not end in "${requiredSuffix}".`;
  }

  public static testFileWithoutTestClass(filePath: string): string {
    return `Test file "${filePath}" yields no test class. Skip a suite deliberately with @Skip("reason"); delete the file when it is no longer needed.`;
  }

  public static testClassWithoutPrototype(className: string, filePath: string): string {
    return `Test class "${className}" in "${filePath}" has no prototype.`;
  }

  public static categoryWithoutTestClass(exportName: string, filePath: string): string {
    return `Export "${exportName}" in "${filePath}" carries @Category but is not marked with @TestClass.`;
  }

  public static staticTestMetadataInvalid(memberName: string, className: string, filePath: string): string {
    return `Static method "${memberName}" of "${className}" in "${filePath}" cannot carry test metadata; mark instance methods only.`;
  }

  public static accessorTestMetadataInvalid(memberName: string, className: string, filePath: string): string {
    return `Accessor "${memberName}" of "${className}" in "${filePath}" cannot carry test metadata; mark instance methods only.`;
  }

  public static testClassWithoutTestMethod(className: string, filePath: string): string {
    return `Test class "${className}" in "${filePath}" declares no test method.`;
  }

  public static testDataWithoutTestMethod(memberName: string, className: string, filePath: string): string {
    return `Method "${memberName}" of "${className}" in "${filePath}" carries @TestData but is not marked with @TestMethod.`;
  }

  public static categoryWithoutTestMethod(memberName: string, className: string, filePath: string): string {
    return `Method "${memberName}" of "${className}" in "${filePath}" carries @Category but is not marked with @TestMethod.`;
  }

  public static testMethodRequiresData(memberName: string, className: string, filePath: string): string {
    return `Test method "${memberName}" of "${className}" in "${filePath}" declares parameters but carries no @TestData.`;
  }

  public static testDataParameterCountMismatch(memberName: string, className: string, filePath: string, expectedCount: number, actualCount: number): string {
    return `Test data for "${memberName}" of "${className}" in "${filePath}" supplies ${actualCount} values for ${expectedCount} parameters.`;
  }

  public static sourceMapVersionInvalid(version: number): string {
    return `A source map must use version ${version}.`;
  }

  public static sourceMapCharacterInvalid(character: string): string {
    return `A source map contains the invalid mapping character "${character}".`;
  }

  public static coverageReportMalformed(reportFilePath: string): string {
    return `The coverage report "${reportFilePath}" is malformed.`;
  }

  public static coverageReportMalformedForReason(reportFilePath: string, reason: string): string {
    return `The coverage report "${reportFilePath}" is malformed: ${reason}.`;
  }

  public static objectRequired(location: string): string {
    return `${location} must be an object`;
  }

  public static stringRequired(location: string): string {
    return `${location} must be a string`;
  }

  public static arrayRequired(location: string): string {
    return `${location} must be an array`;
  }

  public static nonEmptyArrayRequired(location: string): string {
    return `${location} must be a non-empty array`;
  }

  public static nonNegativeIntegerRequired(location: string): string {
    return `${location} must be a non-negative integer`;
  }

  public static integerNoSmallerThanRequired(location: string, lowerBoundName: string): string {
    return `${location} must be an integer no smaller than ${lowerBoundName}`;
  }

  public static sourceMapMalformed(filePath: string): string {
    return `The source map for "${filePath}" is malformed.`;
  }

  public static coverageRangeBeyondFile(rangeEnd: number, fileLength: number): string {
    return `A coverage range ending at ${rangeEnd} exceeds the measured file length ${fileLength}.`;
  }

  public static coverageFileOutsideProject(filePath: string, projectName: string): string {
    return `The coverage file "${filePath}" is outside the declared source or production directory of "${projectName}".`;
  }

  public static coverageFileUrlInvalid(reportFilePath: string, url: string): string {
    return `The coverage report "${reportFilePath}" contains an invalid file URL "${url}".`;
  }

  public static uncoveredLines(lineRange: string): string {
    return `    uncovered lines ${lineRange}`;
  }

  public static overallCoverage(fullyCovered: number, executableCount: number): string {
    return `Overall — ${fullyCovered} of ${executableCount} executable files fully covered`;
  }

  public static skippedTest(methodName: string, reason: string | undefined): string {
    return `${methodName} — skipped: ${reason}`;
  }

  public static formatUnclosedTestResources(resources: readonly string[]): string {
    if (resources.length === 0)
      return `Tests finished but the process did not exit within ${Resources.testShutdownGraceMilliseconds} ms and Node names no open resource; ` +
        "a worker thread or a native handle keeps it alive. Failing the run.\n";

    return `Tests finished but resources remain open: ${resources.join(", ")}. Failing the run.\n`;
  }

  public static formatTemporaryLeftovers(leftovers: readonly string[]): string {
    return `Tests finished but left ${leftovers.join(", ")} in the run's temporary folder; a test must remove what it creates. Failing the run.\n`;
  }

  public static summaryRow(label: string, value: string | number): string {
    return `| ${label} | ${value} |`;
  }

  public static summarySeconds(milliseconds: number): string {
    return `${(milliseconds / 1000).toFixed(2)} s`;
  }

  public static summaryDetails(escaped: string, truncated: boolean): string {
    return `\n<details><summary>Details (full output in the step log)</summary>\n\n<pre>${escaped}</pre>\n${truncated ? "\nAdditional output omitted.\n" : ""}\n</details>\n`;
  }
}
