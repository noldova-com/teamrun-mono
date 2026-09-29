/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProtocolVersion } from "@noldova/teamrun-protocol";
import { Endpoint, RuntimeBuildMismatchException, RuntimeLock } from "@noldova/teamrun-runtime";

@TestClass
export class RuntimeBuildMismatchExceptionTests {
  private static readonly STARTED_AT: string = "2026-09-28T13:52:00.000Z";
  private static readonly QUIT_ADVICE: string = "Quit that TeamRun and try again. It stops about 30 seconds after its last window closes and its replies finish.";

  @TestMethod
  public namesTheProgramTheOtherRuntimeRunsFrom(): void {
    const lock = new RuntimeLock(42, Endpoint.tcp(5000), "token", new ProtocolVersion(0, 1), "0.0.7", RuntimeBuildMismatchExceptionTests.STARTED_AT,
      "other-build", "C:\\Programs\\TeamRun\\TeamRun.exe");

    const exception = new RuntimeBuildMismatchException(lock, "C:\\Users\\person\\.noldova\\teamrun");

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual(lock, exception.lock);
    Assert.areEqual("Another TeamRun, built from different code, is using this data folder:\nC:\\Users\\person\\.noldova\\teamrun\n\n" +
      `It runs from C:\\Programs\\TeamRun\\TeamRun.exe (version 0.0.7) and started on ${RuntimeBuildMismatchExceptionTests.startedDate()} at ` +
      `${RuntimeBuildMismatchExceptionTests.startedTime()}.\n\n${RuntimeBuildMismatchExceptionTests.QUIT_ADVICE}`, exception.message);
  }

  @TestMethod
  public namesOnlyTheVersionOfARuntimeThatRecordedNoProgram(): void {
    const lock = new RuntimeLock(42, Endpoint.tcp(5000), "token", new ProtocolVersion(0, 1), "0.0.7", RuntimeBuildMismatchExceptionTests.STARTED_AT);

    const exception = new RuntimeBuildMismatchException(lock, "/home/person/.noldova/teamrun");

    Assert.areEqual("Another TeamRun, built from different code, is using this data folder:\n/home/person/.noldova/teamrun\n\n" +
      `It is version 0.0.7 and started on ${RuntimeBuildMismatchExceptionTests.startedDate()} at ${RuntimeBuildMismatchExceptionTests.startedTime()}.\n\n` +
      RuntimeBuildMismatchExceptionTests.QUIT_ADVICE, exception.message);
  }

  private static startedDate(): string {
    return new Date(RuntimeBuildMismatchExceptionTests.STARTED_AT).toLocaleDateString(undefined, { dateStyle: "medium" });
  }

  private static startedTime(): string {
    return new Date(RuntimeBuildMismatchExceptionTests.STARTED_AT).toLocaleTimeString(undefined, { timeStyle: "short" });
  }
}
