/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { Terminal } from "@xterm/xterm";

import {
  MethodName,
  TerminalAcknowledgeParams,
  TerminalInputParams,
  TerminalLineRange,
  TerminalOutputPayload,
  TerminalResizeParams,
  TerminalScreen,
  TerminalSize,
  TerminalState
} from "@noldova/teamrun-protocol";

import { FakeFitAddon } from "../../fixtures/fake-fit-addon";
import type { FakeTeamRunBridge } from "../../fixtures/fake-teamrun-bridge";
import { SampleData } from "../../fixtures/sample-data";
import { TerminalWindow } from "../../fixtures/terminal-window";
import { BridgeService, TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { TerminalSession } from "../../../src/app/services/terminal-session";

describe("TerminalSession", () => {
  const stored = new TerminalLineRange(0, 0);
  let bridge: FakeTeamRunBridge;
  let terminal: Terminal;
  let fit: FakeFitAddon;
  let session: TerminalSession;

  const output = (sequence: number, data: string): TerminalOutputPayload => new TerminalOutputPayload("t1", sequence, data, stored);
  const parsed = (): Promise<void> => new Promise(resolve => terminal.write("", resolve));
  const lines = (): string[] => {
    const buffer = terminal.buffer.active;
    return Array.from({ length: buffer.length }, (_, index) => buffer.getLine(index)?.translateToString(true) ?? "").filter(t => t.length > 0);
  };
  const requests = (method: string): unknown[] => bridge.requests.filter(t => t.method === method).map(t => t.payload);

  beforeEach(() => {
    bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    terminal = new Terminal();
    fit = new FakeFitAddon();
    session = new TerminalSession(SampleData.terminal("t1"), terminal, fit, TestBed.inject(BridgeService));
  });

  afterEach(() => session.dispose());

  it("draws the screen it attaches to, then only the events after it, in order", async () => {
    session.receiveOutput(output(3, "early\r\n"));
    session.receiveState(SampleData.terminal("t1", 4, null, 0));
    session.load(new TerminalScreen(SampleData.terminal("t1", 2), "screen\r\n"));
    session.receiveOutput(output(2, "old\r\n"));
    session.receiveOutput(output(5, "late\r\n"));
    await parsed();

    expect(lines()).toEqual(["screen", "early", "late"]);
    expect(session.id).toBe("t1");
    expect(session.state().sequence).toBe(4);
  });

  it("leaves the device attributes question to the runtime, which answers it", async () => {
    session.load(new TerminalScreen(SampleData.terminal("t1"), ""));

    session.receiveOutput(output(1, "\u001b[c\u001b[0c\u001b[6n"));
    await parsed();

    expect(requests(MethodName.TerminalInput)).toEqual([new TerminalInputParams("t1", "\u001b[1;1R").toJson()]);
  });

  it("follows the Windows pseudo-console only for a terminal that runs in one", () => {
    const windows = new TerminalState("t2", SampleData.project.id, "PowerShell", 26200, new TerminalSize(80, 24), null, 0, 0, stored);
    const other = new Terminal();
    const onWindows = new TerminalSession(windows, other, new FakeFitAddon(), TestBed.inject(BridgeService));

    expect(other.options.windowsPty).toEqual({ backend: "conpty", buildNumber: 26200 });
    expect(other.options.reflowCursorLine).toBe(true);
    expect(terminal.options.windowsPty).toEqual({});
    expect(terminal.options.reflowCursorLine).toBe(false);
    onWindows.dispose();
  });

  it("acknowledges drawn output in batches", async () => {
    session.load(new TerminalScreen(SampleData.terminal("t1"), ""));

    session.receiveOutput(output(1, "x".repeat(10_000)));
    await parsed();
    expect(requests(MethodName.TerminalAcknowledge)).toEqual([]);
    session.receiveOutput(output(2, "y".repeat(10_000)));
    await parsed();

    expect(requests(MethodName.TerminalAcknowledge)).toEqual([new TerminalAcknowledgeParams("t1", 20_000).toJson()]);
  });

  it("starts a restarted shell below the old output and stops typing after an exit", async () => {
    session.load(new TerminalScreen(SampleData.terminal("t1", 1), "one\r\ntwo"));
    session.receiveState(SampleData.terminal("t1", 2, null, 1));
    session.receiveOutput(output(3, "new"));
    await parsed();

    expect(lines()).toEqual(["one", "two", "new"]);
    expect(terminal.buffer.active.getLine(terminal.buffer.active.baseY)?.translateToString(true)).toBe("new");
    expect(terminal.options.disableStdin).toBe(false);

    session.receiveState(SampleData.terminal("t1", 4, 2, 1));
    session.receiveState(SampleData.terminal("t1", 4, null, 1));
    expect(session.state().exitCode).toBe(2);
    expect(terminal.options.disableStdin).toBe(true);
  });

  it("sends what is typed and resizes to fit its panel", () => {
    session.load(new TerminalScreen(SampleData.terminal("t1"), ""));

    terminal.input("ls\r");
    fit.proposal = { cols: 100.4, rows: 30 };
    session.fitToHost();
    session.fitToHost();
    fit.proposal = { cols: Number.NaN, rows: 30 };
    session.fitToHost();
    fit.proposal = undefined;
    session.fitToHost();
    session.configure("monospace", 17, { foreground: "#123456" });

    expect(requests(MethodName.TerminalInput)).toEqual([new TerminalInputParams("t1", "ls\r").toJson()]);
    expect([terminal.cols, terminal.rows]).toEqual([100, 30]);
    expect(requests(MethodName.TerminalResize).map(t => TerminalResizeParams.fromJson(t).size.columns)).toEqual([100]);
    expect([terminal.options.fontFamily, terminal.options.fontSize, terminal.options.theme?.foreground]).toEqual(["monospace", 17, "#123456"]);
  });

  it("opens in its panel, moves to another, takes focus once shown and copies its selection", async () => {
    const terminalWindow = TerminalWindow.install();
    onTestFinished(() => terminalWindow.restore());
    const first = document.body.appendChild(document.createElement("div"));
    const second = document.body.appendChild(document.createElement("div"));
    session.load(new TerminalScreen(SampleData.terminal("t1"), "hello"));
    await parsed();

    session.requestFocus();
    expect(session.hasFocus).toBe(false);
    session.show(first, () => true);
    expect(terminal.element?.parentElement).toBe(first);
    expect(session.hasFocus).toBe(true);
    first.focus();
    session.show(second, () => true);
    session.show(second, () => true);
    expect(terminal.element?.parentElement).toBe(second);
    session.requestFocus();
    expect(session.hasFocus).toBe(true);

    expect(session.copySelection()).toBe(false);
    terminal.select(0, 0, 5);
    expect(session.copySelection()).toBe(true);
    expect(terminalWindow.copied).toEqual(["hello"]);
    first.remove();
    second.remove();
  });
});
