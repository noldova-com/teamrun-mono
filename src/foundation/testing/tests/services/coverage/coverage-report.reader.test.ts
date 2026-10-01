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
export class CoverageReportReaderTests {
  @TestMethod
  public async rejectsMalformedCoverageJson(): Promise<void> {
    using directory = new TemporaryDirectory();
    const coverageDirectory = directory.path;
    const includedDirectory = join(coverageDirectory, "included");
    await mkdir(includedDirectory);
    await writeFile(join(includedDirectory, "sample.js"), "sample;\n");
    await writeFile(join(coverageDirectory, "coverage-1.json"), "not json");

    await Assert.throwsAsync(async () => {
      await new CoverageAnalyzer().analyzeAsync(coverageDirectory, [new CoverageProject("Sample", includedDirectory, coverageDirectory)]);
    }, TestingException);
  }
}
