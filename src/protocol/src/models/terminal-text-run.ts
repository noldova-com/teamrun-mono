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

export class TerminalTextRun {
  public readonly length: number;
  public readonly foreground: number;
  public readonly background: number;
  public readonly style: number;

  public constructor(length: number, foreground: number, background: number, style: number) {
    if (!Number.isInteger(length) || length < 1)
      throw new ArgumentOutOfRangeException(Resources.lengthField, length);
    if (!TerminalTextRun.isColor(foreground))
      throw new ArgumentOutOfRangeException(Resources.foregroundField, foreground);
    if (!TerminalTextRun.isColor(background))
      throw new ArgumentOutOfRangeException(Resources.backgroundField, background);
    if (!Number.isInteger(style) || style < 0 || (style & ~Resources.terminalTextStyles) !== 0)
      throw new ArgumentOutOfRangeException(Resources.styleField, style);

    this.length = length;
    this.foreground = foreground;
    this.background = background;
    this.style = style;
  }

  public static fromJson(value: unknown, path?: string): TerminalTextRun {
    const reader = JsonReader.fromValue(value, path);
    return new TerminalTextRun(reader.readInteger(Resources.lengthField), reader.readInteger(Resources.foregroundField),
      reader.readInteger(Resources.backgroundField), reader.readInteger(Resources.styleField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.lengthField]: this.length,
      [Resources.foregroundField]: this.foreground,
      [Resources.backgroundField]: this.background,
      [Resources.styleField]: this.style
    };
  }

  private static isColor(value: number): boolean {
    return Number.isInteger(value) && (value === Resources.defaultTerminalColor || (value >= 0 && value < Resources.terminalPaletteSize) ||
      (value >= Resources.terminalRgbColor && value <= Resources.maximumTerminalColor));
  }
}
