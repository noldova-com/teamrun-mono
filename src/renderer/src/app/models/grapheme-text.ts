/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

export class GraphemeText {
  private static readonly segmenter: Intl.Segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  private readonly ends: readonly number[];
  public readonly text: string;

  public constructor(text: string) {
    this.text = text;
    this.ends = Array.from(GraphemeText.segmenter.segment(text), t => t.index + t.segment.length);
  }

  public get count(): number {
    return this.ends.length;
  }

  public prefix(count: number): string {
    if (count >= this.ends.length)
      return this.text;

    return count <= 0 ? String.empty : this.text.slice(0, this.ends[count - 1]);
  }
}
