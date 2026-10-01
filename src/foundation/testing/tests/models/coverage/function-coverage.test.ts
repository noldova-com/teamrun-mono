/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Assert, CoverageAnalyzer, CoverageProject, TestClass, TestingException, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class FunctionCoverageTests {
  @TestMethod
  public async rejectsAFunctionWithoutRanges(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const productionDirectory = join(coverageDirectory, "production");
    await mkdir(productionDirectory);
    await writeFile(join(productionDirectory, "sample.js"), "sample;\n");
    await writeFile(join(coverageDirectory, "coverage.json"), JSON.stringify({
      result: [{ url: "node:sample", functions: [{ ranges: [] }] }],
    }));

    await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [new CoverageProject("Sample", productionDirectory, coverageDirectory)]);
    }, TestingException);
  }
}
