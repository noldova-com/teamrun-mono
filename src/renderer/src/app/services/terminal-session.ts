/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";
import type { FitAddon } from "@xterm/addon-fit";
import type { ITheme, Terminal } from "@xterm/xterm";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  MethodName,
  TerminalAcknowledgeParams,
  TerminalInputParams,
  type TerminalOutputPayload,
  TerminalResizeParams,
  type TerminalScreen,
  TerminalSize,
  type TerminalState
} from "@noldova/teamrun-protocol";

import { Resources } from "../resources";
import type { BridgeService } from "./bridge.service";

export class TerminalSession {
  private readonly terminal: Terminal;
  private readonly fit: FitAddon;
  private readonly bridge: BridgeService;
  private readonly stateSignal: WritableSignal<TerminalState>;
  private readonly waiting: (() => void)[] = [];
  private loaded: boolean = false;
  private sequence: number = 0;
  private processed: number = 0;
  private focusPending: boolean = false;

  public readonly id: string;
  public readonly state: Signal<TerminalState>;

  public constructor(state: TerminalState, terminal: Terminal, fit: FitAddon, bridge: BridgeService) {
    this.terminal = terminal;
    this.fit = fit;
    this.bridge = bridge;
    this.stateSignal = signal(state);
    this.id = state.id;
    this.state = this.stateSignal.asReadonly();
    terminal.loadAddon(fit);
    terminal.onData(t => this.type(t));
    terminal.onBinary(t => this.type(t));
    terminal.parser.registerCsiHandler({ final: Resources.deviceAttributesFinal }, t => TerminalSession.isAttributesQuery(t));
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
    this.sequence = screen.state.sequence;
    this.stateSignal.set(screen.state);
    this.terminal.options.disableStdin = !Object.isNull(screen.state.exitCode);
    this.loaded = true;
    for (const apply of this.waiting.splice(0))
      apply();
  }

  public receiveOutput(payload: TerminalOutputPayload): void {
    if (!this.loaded) {
      this.waiting.push(() => this.receiveOutput(payload));
      return;
    }
    if (payload.sequence <= this.sequence)
      return;

    this.sequence = payload.sequence;
    this.terminal.write(payload.data, () => this.acknowledge(payload.data.length));
  }

  public receiveState(state: TerminalState): void {
    if (!this.loaded) {
      this.waiting.push(() => this.receiveState(state));
      return;
    }
    if (state.sequence <= this.sequence)
      return;

    this.sequence = state.sequence;
    if (state.restartCount > this.stateSignal().restartCount)
      this.terminal.write(Resources.terminalRestartReset + Resources.terminalLineFeed.repeat(this.terminal.rows) + Resources.terminalHome);
    this.terminal.options.disableStdin = !Object.isNull(state.exitCode);
    this.stateSignal.set(state);
  }

  public show(host: HTMLElement, keys: (event: KeyboardEvent) => boolean): void {
    const element = this.terminal.element;
    if (Object.isUndefined(element))
      this.terminal.open(host);
    else if (element.parentElement !== host)
      host.append(element);
    this.terminal.attachCustomKeyEventHandler(keys);
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
    this.terminal.options.theme = theme;
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
  }

  private acknowledge(characters: number): void {
    this.processed += characters;
    if (this.processed < Resources.terminalAcknowledgeBatch)
      return;

    const params = new TerminalAcknowledgeParams(this.id, this.processed);
    this.processed = 0;
    this.call(MethodName.TerminalAcknowledge, params.toJson());
  }

  private call(method: string, payload: JsonValue): void {
    this.bridge.call(method, payload).catch(() => undefined);
  }

  private static isAttributesQuery(params: readonly (number | number[])[]): boolean {
    return params.length === 0 || (params.length === 1 && params[0] === 0);
  }
}
