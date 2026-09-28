/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Event, EventName, TerminalOutputPayload, TerminalState, type WireMessage } from "@noldova/teamrun-protocol";
import type { ITerminalOwner } from "@noldova/teamrun-runtime";

export class RecordingTerminalOwner implements ITerminalOwner {
  public readonly events: Event[] = [];
  public isClosed: boolean = false;

  public get output(): string {
    return this.outputs.map(t => t.data).join("");
  }

  public get outputs(): readonly TerminalOutputPayload[] {
    return this.events.filter(t => t.name === EventName.TerminalOutput).map(t => TerminalOutputPayload.fromJson(t.payload));
  }

  public get changes(): readonly TerminalState[] {
    return this.events.filter(t => t.name === EventName.TerminalChanged).map(t => TerminalState.fromJson(t.payload));
  }

  public get sequences(): readonly number[] {
    return this.events.map(t => t.name === EventName.TerminalOutput ? TerminalOutputPayload.fromJson(t.payload).sequence : TerminalState.fromJson(t.payload).sequence);
  }

  public write(message: WireMessage): void {
    if (message instanceof Event)
      this.events.push(message);
  }
}
