/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { TerminalSize } from "@noldova/teamrun-protocol";
import { type IDisposable, type IPty, spawn } from "node-pty";

import type { IPseudoTerminalListener } from "../../interfaces/i-pseudo-terminal-listener.js";
import type { Shell } from "../../models/shell.js";
import type { ShellEnvironment } from "../../models/shell-environment.js";

export class PseudoTerminal {
  private readonly pty: IPty;
  private readonly listener: IPseudoTerminalListener;
  private readonly forceSignal: string | undefined;
  private readonly graceMilliseconds: number;
  private readonly subscriptions: readonly IDisposable[];
  private readonly exited: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private exitCode: number | null = null;

  public constructor(pty: IPty, listener: IPseudoTerminalListener, forceSignal: string | undefined, graceMilliseconds: number) {
    this.pty = pty;
    this.listener = listener;
    this.forceSignal = forceSignal;
    this.graceMilliseconds = graceMilliseconds;
    this.subscriptions = [pty.onData(t => this.listener.onData(this, t)), pty.onExit(t => this.handleExit(t.exitCode))];
  }

  public static start(
    shell: Shell,
    directory: string,
    environment: ShellEnvironment,
    size: TerminalSize,
    listener: IPseudoTerminalListener,
    forceSignal: string | undefined,
    graceMilliseconds: number): PseudoTerminal {
    const pty = spawn(shell.executable, [...shell.arguments], { cwd: directory, env: environment.toRecord(), cols: size.columns, rows: size.rows });
    return new PseudoTerminal(pty, listener, forceSignal, graceMilliseconds);
  }

  public get hasExited(): boolean {
    return !Object.isNull(this.exitCode);
  }

  public write(data: string): void {
    this.pty.write(data);
  }

  public resize(size: TerminalSize): void {
    this.pty.resize(size.columns, size.rows);
  }

  public pause(): void {
    this.pty.pause();
  }

  public resume(): void {
    this.pty.resume();
  }

  public async end(): Promise<void> {
    if (this.hasExited)
      return;

    this.pty.kill();
    if (await this.exitsWithin(this.graceMilliseconds))
      return;
    this.pty.kill(this.forceSignal);
    await this.exitsWithin(this.graceMilliseconds);
  }

  private async exitsWithin(milliseconds: number): Promise<boolean> {
    let timer: NodeJS.Timeout | null = null;
    const elapsed = new Promise<void>(resolve => {
      timer = setTimeout(resolve, milliseconds);
    });
    try {
      await Promise.race([this.exited.promise, elapsed]);
    }
    finally {
      if (!Object.isNull(timer))
        clearTimeout(timer);
    }
    return this.hasExited;
  }

  private handleExit(exitCode: number): void {
    this.exitCode = exitCode;
    for (const subscription of this.subscriptions)
      subscription.dispose();
    // node-pty releases a finished Windows pseudoconsole only through kill(); elsewhere the process is already gone.
    this.pty.kill();
    this.exited.resolve();
    this.listener.onExit(this, exitCode);
  }
}
