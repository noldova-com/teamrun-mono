/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { TerminalSize } from "@noldova/teamrun-protocol";
import serialize, { type SerializeAddon } from "@xterm/addon-serialize";
import headless, { type Terminal } from "@xterm/headless";

import { Resources } from "../../resources.js";
import type { TerminalHistory } from "./terminal-history.js";
import { TerminalLineReader } from "./terminal-line-reader.js";

export class TerminalEmulator implements Disposable {
  private readonly terminal: Terminal;
  private readonly serializer: SerializeAddon = new serialize.SerializeAddon();
  private readonly history: TerminalHistory;
  private readonly reader: TerminalLineReader;
  private captured: number = 0;
  private pending: number = 0;

  public constructor(size: TerminalSize, history: TerminalHistory, windowsBuild: number | null) {
    this.terminal = new headless.Terminal({
      cols: size.columns,
      rows: size.rows,
      scrollback: Resources.terminalCaptureScrollback,
      allowProposedApi: true,
      ...(Object.isNull(windowsBuild) ? {} : { windowsPty: { backend: Resources.conptyBackend, buildNumber: windowsBuild } })
    });
    this.history = history;
    this.terminal.loadAddon(this.serializer);
    this.reader = new TerminalLineReader(this.terminal.buffer.normal.getNullCell());
    this.terminal.onScroll(() => this.capture());
    this.terminal.parser.registerCsiHandler({ final: Resources.eraseInDisplayFinal }, t => this.eraseSaved(t));
    this.terminal.parser.registerCsiHandler({ prefix: Resources.privatePrefix, final: Resources.eraseInDisplayFinal }, t => this.eraseSaved(t));
    this.terminal.parser.registerEscHandler({ final: Resources.fullResetFinal }, () => this.forgetStored());
  }

  public get size(): TerminalSize {
    return new TerminalSize(this.terminal.cols, this.terminal.rows);
  }

  public get backlog(): number {
    return this.pending;
  }

  public write(data: string, parsed: () => void): void {
    this.pending += data.length;
    this.terminal.write(data, () => {
      this.pending -= data.length;
      parsed();
    });
  }

  public afterWrites(action: () => void): void {
    this.terminal.write(String.empty, action);
  }

  public resize(size: TerminalSize): void {
    const columns = this.terminal.cols;
    this.compact();
    this.terminal.options.scrollback = this.terminal.rows * Math.ceil(columns / size.columns);
    this.terminal.resize(size.columns, size.rows);
    this.capture();
    this.compact();
  }

  public screen(): string {
    return this.serializer.serialize({ scrollback: 0 });
  }

  public storeScreen(): void {
    const buffer = this.terminal.buffer.normal;
    let last = buffer.cursorY;
    for (let y = buffer.cursorY + 1; y < this.terminal.rows; y++)
      if (!String.isNullOrWhitespace(buffer.getLine(buffer.baseY + y)?.translateToString(true)))
        last = y;
    for (let y = 0; y <= last; y++)
      this.store(buffer.baseY + y);
  }

  public [Symbol.dispose](): void {
    this.terminal.dispose();
  }

  private capture(): void {
    const buffer = this.terminal.buffer.normal;
    for (let y = this.captured; y < buffer.baseY; y++)
      this.store(y);
    this.captured = buffer.baseY;
    if (this.captured >= Resources.terminalCompactionLines)
      this.compact();
  }

  private store(y: number): void {
    const buffer = this.terminal.buffer.normal;
    const line = buffer.getLine(y);
    if (!Object.isUndefined(line))
      this.history.append(this.reader.read(line, buffer.getLine(y + 1)?.isWrapped === true));
  }

  private compact(): void {
    this.terminal.options.scrollback = 0;
    this.terminal.options.scrollback = Resources.terminalCaptureScrollback;
    this.captured = this.terminal.buffer.normal.baseY;
  }

  private eraseSaved(params: readonly (number | number[])[]): boolean {
    if (params[0] === Resources.eraseSavedLinesParameter && this.terminal.buffer.active.type === Resources.normalBufferType)
      this.forgetStored();
    return false;
  }

  private forgetStored(): boolean {
    this.history.clear();
    this.captured = 0;
    return false;
  }
}
