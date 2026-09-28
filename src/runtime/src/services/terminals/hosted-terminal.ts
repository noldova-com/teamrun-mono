/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import {
  ErrorCode,
  Event,
  EventName,
  type Project,
  type TerminalLinePage,
  TerminalOutputPayload,
  TerminalScreen,
  type TerminalSize,
  TerminalState
} from "@noldova/teamrun-protocol";

import type { IPseudoTerminalListener } from "../../interfaces/i-pseudo-terminal-listener.js";
import type { ITerminalOwner } from "../../interfaces/i-terminal-owner.js";
import type { Shell } from "../../models/shell.js";
import type { ShellEnvironment } from "../../models/shell-environment.js";
import type { TerminalSettings } from "../../models/terminal-settings.js";
import { Resources } from "../../resources.js";
import { PseudoTerminal } from "./pseudo-terminal.js";
import { TerminalEmulator } from "./terminal-emulator.js";
import { TerminalHistory } from "./terminal-history.js";

export class HostedTerminal implements IPseudoTerminalListener {
  private readonly project: Project;
  private readonly shell: Shell;
  private readonly settings: TerminalSettings;
  private readonly history: TerminalHistory;
  private emulator: TerminalEmulator;
  private size: TerminalSize;
  private pty: PseudoTerminal | null = null;
  private exitCode: number | null = null;
  private restartCount: number = 0;
  private sequence: number = 0;
  private output: string = String.empty;
  private flush: NodeJS.Immediate | null = null;
  private paused: boolean = false;
  private closed: boolean = false;
  private operation: Promise<void> = Promise.resolve();

  public readonly id: string;
  public readonly owner: ITerminalOwner;

  private constructor(id: string, owner: ITerminalOwner, project: Project, shell: Shell, size: TerminalSize, historyPath: string, settings: TerminalSettings) {
    this.id = id;
    this.owner = owner;
    this.project = project;
    this.shell = shell;
    this.settings = settings;
    this.history = new TerminalHistory(historyPath, () => this.updateFlow());
    this.emulator = new TerminalEmulator(size, this.history, settings.windowsBuild);
    this.size = size;
  }

  public static start(
    id: string,
    owner: ITerminalOwner,
    project: Project,
    shell: Shell,
    environment: ShellEnvironment,
    size: TerminalSize,
    historyPath: string,
    settings: TerminalSettings): HostedTerminal {
    const terminal = new HostedTerminal(id, owner, project, shell, size, historyPath, settings);
    terminal.pty = terminal.launch(environment);
    return terminal;
  }

  public get state(): TerminalState {
    return new TerminalState(this.id, this.project.id, this.shell.name, this.emulator.size, this.exitCode, this.restartCount, this.sequence,
      this.history.stored);
  }

  public input(data: string): void {
    if (Object.isNull(this.pty))
      throw new ServiceException(ErrorCode.Conflict, Resources.terminalShellNotRunning, [this.id]);

    this.pty.write(data);
  }

  public resize(size: TerminalSize): void {
    if (size.equals(this.size))
      return;

    this.size = size;
    if (!Object.isNull(this.pty))
      this.pty.resize(size);
    this.emulator.afterWrites(() => {
      this.flushOutput();
      this.emulator.resize(size);
      this.emitChanged();
    });
  }

  public screen(): TerminalScreen {
    this.flushOutput();
    return new TerminalScreen(this.state, this.emulator.screen());
  }

  public lines(start: number, limit: number): Promise<TerminalLinePage> {
    return this.history.read(start, limit);
  }

  public restart(environment: ShellEnvironment): Promise<void> {
    return this.enqueue(() => this.startAgain(environment));
  }

  public close(): Promise<void> {
    return this.enqueue(() => this.end());
  }

  public onData(source: PseudoTerminal, data: string): void {
    if (source !== this.pty)
      return;

    this.emulator.write(data, () => {
      this.output += data;
      this.scheduleFlush();
      this.updateFlow();
    });
    this.updateFlow();
  }

  public onExit(source: PseudoTerminal, exitCode: number): void {
    if (source !== this.pty)
      return;

    this.pty = null;
    this.emulator.afterWrites(() => {
      this.flushOutput();
      this.exitCode = exitCode;
      this.emitChanged();
    });
  }

  private launch(environment: ShellEnvironment): PseudoTerminal {
    return PseudoTerminal.start(this.shell, this.project.rootPath, environment, this.size, this, this.settings.forceSignal, this.settings.endMilliseconds);
  }

  private async startAgain(environment: ShellEnvironment): Promise<void> {
    if (this.closed)
      throw new ServiceException(ErrorCode.NotFound, Resources.terminalNotFound, [this.id]);
    if (!Object.isNull(this.pty))
      await this.pty.end();
    await this.parsed();

    const pty = this.launch(environment);
    const emulator = new TerminalEmulator(this.size, this.history, this.settings.windowsBuild);
    this.emulator.storeScreen();
    this.emulator[Symbol.dispose]();
    this.emulator = emulator;
    this.pty = pty;
    this.paused = false;
    this.exitCode = null;
    this.restartCount += 1;
    this.emitChanged();
  }

  private async end(): Promise<void> {
    this.closed = true;
    const pty = this.pty;
    this.pty = null;
    if (!Object.isNull(pty))
      await pty.end();
    await this.parsed();
    this.cancelFlush();
    this.output = String.empty;
    this.emulator[Symbol.dispose]();
    await this.history.close();
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.operation.then(operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }

  private parsed(): Promise<void> {
    return new Promise(resolve => this.emulator.afterWrites(resolve));
  }

  private scheduleFlush(): void {
    if (Object.isNull(this.flush))
      this.flush = setImmediate(() => this.flushOutput());
  }

  private cancelFlush(): void {
    if (!Object.isNull(this.flush))
      clearImmediate(this.flush);
    this.flush = null;
  }

  private flushOutput(): void {
    this.cancelFlush();
    if (this.output.length === 0)
      return;

    this.sequence += 1;
    const payload = new TerminalOutputPayload(this.id, this.sequence, this.output, this.history.stored);
    this.output = String.empty;
    this.owner.write(new Event(EventName.TerminalOutput, payload.toJson()));
  }

  private emitChanged(): void {
    this.sequence += 1;
    this.owner.write(new Event(EventName.TerminalChanged, this.state.toJson()));
  }

  private updateFlow(): void {
    if (Object.isNull(this.pty))
      return;

    const backlog = this.emulator.backlog + this.history.backlog;
    if (!this.paused && backlog > this.settings.highWatermark) {
      this.paused = true;
      this.pty.pause();
    }
    else if (this.paused && backlog <= this.settings.lowWatermark) {
      this.paused = false;
      this.pty.resume();
    }
  }
}
