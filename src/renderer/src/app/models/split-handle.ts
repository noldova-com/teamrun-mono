/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PanelEdge } from "../enums/panel-edge";
import { Resources } from "../resources";
import type { SplitNode } from "./split.node";

export class SplitHandle {
  private readonly leadingMinimum: number;
  private readonly sharedLength: number;

  public readonly split: SplitNode;
  public readonly index: number;
  public readonly leadingId: number;
  public readonly bounds: DOMRectReadOnly;
  public readonly leadingLength: number;

  public constructor(split: SplitNode, index: number, leadingId: number, bounds: DOMRectReadOnly, leadingLength: number, leadingMinimum: number,
    sharedLength: number) {
    this.leadingMinimum = leadingMinimum;
    this.sharedLength = sharedLength;
    this.split = split;
    this.index = index;
    this.leadingId = leadingId;
    this.bounds = bounds;
    this.leadingLength = leadingLength;
  }

  public get edge(): PanelEdge {
    return Resources.splitHandleEdges[this.split.axis];
  }

  public weightsFor(leadingLength: number): readonly number[] {
    if (this.sharedLength <= 0)
      return this.split.weights;
    const pair = this.pair;
    const share = Math.min(pair, Math.max(0, (leadingLength - this.leadingMinimum) / this.sharedLength));
    return this.split.weights.map((t, index) => (index === this.index ? share : index === this.index + 1 ? pair - share : t));
  }

  public get balancedWeights(): readonly number[] {
    const pair = this.pair;
    return this.split.weights.map((t, index) => (index === this.index || index === this.index + 1 ? pair / 2 : t));
  }

  private get pair(): number {
    return (this.split.weights[this.index] ?? 0) + (this.split.weights[this.index + 1] ?? 0);
  }
}
