/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as api from "@noldova/teamrun-foundation-testing";

import { Assert, AssertFailedException, TestClass, TestingException, TestMethod, TestTimeoutException } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TestingApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const exportNames = [
      "Assert", "AssertFailedException", "BlockCoverage", "Category", "CoverageAnalyzer", "CoverageEnvironment", "CoverageProject", "CoverageReportWriter",
      "CoverageResult", "DiscoveredTestClass", "DiscoveredTestMethod", "FileCoverage", "GitHubSummaryWriter", "LineRange",
      "Skip", "SourceMap", "SourcePosition", "TestClass", "TestClassResult", "TestData", "TestDiscovery",
      "TestExecutor", "TestingException", "TestMethod", "TestMethodResult", "TestOutcome",
      "TestProject", "TestReportWriter", "TestRunner", "TestRunResult", "TestTimeoutException",
    ];

    Assert.areEqual(exportNames.sort().join(","), Object.keys(api).sort().join(","));
  }

  @TestMethod
  public exposesTheDeclaredCoreGlobalDependency(): void {
    Assert.areEqual(String.empty, "");
    Assert.isTrue(Object.isNullOrUndefined(undefined));
  }

  @TestMethod
  public exposesThePackageExceptionHierarchy(): void {
    Assert.isInstanceOf(AssertFailedException.prototype, TestingException);
    Assert.isInstanceOf(TestTimeoutException.prototype, TestingException);
  }
}
