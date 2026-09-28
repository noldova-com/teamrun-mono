/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Resources as ProtocolResources, TerminalLine, TerminalTextRun, TerminalTextStyle } from "@noldova/teamrun-protocol";
import type { IBufferCell, IBufferLine } from "@xterm/headless";

import { Resources } from "../../resources.js";

export class TerminalLineReader {
  private readonly cell: IBufferCell;

  public constructor(cell: IBufferCell) {
    this.cell = cell;
  }

  public read(line: IBufferLine, isContinued: boolean): TerminalLine {
    const end = isContinued ? line.length : this.contentEnd(line);
    const runs: TerminalTextRun[] = [];
    let text = String.empty;
    let length = 0;
    let foreground = ProtocolResources.defaultTerminalColor;
    let background = ProtocolResources.defaultTerminalColor;
    let style = 0;
    for (let x = 0; x < end; x++) {
      const cell = line.getCell(x, this.cell);
      if (Object.isUndefined(cell) || cell.getWidth() === 0)
        continue;
      const chars = cell.getChars() || Resources.blankCell;
      const cellForeground = TerminalLineReader.foregroundOf(cell);
      const cellBackground = TerminalLineReader.backgroundOf(cell);
      const cellStyle = TerminalLineReader.styleOf(cell);
      if (length > 0 && (cellForeground !== foreground || cellBackground !== background || cellStyle !== style)) {
        runs.push(new TerminalTextRun(length, foreground, background, style));
        length = 0;
      }
      foreground = cellForeground;
      background = cellBackground;
      style = cellStyle;
      text += chars;
      length += chars.length;
    }
    if (length > 0)
      runs.push(new TerminalTextRun(length, foreground, background, style));

    return new TerminalLine(text, line.isWrapped, runs);
  }

  private contentEnd(line: IBufferLine): number {
    let end = line.length;
    while (end > 0 && this.isBlank(line.getCell(end - 1, this.cell)))
      end -= 1;
    return end;
  }

  private isBlank(cell: IBufferCell | undefined): boolean {
    return !Object.isUndefined(cell) && String.isNullOrWhitespace(cell.getChars()) && cell.isBgDefault() && !cell.isInverse() &&
      !cell.isUnderline() && !cell.isStrikethrough() && !cell.isOverline();
  }

  private static foregroundOf(cell: IBufferCell): number {
    if (cell.isFgDefault())
      return ProtocolResources.defaultTerminalColor;
    return cell.isFgRGB() ? ProtocolResources.terminalRgbColor + cell.getFgColor() : cell.getFgColor();
  }

  private static backgroundOf(cell: IBufferCell): number {
    if (cell.isBgDefault())
      return ProtocolResources.defaultTerminalColor;
    return cell.isBgRGB() ? ProtocolResources.terminalRgbColor + cell.getBgColor() : cell.getBgColor();
  }

  private static styleOf(cell: IBufferCell): number {
    let style = 0;
    if (cell.isBold())
      style |= TerminalTextStyle.Bold;
    if (cell.isDim())
      style |= TerminalTextStyle.Dim;
    if (cell.isItalic())
      style |= TerminalTextStyle.Italic;
    if (cell.isUnderline())
      style |= TerminalTextStyle.Underline;
    if (cell.isBlink())
      style |= TerminalTextStyle.Blink;
    if (cell.isInverse())
      style |= TerminalTextStyle.Inverse;
    if (cell.isInvisible())
      style |= TerminalTextStyle.Invisible;
    if (cell.isStrikethrough())
      style |= TerminalTextStyle.Strikethrough;
    if (cell.isOverline())
      style |= TerminalTextStyle.Overline;
    return style;
  }
}
