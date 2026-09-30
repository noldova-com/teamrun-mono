/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { ApprovalAsk, ITurnListener, TurnDetail, TurnStart } from "@noldova/teamrun-core";
import type { ObservedSettings } from "@noldova/teamrun-protocol";

export class RecordingTurnListener implements ITurnListener {
  public readonly starts: TurnStart[] = [];
  public readonly details: TurnDetail[] = [];
  public readonly observations: ObservedSettings[] = [];
  public readonly asks: ApprovalAsk[] = [];
  public readonly decisions: string[] = [];
  public thinking: number = 0;
  public defaultDecision: string = "accept";
  public decisionFailure: Error | null = null;

  public get texts(): readonly string[] {
    return this.details.map(t => t.text);
  }

  public get lastObserved(): ObservedSettings | undefined {
    return this.observations.at(-1);
  }

  public onStarted(start: TurnStart): void {
    this.starts.push(start);
  }

  public onDetail(detail: TurnDetail): void {
    this.details.push(detail);
  }

  public onThinking(): void {
    this.thinking += 1;
  }

  public onApprovalRequested(ask: ApprovalAsk): Promise<string> {
    this.asks.push(ask);
    if (!Object.isNull(this.decisionFailure))
      return Promise.reject(this.decisionFailure);

    return Promise.resolve(this.decisions.shift() ?? this.defaultDecision);
  }

  public onObserved(observed: ObservedSettings): void {
    this.observations.push(observed);
  }
}
