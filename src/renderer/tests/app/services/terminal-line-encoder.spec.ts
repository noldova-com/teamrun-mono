/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalLine, TerminalTextRun, TerminalTextStyle } from "@noldova/teamrun-protocol";

import { TerminalLineEncoder } from "../../../src/app/services/terminal-line-encoder";

describe("TerminalLineEncoder", () => {
  const plain = (text: string, wrapped: boolean = false): TerminalLine =>
    new TerminalLine(text, wrapped, text.length === 0 ? [] : [new TerminalTextRun(text.length, -1, -1, 0)]);

  it("writes each line's text with a reset before it and a line break after it", () => {
    expect(TerminalLineEncoder.encode([plain("one"), plain(""), plain("three")], true))
      .toBe("\u001b[0mone\u001b[0m\r\n\u001b[0m\r\n\u001b[0mthree\u001b[0m\r\n");
  });

  it("joins a wrapped continuation to the line before it and leaves the last line open when asked", () => {
    expect(TerminalLineEncoder.encode([plain("abc"), plain("def", true), plain("ghi")], false))
      .toBe("\u001b[0mabc\u001b[0m\u001b[0mdef\u001b[0m\r\n\u001b[0mghi\u001b[0m");
  });

  it("sets each run's styles, palette colors and RGB colors", () => {
    const line = new TerminalLine("ab", false, [
      new TerminalTextRun(1, 3, -1, TerminalTextStyle.Bold | TerminalTextStyle.Underline),
      new TerminalTextRun(1, 0x1000000 + 0x102030, 0x1000000 + 0xffffff, TerminalTextStyle.Dim | TerminalTextStyle.Italic | TerminalTextStyle.Blink
        | TerminalTextStyle.Inverse | TerminalTextStyle.Invisible | TerminalTextStyle.Strikethrough | TerminalTextStyle.Overline)
    ]);

    expect(TerminalLineEncoder.encode([line], true))
      .toBe("\u001b[0;1;4;38;5;3ma\u001b[0;2;3;5;7;8;9;53;38;2;16;32;48;48;2;255;255;255mb\u001b[0m\r\n");
  });
});
