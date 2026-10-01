/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FadeSpan {
  public readonly start: number;
  public readonly end: number;
  public readonly step: number;

  public constructor(start: number, end: number, step: number) {
    this.start = start;
    this.end = end;
    this.step = step;
  }
}
