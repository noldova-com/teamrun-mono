/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Script from "./script.ts";

class TestPackage extends Script {
  private static readonly TYPECHECK_ARGUMENTS: readonly string[] = ["--project", "scripts/tsconfig.json"];
  private static readonly COVERAGE_ARGUMENTS: readonly string[] = [
    "--test", "--experimental-test-coverage", "--test-coverage-include-all", "--test-coverage-exclude=scripts/tests/**",
    "--test-coverage-lines=100", "--test-coverage-branches=100", "--test-coverage-functions=100"
  ];
  private static readonly SUPPORT_ARGUMENTS: readonly string[] = [
    "--test-coverage-include=scripts/packaging/app-image-launcher.ts",
    "--test-coverage-include=scripts/packaging/package-options.ts",
    "--test-coverage-include=scripts/packaging/package-artifacts.ts",
    "--test-coverage-include=scripts/packaging/packaged-manifest.ts",
    "--test-coverage-include=scripts/packaging/package.exception.ts",
    "--test-coverage-include=scripts/packaging/windows-installer-policy.ts",
    "scripts/tests/packaging/package-options.test.ts", "scripts/tests/packaging/package-artifacts.test.ts",
    "scripts/tests/packaging/windows-installer-policy.test.ts",
    "scripts/tests/packaging/app-image-launcher.test.ts"
  ];
  private static readonly COMMAND_ARGUMENTS: readonly string[] = [
    "--experimental-test-module-mocks", "--test-coverage-include=scripts/package.ts",
    "--test-coverage-include=scripts/test-package.ts",
    "scripts/tests/package-command.test.ts",
    "scripts/tests/package-orchestration.test.ts"
  ];

  public override async runAsync(): Promise<void> {
    await this.executeTypeScriptCompilerAsync(TestPackage.TYPECHECK_ARGUMENTS);
    await this.executeProcessAsync(process.execPath, [...TestPackage.COVERAGE_ARGUMENTS, ...TestPackage.SUPPORT_ARGUMENTS], process.cwd());
    await this.executeProcessAsync(process.execPath, [...TestPackage.COVERAGE_ARGUMENTS, ...TestPackage.COMMAND_ARGUMENTS], process.cwd());
  }
}

await new TestPackage().runAsync();
