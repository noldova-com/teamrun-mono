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
import { TerminalLineRange } from "../terminal-line-range.js";

export class TerminalOutputPayload {
  public readonly terminalId: string;
  public readonly sequence: number;
  public readonly data: string;
  public readonly stored: TerminalLineRange;

  public constructor(terminalId: string, sequence: number, data: string, stored: TerminalLineRange) {
    ArgumentException.throwIfNullOrWhitespace(terminalId, Resources.terminalIdField);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(sequence, Resources.sequenceField);
    ArgumentException.throwIfNullOrEmpty(data, Resources.dataField);

    this.terminalId = terminalId;
    this.sequence = sequence;
    this.data = data;
    this.stored = stored;
  }

  public static fromJson(value: unknown, path?: string): TerminalOutputPayload {
    const reader = JsonReader.fromValue(value, path);
    const stored = reader.readObject(Resources.storedField);
    return new TerminalOutputPayload(reader.readNonBlankString(Resources.terminalIdField), reader.readInteger(Resources.sequenceField),
      reader.readString(Resources.dataField), TerminalLineRange.fromJson(stored.toJson(), stored.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.terminalIdField]: this.terminalId,
      [Resources.sequenceField]: this.sequence,
      [Resources.dataField]: this.data,
      [Resources.storedField]: this.stored.toJson()
    };
  }
}
