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

export class TerminalLinesParams {
  public readonly terminalId: string;
  public readonly start: number;
  public readonly limit: number;

  public constructor(terminalId: string, start: number, limit: number) {
    ArgumentException.throwIfNullOrWhitespace(terminalId, Resources.terminalIdField);
    if (!Number.isInteger(start) || start < 0)
      throw new ArgumentOutOfRangeException(Resources.startField, start);
    if (!Number.isInteger(limit) || limit < 1 || limit > Resources.maximumPageSize)
      throw new ArgumentOutOfRangeException(Resources.limitField, limit);

    this.terminalId = terminalId;
    this.start = start;
    this.limit = limit;
  }

  public static fromJson(value: unknown, path?: string): TerminalLinesParams {
    const reader = JsonReader.fromValue(value, path);
    return new TerminalLinesParams(reader.readNonBlankString(Resources.terminalIdField), reader.readInteger(Resources.startField),
      reader.readInteger(Resources.limitField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.terminalIdField]: this.terminalId,
      [Resources.startField]: this.start,
      [Resources.limitField]: this.limit
    };
  }
}
