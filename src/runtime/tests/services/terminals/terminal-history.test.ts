/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, statSync, truncateSync } from "node:fs";

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, TerminalLine, TerminalTextRun } from "@noldova/teamrun-protocol";
import { TerminalHistory } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class TerminalHistoryTests {
  @TestMethod
  public async readsPagesAcrossTheWholeHistory(): Promise<void> {
    using directory = new TemporaryDirectory();
    let written = 0;
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => { written += 1; });
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
    Assert.areEqual(0, history.backlog);
    Assert.isTrue(written > 0);
    await history.close();
  }

  @TestMethod
  public async readsLinesThatSpanReadChunks(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    const long = "ж".repeat(900);
    for (let index = 0; index < 200; index++)
      history.append(TerminalHistoryTests.line(`${index} ${long}`));

    const page = await history.read(120, 80);

    Assert.areEqual(80, page.lines.length);
    Assert.areEqual(`199 ${long}`, page.lines[79]?.text);
    await history.close();
  }

  @TestMethod
  public async keepsCountingAfterTheLinesAreCleared(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
    for (let index = 0; index < 10; index++)
      history.append(TerminalHistoryTests.line(`old ${index}`));
    await history.read(0, 1);
    history.append(TerminalHistoryTests.line("dropped"));

    history.clear();
    history.append(TerminalHistoryTests.line("new 0"));
    history.append(TerminalHistoryTests.line("new 1"));
    const page = await history.read(0, 10);

    Assert.areEqual(11, page.start);
    Assert.areEqual("new 0,new 1", page.lines.map(t => t.text).join(","));
    Assert.areEqual(11, history.stored.start);
    Assert.areEqual(13, history.stored.end);
    Assert.areEqual(0, history.backlog);
    await history.close();
  }

  @TestMethod
  public async clearsAnUnwrittenBatch(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);

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
    const history = new TerminalHistory(directory.resolve("t.jsonl"), () => undefined);
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
  public async deletesItsFileAndProtectsIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("t.jsonl");
    const history = new TerminalHistory(path, () => undefined);
    history.append(TerminalHistoryTests.line("secret"));
    await history.read(0, 1);
    const mode = statSync(path).mode & 0o777;
    history.append(TerminalHistoryTests.line("pending"));

    await history.close();
    await new TerminalHistory(directory.resolve("never.jsonl"), () => undefined).close();

    Assert.isFalse(existsSync(path));
    if (process.platform !== "win32")
      Assert.areEqual(0o600, mode);
  }

  @TestMethod
  public async stopsStoringAfterAWriteFails(): Promise<void> {
    using directory = new TemporaryDirectory();
    const history = new TerminalHistory(directory.resolve("missing", "t.jsonl"), () => undefined);

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
  public async reportsADamagedFile(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("t.jsonl");
    const history = new TerminalHistory(path, () => undefined);
    history.append(TerminalHistoryTests.line("one"));
    history.append(TerminalHistoryTests.line("two"));
    await history.read(0, 1);

    truncateSync(path, 5);
    const exception = await Assert.throwsAsync(() => history.read(0, 2), ServiceException);

    Assert.areEqual(ErrorCode.Internal, exception.info.name);
    await history.close();
  }

  private static line(text: string): TerminalLine {
    return new TerminalLine(text, false, [new TerminalTextRun(text.length, -1, -1, 0)]);
  }
}
