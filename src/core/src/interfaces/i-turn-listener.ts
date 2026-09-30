/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ObservedSettings } from "@noldova/teamrun-protocol";

import type { ApprovalAsk } from "../models/approval-ask.js";
import type { TurnDetail } from "../models/turn-detail.js";
import type { TurnStart } from "../models/turn-start.js";

export interface ITurnListener {
  onStarted(start: TurnStart): void;
  onDetail(detail: TurnDetail): void;
  onThinking(): void;
  onApprovalRequested(ask: ApprovalAsk): Promise<string>;
  onObserved(observed: ObservedSettings): void;
}
