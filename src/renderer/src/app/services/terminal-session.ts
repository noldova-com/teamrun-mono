/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";
import type { ITheme, Terminal } from "@xterm/xterm";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  MethodName,
  TerminalAcknowledgeParams,
  TerminalIdParams,
  TerminalInputParams,
  TerminalLinePage,
  TerminalLineRange,
  TerminalLinesParams,
  type TerminalOutputPayload,
  TerminalResizeParams,
  TerminalScreen,
  TerminalSize,
  type TerminalState
} from "@noldova/teamrun-protocol";

import { StoredLinesWindow } from "../models/stored-lines-window";
import { Resources } from "../resources";
import type { BridgeService } from "./bridge.service";
import { TerminalLineEncoder } from "./terminal-line-encoder";

export class TerminalSession {
  private readonly terminal: Terminal;
  private readonly fit: FitAddon;
  private readonly webgl: WebglAddon;
  private readonly bridge: BridgeService;
  private readonly stateSignal: WritableSignal<TerminalState>;
  private readonly waiting: (() => void)[] = [];
  private readonly window: StoredLinesWindow;
  private loaded: boolean = false;
  private attached: boolean = true;
  private rebuilding: boolean = false;
  private returning: boolean = false;
  private sequence: number = 0;
  private processed: number = 0;
  private focusPending: boolean = false;
  private theme: ITheme;

  public readonly id: string;
  public readonly state: Signal<TerminalState>;

  public constructor(state: TerminalState, terminal: Terminal, fit: FitAddon, webgl: WebglAddon, bridge: BridgeService) {
    this.terminal = terminal;
    this.fit = fit;
    this.webgl = webgl;
    this.theme = terminal.options.theme ?? {};
    this.bridge = bridge;
    this.stateSignal = signal(state);
    this.window = new StoredLinesWindow(Resources.terminalStoredPages, state.stored);
    this.id = state.id;
    this.state = this.stateSignal.asReadonly();
    terminal.loadAddon(fit);
    terminal.onData(t => this.type(t));
    terminal.onBinary(t => this.type(t));
    terminal.onScroll(t => this.onScroll(t));
    terminal.parser.registerCsiHandler({ final: Resources.deviceAttributesFinal }, t => TerminalSession.isAttributesQuery(t));
    terminal.parser.registerCsiHandler({ final: Resources.deviceStatusFinal }, t => TerminalSession.isCursorPositionQuery(t));
    if (!Object.isNull(state.conptyBuild)) {
      terminal.options.windowsPty = { backend: Resources.conptyBackend, buildNumber: state.conptyBuild };
      terminal.options.reflowCursorLine = true;
    }
  }

  public get hasFocus(): boolean {
    return this.terminal.element?.contains(this.terminal.element.ownerDocument.activeElement) ?? false;
  }

  public load(screen: TerminalScreen): void {
    this.terminal.resize(screen.state.size.columns, screen.state.size.rows);
    this.terminal.write(screen.screen);
    this.window.reset(screen.state.stored);
    this.attach(screen);
    this.loaded = true;
    this.applyWaiting();
  }

  public receiveOutput(payload: TerminalOutputPayload): void {
    if (!this.loaded || this.rebuilding) {
      this.waiting.push(() => this.receiveOutput(payload));
      return;
    }
    if (payload.sequence <= this.sequence)
      return;

    this.sequence = payload.sequence;
    this.window.follow(payload.stored);
    if (this.attached)
      this.terminal.write(payload.data, () => this.acknowledge(payload.data.length));
    else
      this.acknowledge(payload.data.length);
  }

  public receiveState(state: TerminalState): void {
    if (!this.loaded || this.rebuilding) {
      this.waiting.push(() => this.receiveState(state));
      return;
    }
    if (state.sequence <= this.sequence)
      return;

    this.sequence = state.sequence;
    this.window.follow(state.stored);
    if (this.attached && state.restartCount > this.stateSignal().restartCount)
      this.terminal.write(Resources.terminalRestartReset + Resources.terminalLineFeed.repeat(this.terminal.rows) + Resources.terminalHome);
    this.terminal.options.disableStdin = !Object.isNull(state.exit);
    this.stateSignal.set(state);
  }

  public show(host: HTMLElement, keys: (event: KeyboardEvent) => boolean): void {
    const element = this.terminal.element;
    if (Object.isUndefined(element)) {
      host.replaceChildren();
      this.terminal.open(host);
      this.drawWithWebgl();
    }
    else if (element.parentElement !== host)
      host.replaceChildren(element);
    this.terminal.attachCustomKeyEventHandler(keys);
    this.paint();
    this.fitToHost();
    if (this.focusPending) {
      this.focusPending = false;
      this.terminal.focus();
    }
  }

  public requestFocus(): void {
    if (this.terminal.element?.isConnected === true)
      this.terminal.focus();
    else
      this.focusPending = true;
  }

  public fitToHost(): void {
    const host = this.terminal.element?.parentElement;
    if (Object.isNullOrUndefined(host) || host.clientWidth === 0 || host.clientHeight === 0)
      return;
    const proposed = this.fit.proposeDimensions();
    if (Object.isUndefined(proposed) || !Number.isFinite(proposed.cols) || !Number.isFinite(proposed.rows))
      return;
    const size = TerminalSize.fitting(proposed.cols, proposed.rows);
    if (size.columns === this.terminal.cols && size.rows === this.terminal.rows)
      return;

    this.terminal.resize(size.columns, size.rows);
    this.call(MethodName.TerminalResize, new TerminalResizeParams(this.id, size).toJson());
  }

  public configure(fontFamily: string, fontSize: number, theme: ITheme): void {
    this.terminal.options.fontFamily = fontFamily;
    this.terminal.options.fontSize = fontSize;
    this.theme = theme;
    this.paint();
    this.fitToHost();
  }

  public copySelection(): boolean {
    if (!this.terminal.hasSelection())
      return false;

    void navigator.clipboard.writeText(this.terminal.getSelection());
    return true;
  }

  public dispose(): void {
    this.terminal.dispose();
  }

  private type(data: string): void {
    this.call(MethodName.TerminalInput, new TerminalInputParams(this.id, data).toJson());
    if (this.attached)
      return;

    this.returning = true;
    if (!this.rebuilding)
      void this.extend(() => this.comeBack());
  }

  private onScroll(viewportY: number): void {
    if (!this.loaded || this.rebuilding)
      return;
    if (viewportY === 0 && this.window.hasOlder)
      void this.extend(() => this.extendUp());
    else if (!this.attached && viewportY >= this.terminal.buffer.active.baseY)
      void this.extend(() => this.extendDown());
  }

  private async extend(operation: () => Promise<void>): Promise<void> {
    this.rebuilding = true;
    try {
      await operation();
    }
    catch {
      this.returning = false;
    }
    finally {
      this.rebuilding = false;
      this.applyWaiting();
    }
  }

  private async extendUp(): Promise<void> {
    const anchor = this.window.first;
    let screen: TerminalScreen | null = null;
    if (this.attached) {
      screen = await this.fetchScreen();
      await this.catchUp(screen.state.stored.end);
    }
    if (!this.window.hasOlder)
      return;

    const page = await this.fetchPage(Math.max(this.window.first - Resources.terminalStoredPageSize, this.window.stored.start), this.window.first);
    if (page.lines.length === 0) {
      this.window.follow(page.stored);
      return;
    }
    const detached = this.window.prepend(page);
    await this.rebuild(detached ? null : screen, anchor, 0);
  }

  private async extendDown(): Promise<void> {
    let anchor = this.window.last;
    if (this.window.hasNewer) {
      const page = await this.fetchPage(this.window.last, Math.min(this.window.last + Resources.terminalStoredPageSize, this.window.stored.end));
      if (page.lines.length > 0) {
        anchor = page.start;
        this.window.append(page);
      }
      else
        this.window.follow(page.stored);
    }
    let screen: TerminalScreen | null = null;
    if (!this.window.hasNewer) {
      const fetched = await this.fetchScreen();
      if (fetched.state.stored.end === this.window.last)
        screen = fetched;
      else
        this.window.follow(fetched.state.stored);
    }
    await this.rebuild(screen, anchor, -this.terminal.rows);
  }

  private async comeBack(): Promise<void> {
    const screen = await this.fetchScreen();
    this.window.reset(screen.state.stored);
    await this.rebuild(screen, screen.state.stored.end, Number.MAX_SAFE_INTEGER);
  }

  private async catchUp(end: number): Promise<void> {
    if (end - this.window.last > Resources.terminalStoredPages * Resources.terminalStoredPageSize)
      this.window.reset(new TerminalLineRange(this.window.stored.start, end));
    while (this.window.last < end) {
      const page = await this.fetchPage(this.window.last, Math.min(this.window.last + Resources.terminalStoredPageSize, end));
      if (page.lines.length === 0)
        break;
      this.window.append(page);
    }
  }

  private async rebuild(screen: TerminalScreen | null, anchor: number, offset: number): Promise<void> {
    this.terminal.reset();
    if (this.window.first === this.window.stored.start && this.window.stored.dropped > 0)
      await this.write(`${Resources.terminalNoteAttributes}${Resources.formatDroppedLines(this.window.stored.dropped)}${Resources.terminalResetAttributes}${Resources.terminalLineBreak}`);
    const pages = this.window.pages;
    let anchorRow = 0;
    for (const [index, page] of pages.entries()) {
      if (page.start === anchor)
        anchorRow = this.cursorRow();
      await this.write(TerminalLineEncoder.encode(page.lines, pages[index + 1]?.lines[0]?.wrapped !== true));
    }
    if (anchor >= this.window.last)
      anchorRow = this.cursorRow();
    if (Object.isNull(screen))
      this.attached = false;
    else {
      await this.write(screen.screen);
      this.attach(screen);
    }
    const bottom = this.terminal.buffer.active.baseY;
    this.terminal.scrollToLine(this.returning && this.attached ? bottom : Math.min(Math.max(0, anchorRow + offset), bottom));
    this.returning = this.returning && !this.attached;
  }

  private attach(screen: TerminalScreen): void {
    this.sequence = screen.state.sequence;
    this.stateSignal.set(screen.state);
    this.window.follow(screen.state.stored);
    this.attached = true;
    this.terminal.options.disableStdin = !Object.isNull(screen.state.exit);
  }

  private cursorRow(): number {
    const buffer = this.terminal.buffer.active;
    return buffer.baseY + buffer.cursorY;
  }

  private applyWaiting(): void {
    for (const apply of this.waiting.splice(0))
      apply();
  }

  private write(data: string): Promise<void> {
    return new Promise(resolve => this.terminal.write(data, resolve));
  }

  private async fetchScreen(): Promise<TerminalScreen> {
    return TerminalScreen.fromJson(await this.bridge.call(MethodName.TerminalScreen, new TerminalIdParams(this.id).toJson()));
  }

  private async fetchPage(start: number, end: number): Promise<TerminalLinePage> {
    const page = TerminalLinePage.fromJson(await this.bridge.call(MethodName.TerminalLines, new TerminalLinesParams(this.id, start, end - start).toJson()));
    return new TerminalLinePage(page.start, page.lines.slice(0, Math.max(0, end - page.start)), page.stored);
  }

  private acknowledge(characters: number): void {
    this.processed += characters;
    if (this.processed < Resources.terminalAcknowledgeBatch)
      return;

    const params = new TerminalAcknowledgeParams(this.id, this.processed);
    this.processed = 0;
    this.call(MethodName.TerminalAcknowledge, params.toJson());
  }

  private paint(): void {
    const surface = this.surface();
    this.terminal.options.theme = Object.isNull(surface) ? this.theme : { ...this.theme, background: surface };
  }

  private surface(): string | null {
    for (let element = this.terminal.element?.parentElement ?? null; !Object.isNull(element); element = element.parentElement) {
      const color = getComputedStyle(element).backgroundColor;
      if (!Resources.transparentBackgrounds.includes(color))
        return color;
    }
    return null;
  }

  private drawWithWebgl(): void {
    try {
      this.terminal.loadAddon(this.webgl);
    }
    catch {
      this.webgl.dispose();
      return;
    }
    this.webgl.onContextLoss(() => this.webgl.dispose());
  }

  private call(method: string, payload: JsonValue): void {
    this.bridge.call(method, payload).catch(() => undefined);
  }

  private static isAttributesQuery(params: readonly (number | number[])[]): boolean {
    return params.length === 0 || (params.length === 1 && params[0] === 0);
  }

  private static isCursorPositionQuery(params: readonly (number | number[])[]): boolean {
    return params.length === 1 && params[0] === Resources.cursorPositionRequest;
  }
}
