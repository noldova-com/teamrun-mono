/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { tmpdir } from "node:os";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalSize } from "@noldova/teamrun-protocol";
import { PseudoTerminal } from "@noldova/teamrun-runtime";

import { FakePty } from "../../fixtures/fake-pty.fixture.js";
import { FixtureShell } from "../../fixtures/fixture-shell.fixture.js";
import { RecordingPseudoTerminalListener } from "../../fixtures/recording-pseudo-terminal-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class PseudoTerminalTests {
  @TestMethod
  public async runsAShellAndReportsItsOutputAndExit(): Promise<void> {
    const listener = new RecordingPseudoTerminalListener();
    const pty = PseudoTerminal.start(FixtureShell.create(), tmpdir(), FixtureShell.environment(), new TerminalSize(80, 24), listener, "SIGKILL", 2000);
    await Wait.until(() => listener.output.includes("ready"));

    pty.resize(new TerminalSize(100, 30));
    pty.pause();
    pty.resume();
    pty.write("exit 7\r");
    await Wait.until(() => pty.hasExited);
    await pty.end();

    Assert.areEqual("7", listener.exitCodes.join(","));
    Assert.isTrue(listener.sources.every(t => t === pty));
  }

  @TestMethod
  public async endsARunningShell(): Promise<void> {
    const listener = new RecordingPseudoTerminalListener();
    const pty = PseudoTerminal.start(FixtureShell.create(), tmpdir(), FixtureShell.environment(), new TerminalSize(80, 24), listener, "SIGKILL", 5000);
    await Wait.until(() => listener.output.includes("ready"));

    await pty.end();

    Assert.isTrue(pty.hasExited);
    Assert.areEqual(1, listener.exitCodes.length);
  }

  @TestMethod
  public async endsAShellThatIgnoresTheHangup(): Promise<void> {
    const listener = new RecordingPseudoTerminalListener();
    const pty = PseudoTerminal.start(FixtureShell.create(), tmpdir(), FixtureShell.environment(), new TerminalSize(80, 24), listener, "SIGKILL", 500);
    await Wait.until(() => listener.output.includes("ready"));
    pty.write("ignore-hangup\r");
    await Wait.until(() => listener.output.includes("ignoring"));

    await pty.end();

    Assert.isTrue(pty.hasExited);
  }

  @TestMethod
  public async forcesTheShellWhenAskingDoesNotEndIt(): Promise<void> {
    const listener = new RecordingPseudoTerminalListener();
    const fake = new FakePty(2);
    const pty = new PseudoTerminal(fake, listener, "SIGKILL", 20);

    await pty.end();

    Assert.isTrue(pty.hasExited);
    Assert.areEqual("undefined,SIGKILL,undefined", fake.kills.map(t => String(t)).join(","));
    Assert.areEqual(0, fake.listenerCount);
  }

  @TestMethod
  public async givesUpWhenNothingEndsTheShell(): Promise<void> {
    const listener = new RecordingPseudoTerminalListener();
    const fake = new FakePty(0);
    const pty = new PseudoTerminal(fake, listener, undefined, 20);

    await pty.end();

    Assert.isFalse(pty.hasExited);
    Assert.areEqual(2, fake.kills.length);
    fake.emitExit(1);
    Assert.isTrue(pty.hasExited);
  }

  @TestMethod
  public async readsThePausedOutputAgainBeforeEndingTheShell(): Promise<void> {
    const listener = new RecordingPseudoTerminalListener();
    const fake = new FakePty(1);
    const pty = new PseudoTerminal(fake, listener, undefined, 20);
    pty.pause();

    await pty.end();

    Assert.isTrue(pty.hasExited);
    Assert.areEqual(1, fake.resumes);
  }

  @TestMethod
  public async releasesTheWindowsOutputReaderOfAShellThatEnded(): Promise<void> {
    const listener = new RecordingPseudoTerminalListener();
    const reader = { released: 0, dispose(): void { this.released += 1; } };
    const fake = Object.assign(new FakePty(1), { _agent: { _conoutSocketWorker: reader } });
    const pty = new PseudoTerminal(fake, listener, undefined, 20);

    fake.emitExit(0);
    await pty.end();

    Assert.isTrue(pty.hasExited);
    Assert.areEqual(1, reader.released);
    Assert.areEqual(1, fake.kills.length);
  }

  @TestMethod
  public passesInputSizeAndFlowControlToThePseudoTerminal(): void {
    const listener = new RecordingPseudoTerminalListener();
    const fake = new FakePty(1);
    const pty = new PseudoTerminal(fake, listener, "SIGKILL", 20);

    pty.write("ls\r");
    pty.resize(new TerminalSize(120, 40));
    pty.pause();
    pty.resume();
    fake.emitData("out");

    Assert.areEqual("ls\r", fake.writes.join(""));
    Assert.areEqual("120x40", fake.sizes.join(","));
    Assert.areEqual(1, fake.pauses);
    Assert.areEqual(1, fake.resumes);
    Assert.areEqual("out", listener.output);
    fake.emitExit(0);
  }
}
