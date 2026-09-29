/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { TerminalShellKind } from "../enums/terminal-shell-kind.js";
import { Resources } from "../resources.js";

export class TerminalShell {
  public readonly id: string;
  public readonly name: string;
  public readonly kind: TerminalShellKind;
  public readonly isDefault: boolean;

  public constructor(id: string, name: string, kind: TerminalShellKind, isDefault: boolean) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);

    this.id = id;
    this.name = name;
    this.kind = kind;
    this.isDefault = isDefault;
  }

  public static fromJson(value: unknown, path?: string): TerminalShell {
    const reader = JsonReader.fromValue(value, path);
    return new TerminalShell(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.nameField),
      reader.readOneOf(Resources.kindField, Object.values(TerminalShellKind)),
      reader.readBoolean(Resources.isDefaultField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.nameField]: this.name,
      [Resources.kindField]: this.kind,
      [Resources.isDefaultField]: this.isDefault
    };
  }
}
