/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITerminalDimensions } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";

export class FakeFitAddon {
  public proposal: ITerminalDimensions | undefined = undefined;

  public activate(_terminal: Terminal): void {
  }

  public dispose(): void {
  }

  public fit(): void {
  }

  public proposeDimensions(): ITerminalDimensions | undefined {
    return this.proposal;
  }
}
