/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "desktop.spec.ts",
  outputDir: "../../../../_build/ui-results",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../../../_build/ui-report", open: "never" }],
    ["../../../../scripts/testing/git-hub-ui-reporter.ts"]
  ]
});
