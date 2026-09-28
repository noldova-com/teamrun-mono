/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";

export class TerminalInputParams {
  public readonly terminalId: string;
  public readonly data: string;

  public constructor(terminalId: string, data: string) {
    ArgumentException.throwIfNullOrWhitespace(terminalId, Resources.terminalIdField);
    ArgumentException.throwIfNullOrEmpty(data, Resources.dataField);

    this.terminalId = terminalId;
    this.data = data;
  }

  public static fromJson(value: unknown, path?: string): TerminalInputParams {
    const reader = JsonReader.fromValue(value, path);
    return new TerminalInputParams(reader.readNonBlankString(Resources.terminalIdField), reader.readString(Resources.dataField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.terminalIdField]: this.terminalId,
      [Resources.dataField]: this.data
    };
  }
}
