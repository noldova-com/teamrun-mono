/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { TerminalSize } from "../terminal-size.js";

export class TerminalOpenParams {
  public readonly projectId: string | null;
  public readonly shellId: string | null;
  public readonly size: TerminalSize;

  public constructor(projectId: string | null, shellId: string | null, size: TerminalSize) {
    if (!Object.isNull(projectId))
      ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);
    if (!Object.isNull(shellId))
      ArgumentException.throwIfNullOrWhitespace(shellId, Resources.shellIdField);

    this.projectId = projectId;
    this.shellId = shellId;
    this.size = size;
  }

  public static fromJson(value: unknown, path?: string): TerminalOpenParams {
    const reader = JsonReader.fromValue(value, path);
    const size = reader.readObject(Resources.sizeField);
    return new TerminalOpenParams(reader.readNullableString(Resources.projectIdField), reader.readNullableString(Resources.shellIdField),
      TerminalSize.fromJson(size.toJson(), size.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.projectIdField]: this.projectId,
      [Resources.shellIdField]: this.shellId,
      [Resources.sizeField]: this.size.toJson()
    };
  }
}
