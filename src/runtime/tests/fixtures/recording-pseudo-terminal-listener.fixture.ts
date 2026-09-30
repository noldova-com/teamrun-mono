/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPseudoTerminalListener, PseudoTerminal } from "@noldova/teamrun-runtime";

export class RecordingPseudoTerminalListener implements IPseudoTerminalListener {
  public readonly sources: PseudoTerminal[] = [];
  public readonly exitCodes: (number | null)[] = [];
  public output: string = "";

  public onData(source: PseudoTerminal, data: string): void {
    this.sources.push(source);
    this.output += data;
  }

  public onExit(source: PseudoTerminal, exitCode: number | null): void {
    this.sources.push(source);
    this.exitCodes.push(exitCode);
  }
}
