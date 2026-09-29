/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Exception } from "@noldova/teamrun-foundation-exceptions";

import type { RuntimeLock } from "../models/runtime-lock.js";
import { Resources } from "../resources.js";

export class RuntimeBuildMismatchException extends Exception {
  public readonly lock: RuntimeLock;

  public constructor(lock: RuntimeLock, dataDirectory: string) {
    super(Resources.formatRuntimeBuildMismatch(dataDirectory, RuntimeBuildMismatchException.describe(lock)));

    this.lock = lock;
  }

  private static describe(lock: RuntimeLock): string {
    const started = new Date(lock.startedAt);
    const date = started.toLocaleDateString(undefined, Resources.runtimeStartedDateFormat);
    const time = started.toLocaleTimeString(undefined, Resources.runtimeStartedTimeFormat);
    return Object.isUndefined(lock.executablePath)
      ? Resources.formatRuntimeVersion(lock.productVersion, date, time)
      : Resources.formatRuntimeProgram(lock.executablePath, lock.productVersion, date, time);
  }
}
