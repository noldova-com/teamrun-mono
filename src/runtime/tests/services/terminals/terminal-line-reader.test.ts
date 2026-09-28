/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type TerminalLine, TerminalTextStyle } from "@noldova/teamrun-protocol";
import { TerminalLineReader } from "@noldova/teamrun-runtime";
import headless from "@xterm/headless";

@TestClass
export class TerminalLineReaderTests {
  @TestMethod
  public async readsPlainTextWithoutTrailingBlanks(): Promise<void> {
    const [line] = await TerminalLineReaderTests.read("hello   ", 20);

    Assert.areEqual("hello", line?.text);
    Assert.areEqual(JSON.stringify([{ length: 5, foreground: -1, background: -1, style: 0 }]), JSON.stringify(line?.runs.map(t => t.toJson())));
    Assert.isFalse(line?.wrapped ?? true);
  }

  @TestMethod
  public async readsPaletteAndRgbColors(): Promise<void> {
    const [line] = await TerminalLineReaderTests.read("\u001b[31mr\u001b[38;5;200mp\u001b[38;2;1;2;3mt\u001b[41mb\u001b[48;2;4;5;6mg\u001b[0m.", 20);

    Assert.areEqual("rptbg.", line?.text);
    Assert.areEqual(
      "1/-1,200/-1,16843267/-1,16843267/1,16843267/17040646,-1/-1",
      line?.runs.map(t => `${t.foreground}/${t.background}`).join(","));
  }

  @TestMethod
  public async readsEveryStyle(): Promise<void> {
    const codes = [1, 2, 3, 4, 5, 7, 8, 9, 53];
    const [line] = await TerminalLineReaderTests.read(codes.map(t => `\u001b[${t}mx\u001b[0m`).join(""), 20);

    Assert.areEqual([
      TerminalTextStyle.Bold, TerminalTextStyle.Dim, TerminalTextStyle.Italic, TerminalTextStyle.Underline, TerminalTextStyle.Blink,
      TerminalTextStyle.Inverse, TerminalTextStyle.Invisible, TerminalTextStyle.Strikethrough, TerminalTextStyle.Overline
    ].join(","), line?.runs.map(t => t.style).join(","));
  }

  @TestMethod
  public async readsWideCharactersAndGaps(): Promise<void> {
    const [line] = await TerminalLineReaderTests.read("日本\u001b[3Cx", 20);

    Assert.areEqual("日本   x", line?.text);
    Assert.areEqual(6, line?.runs[0]?.length);
  }

  @TestMethod
  public async keepsTrailingBlanksThatShow(): Promise<void> {
    const lines = await TerminalLineReaderTests.read("a\u001b[41m  \u001b[0m\r\nb\u001b[7m \u001b[0m\r\nc\u001b[4m \u001b[0m\r\nd\u001b[9m \u001b[0m\r\ne\u001b[53m \u001b[0m\r\nf\u001b[31m \u001b[0m", 20);

    Assert.areEqual("a  ,b ,c ,d ,e ,f", lines.map(t => t.text).join(","));
  }

  @TestMethod
  public async keepsTheFullWidthOfALineTheNextOneContinues(): Promise<void> {
    const terminal = new headless.Terminal({ cols: 10, rows: 4, allowProposedApi: true });
    await new Promise<void>(resolve => terminal.write("abcdefgh  xyz", resolve));
    const buffer = terminal.buffer.normal;
    const reader = new TerminalLineReader(buffer.getNullCell());
    const first = buffer.getLine(0);
    const second = buffer.getLine(1);
    Assert.isDefined(first);
    Assert.isDefined(second);

    const continued = reader.read(first, true);
    const next = reader.read(second, false);
    terminal.dispose();

    Assert.areEqual("abcdefgh  ", continued.text);
    Assert.areEqual("xyz", next.text);
    Assert.isTrue(next.wrapped);
  }

  private static async read(text: string, columns: number): Promise<readonly TerminalLine[]> {
    const terminal = new headless.Terminal({ cols: columns, rows: 10, allowProposedApi: true });
    await new Promise<void>(resolve => terminal.write(text, resolve));
    const buffer = terminal.buffer.normal;
    const reader = new TerminalLineReader(buffer.getNullCell());
    const lines: TerminalLine[] = [];
    for (let y = 0; y <= buffer.cursorY; y++) {
      const line = buffer.getLine(y);
      if (line !== undefined)
        lines.push(reader.read(line, false));
    }
    terminal.dispose();
    return lines;
  }
}
