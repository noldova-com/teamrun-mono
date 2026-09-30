/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class VerificationScope {
  private static readonly FULL_SUMMARY: string = "Full build and test verification selected.";
  private static readonly SKIPPED_SUMMARY: string = "Code builds and tests are not required.";

  public readonly runCode: boolean;
  public readonly reason: string;

  public constructor(runCode: boolean, reason: string) {
    this.runCode = runCode;
    this.reason = reason;
  }

  public get summary(): string {
    return `${this.runCode ? VerificationScope.FULL_SUMMARY : VerificationScope.SKIPPED_SUMMARY} ${this.reason}`;
  }
}
