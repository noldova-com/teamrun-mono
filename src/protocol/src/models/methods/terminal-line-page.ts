/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { TerminalLine } from "../terminal-line.js";
import { TerminalLineRange } from "../terminal-line-range.js";

export class TerminalLinePage {
  public readonly start: number;
  public readonly lines: readonly TerminalLine[];
  public readonly stored: TerminalLineRange;

  public constructor(start: number, lines: readonly TerminalLine[], stored: TerminalLineRange) {
    if (!Number.isInteger(start))
      throw new ArgumentOutOfRangeException(Resources.startField, start);
    if (start < stored.start || start + lines.length > stored.end)
      throw new ArgumentException(Resources.terminalPageOutsideStored, Resources.linesField);

    this.start = start;
    this.lines = [...lines];
    this.stored = stored;
  }

  public static fromJson(value: unknown, path?: string): TerminalLinePage {
    const reader = JsonReader.fromValue(value, path);
    const stored = reader.readObject(Resources.storedField);
    return new TerminalLinePage(reader.readInteger(Resources.startField),
      reader.readObjectArray(Resources.linesField).map(t => TerminalLine.fromJson(t.toJson(), t.path)),
      TerminalLineRange.fromJson(stored.toJson(), stored.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.startField]: this.start,
      [Resources.linesField]: this.lines.map(t => t.toJson()),
      [Resources.storedField]: this.stored.toJson()
    };
  }
}
