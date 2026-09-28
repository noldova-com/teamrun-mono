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

export class TerminalAcknowledgeParams {
  public readonly terminalId: string;
  public readonly characters: number;

  public constructor(terminalId: string, characters: number) {
    ArgumentException.throwIfNullOrWhitespace(terminalId, Resources.terminalIdField);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(characters, Resources.charactersField);

    this.terminalId = terminalId;
    this.characters = characters;
  }

  public static fromJson(value: unknown, path?: string): TerminalAcknowledgeParams {
    const reader = JsonReader.fromValue(value, path);
    return new TerminalAcknowledgeParams(reader.readNonBlankString(Resources.terminalIdField), reader.readInteger(Resources.charactersField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.terminalIdField]: this.terminalId,
      [Resources.charactersField]: this.characters
    };
  }
}
