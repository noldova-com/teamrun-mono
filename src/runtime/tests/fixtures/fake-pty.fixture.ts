/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDisposable, IEvent, IPty } from "node-pty";

export class FakePty implements IPty {
  private readonly dataListeners: Set<(data: string) => void> = new Set();
  private readonly exitListeners: Set<(event: { exitCode: number; signal?: number }) => void> = new Set();
  public readonly pid: number = 4242;
  public readonly cols: number = 80;
  public readonly rows: number = 24;
  public readonly process: string = "fake";
  public readonly kills: (string | undefined)[] = [];
  public readonly writes: string[] = [];
  public readonly sizes: string[] = [];
  public readonly exitOnKill: number;
  public readonly onData: IEvent<string> = listener => FakePty.subscribe(this.dataListeners, listener);
  public readonly onExit: IEvent<{ exitCode: number; signal?: number }> = listener => FakePty.subscribe(this.exitListeners, listener);
  public handleFlowControl: boolean = false;
  public pauses: number = 0;
  public resumes: number = 0;

  public constructor(exitOnKill: number) {
    this.exitOnKill = exitOnKill;
  }

  public get listenerCount(): number {
    return this.dataListeners.size + this.exitListeners.size;
  }

  public emitData(data: string): void {
    for (const listener of this.dataListeners)
      listener(data);
  }

  public emitExit(exitCode: number): void {
    for (const listener of [...this.exitListeners])
      listener({ exitCode });
  }

  public resize(columns: number, rows: number): void {
    this.sizes.push(`${columns}x${rows}`);
  }

  public clear(): void {
    this.writes.length = 0;
  }

  public write(data: string): void {
    this.writes.push(data);
  }

  public kill(signal?: string): void {
    this.kills.push(signal);
    if (this.kills.length === this.exitOnKill)
      setImmediate(() => this.emitExit(0));
  }

  public pause(): void {
    this.pauses += 1;
  }

  public resume(): void {
    this.resumes += 1;
  }

  private static subscribe<T>(listeners: Set<(value: T) => void>, listener: (value: T) => void): IDisposable {
    listeners.add(listener);
    return { dispose: () => listeners.delete(listener) };
  }
}
