/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalSize } from "@noldova/teamrun-protocol";
import { TerminalEmulator, TerminalHistory } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class TerminalEmulatorTests {
  @TestMethod
  public async storesEveryLineThatLeavesTheScreenInOrder(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, null);
    let text = "";
    for (let index = 1; index <= 600; index++)
      text += `line ${index}\r\n`;

    await TerminalEmulatorTests.write(emulator, text);
    const first = await history.read(0, 500);
    const second = await history.read(500, 500);
    const screen = emulator.screen();

    Assert.areEqual(596, history.stored.end);
    Assert.areEqual("line 1,line 500", `${first.lines[0]?.text},${first.lines[499]?.text}`);
    Assert.areEqual("line 501,line 596", `${second.lines[0]?.text},${second.lines[95]?.text}`);
    Assert.isTrue(screen.includes("line 600"));
    Assert.isFalse(screen.includes("line 596"));
    await history.close();
  }

  @TestMethod
  public async clearsTheStoredLinesWhenTheSavedLinesAreErasedOrTheTerminalResets(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 3), history, null);

    for (const [clearing, expected] of [["\u001b[3J", "c,d,e,f"], ["\u001b[?3J", "c,d,e,f"], ["\u001bc", "e,f"]]) {
      await TerminalEmulatorTests.write(emulator, "a\r\nb\r\nc\r\nd\r\n");
      Assert.isTrue(history.stored.end > history.stored.start);
      await TerminalEmulatorTests.write(emulator, `${clearing}e\r\nf\r\ng\r\nh\r\n`);
      const page = await history.read(0, 10);
      Assert.areEqual(expected, page.lines.map(t => t.text).join(","));
    }
    await TerminalEmulatorTests.write(emulator, "\u001b[2J\u001b[1J\u001b[4J");
    Assert.areEqual(2, (await history.read(0, 10)).lines.length);
    await history.close();
  }

  @TestMethod
  public async keepsNothingOfTheAlternateScreen(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 3), history, null);
    await TerminalEmulatorTests.write(emulator, "a\r\nb\r\nc\r\nd\r\n");
    const stored = history.stored.end;

    await TerminalEmulatorTests.write(emulator, "\u001b[?1049hx\r\ny\r\nz\r\nw\r\n\u001b[3J");
    const screen = emulator.screen();
    await TerminalEmulatorTests.write(emulator, "\u001b[?1049l");

    Assert.areEqual(stored, history.stored.end);
    Assert.areEqual(0, history.stored.start);
    Assert.isTrue(screen.includes("\u001b[?1049h"));
    await history.close();
  }

  @TestMethod
  public async storesTheLinesAResizePushesOffAndNeverBringsThemBack(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, null);
    await TerminalEmulatorTests.write(emulator, "a1\r\na2\r\na3\r\na4\r\na5");

    emulator.resize(new TerminalSize(20, 3));
    const shrunk = await history.read(0, 10);
    emulator.resize(new TerminalSize(8, 6));
    await TerminalEmulatorTests.write(emulator, "\r\nlonger line\r\n");
    emulator.resize(new TerminalSize(20, 6));
    const grown = await history.read(0, 10);

    Assert.areEqual("a1,a2", shrunk.lines.map(t => t.text).join(","));
    Assert.areEqual("a1,a2", grown.lines.map(t => t.text).join(","));
    Assert.areEqual("20x6", `${emulator.size.columns}x${emulator.size.rows}`);
    Assert.isTrue(emulator.screen().includes("a3"));
    await history.close();
  }

  @TestMethod
  public async storesTheScreenUpToTheCursorOrItsLastText(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 6), history, 26200);
    await TerminalEmulatorTests.write(emulator, "x\r\ny\r\nz\u001b[2A");

    emulator.storeScreen();
    const page = await history.read(0, 10);

    Assert.areEqual("x,y,z", page.lines.map(t => t.text).join(","));
    await history.close();
  }

  @TestMethod
  public async runsActionsAfterTheOutputWrittenBeforeThem(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, 19045);
    const order: string[] = [];

    emulator.write("x".repeat(10_000), () => order.push("written"));
    const backlog = emulator.backlog;
    await new Promise<void>(resolve => emulator.afterWrites(() => {
      order.push("after");
      resolve();
    }));

    Assert.areEqual(10_000, backlog);
    Assert.areEqual(0, emulator.backlog);
    Assert.areEqual("written,after", order.join(","));
    await history.close();
  }

  private static write(emulator: TerminalEmulator, data: string): Promise<void> {
    return new Promise(resolve => emulator.write(data, resolve));
  }
}
