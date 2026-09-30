/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { TerminalLinePage, TerminalLineRange } from "@noldova/teamrun-protocol";

import { Resources } from "../resources";

export class StoredLinesWindow {
  private readonly capacity: number;
  private loaded: TerminalLinePage[] = [];
  private range: TerminalLineRange;

  public constructor(capacity: number, stored: TerminalLineRange) {
    this.capacity = capacity;
    this.range = stored;
  }

  public get pages(): readonly TerminalLinePage[] {
    return this.loaded;
  }

  public get stored(): TerminalLineRange {
    return this.range;
  }

  public get first(): number {
    return this.loaded[0]?.start ?? this.range.end;
  }

  public get last(): number {
    const last = this.loaded.at(-1);
    return Object.isUndefined(last) ? this.range.end : last.start + last.lines.length;
  }

  public get hasOlder(): boolean {
    return this.first > this.range.start;
  }

  public get hasNewer(): boolean {
    return this.last < this.range.end;
  }

  public reset(stored: TerminalLineRange): void {
    this.loaded = [];
    this.range = stored;
  }

  public follow(stored: TerminalLineRange): void {
    this.range = stored;
    this.loaded = this.loaded.filter(t => t.start >= stored.start);
  }

  public prepend(page: TerminalLinePage): boolean {
    if (page.start + page.lines.length !== this.first)
      throw new Error(Resources.storedPageNotAdjacent);

    this.range = page.stored;
    this.loaded.unshift(page);
    if (this.loaded.length <= this.capacity)
      return false;

    this.loaded.pop();
    return true;
  }

  public append(page: TerminalLinePage): boolean {
    if (page.start !== this.last)
      throw new Error(Resources.storedPageNotAdjacent);

    this.range = page.stored;
    this.loaded.push(page);
    if (this.loaded.length <= this.capacity)
      return false;

    this.loaded.shift();
    return true;
  }
}
