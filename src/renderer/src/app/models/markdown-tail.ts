/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";

export class MarkdownTail {
  private readonly text: string;

  public constructor(text: string) {
    this.text = text;
  }

  public get settled(): string {
    const end = this.settledLength();

    return end >= this.text.length ? this.text : this.text.slice(0, end);
  }

  private settledLength(): number {
    const lines = this.text.split("\n");
    const last = lines[lines.length - 1] ?? String.empty;
    let offset = 0;
    let blockStart = 0;
    let fence: string | null = null;
    for (const line of lines.slice(0, -1)) {
      if (Object.isNull(fence)) {
        const opening = Resources.fenceOpenPattern.exec(line);
        if (!Object.isNull(opening))
          fence = opening[1] ?? String.empty;
        else if (line.trim() === String.empty)
          blockStart = offset + line.length + 1;
      }
      else if (MarkdownTail.closes(line, fence)) {
        fence = null;
        blockStart = offset + line.length + 1;
      }
      offset += line.length + 1;
    }
    if (!Object.isNull(fence))
      return MarkdownTail.isShortFence(last, fence) ? offset : this.text.length;
    if (Resources.fenceOpenPattern.test(last))
      return offset;

    const candidates = [this.tableStart(blockStart), Resources.blockMarkerPattern.test(last) ? offset : this.text.length,
      this.openConstruct(blockStart)];
    const hold = Math.min(...candidates);

    return this.text.length - hold <= Resources.maximumHoldBackCharacters ? hold : this.text.length;
  }

  private tableStart(blockStart: number): number {
    const rows = this.text.slice(blockStart).split("\n");
    const header = rows[0] ?? String.empty;
    if (!Resources.tableRowPattern.test(header))
      return this.text.length;

    return rows.length > 1 && MarkdownTail.isDelimiter(rows[1] ?? String.empty, MarkdownTail.cellsOf(header).length) ? this.text.length : blockStart;
  }

  private openConstruct(blockStart: number): number {
    const block = this.text.slice(blockStart);
    const openers: { readonly marker: string; readonly length: number; readonly index: number }[] = [];
    const earliest = (index: number): number => blockStart + Math.min(index, openers[0]?.index ?? index);
    let position = 0;
    while (position < block.length) {
      const character = block[position] ?? String.empty;
      if (character === "\\") {
        if (position === block.length - 1)
          return earliest(position);
        position += 2;
      }
      else if (character === "`") {
        const length = MarkdownTail.runLength(block, position);
        const close = MarkdownTail.findRun(block, character, length, position + length);
        if (close < 0)
          return earliest(position);
        position = close + length;
      }
      else if (character === "*" || character === "_" || character === "~") {
        const length = MarkdownTail.runLength(block, position);
        position += length;
        if (character === "~" && length < 2)
          continue;
        const matching = openers.findLastIndex(t => t.marker === character && t.length === length);
        if (MarkdownTail.canClose(block, position - length, length, character) && matching >= 0)
          openers.length = matching;
        else if (MarkdownTail.canOpen(block, position - length, length, character))
          openers.push({ marker: character, length, index: position - length });
      }
      else if (character === "[" || (character === "!" && block[position + 1] === "[")) {
        const open = character === "[" ? position : position + 1;
        if (MarkdownTail.isUnfinishedLink(block, open))
          return earliest(position);
        position = open + 1;
      }
      else if (character === "]" && block[position + 1] === "(") {
        const close = block.indexOf(")", position + 2);
        if (close < 0)
          return earliest(position);
        position = close + 1;
      }
      else
        position++;
    }

    return openers.length > 0 ? earliest(block.length) : this.text.length;
  }

  private static closes(line: string, fence: string): boolean {
    const mark = Resources.fenceMarkPattern.exec(line)?.[1];

    return !Object.isUndefined(mark) && mark[0] === fence[0] && mark.length >= fence.length;
  }

  private static isShortFence(line: string, fence: string): boolean {
    const mark = Resources.fenceMarkPattern.exec(line)?.[1];

    return !Object.isUndefined(mark) && mark[0] === fence[0] && mark.length < fence.length;
  }

  private static cellsOf(row: string): readonly string[] {
    let trimmed = row.trim();
    if (trimmed.startsWith("|"))
      trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|"))
      trimmed = trimmed.slice(0, -1);

    return trimmed.split("|");
  }

  private static isDelimiter(row: string, columns: number): boolean {
    const cells = MarkdownTail.cellsOf(row);

    return cells.length >= columns && cells.every(t => Resources.delimiterCellPattern.test(t));
  }

  private static runLength(block: string, position: number): number {
    let end = position;
    while (block[end] === block[position])
      end++;

    return end - position;
  }

  private static findRun(block: string, character: string, length: number, from: number): number {
    let position = block.indexOf(character, from);
    while (position >= 0) {
      const run = MarkdownTail.runLength(block, position);
      if (run === length)
        return position;
      position = block.indexOf(character, position + run);
    }

    return -1;
  }

  private static canOpen(block: string, position: number, length: number, character: string): boolean {
    const after = block[position + length];
    if (Object.isUndefined(after))
      return true;

    return !Resources.whitespacePattern.test(after)
      && (character !== "_" || position === 0 || !Resources.wordCharacterPattern.test(block[position - 1] ?? String.empty));
  }

  private static canClose(block: string, position: number, length: number, character: string): boolean {
    const before = block[position - 1];
    const after = block[position + length];
    if (Object.isUndefined(before) || Resources.whitespacePattern.test(before))
      return false;

    return character !== "_" || Object.isUndefined(after) || !Resources.wordCharacterPattern.test(after);
  }

  private static isUnfinishedLink(block: string, open: number): boolean {
    let depth = 0;
    for (let position = open; position < block.length; position++) {
      const character = block[position];
      if (character === "\\")
        position++;
      else if (character === "[")
        depth++;
      else if (character === "]" && --depth === 0)
        return position === block.length - 1 || (block[position + 1] === "(" && block.indexOf(")", position + 2) < 0);
    }

    return true;
  }
}
