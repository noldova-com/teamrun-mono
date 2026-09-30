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
  TerminalExit,
  TerminalInputParams,
  TerminalLine,
  TerminalLinePage,
  TerminalLineRange,
  TerminalLinesParams,
  TerminalOutputPayload,
  TerminalResizeParams,
  TerminalScreen,
  TerminalShellKind,
  TerminalSize,
  TerminalState,
  TerminalTextRun,
  TerminalTextStyle
} from "@noldova/teamrun-protocol";

import { FakeFitAddon } from "../../fixtures/fake-fit-addon";
import { FakeWebglAddon } from "../../fixtures/fake-webgl-addon";
import type { FakeTeamRunBridge } from "../../fixtures/fake-teamrun-bridge";
import { SampleData } from "../../fixtures/sample-data";
import { TerminalWindow } from "../../fixtures/terminal-window";
import { Resources } from "../../../src/app/resources";
import { BridgeService, TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { TerminalSession } from "../../../src/app/services/terminal-session";

describe("TerminalSession", () => {
  const stored = new TerminalLineRange(0, 0);
  let bridge: FakeTeamRunBridge;
  let terminal: Terminal;
  let fit: FakeFitAddon;
  let webgl: FakeWebglAddon;
  let session: TerminalSession;

  const output = (sequence: number, data: string): TerminalOutputPayload => new TerminalOutputPayload("t1", sequence, data, stored);
  const parsed = (): Promise<void> => new Promise(resolve => terminal.write("", resolve));
  const lines = (): string[] => {
    const buffer = terminal.buffer.active;
    return Array.from({ length: buffer.length }, (_, index) => buffer.getLine(index)?.translateToString(true) ?? "").filter(t => t.length > 0);
  };
  const requests = (method: string): unknown[] => bridge.requests.filter(t => t.method === method).map(t => t.payload);
  const panel = (area: { width: number; height: number }): HTMLElement => {
    const element = document.body.appendChild(document.createElement("div"));
    Object.defineProperty(element, "clientWidth", { get: () => area.width });
    Object.defineProperty(element, "clientHeight", { get: () => area.height });
    onTestFinished(() => element.remove());
    return element;
  };

  beforeEach(() => {
    bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    terminal = new Terminal({ scrollback: Resources.terminalScrollback });
    fit = new FakeFitAddon();
    webgl = new FakeWebglAddon();
    session = new TerminalSession(SampleData.terminal("t1"), terminal, fit, webgl, TestBed.inject(BridgeService));
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

  it("leaves the device attributes and cursor position questions to the runtime, which answers them", async () => {
    session.load(new TerminalScreen(SampleData.terminal("t1"), ""));

    session.receiveOutput(output(1, "\u001b[c\u001b[0c\u001b[6n\u001b[5n"));
    await parsed();

    expect(requests(MethodName.TerminalInput)).toEqual([new TerminalInputParams("t1", "\u001b[0n").toJson()]);
  });

  it("follows the Windows pseudo-console only for a terminal that runs in one", () => {
    const windows = new TerminalState("t2", SampleData.project.id, "PowerShell", TerminalShellKind.PowerShell, 26200, new TerminalSize(80, 24), null, 0, 0, stored);
    const other = new Terminal();
    const onWindows = new TerminalSession(windows, other, new FakeFitAddon(), new FakeWebglAddon(), TestBed.inject(BridgeService));

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

    session.receiveState(SampleData.terminal("t1", 4, new TerminalExit(2), 1));
    session.receiveState(SampleData.terminal("t1", 4, null, 1));
    expect(session.state().exit?.code).toBe(2);
    expect(terminal.options.disableStdin).toBe(true);
  });

  it("sends what is typed and resizes to fit its panel", () => {
    const terminalWindow = TerminalWindow.install();
    onTestFinished(() => terminalWindow.restore());
    session.load(new TerminalScreen(SampleData.terminal("t1"), ""));
    session.show(panel({ width: 800, height: 400 }), () => true);

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

  it("keeps its size while its panel has no width or height, as while the panel is hidden", () => {
    const terminalWindow = TerminalWindow.install();
    onTestFinished(() => terminalWindow.restore());
    const area = { width: 800, height: 400 };
    session.load(new TerminalScreen(SampleData.terminal("t1"), ""));
    session.show(panel(area), () => true);
    fit.proposal = { cols: 2, rows: 5 };

    area.width = 0;
    session.fitToHost();
    area.width = 800;
    area.height = 0;
    session.fitToHost();

    expect([terminal.cols, terminal.rows]).toEqual([80, 24]);
    expect(requests(MethodName.TerminalResize)).toEqual([]);
  });

  it("draws with WebGL once it opens, and with the DOM renderer where WebGL is unavailable or its context is lost", () => {
    const terminalWindow = TerminalWindow.install();
    onTestFinished(() => terminalWindow.restore());
    const first = document.body.appendChild(document.createElement("div"));
    const second = document.body.appendChild(document.createElement("div"));
    const unavailable = new FakeWebglAddon(true);
    const other = new Terminal();
    const withoutWebgl = new TerminalSession(SampleData.terminal("t2"), other, new FakeFitAddon(), unavailable, TestBed.inject(BridgeService));

    session.show(first, () => true);
    session.show(second, () => true);
    webgl.loseContext();
    withoutWebgl.show(first, () => true);

    expect(webgl.activations).toBe(1);
    expect(webgl.disposals).toBe(1);
    expect(unavailable.disposals).toBe(1);
    expect(other.element?.parentElement).toBe(first);
    withoutWebgl.dispose();
    first.remove();
    second.remove();
  });

  it("paints its background in the color of the surface it is shown on, also after it is configured again", () => {
    const terminalWindow = TerminalWindow.install();
    onTestFinished(() => terminalWindow.restore());
    const dock = document.body.appendChild(document.createElement("div"));
    dock.style.backgroundColor = "rgb(24, 24, 24)";
    const inDock = dock.appendChild(document.createElement("div"));
    const bare = document.body.appendChild(document.createElement("div"));

    session.show(inDock, () => true);
    const shown = terminal.options.theme?.background;
    session.configure("monospace", 13, { background: "#1f1f1f", foreground: "#cccccc" });
    const configured = terminal.options.theme;
    session.show(bare, () => true);

    expect(shown).toBe("rgb(24, 24, 24)");
    expect(configured?.background).toBe("rgb(24, 24, 24)");
    expect(configured?.foreground).toBe("#cccccc");
    expect(terminal.options.theme?.background).toBe("#1f1f1f");
    dock.remove();
    bare.remove();
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

  describe("stored lines", () => {
    const screenRows = Array.from({ length: 30 }, (_t, index) => `row ${index + 1}`);
    let store: string[];
    let range: TerminalLineRange;
    let screens: number;

    const stateWith = (sequence: number): TerminalState =>
      new TerminalState("t1", SampleData.project.id, "PowerShell", TerminalShellKind.PowerShell, null, new TerminalSize(80, 24), null, 0, sequence, range);
    const pageRequests = (): [number, number][] =>
      requests(MethodName.TerminalLines).map(t => TerminalLinesParams.fromJson(t)).map(t => [t.start, t.limit]);
    const start = async (count: number): Promise<void> => {
      store = Array.from({ length: count }, (_t, index) => `stored ${index}`);
      range = new TerminalLineRange(0, count);
      session.load(new TerminalScreen(stateWith(10), screenRows.join("\r\n")));
      await parsed();
    };
    const scrollToTop = async (expectedLines: number): Promise<void> => {
      terminal.scrollToLine(0);
      await vi.waitFor(() => expect(lines().length).toBe(expectedLines));
    };

    beforeEach(() => {
      screens = 0;
      bridge
        .answer(MethodName.TerminalLines, payload => {
          const params = TerminalLinesParams.fromJson(payload);
          const first = Math.min(Math.max(params.start, range.start), range.end);
          return new TerminalLinePage(first, store.slice(first, Math.min(first + params.limit, range.end))
            .map(t => new TerminalLine(t, false, [new TerminalTextRun(t.length, 3, -1, TerminalTextStyle.Bold)])), range).toJson();
        })
        .answer(MethodName.TerminalScreen, () => new TerminalScreen(stateWith(10 + ++screens), screenRows.join("\r\n")).toJson());
    });

    it("says how many older lines were dropped once the scroll reaches the first stored line", async () => {
      store = Array.from({ length: 1700 }, (_t, index) => `stored ${index}`);
      range = new TerminalLineRange(1200, 1700, 1200);
      session.load(new TerminalScreen(stateWith(10), screenRows.join("\r\n")));
      await parsed();

      await scrollToTop(531);

      expect(lines().slice(0, 2)).toEqual(["1,200 older lines were dropped", "stored 1200"]);
      expect(terminal.buffer.active.getLine(0)?.getCell(0)?.isDim()).not.toBe(0);
      expect(terminal.buffer.active.getLine(0)?.getCell(0)?.isItalic()).not.toBe(0);
      expect(Resources.formatDroppedLines(1)).toBe("1 older line was dropped");
    });

    it("loads the stored lines page by page when scrolled to the top, keeping the top line in place", async () => {
      await start(1300);
      expect(terminal.buffer.active.viewportY).toBe(6);

      await scrollToTop(530);
      expect(lines().slice(0, 2)).toEqual(["stored 800", "stored 801"]);
      expect(terminal.buffer.active.viewportY).toBe(500);
      expect(terminal.buffer.active.getLine(0)?.getCell(0)?.getFgColor()).toBe(3);
      await scrollToTop(1030);
      await scrollToTop(1330);
      terminal.scrollToLine(0);
      await parsed();

      expect(pageRequests()).toEqual([[800, 500], [300, 500], [0, 300]]);
      expect(lines().length).toBe(1330);
      expect([lines()[0], lines()[1299], lines()[1300], lines().at(-1)]).toEqual(["stored 0", "stored 1299", "row 1", "row 30"]);
    });

    it("forgets loaded lines below a raised start and reads the rest from there", async () => {
      await start(1300);
      await scrollToTop(530);
      await scrollToTop(1030);
      range = new TerminalLineRange(700, 1300);
      session.receiveState(stateWith(20));

      await scrollToTop(630);
      terminal.scrollToLine(0);
      await parsed();

      expect(pageRequests()).toEqual([[800, 500], [300, 500], [700, 100]]);
      expect(lines()[0]).toBe("stored 700");
      expect(lines().length).toBe(630);
    });

    it("leaves the screen behind beyond twelve pages, holds new output, and brings the screen back when scrolled down", async () => {
      await start(6500);
      for (let page = 1; page <= 13; page++)
        await scrollToTop(page < 13 ? 500 * page + 30 : 6000);

      expect([lines()[0], lines().at(-1)]).toEqual(["stored 0", "stored 5999"]);
      session.receiveOutput(new TerminalOutputPayload("t1", 40, "ignored\r\n", range));
      await parsed();
      expect(lines().length).toBe(6000);

      terminal.scrollToLine(terminal.buffer.active.baseY);
      await vi.waitFor(() => expect(lines().length).toBe(6030));

      expect([lines()[0], lines()[5999], lines()[6000], lines().at(-1)]).toEqual(["stored 500", "stored 6499", "row 1", "row 30"]);
      expect(terminal.buffer.active.viewportY).toBe(5500 - 24);
      session.receiveOutput(new TerminalOutputPayload("t1", 41, "\r\ndrawn", range));
      await parsed();
      expect(lines().at(-1)).toBe("drawn");
    });

    it("comes back to a fresh screen at the bottom when the person types while the screen is left behind", async () => {
      await start(6500);
      for (let page = 1; page <= 13; page++)
        await scrollToTop(page < 13 ? 500 * page + 30 : 6000);

      terminal.input("ls\r");
      await vi.waitFor(() => expect(lines().slice(-30)).toEqual(screenRows));

      expect(requests(MethodName.TerminalInput)).toEqual([new TerminalInputParams("t1", "ls\r").toJson()]);
      expect(terminal.buffer.active.viewportY).toBe(terminal.buffer.active.baseY);
      expect(terminal.buffer.active.baseY).toBeGreaterThan(0);
    });
  });
});
