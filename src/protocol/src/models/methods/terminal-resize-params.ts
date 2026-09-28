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
import { TerminalSize } from "../terminal-size.js";

export class TerminalResizeParams {
  public readonly terminalId: string;
  public readonly size: TerminalSize;

  public constructor(terminalId: string, size: TerminalSize) {
    ArgumentException.throwIfNullOrWhitespace(terminalId, Resources.terminalIdField);

    this.terminalId = terminalId;
    this.size = size;
  }

  public static fromJson(value: unknown, path?: string): TerminalResizeParams {
    const reader = JsonReader.fromValue(value, path);
    const size = reader.readObject(Resources.sizeField);
    return new TerminalResizeParams(reader.readNonBlankString(Resources.terminalIdField), TerminalSize.fromJson(size.toJson(), size.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.terminalIdField]: this.terminalId,
      [Resources.sizeField]: this.size.toJson()
    };
  }
}
