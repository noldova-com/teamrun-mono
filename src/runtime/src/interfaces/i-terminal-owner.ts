/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WireMessage } from "@noldova/teamrun-protocol";

export interface ITerminalOwner {
  readonly isClosed: boolean;

  write(message: WireMessage): void;
}
