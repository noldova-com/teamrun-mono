/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class TerminalLineRange {
  public readonly start: number;
  public readonly end: number;
  public readonly dropped: number;

  public constructor(start: number, end: number, dropped: number = 0) {
    if (!Number.isInteger(start) || start < 0)
      throw new ArgumentOutOfRangeException(Resources.startField, start);
    if (!Number.isInteger(end))
      throw new ArgumentOutOfRangeException(Resources.endField, end);
    if (end < start)
      throw new ArgumentException(Resources.terminalLineRangeReversed, Resources.endField);
    if (!Number.isInteger(dropped) || dropped < 0)
      throw new ArgumentOutOfRangeException(Resources.droppedField, dropped);
    if (dropped > start)
      throw new ArgumentException(Resources.terminalDroppedBeyondStart, Resources.droppedField);

    this.start = start;
    this.end = end;
    this.dropped = dropped;
  }

  public static fromJson(value: unknown, path?: string): TerminalLineRange {
    const reader = JsonReader.fromValue(value, path);
    return new TerminalLineRange(reader.readInteger(Resources.startField), reader.readInteger(Resources.endField), reader.readInteger(Resources.droppedField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.startField]: this.start,
      [Resources.endField]: this.end,
      [Resources.droppedField]: this.dropped
    };
  }
}
