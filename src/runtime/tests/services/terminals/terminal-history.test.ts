/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, statSync, truncateSync } from "node:fs";

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, Resources, TerminalLine, TerminalTextRun } from "@noldova/teamrun-protocol";
import { TerminalHistory } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { TerminalHistoryFiles } from "../../fixtures/terminal-history-files.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class TerminalHistoryTests {
  @TestMethod
  public async readsPagesAcrossTheWholeHistory(): Promise<void> {
    using directory = new TemporaryDirectory();
    let written = 0;
    const history = TerminalHistoryTests.create(directory, () => { written += 1; });
    for (let index = 0; index < 150; index++)
      history.append(TerminalHistoryTests.line(`line ${index} é日本`));

    const middle = await history.read(70, 20);
    const all = await history.read(0, 500);
    const tail = await history.read(149, 10);
    const beyond = await history.read(400, 10);

    Assert.areEqual(70, middle.start);
    Assert.areEqual("line 70 é日本,line 89 é日本", `${middle.lines[0]?.text},${middle.lines[19]?.text}`);
    Assert.areEqual(150, all.lines.length);
    Assert.areEqual("line 149 é日本", tail.lines[0]?.text);
    Assert.areEqual(1, tail.lines.length);
    Assert.areEqual(150, beyond.start);
    Assert.areEqual(0, beyond.lines.length);
    Assert.areEqual(150, all.stored.end);
    Assert.areEqual(0, all.stored.dropped);
    Assert.areEqual(0, history.backlog);
    Assert.isTrue(written > 0);
    await history.close();
  }

  @TestMethod
  public async readsLinesThatSpanReadChunks(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = TerminalHistoryTests.create(directory);
    const long = "ж".repeat(900);
    for (let index = 0; index < 200; index++)
      history.append(TerminalHistoryTests.line(`${index} ${long}`));

    const page = await history.read(120, 80);

    Assert.areEqual(80, page.lines.length);
    Assert.areEqual(`199 ${long}`, page.lines[79]?.text);
    await history.close();
  }

  @TestMethod
  public async dropsTheOlderFileWhenTheNewerOneFillsItsHalfOfTheLimit(): Promise<void> {
    using directory = new TemporaryDirectory();
    const files = TerminalHistoryFiles.in(directory, "t");
    const history = new TerminalHistory(files, 20 * TerminalHistoryTests.bytes, () => undefined);
    for (let index = 0; index < 35; index++)
      history.append(TerminalHistoryTests.numbered(index));

    const all = await history.read(0, 100);
    const across = await history.read(25, 7);

    Assert.areEqual(20, all.start);
    Assert.areEqual("line 0020,line 0034", `${all.lines[0]?.text},${all.lines[14]?.text}`);
    Assert.areEqual(15, all.lines.length);
    Assert.areEqual("20 35 20", `${all.stored.start} ${all.stored.end} ${all.stored.dropped}`);
    Assert.areEqual("25,26,27,28,29,30,31", across.lines.map(t => Number(t.text.slice(5))).join(","));
    Assert.areEqual(10 * TerminalHistoryTests.bytes, statSync(files[0]).size);
    Assert.areEqual(5 * TerminalHistoryTests.bytes, statSync(files[1]).size);
    await history.close();
  }

  @TestMethod
  public async keepsItsFilesWithinTheLimitWhileOutputNeverEnds(): Promise<void> {
    using directory = new TemporaryDirectory();
    const files = TerminalHistoryFiles.in(directory, "t");
    const limit = 50 * TerminalHistoryTests.bytes;
    const history = new TerminalHistory(files, limit, () => undefined);
    let largest = 0;
    for (let round = 0; round < 20; round++) {
      for (let index = 0; index < 97; index++)
        history.append(TerminalHistoryTests.numbered(round * 97 + index));
      await history.read(0, 1);
      largest = Math.max(largest, files.filter(t => existsSync(t)).reduce((total, file) => total + statSync(file).size, 0));
    }

    const page = await history.read(0, 500);

    Assert.isTrue(largest <= limit);
    Assert.areEqual(1940, page.stored.end);
    Assert.areEqual(page.stored.start, page.stored.dropped);
    Assert.areEqual(page.stored.end - page.stored.start, page.lines.length);
    Assert.isTrue(page.lines.every((line, index) => Number(line.text.slice(5)) === page.start + index));
    await history.close();
  }

  @TestMethod
  public async readsAConsistentPageWhileLinesAreDroppedDuringTheRead(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(TerminalHistoryFiles.in(directory, "t"), 20 * TerminalHistoryTests.bytes, () => undefined);
    let next = 0;
    const burst = (): void => {
      for (let index = 0; index < 25; index++)
        history.append(TerminalHistoryTests.numbered(next++));
    };
    burst();
    const pages = [history.read(0, 100), history.read(0, 100), history.read(0, 100)];
    let settled = false;
    void Promise.all(pages).then(() => { settled = true; });
    while (!settled) {
      burst();
      await new Promise(resolve => setImmediate(resolve));
    }

    for (const page of await Promise.all(pages)) {
      Assert.areEqual(page.stored.start, page.start);
      Assert.areEqual(page.stored.end - page.stored.start, page.lines.length);
      Assert.isTrue(page.lines.every((line, index) => Number(line.text.slice(5)) === page.start + index));
    }
    await history.close();
  }

  @TestMethod
  public async keepsCountingAfterTheLinesAreClearedAndForgetsWhatWasDropped(): Promise<void> {
    using directory = new TemporaryDirectory();
    const files = TerminalHistoryFiles.in(directory, "t");
    const history = new TerminalHistory(files, 20 * TerminalHistoryTests.bytes, () => undefined);
    for (let index = 0; index < 25; index++)
      history.append(TerminalHistoryTests.numbered(index));
    await history.read(0, 1);
    const dropped = history.stored.dropped;
    history.append(TerminalHistoryTests.line("unwritten"));

    history.clear();
    history.append(TerminalHistoryTests.line("new 0"));
    history.append(TerminalHistoryTests.line("new 1"));
    const page = await history.read(0, 10);

    Assert.areEqual(10, dropped);
    Assert.areEqual(26, page.start);
    Assert.areEqual("new 0,new 1", page.lines.map(t => t.text).join(","));
    Assert.areEqual("26 28 0", `${history.stored.start} ${history.stored.end} ${history.stored.dropped}`);
    Assert.isFalse(existsSync(files[1]));
    Assert.areEqual(0, history.backlog);
    await history.close();
  }

  @TestMethod
  public async clearsAnUnwrittenBatch(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = TerminalHistoryTests.create(directory);

    history.append(TerminalHistoryTests.line("never written"));
    history.clear();
    const page = await history.read(0, 10);

    Assert.areEqual(0, page.lines.length);
    Assert.areEqual(1, page.stored.start);
    Assert.areEqual(0, history.backlog);
    await history.close();
  }

  @TestMethod
  public async writesEachLineOnceWhenAReadWritesPendingLines(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = TerminalHistoryTests.create(directory);
    history.append(TerminalHistoryTests.line("a"));
    const reading = history.read(0, 10);
    await Promise.resolve();

    history.append(TerminalHistoryTests.line("b"));
    const page = await reading;
    history.append(TerminalHistoryTests.line("c"));
    const later = await history.read(0, 10);

    Assert.areEqual("a,b", page.lines.map(t => t.text).join(","));
    Assert.areEqual(2, page.stored.end);
    Assert.areEqual("a,b,c", later.lines.map(t => t.text).join(","));
    await history.close();
  }

  @TestMethod
  public async deletesItsFilesAndProtectsThem(): Promise<void> {
    using directory = new TemporaryDirectory();
    const files = TerminalHistoryFiles.in(directory, "t");
    const history = new TerminalHistory(files, 20 * TerminalHistoryTests.bytes, () => undefined);
    for (let index = 0; index < 15; index++)
      history.append(TerminalHistoryTests.numbered(index));
    await history.read(0, 1);
    const modes = files.map(t => statSync(t).mode & 0o777);
    history.append(TerminalHistoryTests.line("pending"));

    await history.close();
    await TerminalHistoryTests.create(directory, () => undefined, "never").close();

    Assert.isFalse(files.some(existsSync));
    if (process.platform !== "win32")
      Assert.areEqual("384,384", modes.join(","));
  }

  @TestMethod
  public async stopsStoringAfterAWriteFails(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory([directory.resolve("missing", "t-1.jsonl"), directory.resolve("missing", "t-2.jsonl")],
      Resources.defaultTerminalStoredLimit, () => undefined);

    history.append(TerminalHistoryTests.line("lost"));
    await Wait.until(() => history.backlog === 0);
    history.append(TerminalHistoryTests.line("ignored"));
    history.clear();
    const exception = await Assert.throwsAsync(() => history.read(0, 10), ServiceException);

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
    Assert.areEqual("The terminal's stored lines could not be written.", exception.message);
    Assert.isDefined(exception.cause);
    Assert.areEqual(1, history.stored.end);
    await history.close();
  }

  @TestMethod
  public async stopsStoringWhenAFileCannotBeRemoved(): Promise<void> {
    using directory = new TemporaryDirectory();
    const files = TerminalHistoryFiles.in(directory, "t");
    mkdirSync(files[0]);
    const history = new TerminalHistory(files, Resources.defaultTerminalStoredLimit, () => undefined);

    history.clear();
    const exception = await Assert.throwsAsync(() => history.read(0, 10), ServiceException);
    history.append(TerminalHistoryTests.line("ignored"));

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
    Assert.areEqual(0, history.stored.end);
    await Assert.throwsAsync(() => history.close(), Error);
  }

  @TestMethod
  public async reportsADamagedFile(): Promise<void> {
    using directory = new TemporaryDirectory();
    const files = TerminalHistoryFiles.in(directory, "t");
    const history = TerminalHistoryTests.create(directory);
    history.append(TerminalHistoryTests.line("one"));
    history.append(TerminalHistoryTests.line("two"));
    await history.read(0, 1);

    truncateSync(files[0], 5);
    const exception = await Assert.throwsAsync(() => history.read(0, 2), ServiceException);

    Assert.areEqual(ErrorCode.Internal, exception.info.name);
    await history.close();
  }

  private static get bytes(): number {
    return Buffer.byteLength(`${JSON.stringify(TerminalHistoryTests.numbered(0).toJson())}\n`);
  }

  private static create(directory: TemporaryDirectory, onWritten: () => void = () => undefined, name: string = "t"): TerminalHistory {
    return new TerminalHistory(TerminalHistoryFiles.in(directory, name), Resources.defaultTerminalStoredLimit, onWritten);
  }

  private static numbered(index: number): TerminalLine {
    return TerminalHistoryTests.line(`line ${String(index).padStart(4, "0")}`);
  }

  private static line(text: string): TerminalLine {
    return new TerminalLine(text, false, [new TerminalTextRun(text.length, -1, -1, 0)]);
  }
}
