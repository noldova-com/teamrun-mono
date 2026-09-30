/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class TerminalExit {
  public readonly code: number | null;

  public constructor(code: number | null) {
    if (!Object.isNull(code) && !Number.isInteger(code))
      throw new ArgumentOutOfRangeException(Resources.codeField, code);

    this.code = code;
  }

  public static fromJson(value: unknown, path?: string): TerminalExit {
    return new TerminalExit(JsonReader.fromValue(value, path).readNullableInteger(Resources.codeField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.codeField]: this.code
    };
  }
}
