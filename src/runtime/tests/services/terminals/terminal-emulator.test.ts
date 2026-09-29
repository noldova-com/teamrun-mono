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
  public async storesOlderLinesInOrderAndKeepsRecentRowsForReload(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, null, () => undefined);
    let text = "";
    for (let index = 1; index <= 2600; index++)
      text += `line ${index}\r\n`;

    await TerminalEmulatorTests.write(emulator, text);
    const first = await history.read(0, 500);
    const second = await history.read(1500, 500);
    const screen = emulator.screen();

    Assert.areEqual(1596, history.stored.end);
    Assert.areEqual("line 1,line 500", `${first.lines[0]?.text},${first.lines[499]?.text}`);
    Assert.areEqual("line 1501,line 1596", `${second.lines[0]?.text},${second.lines[95]?.text}`);
    Assert.isTrue(screen.includes("line 1597"));
    Assert.isTrue(screen.includes("line 2600"));
    Assert.isFalse(screen.includes("line 1596"));
    await history.close();
  }

  @TestMethod
  public async clearsTheStoredLinesWhenTheSavedLinesAreErasedOrTheTerminalResets(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 3), history, null, () => undefined);

    for (const clearing of ["\u001b[3J", "\u001b[?3J", "\u001bc"]) {
      await TerminalEmulatorTests.write(emulator, "old-row\r\n".repeat(1200) + "clear-a\r\nclear-b\r\nclear-c\r\nclear-d\r\n");
      Assert.isTrue(history.stored.end > history.stored.start);
      await TerminalEmulatorTests.write(emulator, `${clearing}clear-e\r\nclear-f\r\nclear-g\r\nclear-h\r\n`);
      const page = await history.read(0, 10);
      Assert.areEqual(0, page.lines.length);
      Assert.isFalse(emulator.screen().includes("old-row"));
      Assert.areEqual(clearing !== "\u001bc", emulator.screen().includes("clear-c"));
      Assert.isTrue(emulator.screen().includes("clear-e"));
    }
    await TerminalEmulatorTests.write(emulator, "\u001b[2J\u001b[1J\u001b[4J");
    Assert.areEqual(0, (await history.read(0, 10)).lines.length);
    await history.close();
  }

  @TestMethod
  public async keepsNothingOfTheAlternateScreen(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 3), history, null, () => undefined);
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
  public async keepsRecentRowsWhenTheScreenShrinksAndGrows(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, null, () => undefined);
    await TerminalEmulatorTests.write(emulator, "a1\r\na2\r\na3\r\na4\r\na5");

    emulator.resize(new TerminalSize(20, 3));
    const shrunk = await history.read(0, 10);
    emulator.resize(new TerminalSize(8, 6));
    await TerminalEmulatorTests.write(emulator, "\r\nlonger line\r\n");
    emulator.resize(new TerminalSize(20, 6));
    const grown = await history.read(0, 10);

    Assert.areEqual(0, shrunk.lines.length);
    Assert.areEqual(0, grown.lines.length);
    Assert.areEqual("20x6", `${emulator.size.columns}x${emulator.size.rows}`);
    Assert.isTrue(emulator.screen().includes("a1"));
    Assert.isTrue(emulator.screen().includes("a5"));
    await history.close();
  }

  @TestMethod
  public async storesTheScreenUpToTheCursorOrItsLastText(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 6), history, 26200, () => undefined);
    await TerminalEmulatorTests.write(emulator, "x\r\ny\r\nz\u001b[2A");

    emulator.storeScreen();
    const page = await history.read(0, 10);

    Assert.areEqual("x,y,z", page.lines.map(t => t.text).join(","));
    await history.close();
  }

  @TestMethod
  public async storesTheInitialBlankCursorRowBeforeTheFirstWrite(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, null, () => undefined);

    emulator.storeScreen();

    Assert.areEqual(1, history.stored.end);
    Assert.areEqual("", (await history.read(0, 1)).lines[0]?.text);
    await history.close();
  }

  @TestMethod
  public async runsActionsAfterTheOutputWrittenBeforeThem(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, 19045, () => undefined);
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

  @TestMethod
  public async answersThePrimaryDeviceAttributesQueryOnly(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    const answers: string[] = [];
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, null, t => answers.push(t));

    await TerminalEmulatorTests.write(emulator, "\u001b[c\u001b[0c\u001b[1c\u001b[0;1c\u001b[>c");

    Assert.areEqual(JSON.stringify(["\u001b[?1;2c", "\u001b[?1;2c"]), JSON.stringify(answers));
    await history.close();
  }

  @TestMethod
  public async keepsTheLineHoldingTheCursorWhenTheWidthChangesOnWindows(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, 26200, () => undefined);
    await TerminalEmulatorTests.write(emulator, "PS C:\\project> ");

    emulator.resize(new TerminalSize(2, 5));
    emulator.resize(new TerminalSize(20, 5));

    Assert.isTrue(emulator.screen().includes("PS C:\\project>"));
    await history.close();
  }

  @TestMethod
  public async restoresTheSameOutputAfterNarrowingWideningAndReloading(): Promise<void> {
    using directory = new TemporaryDirectory();
    for (const windowsBuild of [null, 26200]) {
      const history = new TerminalHistory(directory.resolve(`before-${windowsBuild}.jsonl`), () => undefined);
      const restoredHistory = new TerminalHistory(directory.resolve(`after-${windowsBuild}.jsonl`), () => undefined);
      using emulator = new TerminalEmulator(new TerminalSize(80, 5), history, windowsBuild, () => undefined);
      using restored = new TerminalEmulator(new TerminalSize(80, 5), restoredHistory, windowsBuild, () => undefined);
      await TerminalEmulatorTests.write(emulator, "\u001b[31mred-output-with-a-long-line\u001b[0m\r\nwide-界-🙂-output\r\n");
      const before = emulator.screen();

      emulator.resize(new TerminalSize(2, 5));
      emulator.resize(new TerminalSize(80, 5));
      await TerminalEmulatorTests.write(restored, emulator.screen());

      Assert.areEqual(before, restored.screen());
      Assert.areEqual(0, history.stored.end);
      Assert.areEqual(0, restoredHistory.stored.end);
      await history.close();
      await restoredHistory.close();
    }
  }

  @TestMethod
  public async keepsRetainedRowsWhenTheNarrowSnapshotIsReloadedBeforeWidening(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("before.jsonl"), () => undefined);
    const restoredHistory = new TerminalHistory(directory.resolve("after.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(80, 5), history, 26200, () => undefined);
    using restored = new TerminalEmulator(new TerminalSize(2, 5), restoredHistory, 26200, () => undefined);
    const prompt = "PS C:\\fixture-project-with-a-long-name> ";
    await TerminalEmulatorTests.write(emulator, prompt);

    emulator.resize(new TerminalSize(2, 5));
    await TerminalEmulatorTests.write(restored, emulator.screen());
    restored.resize(new TerminalSize(80, 5));

    Assert.isTrue(restored.screen().includes(prompt.trim()));
    Assert.areEqual(0, history.stored.end);
    Assert.areEqual(0, restoredHistory.stored.end);
    await history.close();
    await restoredHistory.close();
  }

  @TestMethod
  public async storesEveryRetainedAndVisibleRowOnceWhenTheShellRestarts(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 3), history, null, () => undefined);
    const expected = Array.from({ length: 1100 }, (_t, index) => `row-${index}`);
    await TerminalEmulatorTests.write(emulator, expected.join("\r\n") + "\r\n");
    emulator.storeScreen();

    const rows = [];
    for (let start = 0; start < history.stored.end; start += 500)
      rows.push(...(await history.read(start, 500)).lines.map(t => t.text));

    Assert.areEqual(1101, rows.length);
    Assert.areEqual(expected.join(",") + ",", rows.join(","));
    await history.close();
  }

  @TestMethod
  public async storesResizeOverflowWithoutLosingOrRepeatingRows(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 5), history, null, () => undefined);
    const lines = Array.from({ length: 500 }, (_t, index) => `line-${String(index).padStart(3, "0")}`);
    await TerminalEmulatorTests.write(emulator, lines.join("\r\n") + "\r\n");

    emulator.resize(new TerminalSize(2, 5));
    Assert.isTrue(history.stored.end > 0);
    emulator.resize(new TerminalSize(20, 5));
    emulator.storeScreen();
    let text = "";
    for (let start = 0; start < history.stored.end; start += 500)
      for (const line of (await history.read(start, 500)).lines)
        text += (line.wrapped ? "" : "\n") + line.text;

    Assert.areEqual("\n" + lines.join("\n") + "\n", text);
    await history.close();
  }

  @TestMethod
  public async resumesCapturingAfterAnAlternateScreenWithAFullRetainedBuffer(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    using emulator = new TerminalEmulator(new TerminalSize(20, 3), history, null, () => undefined);
    const expected = Array.from({ length: 1100 }, (_t, index) => `normal-${index}`);
    await TerminalEmulatorTests.write(emulator, expected.join("\r\n") + "\r\n");
    const stored = history.stored.end;

    await TerminalEmulatorTests.write(emulator, "\u001b[?1049h" + "alternate\r\n".repeat(20) + "\u001b[3J");
    Assert.areEqual(stored, history.stored.end);
    await TerminalEmulatorTests.write(emulator, "\u001b[?1049lafter-alternate\r\n");
    emulator.storeScreen();
    const rows = [];
    for (let start = 0; start < history.stored.end; start += 500)
      rows.push(...(await history.read(start, 500)).lines.map(t => t.text));

    Assert.areEqual([...expected, "after-alternate", ""].join(","), rows.join(","));
    await history.close();
  }

  private static write(emulator: TerminalEmulator, data: string): Promise<void> {
    return new Promise(resolve => emulator.write(data, resolve));
  }
}
