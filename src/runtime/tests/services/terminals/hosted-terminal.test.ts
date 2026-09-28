/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { release } from "node:os";

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, Project, TerminalSize } from "@noldova/teamrun-protocol";
import { HostedTerminal, PseudoTerminal, type ShellEnvironment, TerminalSettings } from "@noldova/teamrun-runtime";

import { FakePty } from "../../fixtures/fake-pty.fixture.js";
import { FixtureShell } from "../../fixtures/fixture-shell.fixture.js";
import { RecordingPseudoTerminalListener } from "../../fixtures/recording-pseudo-terminal-listener.fixture.js";
import { RecordingTerminalOwner } from "../../fixtures/recording-terminal-owner.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class HostedTerminalTests {
  private static readonly FLOOD_LINE: string = "0123456789".repeat(10);

  @TestMethod
  public async sendsTheOutputInOrderAndStoresWhatLeavesTheScreen(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const environment = FixtureShell.environment();
    environment.set("TEAMRUN_FIXTURE", "present");
    const terminal = HostedTerminalTests.start(owner, directory, environment, HostedTerminalTests.settings());
    try {
      Assert.areEqual(0, terminal.state.sequence);
      await Wait.until(() => owner.output.includes("ready"));

      terminal.input("env TEAMRUN_FIXTURE\r");
      terminal.input("lines 30\r");
      await HostedTerminalTests.waitForStored(terminal, "line 25");
      const texts = (await terminal.lines(0, 500)).lines.map(t => t.text);

      Assert.isTrue(texts.includes("env TEAMRUN_FIXTURE=present"));
      Assert.isTrue(texts.indexOf("line 1") < texts.indexOf("line 25"));
      Assert.areEqual(owner.sequences.map((_t, index) => index + 1).join(","), owner.sequences.join(","));
      Assert.areEqual(terminal.state.stored.end, owner.outputs.at(-1)?.stored.end);
      Assert.areEqual(HostedTerminalTests.settings().windowsBuild, terminal.state.conptyBuild);
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async startsTheShellInTheProjectFolder(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), HostedTerminalTests.settings());
    try {
      await Wait.until(() => owner.output.includes("ready"));

      terminal.input("cwd\r");
      terminal.input("lines 12\r");
      await HostedTerminalTests.waitForStored(terminal, "line 5");
      const line = (await terminal.lines(0, 500)).lines.find(t => t.text.startsWith("cwd "));

      Assert.isDefined(line);
      Assert.isTrue(line.text.toLowerCase().endsWith(directory.path.split(/[\\/]/).at(-1)?.toLowerCase() ?? "missing"));
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async resizesAfterTheOutputAlreadyReceived(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), HostedTerminalTests.settings());
    try {
      await Wait.until(() => owner.output.includes("ready"));

      terminal.resize(new TerminalSize(60, 8));
      terminal.resize(new TerminalSize(60, 8));
      await Wait.until(() => owner.changes.length === 1);
      terminal.input("exit 0\r");
      await Wait.until(() => owner.changes.length === 2);
      terminal.resize(new TerminalSize(50, 6));
      await Wait.until(() => owner.changes.length === 3);

      Assert.areEqual(60, owner.changes[0]?.size.columns);
      Assert.areEqual(8, owner.changes[0]?.size.rows);
      Assert.areEqual(50, terminal.state.size.columns);
      Assert.areEqual(6, terminal.state.size.rows);
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async repeatsNothingWhenResizedManyTimesInARow(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), HostedTerminalTests.settings());
    try {
      await Wait.until(() => owner.output.includes("ready"));

      for (let step = 0; step < 40; step++) {
        terminal.resize(new TerminalSize(200, 3 + step % 10 * 3));
        await Wait.delay(10);
      }
      await HostedTerminalTests.settledOutput(owner);
      const stored = (await terminal.lines(0, 500)).lines.filter(t => t.text.includes("ready")).length;
      const shown = terminal.screen().screen.split("ready").length - 1;

      Assert.areEqual(1, stored + shown);
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async answersTheDeviceAttributesQueryOfItsShell(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), HostedTerminalTests.settings());
    try {
      await Wait.until(() => owner.output.includes("ready"));

      terminal.input("attributes\r");

      await Wait.until(() => owner.output.includes("attributes ?1;2c"));
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async reportsTheExitAndRefusesInputAfterIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), HostedTerminalTests.settings());
    try {
      await Wait.until(() => owner.output.includes("ready"));

      terminal.input("exit 7\r");
      await Wait.until(() => owner.changes.length === 1);
      const exception = Assert.throws(() => terminal.input("ls\r"), ServiceException);

      Assert.areEqual(7, owner.changes[0]?.exitCode);
      Assert.areEqual(7, terminal.state.exitCode);
      Assert.areEqual(ErrorCode.Conflict, exception.info.name);
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async restartsTheSameShellBelowTheOldOutput(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), HostedTerminalTests.settings());
    try {
      await Wait.until(() => owner.output.includes("ready"));
      terminal.input("exit 3\r");
      await Wait.until(() => owner.changes.length === 1);

      await terminal.restart(FixtureShell.environment());
      await Wait.until(() => owner.output.split("ready").length >= 3);
      const restarted = terminal.state;
      await terminal.restart(FixtureShell.environment());
      const texts = (await terminal.lines(0, 500)).lines.map(t => t.text);

      Assert.areEqual(1, restarted.restartCount);
      Assert.isNull(restarted.exitCode);
      Assert.areEqual(3, owner.changes[0]?.exitCode);
      Assert.isNull(owner.changes[1]?.exitCode);
      Assert.isTrue(owner.changes.some(t => t.restartCount === 1 && t.exitCode !== null));
      Assert.isTrue(owner.changes.some(t => t.restartCount === 2 && t.exitCode === null));
      Assert.isTrue(texts.filter(t => t === "ready").length >= 2);
      Assert.areEqual("Fixture", terminal.state.shell);
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async readsTheScreenAtTheLastEventSent(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), HostedTerminalTests.settings());
    try {
      await Wait.until(() => owner.output.includes("ready"));
      terminal.input("print \\e[1mbold\r");
      await Wait.until(() => owner.output.includes("bold"));

      const screen = terminal.screen();

      Assert.areEqual(owner.sequences.at(-1), screen.state.sequence);
      Assert.isTrue(screen.screen.includes("ready"));
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async pausesTheShellWhileOutputWaits(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), new TerminalSettings(null, "SIGKILL", 2000, 1, 0));
    try {
      await HostedTerminalTests.acknowledgeUntil(terminal, owner, "ready");

      terminal.input("flood 400\r");
      await HostedTerminalTests.acknowledgeUntil(terminal, owner, "flooded");
      terminal.input("lines 10\r");
      await HostedTerminalTests.acknowledgeUntil(terminal, owner, "line 10");
      await HostedTerminalTests.waitForStored(terminal, "line 4");
      const texts = (await terminal.lines(0, 500)).lines.map(t => t.text);

      Assert.areEqual(400, texts.filter(t => t === HostedTerminalTests.FLOOD_LINE).length);
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async pausesTheShellWhileTheOutputItSentIsNotAcknowledged(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), new TerminalSettings(null, "SIGKILL", 2000, 20_000, 1_000));
    try {
      await Wait.until(() => owner.output.includes("ready"));

      terminal.input("flood 2000\r");
      await Wait.until(() => owner.output.includes(HostedTerminalTests.FLOOD_LINE));
      const paused = await HostedTerminalTests.settledOutput(owner);
      terminal.acknowledge(100);
      const stillPaused = await HostedTerminalTests.settledOutput(owner);
      terminal.screen();
      await Wait.until(() => owner.output.length > stillPaused.length);
      await HostedTerminalTests.acknowledgeUntil(terminal, owner, "flooded");

      Assert.isFalse(paused.includes("flooded"));
      Assert.areEqual(paused.length, stillPaused.length);
      Assert.areEqual(2000, owner.output.split(HostedTerminalTests.FLOOD_LINE).length - 1);
    }
    finally {
      await terminal.close();
    }
  }

  @TestMethod
  public async ignoresShellsItDoesNotRunAndClosesForGood(): Promise<void> {
    using directory = new TemporaryDirectory();
    const owner = new RecordingTerminalOwner();
    const terminal = HostedTerminalTests.start(owner, directory, FixtureShell.environment(), HostedTerminalTests.settings());
    const foreign = new PseudoTerminal(new FakePty(1), new RecordingPseudoTerminalListener(), undefined, 10);
    await Wait.until(() => owner.output.includes("ready"));
    terminal.input("lines 20\r");
    await HostedTerminalTests.waitForStored(terminal, "line 10");

    terminal.onData(foreign, "foreign");
    terminal.onExit(foreign, 9);
    await terminal.close();
    const exception = await Assert.throwsAsync(() => terminal.restart(FixtureShell.environment()), ServiceException);

    Assert.isFalse(owner.output.includes("foreign"));
    Assert.isFalse(owner.changes.some(t => t.exitCode === 9));
    Assert.areEqual(ErrorCode.NotFound, exception.info.name);
    Assert.isFalse(existsSync(directory.resolve("terminal.jsonl")));
  }

  private static start(owner: RecordingTerminalOwner, directory: TemporaryDirectory, environment: ShellEnvironment, settings: TerminalSettings): HostedTerminal {
    const project = new Project("project-1", "Fixture", directory.path, new Date().toISOString());
    return HostedTerminal.start("terminal-1", owner, project, FixtureShell.create(), environment, new TerminalSize(200, 5),
      directory.resolve("terminal.jsonl"), settings);
  }

  private static settings(): TerminalSettings {
    return TerminalSettings.forPlatform(process.platform, release());
  }

  private static acknowledgeUntil(terminal: HostedTerminal, owner: RecordingTerminalOwner, text: string): Promise<void> {
    return Wait.until(() => {
      terminal.acknowledge(owner.output.length);
      return owner.output.includes(text);
    });
  }

  private static async settledOutput(owner: RecordingTerminalOwner): Promise<string> {
    let output: string | null = null;
    while (output !== owner.output) {
      output = owner.output;
      await Wait.delay(250);
    }
    return output;
  }

  private static async waitForStored(terminal: HostedTerminal, text: string): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (!(await terminal.lines(0, 500)).lines.some(t => t.text === text)) {
      if (Date.now() > deadline)
        throw new Error(`"${text}" was not stored in time.`);
      await Wait.delay(20);
    }
  }
}
