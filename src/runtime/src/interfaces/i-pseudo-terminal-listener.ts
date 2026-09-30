/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PseudoTerminal } from "../services/terminals/pseudo-terminal.js";

export interface IPseudoTerminalListener {
  onData(source: PseudoTerminal, data: string): void;
  onExit(source: PseudoTerminal, exitCode: number | null): void;
}
