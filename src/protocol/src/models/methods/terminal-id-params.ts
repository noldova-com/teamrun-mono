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

export class TerminalIdParams {
  public readonly terminalId: string;

  public constructor(terminalId: string) {
    ArgumentException.throwIfNullOrWhitespace(terminalId, Resources.terminalIdField);

    this.terminalId = terminalId;
  }

  public static fromJson(value: unknown, path?: string): TerminalIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new TerminalIdParams(reader.readNonBlankString(Resources.terminalIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.terminalIdField]: this.terminalId
    };
  }
}
