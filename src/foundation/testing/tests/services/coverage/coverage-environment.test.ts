/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, CoverageEnvironment, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class CoverageEnvironmentTests {
  @TestMethod
  public givesAChildTheRunsCoverageFolder(): void {
    const base = { CONTEXT_COVERAGE_DIRECTORY: "run-coverage", PATH: "p" };

    const environment = CoverageEnvironment.forChild(base);

    Assert.areEqual("run-coverage", environment["NODE_V8_COVERAGE"]);
    Assert.areEqual("p", environment["PATH"]);
    Assert.isUndefined(base["NODE_V8_COVERAGE" as keyof typeof base]);
  }

  @TestMethod
  public keepsCoverageOutOfAChildWhenTheRunMeasuresNone(): void {
    const environment = CoverageEnvironment.forChild({ NODE_V8_COVERAGE: "stale", PATH: "p" });

    Assert.isUndefined(environment["NODE_V8_COVERAGE"]);
    Assert.areEqual("p", environment["PATH"]);
  }
}
