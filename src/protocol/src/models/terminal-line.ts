/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { TerminalTextRun } from "./terminal-text-run.js";

export class TerminalLine {
  public readonly text: string;
  public readonly wrapped: boolean;
  public readonly runs: readonly TerminalTextRun[];

  public constructor(text: string, wrapped: boolean, runs: readonly TerminalTextRun[]) {
    if (runs.reduce((length, t) => length + t.length, 0) !== text.length)
      throw new ArgumentException(Resources.terminalRunsMismatch, Resources.runsField);

    this.text = text;
    this.wrapped = wrapped;
    this.runs = [...runs];
  }

  public static fromJson(value: unknown, path?: string): TerminalLine {
    const reader = JsonReader.fromValue(value, path);
    return new TerminalLine(reader.readString(Resources.textField), reader.readBoolean(Resources.wrappedField),
      reader.readObjectArray(Resources.runsField).map(t => TerminalTextRun.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.textField]: this.text,
      [Resources.wrappedField]: this.wrapped,
      [Resources.runsField]: this.runs.map(t => t.toJson())
    };
  }
}
