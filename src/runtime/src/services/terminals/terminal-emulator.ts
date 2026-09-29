/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { type TerminalLine, TerminalSize } from "@noldova/teamrun-protocol";
import serialize, { type SerializeAddon } from "@xterm/addon-serialize";
import headless, { type IMarker, type Terminal } from "@xterm/headless";

import { Resources } from "../../resources.js";
import type { TerminalHistory } from "./terminal-history.js";
import { TerminalLineReader } from "./terminal-line-reader.js";

export class TerminalEmulator implements Disposable {
  private readonly terminal: Terminal;
  private readonly serializer: SerializeAddon = new serialize.SerializeAddon();
  private readonly history: TerminalHistory;
  private readonly reader: TerminalLineReader;
  private readonly answer: (data: string) => void;
  private oldest: TerminalLine | null = null;
  private oldestMarker: IMarker | null = null;
  private pending: number = 0;

  public constructor(size: TerminalSize, history: TerminalHistory, windowsBuild: number | null, answer: (data: string) => void) {
    this.terminal = new headless.Terminal({
      cols: size.columns,
      rows: size.rows,
      scrollback: Resources.terminalCaptureScrollback,
      allowProposedApi: true,
      ...(Object.isNull(windowsBuild) ? {} : { windowsPty: { backend: Resources.conptyBackend, buildNumber: windowsBuild }, reflowCursorLine: true })
    });
    this.history = history;
    this.answer = answer;
    this.terminal.loadAddon(this.serializer);
    this.reader = new TerminalLineReader(this.terminal.buffer.normal.getNullCell());
    this.terminal.onScroll(() => this.capture());
    this.terminal.parser.registerCsiHandler({ final: Resources.eraseInDisplayFinal }, t => this.eraseSaved(t));
    this.terminal.parser.registerCsiHandler({ prefix: Resources.privatePrefix, final: Resources.eraseInDisplayFinal }, t => this.eraseSaved(t));
    this.terminal.parser.registerEscHandler({ final: Resources.fullResetFinal }, () => this.forgetStored());
    this.terminal.parser.registerCsiHandler({ final: Resources.deviceAttributesFinal }, t => this.answerAttributes(t));
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
    this.releaseOldest();
    const buffer = this.terminal.buffer.normal;
    this.terminal.options.scrollback = Math.max(Resources.terminalCaptureScrollback,
      buffer.length * Math.ceil(this.terminal.cols / size.columns));
    this.terminal.resize(size.columns, size.rows);
    const excess = buffer.baseY - Resources.terminalCaptureScrollback;
    for (let y = 0; y < excess; y++)
      this.store(y);
    this.terminal.options.scrollback = Resources.terminalCaptureScrollback;
    this.capture();
  }

  public screen(): string {
    return this.serializer.serialize();
  }

  public storeScreen(): void {
    const buffer = this.terminal.buffer.normal;
    let last = buffer.cursorY;
    for (let y = buffer.cursorY + 1; y < this.terminal.rows; y++)
      if (!String.isNullOrWhitespace(buffer.getLine(buffer.baseY + y)?.translateToString(true)))
        last = y;
    for (let y = 0; y <= buffer.baseY + last; y++)
      this.store(y);
  }

  public [Symbol.dispose](): void {
    this.releaseOldest();
    this.terminal.dispose();
  }

  private capture(): void {
    if (this.oldestMarker?.isDisposed === true && !Object.isNull(this.oldest))
      this.history.append(this.oldest);
    this.releaseOldest();
    const buffer = this.terminal.buffer.normal;
    if (buffer.baseY === Resources.terminalCaptureScrollback) {
      this.oldestMarker = this.terminal.registerMarker(-buffer.baseY - buffer.cursorY) ?? null;
      const line = buffer.getLine(0);
      if (!Object.isNull(this.oldestMarker) && !Object.isUndefined(line))
        this.oldest = this.reader.read(line, buffer.getLine(1)?.isWrapped === true);
    }
  }

  private store(y: number): void {
    const buffer = this.terminal.buffer.normal;
    const line = buffer.getLine(y);
    if (!Object.isUndefined(line))
      this.history.append(this.reader.read(line, buffer.getLine(y + 1)?.isWrapped === true));
  }

  private releaseOldest(): void {
    this.oldestMarker?.dispose();
    this.oldestMarker = null;
    this.oldest = null;
  }

  private eraseSaved(params: readonly (number | number[])[]): boolean {
    if (params[0] === Resources.eraseSavedLinesParameter && this.terminal.buffer.active.type === Resources.normalBufferType)
      this.forgetStored();
    return false;
  }

  private forgetStored(): boolean {
    this.releaseOldest();
    this.history.clear();
    return false;
  }

  private answerAttributes(params: readonly (number | number[])[]): boolean {
    if (params.length > 1 || (params.length === 1 && params[0] !== 0))
      return false;

    this.answer(Resources.deviceAttributesAnswer);
    return true;
  }
}
