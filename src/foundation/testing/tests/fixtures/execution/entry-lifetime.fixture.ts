/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Worker } from "node:worker_threads";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class EntryLifetimeFixture {
  @TestMethod
  public finishesCleanly(): void {
    Assert.isTrue(true);
  }

  @TestMethod
  public keepsTheCoverageFolderOutOfItsEnvironment(): void {
    Assert.isTrue(Object.isUndefined(process.env["NODE_V8_COVERAGE"]));
    Assert.isFalse(Object.isUndefined(process.env["CONTEXT_COVERAGE_DIRECTORY"]));
  }

  @TestMethod
  public usesTheRunsOwnTemporaryFolder(): void {
    Assert.isTrue(basename(tmpdir()).startsWith("teamrun-test-run-"));
    rmSync(mkdtempSync(join(tmpdir(), "entry-removed-")), { recursive: true });
  }

  @TestMethod
  public leavesATemporaryFolder(): void {
    mkdtempSync(join(tmpdir(), "entry-leftover-"));
  }

  @TestMethod
  public passesButLeaksATimer(): void {
    setInterval(() => {}, 1000);
  }

  @TestMethod
  public passesButLeaksAWorkerThread(): void {
    new Worker("setInterval(() => {}, 1000);", { eval: true });
  }

  @TestMethod
  public failsAndLeaksATimer(): void {
    setInterval(() => {}, 1000);
    Assert.isTrue(false);
  }
}
