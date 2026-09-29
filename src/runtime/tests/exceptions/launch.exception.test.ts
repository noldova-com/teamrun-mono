/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { LaunchException } from "@noldova/teamrun-runtime";

@TestClass
export class LaunchExceptionTests {
  @TestMethod
  public formatsTheReason(): void {
    const exception = new LaunchException("timed out");

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual("The runtime could not be started: timed out", exception.message);
  }

  @TestMethod
  public retainsTheUnderlyingProcessFailure(): void {
    const cause = new Error("process creation failed");
    const exception = new LaunchException("process creation failed", new ExceptionOptions(cause));

    Assert.areEqual(cause, exception.cause);
  }
}
