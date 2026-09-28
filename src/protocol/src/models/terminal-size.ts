/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class TerminalSize {
  public readonly columns: number;
  public readonly rows: number;

  public constructor(columns: number, rows: number) {
    if (!Number.isInteger(columns) || columns < Resources.minimumTerminalColumns || columns > Resources.maximumTerminalColumns)
      throw new ArgumentOutOfRangeException(Resources.columnsField, columns);
    if (!Number.isInteger(rows) || rows < 1 || rows > Resources.maximumTerminalRows)
      throw new ArgumentOutOfRangeException(Resources.rowsField, rows);

    this.columns = columns;
    this.rows = rows;
  }

  public static fitting(columns: number, rows: number): TerminalSize {
    return new TerminalSize(
      Math.min(Resources.maximumTerminalColumns, Math.max(Resources.minimumTerminalColumns, Math.floor(columns))),
      Math.min(Resources.maximumTerminalRows, Math.max(1, Math.floor(rows))));
  }

  public static fromJson(value: unknown, path?: string): TerminalSize {
    const reader = JsonReader.fromValue(value, path);
    return new TerminalSize(reader.readInteger(Resources.columnsField), reader.readInteger(Resources.rowsField));
  }

  public equals(other: TerminalSize): boolean {
    return other.columns === this.columns && other.rows === this.rows;
  }

  public toJson(): JsonObject {
    return {
      [Resources.columnsField]: this.columns,
      [Resources.rowsField]: this.rows
    };
  }
}
