/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

/**
 * Adds a repeatable category name to a test class or method. Method categories
 * combine with categories inherited from their declaring test class. Category
 * metadata supports explicit selection and does not control execution order or
 * concurrency.
 *
 * @param name The non-whitespace category identity.
 */
export declare function Category(name: string): (value: Function) => void;

/**
 * Marks a class as a test class. Discovery accepts only exported classes
 * whose name ends in `Tests` and which carry this mark.
 */
export declare function TestClass(value: Function): void;

/**
 * Adds one inline argument row to a test method. Each repeated `TestData`
 * decorator is discovered, executed, timed, and reported as an independent
 * test in written order.
 *
 * @param values The non-empty argument row supplied to the test method.
 */
export declare function TestData<TArguments extends unknown[]>(...values: TArguments): (value: (...testArguments: TArguments) => unknown) => void;

/**
 * Marks a public instance method of a test class as a test method.
 */
export declare function TestMethod(value: Function): void;

/**
 * Marks a test class or test method as skipped for the given reason. The
 * reason is required and is reported with the skipped result.
 */
export declare function Skip(reason: string): (value: Function) => void;

/**
 * The exception that is thrown when a test assertion fails. Carries the
 * expected and actual values beside the message.
 */
export declare class AssertFailedException extends TestingException {
  /**
   * The value the assertion expected, when applicable.
   */
  public readonly expected: unknown;

  /**
   * The value the assertion observed, when applicable.
   */
  public readonly actual: unknown;

  /**
   * Initializes the exception. A missing message defaults to the canonical
   * assertion-failure text.
   */
  public constructor(message?: string, expected?: unknown, actual?: unknown, options?: ExceptionOptions);
}

/**
 * The base exception for failures owned by the Testing package. It is thrown
 * directly when discovery or execution violates the testing contract.
 */
export declare class TestingException extends Exception {
  /**
   * Initializes the exception with the violation description.
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception that fails a test which did not settle within the executor's
 * timeout.
 */
export declare class TestTimeoutException extends TestingException {
  /**
   * The timeout that elapsed, in milliseconds.
   */
  public readonly timeoutMilliseconds: number;

  /**
   * Initializes the exception with a positive integer timeout. Invalid values
   * throw `ArgumentOutOfRangeException`.
   */
  public constructor(timeoutMilliseconds: number, options?: ExceptionOptions);
}

/**
 * The assertion vocabulary. Every failure throws `AssertFailedException`.
 */
export declare class Assert {
  /**
   * Fails unless the condition is true; a passing call narrows the condition.
   */
  public static isTrue(condition: boolean, message?: string): asserts condition;

  /**
   * Fails unless the condition is false; a passing call narrows to `false`.
   */
  public static isFalse(condition: boolean, message?: string): asserts condition is false;

  /**
   * Fails unless the values are equal by SameValue semantics.
   */
  public static areEqual<T>(expected: T, actual: T, message?: string): void;

  /**
   * Fails when the values are equal by SameValue semantics.
   */
  public static areNotEqual<T>(notExpected: T, actual: T, message?: string): void;

  /**
   * Fails unless the value is exactly null; a passing call narrows to `null`.
   */
  public static isNull(value: unknown, message?: string): asserts value is null;

  /**
   * Fails when the value is exactly null; a passing call excludes `null`.
   */
  public static isNotNull<T>(value: T, message?: string): asserts value is Exclude<T, null>;

  /**
   * Fails unless the value is exactly undefined; a passing call narrows to
   * `undefined`.
   */
  public static isUndefined(value: unknown, message?: string): asserts value is undefined;

  /**
   * Fails when the value is undefined; a passing call excludes `undefined`
   * from the type.
   */
  public static isDefined<T>(value: T, message?: string): asserts value is Exclude<T, undefined>;

  /**
   * Fails unless the value is an instance of the type; a passing call narrows
   * to that type.
   */
  public static isInstanceOf<T>(value: unknown, type: Function & { readonly prototype: T }, message?: string): asserts value is T;

  /**
   * Fails unless the action throws an instance of the exception type; returns
   * the caught exception for further assertions.
   */
  public static throws<TException extends Error>(
    action: () => void,
    exceptionType: Function & (abstract new (...arguments_: never[]) => TException),
    message?: string): TException;

  /**
   * Fails unless the awaited action rejects with an instance of the exception
   * type; returns the caught exception for further assertions.
   */
  public static throwsAsync<TException extends Error>(
    action: () => Promise<unknown>,
    exceptionType: Function & (abstract new (...arguments_: never[]) => TException),
    message?: string): Promise<TException>;

  /**
   * Fails when the action throws.
   */
  public static doesNotThrow(action: () => void, message?: string): void;

  /**
   * Fails unconditionally.
   */
  public static fail(message?: string): never;
}

/**
 * The outcome of one executed or skipped test invocation.
 */
export declare enum TestOutcome {
  /**
   * The test executed without a failure.
   */
  Passed = "Passed",

  /**
   * The test executed and produced a failure.
   */
  Failed = "Failed",

  /**
   * The test did not execute because it carries an explicit skip reason.
   */
  Skipped = "Skipped",
}

/**
 * The immutable result of one test-method invocation. The constructor rejects
 * contradictory outcome, failure, skip, and test-data states.
 */
export declare class TestMethodResult {
  /**
   * The canonical package identity of the test.
   */
  public readonly packageName: string;

  /**
   * The discovered test-class name.
   */
  public readonly className: string;

  /**
   * The discovered test-method name.
   */
  public readonly methodName: string;

  /**
   * The zero-based inline-data index, or undefined for a method without test
   * data.
   */
  public readonly testDataIndex: number | undefined;

  /**
   * The inline arguments supplied to this invocation. Empty for a method
   * without test data.
   */
  public readonly testData: readonly unknown[];

  /**
   * The final classified outcome.
   */
  public readonly outcome: TestOutcome;

  /**
   * The measured execution duration in milliseconds.
   */
  public readonly durationMilliseconds: number;

  /**
   * The thrown failure when the outcome is Failed; undefined otherwise.
   */
  public readonly failure: unknown;

  /**
   * The declared skip reason when the outcome is Skipped; undefined
   * otherwise.
   */
  public readonly skipReason: string | undefined;

  /**
   * The `ClassName.methodName` identity, followed by `[index]` for a
   * parameterized invocation.
   */
  public readonly displayName: string;

  /**
   * Initializes the complete immutable result; fails on contradictory data,
   * outcome, failure, or skip state.
   */
  public constructor(
    packageName: string,
    className: string,
    methodName: string,
    testDataIndex: number | undefined,
    testData: readonly unknown[],
    outcome: TestOutcome,
    durationMilliseconds: number,
    failure: unknown,
    skipReason: string | undefined);
}

/**
 * The immutable results of one test class.
 */
export declare class TestClassResult {
  /**
   * The canonical package identity shared by every contained method result.
   */
  public readonly packageName: string;

  /**
   * The discovered test-class name.
   */
  public readonly className: string;

  /**
   * The package-relative path of the compiled test file, using `/` separators.
   */
  public readonly filePath: string;

  /**
   * The method results in deterministic execution order.
   */
  public readonly methodResults: readonly TestMethodResult[];

  /**
   * Initializes the complete immutable result. At least one method result is
   * required, and every method must carry this package and class identity.
   */
  public constructor(packageName: string, className: string, filePath: string, methodResults: readonly TestMethodResult[]);
}

/**
 * The immutable, reconciled result of one complete run.
 */
export declare class TestRunResult {
  /**
   * The class results in deterministic execution order.
   */
  public readonly classResults: readonly TestClassResult[];

  /**
   * The cumulative measured execution duration of all test rows in milliseconds.
   */
  public readonly durationMilliseconds: number;

  /**
   * The number of passed tests.
   */
  public readonly passed: number;

  /**
   * The number of failed tests.
   */
  public readonly failed: number;

  /**
   * The number of explicitly skipped tests.
   */
  public readonly skipped: number;

  /**
   * The number of tests that actually ran: passed plus failed.
   */
  public readonly executed: number;

  /**
   * Executed plus skipped; must reconcile exactly with discovery.
   */
  public readonly total: number;

  /**
   * Initializes the result and computes the totals from the class results.
   */
  public constructor(classResults: readonly TestClassResult[]);
}

/**
 * One independently executable invocation of a discovered test method.
 */
export declare class DiscoveredTestMethod {
  /**
   * The marked public instance-method name.
   */
  public readonly methodName: string;

  /**
   * The zero-based inline-data index, or undefined for a method without test
   * data.
   */
  public readonly testDataIndex: number | undefined;

  /**
   * The inline arguments supplied to this invocation. Empty for a method
   * without test data.
   */
  public readonly testData: readonly unknown[];

  /**
   * The explicit skip reason, when the method is skipped.
   */
  public readonly skipReason: string | undefined;

  /**
   * The distinct category names declared by the method and inherited from its
   * test class, in written order.
   */
  public readonly categories: readonly string[];

  /**
   * The method name followed by its data index when this is a parameterized
   * invocation.
   */
  public readonly displayName: string;

  /**
   * Initializes one discovered invocation and validates its data identity and
   * optional skip reason and categories.
   */
  public constructor(
    methodName: string,
    testDataIndex: number | undefined,
    testData: readonly unknown[],
    skipReason: string | undefined,
    categories?: readonly string[]);
}

/**
 * One discovered test class, its constructor, and its test methods.
 */
export declare class DiscoveredTestClass {
  /**
   * The canonical package identity supplied by the test project.
   */
  public readonly packageName: string;

  /**
   * The exported marked class name.
   */
  public readonly className: string;

  /**
   * The package-relative path of the compiled test file, using `/` separators.
   */
  public readonly filePath: string;

  /**
   * The constructor used to create a fresh instance for each test invocation.
   */
  public readonly testClassConstructor: new () => object;

  /**
   * The explicit class-level skip reason, when the complete class is skipped.
   */
  public readonly skipReason: string | undefined;

  /**
   * The discovered method invocations in deterministic method and data order.
   */
  public readonly methods: readonly DiscoveredTestMethod[];

  /**
   * The distinct category names declared by the test class, in written order.
   */
  public readonly categories: readonly string[];

  /**
   * Initializes the discovered class with at least one method and an immutable
   * copy of the method and category collections.
   */
  public constructor(
    packageName: string,
    className: string,
    filePath: string,
    testClassConstructor: new () => object,
    skipReason: string | undefined,
    methods: readonly DiscoveredTestMethod[],
    categories?: readonly string[]);
}

/**
 * One test project's explicit package identity and compiled test root.
 */
export declare class TestProject {
  /**
   * The canonical package identity assigned to discovered tests.
   */
  public readonly packageName: string;

  /**
   * The root directory containing the compiled test project.
   */
  public readonly rootDirectory: string;

  /**
   * Initializes the project identity used by discovery and reporting.
   */
  public constructor(packageName: string, rootDirectory: string);
}

/**
 * Deterministic discovery of test classes from compiled test output.
 * Violations of the testing contract fail with `TestingException`.
 */
export declare class TestDiscovery {
  /**
   * Discovers every test class beneath the explicitly identified projects:
   * `*.test.js` files in sorted order, exports in sorted order, methods in
   * sorted order.
   */
  public discoverAsync(testProjects: readonly TestProject[]): Promise<DiscoveredTestClass[]>;

  /**
   * Discovers the test classes of one loaded module under the given package
   * name. Exposed for programmatic and framework self-verification use.
   */
  public discoverModuleExports(moduleExports: object, filePath: string, packageName: string): DiscoveredTestClass[];
}

/**
 * Receives serial progress for the selected test classes. A callback failure
 * stops the run and propagates to its caller.
 */
export interface ITestProgressListener {
  /**
   * Reports a completed class before execution proceeds to the next class.
   * @param result The class's structured test outcomes and durations.
   */
  onClassCompleted(result: TestClassResult): void;
}

/**
 * Executes discovered tests: a fresh instance per method invocation, awaited
 * asynchronous work, a loud timeout, and unhandled-rejection attribution.
 */
export declare class TestExecutor {
  /**
   * Initializes the executor with a positive integer per-test timeout in
   * milliseconds. Invalid values throw `ArgumentOutOfRangeException`.
   */
  public constructor(timeoutMilliseconds: number);

  /**
   * Executes every method invocation of every class in order and returns its
   * independent result.
   * @param testClasses The selected classes, in execution order.
   * @param progress Optional observer notified after each class, before the next begins.
   * @returns Completed class results in execution order.
   */
  public executeAsync(testClasses: readonly DiscoveredTestClass[], progress?: ITestProgressListener): Promise<TestClassResult[]>;
}

/**
 * Orchestrates discovery, selection, execution, and reconciliation.
 */
export declare class TestRunner {
  /**
   * Initializes the runner with its discovery and executor.
   */
  public constructor(discovery: TestDiscovery, executor: TestExecutor);

  /**
   * Runs the explicitly identified test projects. Optional filters select by
   * package name, file path, class name, `ClassName.methodName`, indexed
   * data-case substring, or exact `category:name` identity and are combined
   * with OR semantics. Fails when result totals do not reconcile with discovery.
   * @param testProjects The package identities and compiled test roots to discover.
   * @param filters Optional selection filters; an empty list selects all discovered tests.
   * @param progress Optional observer for selected class execution.
   * @returns The reconciled aggregate result.
   */
  public runAsync(testProjects: readonly TestProject[], filters?: readonly string[], progress?: ITestProgressListener): Promise<TestRunResult>;
}

/**
 * Console presentation of a run result. Each class heading includes its
 * package, package-relative file path, and class identity. The structured
 * result remains the authority; no consumer parses this output.
 */
export declare class TestReportWriter implements ITestProgressListener {
  /**
   * Configures progress reporting; whole-report methods keep their explicit setting.
   * @param skipPassingDetails Hide passed-test details and entirely passing classes;
   * defaults to false. Failures and skips remain visible.
   */
  public constructor(skipPassingDetails?: boolean);

  /**
   * Writes the completed class's heading and test details in the whole-report format.
   * @param result The completed class's structured result.
   */
  public onClassCompleted(result: TestClassResult): void;

  /**
   * Writes final aggregate totals without repeating class details.
   * @param result The complete, reconciled run result.
   */
  public writeSummary(result: TestRunResult): void;

  /**
   * Writes the formatted report to the console.
   * @param result The complete run result to present.
   * @param skipPassingDetails Hide passed-test details and entirely passing classes.
   */
  public write(result: TestRunResult, skipPassingDetails: boolean): void;

  /**
   * Returns the report lines without writing them.
   * @param result The complete run result to present.
   * @param skipPassingDetails Hide passed-test details and entirely passing classes.
   * @returns Class reports followed by final totals, including terminal color sequences.
   */
  public formatLines(result: TestRunResult, skipPassingDetails: boolean): string[];
}

/** Appends bounded GitHub Actions Markdown summaries without replacing existing step content. */
export declare class GitHubSummaryWriter {
  /**
   * Creates a summary writer for the supplied GITHUB_STEP_SUMMARY path.
   * @param path The step summary file; undefined or blank disables output.
   */
  public constructor(path: string | undefined);

  /** Appends counts, summed test duration, and bounded escaped failure/skip details. */
  public writeTests(result: TestRunResult): void;

  /** Appends the coverage gate result, totals, and bounded uncovered-file details. */
  public writeCoverage(result: CoverageResult): void;

  /** Appends a runner or shutdown failure. Write failures are logged without changing the test verdict. */
  public writeFailure(message: string): void;
}

/**
 * One contiguous span of source lines, 1-based and inclusive.
 */
export declare class LineRange {
  /**
   * The inclusive 1-based first line.
   */
  public readonly startLine: number;

  /**
   * The inclusive 1-based final line.
   */
  public readonly endLine: number;

  /**
   * The range as `start` or `start-end` for reports.
   */
  public readonly displayText: string;

  /**
   * Initializes the range.
   */
  public constructor(startLine: number, endLine: number);
}

/**
 * One coverage block: a distinct instrumented V8 block range, excluding
 * function roots, and whether any test run entered it.
 */
export declare class BlockCoverage {
  /**
   * The 1-based source line containing the instrumented block.
   */
  public readonly line: number;

  /**
   * True when at least one test execution entered the block.
   */
  public readonly isTaken: boolean;

  /**
   * Initializes the block coverage.
   */
  public constructor(line: number, isTaken: boolean);
}

/**
 * The flat Source Map v3 payload emitted by the pinned TypeScript bootstrap and
 * consumed by `SourceMap`.
 */
export declare interface ISourceMapData {
  /**
   * The Source Map schema version; only version 3 is accepted.
   */
  readonly version: number;

  /**
   * The ordered original-source paths referenced by mapping segments.
   */
  readonly sources: readonly string[];

  /**
   * The base64 VLQ-encoded generated-to-original mappings.
   */
  readonly mappings: string;

  /**
   * The optional source-root prefix applied during source-path resolution.
   */
  readonly sourceRoot?: string;

  /**
   * The optional symbol-name table referenced by five-field segments.
   */
  readonly names?: readonly string[];
}

/**
 * One mapped source location: the original source file and its 1-based line.
 */
export declare class SourcePosition {
  /**
   * The resolved canonical path of the original source file.
   */
  public readonly sourcePath: string;

  /**
   * The resolved 1-based original source line.
   */
  public readonly line: number;

  /**
   * Initializes the position.
   */
  public constructor(sourcePath: string, line: number);
}

/**
 * A decoded flat Source Map v3 document from the pinned TypeScript bootstrap.
 * Maps generated positions back to the original sources; source paths resolve
 * against the map's directory.
 */
export declare class SourceMap {
  /**
   * Initializes the map from its parsed payload and the directory containing
   * the map file. Fails unless the payload is a valid flat Source Map v3
   * document within the accepted TypeScript bootstrap subset.
   */
  public constructor(data: ISourceMapData, mapDirectory: string);

  /**
   * Maps a generated 1-based line and 0-based column to its source position,
   * using the nearest preceding segment on the same generated line; undefined
   * when no segment maps that position. Invalid coordinates throw
   * `ArgumentOutOfRangeException`.
   */
  public mapToSource(generatedLine: number, generatedColumn: number): SourcePosition | undefined;
}

/**
 * One explicitly identified production project included in a coverage run.
 */
export declare class CoverageProject {
  /**
   * The canonical project identity shown in coverage reports.
   */
  public readonly name: string;

  /**
   * The directory containing the installed production JavaScript files.
   */
  public readonly productionDirectory: string;

  /**
   * The directory against which mapped source paths are reported.
   */
  public readonly sourceDirectory: string;

  /**
   * Initializes the explicit project identity and its production and source
   * roots.
   */
  public constructor(name: string, productionDirectory: string, sourceDirectory: string);
}

/**
 * The coverage state of one production file. Lengths are measured in source
 * code units as reported by the V8 coverage ranges.
 */
export declare class FileCoverage {
  /**
   * The canonical identity of the file's project.
   */
  public readonly projectName: string;

  /**
   * The file path relative to its declared project root.
   */
  public readonly relativePath: string;

  /**
   * The uncovered 1-based source-line ranges.
   */
  public readonly uncoveredLineRanges: readonly LineRange[];

  /**
   * The total executable source length measured in code units.
   */
  public readonly totalLength: number;

  /**
   * The uncovered executable source length measured in code units.
   */
  public readonly uncoveredLength: number;

  /**
   * The distinct instrumented blocks of the file.
   */
  public readonly blockCoverages: readonly BlockCoverage[];

  /**
   * True when the file is executable and has no uncovered range.
   */
  public readonly isFullyCovered: boolean;

  /**
   * True when the file contains executable source ranges. Type-only and other
   * inert files remain in the inventory but do not enter coverage totals.
   */
  public readonly isExecutable: boolean;

  /**
   * The number of distinct instrumented blocks.
   */
  public readonly blockCount: number;

  /**
   * The number of blocks entered by at least one test run.
   */
  public readonly takenBlockCount: number;

  /**
   * Initializes the file coverage; fails when the uncovered line ranges and
   * the uncovered length disagree about whether anything is uncovered, or
   * when a length is negative, fractional, or exceeds the total.
   */
  public constructor(
    projectName: string,
    relativePath: string,
    uncoveredLineRanges: readonly LineRange[],
    totalLength: number,
    uncoveredLength: number,
    blockCoverages: readonly BlockCoverage[]);
}

/**
 * The aggregated coverage of one complete test run.
 */
export declare class CoverageResult {
  /**
   * The coverage state of every inventoried production file.
   */
  public readonly fileCoverages: readonly FileCoverage[];

  /**
   * True when every executable file is fully covered.
   */
  public readonly isComplete: boolean;

  /**
   * The inventoried files that contain executable source ranges.
   */
  public readonly executableFileCoverages: readonly FileCoverage[];

  /**
   * The files that still have uncovered ranges.
   */
  public readonly incompleteFileCoverages: readonly FileCoverage[];

  /**
   * The summed executable length of every inventoried file.
   */
  public readonly totalLength: number;

  /**
   * The summed uncovered length across every measured file.
   */
  public readonly uncoveredLength: number;

  /**
   * The summed block count across every measured file.
   */
  public readonly blockCount: number;

  /**
   * The summed taken-block count across every measured file.
   */
  public readonly takenBlockCount: number;

  /**
   * Initializes the result.
   */
  public constructor(fileCoverages: readonly FileCoverage[]);
}

/**
 * Terminal presentation of a coverage result: one percentage per executable
 * production file, not-applicable markers for inert files, uncovered line
 * ranges, and the overall total. The structured result remains the authority;
 * no consumer parses this output.
 */
export declare class CoverageReportWriter {
  /**
   * Returns the report lines without writing them.
   */
  public formatLines(result: CoverageResult, skipCoveredDetails: boolean): string[];
}

/**
 * Reads the V8 coverage reports written by a test-run child process and
 * computes the uncovered line ranges of the production files.
 */
export declare class CoverageEnvironment {
  /**
   * Builds the environment for a child process a test wants measured. The test run keeps its coverage folder out of
   * `process.env` (as `CONTEXT_COVERAGE_DIRECTORY`) because a child killed while writing its report breaks the gate,
   * so only a test that waits for its child to exit on its own hands the folder back through this method.
   * @param base The environment to copy, usually `process.env`.
   * @returns A copy of `base` with `NODE_V8_COVERAGE` set to the run's coverage folder, or without it when the run
   * measures no coverage.
   */
  public static forChild(base: Readonly<Record<string, string | undefined>>): Record<string, string | undefined>;
}

export declare class CoverageAnalyzer {
  /**
   * Analyzes every report in the coverage directory against the complete
   * inventory of `.js` files beneath the projects' production directories,
   * merging coverage across processes. A file the reports never mention
   * counts as fully uncovered unless it holds no executable content; a
   * position no report claims counts as uncovered; a missing source map falls
   * back to generated coordinates, while a malformed report, source map, or
   * source path outside its declared project root fails the analysis. An empty
   * inventory fails.
   */
  public analyzeAsync(coverageDirectory: string, projects: readonly CoverageProject[]): Promise<CoverageResult>;
}
