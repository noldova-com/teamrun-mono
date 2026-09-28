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

export class TerminalOpenParams {
  public readonly projectId: string;
  public readonly size: TerminalSize;

  public constructor(projectId: string, size: TerminalSize) {
    ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);

    this.projectId = projectId;
    this.size = size;
  }

  public static fromJson(value: unknown, path?: string): TerminalOpenParams {
    const reader = JsonReader.fromValue(value, path);
    const size = reader.readObject(Resources.sizeField);
    return new TerminalOpenParams(reader.readNonBlankString(Resources.projectIdField), TerminalSize.fromJson(size.toJson(), size.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.projectIdField]: this.projectId,
      [Resources.sizeField]: this.size.toJson()
    };
  }
}
