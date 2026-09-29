/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Event, EventName, type Request, type Response } from "@noldova/teamrun-protocol";
import { ConnectionException, type IRuntimeClientListener, type RuntimeClient } from "@noldova/teamrun-runtime";

import type { IEventForwarder } from "../interfaces/i-event-forwarder.js";
import type { IRuntimeAttacher } from "../interfaces/i-runtime-attacher.js";
import { Resources } from "../resources.js";

export class RuntimeConnection implements IRuntimeClientListener {
  private readonly attacher: IRuntimeAttacher;
  private readonly forwarder: IEventForwarder;
  private readonly clientName: string;
  private client: RuntimeClient | null = null;
  private attaching: Promise<RuntimeClient> | null = null;
  private connectedBefore: boolean = false;
  private closed: boolean = false;

  public constructor(attacher: IRuntimeAttacher, forwarder: IEventForwarder, clientName: string) {
    ArgumentException.throwIfNullOrWhitespace(clientName, Resources.clientNameParameterName);

    this.attacher = attacher;
    this.forwarder = forwarder;
    this.clientName = clientName;
  }

  public get isConnected(): boolean {
    return !Object.isNull(this.client) && this.client.isConnected;
  }

  public assertSameBuild(): void {
    this.attacher.assertSameBuild();
  }

  public async call(request: Request): Promise<Response> {
    const client = await this.ensureClient();
    return client.call(request.method, request.payload);
  }

  public onEvent(event: Event): void {
    this.forwarder.forward(event);
  }

  public onDisconnected(): void {
    this.client = null;
    if (!this.closed && this.connectedBefore)
      this.forwarder.forward(new Event(EventName.StateInvalidated, null));
  }

  public close(): void {
    this.closed = true;
    if (!Object.isNull(this.client))
      this.client.close();
    this.client = null;
  }

  private ensureClient(): Promise<RuntimeClient> {
    if (this.closed)
      return Promise.reject(new ConnectionException(Resources.connectionClosed, null));
    if (!Object.isNull(this.client) && this.client.isConnected)
      return Promise.resolve(this.client);
    if (!Object.isNull(this.attaching))
      return this.attaching;

    const attaching = this.attacher.attach(this.clientName, this);
    this.attaching = attaching;
    return attaching.then(
      client => {
        if (this.closed) {
          client.close();
          throw new ConnectionException(Resources.connectionClosed, null);
        }
        this.client = client;
        this.attaching = null;
        if (this.connectedBefore)
          this.forwarder.forward(new Event(EventName.StateResyncRequested, null));
        this.connectedBefore = true;
        return client;
      },
      (error: unknown) => {
        this.attaching = null;
        throw error;
      });
  }
}
