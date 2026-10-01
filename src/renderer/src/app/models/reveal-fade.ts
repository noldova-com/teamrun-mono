/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";
import { FadeSpan } from "./fade-span";

export class RevealFade {
  private readonly paint: (spans: readonly FadeSpan[]) => void;
  private readonly times: number[] = [];
  private readonly counts: number[] = [];
  private settled: number;
  private frame: number | null = null;

  public constructor(initial: number, paint: (spans: readonly FadeSpan[]) => void) {
    this.settled = initial;
    this.paint = paint;
  }

  public note(count: number): void {
    const last = this.counts.at(-1) ?? this.settled;
    if (count < last) {
      this.clear();
      this.settled = count;
      return;
    }
    if (count === last)
      return;

    const now = performance.now();
    this.times.push(now);
    this.counts.push(count);
    this.render(now);
  }

  public clear(): void {
    if (!Object.isNull(this.frame))
      cancelAnimationFrame(this.frame);
    this.frame = null;
    this.settled = this.counts.at(-1) ?? this.settled;
    this.times.length = 0;
    this.counts.length = 0;
    this.paint([]);
  }

  private render(time: number): void {
    const duration = Resources.revealFadeMilliseconds;
    const steps = Resources.revealFadeSteps;
    while (this.times.length > 0 && this.times[0]! <= time - duration) {
      this.settled = this.counts[0]!;
      this.times.shift();
      this.counts.shift();
    }
    const spans: FadeSpan[] = [];
    let end = this.counts.at(-1) ?? this.settled;
    const oldest = Math.max(this.settled, end - Resources.revealFadeMaximumCharacters);
    for (let step = 0; step < steps && end > oldest; step++) {
      const start = Math.max(this.countAt(time - duration * (step + 1) / steps), oldest);
      if (start < end)
        spans.push(new FadeSpan(start, end, step));
      end = start;
    }
    this.paint(spans);
    if (this.times.length > 0)
      this.frame ??= requestAnimationFrame(t => {
        this.frame = null;
        this.render(t);
      });
  }

  private countAt(time: number): number {
    let count = this.settled;
    for (let index = 0; index < this.times.length && this.times[index]! <= time; index++)
      count = this.counts[index]!;

    return count;
  }
}
