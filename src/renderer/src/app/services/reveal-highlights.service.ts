/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";

@Injectable({ providedIn: "root" })
export class RevealHighlights {
  private readonly highlights: Map<string, Highlight> = new Map();
  private sheet: CSSStyleSheet | null = null;

  public get isSupported(): boolean {
    return typeof Highlight !== "undefined" && typeof CSS !== "undefined" && !Object.isUndefined(CSS.highlights);
  }

  public paint(painted: [Highlight, Range][], ranges: readonly [Range, number][]): void {
    for (const [highlight, range] of painted)
      highlight.delete(range);
    painted.length = 0;
    for (const [range, step] of ranges) {
      const parent = range.startContainer.parentElement;
      if (Object.isNull(parent))
        continue;
      const highlight = this.highlightFor(getComputedStyle(parent).color, step);
      highlight.add(range);
      painted.push([highlight, range]);
    }
  }

  private highlightFor(color: string, step: number): Highlight {
    const key = `${color}${Resources.fadeKeySeparator}${step}`;
    let highlight = this.highlights.get(key);
    if (Object.isUndefined(highlight)) {
      const name = `${Resources.revealFadeHighlightPrefix}${this.highlights.size}`;
      highlight = new Highlight();
      CSS.highlights.set(name, highlight);
      this.styleSheet().insertRule(Resources.formatFadeRule(name, color, (step + 1) / (Resources.revealFadeSteps + 1)));
      this.highlights.set(key, highlight);
    }

    return highlight;
  }

  private styleSheet(): CSSStyleSheet {
    if (Object.isNull(this.sheet)) {
      this.sheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.sheet];
    }

    return this.sheet;
  }
}
