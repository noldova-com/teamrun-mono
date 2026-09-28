/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Socket } from "node:net";

import "@noldova/teamrun-foundation-core";
import type { WireMessage } from "@noldova/teamrun-protocol";

import type { ISessionListener } from "../../interfaces/i-session-listener.js";
import type { ITerminalOwner } from "../../interfaces/i-terminal-owner.js";
import { LineBuffer } from "../../models/line-buffer.js";
import { Resources } from "../../resources.js";

export class ClientSession implements ITerminalOwner {
  private readonly socket: Socket;
  private readonly listener: ISessionListener;
  private readonly lines: LineBuffer = new LineBuffer();
  private clientName: string | null = null;
  private closed: boolean = false;

  public constructor(socket: Socket, listener: ISessionListener) {
    this.socket = socket;
    this.listener = listener;
    socket.setEncoding(Resources.utf8Encoding);
    socket.on(Resources.dataEvent, (chunk: string) => this.receive(chunk));
    socket.on(Resources.errorEvent, () => this.close());
    socket.on(Resources.closeEvent, () => this.handleClosed());
  }

  public get isAuthenticated(): boolean {
    return !Object.isNull(this.clientName);
  }

  public get name(): string | null {
    return this.clientName;
  }

  public get isClosed(): boolean {
    return this.closed;
  }

  public authenticate(clientName: string): void {
    this.clientName = clientName;
  }

  public write(message: WireMessage): void {
    if (!this.closed)
      this.socket.write(`${message.toText()}${Resources.lineSeparator}`);
  }

  public close(): void {
    if (!this.closed)
      this.socket.destroy();
  }

  public writeAndFlush(message: WireMessage): Promise<void> {
    if (this.closed)
      return Promise.reject(new Error(Resources.clientClosed));
    return new Promise((resolve, reject) => {
      this.socket.write(`${message.toText()}${Resources.lineSeparator}`, t => Object.isNullOrUndefined(t) ? resolve() : reject(t));
    });
  }

  private receive(chunk: string): void {
    for (const line of this.lines.append(chunk))
      this.listener.onLine(this, line);
  }

  private handleClosed(): void {
    this.closed = true;
    this.listener.onClosed(this);
  }
}
