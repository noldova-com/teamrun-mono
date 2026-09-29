/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Server, type Socket, createServer } from "node:net";

import { Endpoint, LineBuffer } from "@noldova/teamrun-runtime";

export class RawServer implements AsyncDisposable {
  public readonly received: string[] = [];
  public readonly sockets: Socket[] = [];
  public linesOnConnect: string[] = [];
  public resetOnConnect: boolean = false;
  private readonly server: Server;

  public constructor() {
    this.server = createServer(socket => this.accept(socket));
  }

  public start(): Promise<Endpoint> {
    return new Promise(resolve => this.server.listen(0, "127.0.0.1", () => resolve(Endpoint.tcp(RawServer.readPort(this.server)))));
  }

  public static readPort(server: Server): number {
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("The server has no TCP address.");

    return address.port;
  }

  public stop(): Promise<void> {
    for (const socket of this.sockets)
      socket.destroy();
    return new Promise(resolve => this.server.close(() => resolve()));
  }

  public [Symbol.asyncDispose](): Promise<void> {
    return this.stop();
  }

  public write(line: string): void {
    for (const socket of this.sockets)
      socket.write(`${line}\n`);
  }

  private accept(socket: Socket): void {
    this.sockets.push(socket);
    socket.setEncoding("utf8");
    const lines = new LineBuffer();
    socket.on("data", (chunk: string) => this.received.push(...lines.append(chunk)));
    socket.on("error", () => socket.destroy());
    if (this.resetOnConnect) {
      socket.resetAndDestroy();
      return;
    }
    for (const line of this.linesOnConnect)
      socket.write(`${line}\n`);
  }
}
