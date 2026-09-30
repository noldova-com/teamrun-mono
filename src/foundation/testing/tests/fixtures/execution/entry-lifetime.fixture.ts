/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Worker } from "node:worker_threads";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class EntryLifetimeFixture {
  @TestMethod
  public finishesCleanly(): void {
    Assert.isTrue(true);
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
