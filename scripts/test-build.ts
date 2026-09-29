/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Script from "./script.ts";

export default class TestBuild extends Script {
  private static readonly TEST_ARGUMENTS: readonly string[] = [
    "--test", "--experimental-test-module-mocks", "--experimental-test-coverage", "--test-coverage-include-all",
    "--test-coverage-lines=100", "--test-coverage-branches=100", "--test-coverage-functions=100",
    "--test-coverage-include=scripts/build.ts", "--test-coverage-include=scripts/build/build-evidence.ts",
    "--test-coverage-include=scripts/test-build.ts", "--test-coverage-exclude=scripts/tests/**",
    "scripts/tests/build.test.ts", "scripts/tests/build/build-evidence.test.ts", "scripts/tests/test-build.test.ts"
  ];

  public override async runAsync(): Promise<void> {
    await this.executeTypeScriptCompilerAsync(["--project", "scripts/tsconfig.json"]);
    await this.executeProcessAsync(process.execPath, TestBuild.TEST_ARGUMENTS, process.cwd());
  }
}

if (import.meta.main)
  await new TestBuild().runAsync();
