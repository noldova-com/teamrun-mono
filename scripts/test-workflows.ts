/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Script from "./script.ts";

export default class TestWorkflows extends Script {
  private static readonly TYPECHECK_ARGUMENTS: readonly string[] = ["--project", "scripts/tsconfig.json"];
  private static readonly TEST_ARGUMENTS: readonly string[] = [
    "--experimental-test-module-mocks", "--test", "--experimental-test-coverage", "--test-coverage-include-all",
    "--test-coverage-exclude=scripts/tests/**",
    "--test-coverage-lines=100", "--test-coverage-branches=100", "--test-coverage-functions=100",
    "--test-coverage-include=scripts/workflows/*.ts", "--test-coverage-include=scripts/classify-changes.ts",
    "--test-coverage-include=scripts/test-workflows.ts",
    "scripts/tests/workflows/*.test.ts", "scripts/tests/workflow-commands.test.ts"
  ];

  public override async runAsync(): Promise<void> {
    await this.executeTypeScriptCompilerAsync(TestWorkflows.TYPECHECK_ARGUMENTS);
    await this.executeProcessAsync(process.execPath, TestWorkflows.TEST_ARGUMENTS, process.cwd());
  }
}

if (import.meta.main)
  await new TestWorkflows().runAsync();
