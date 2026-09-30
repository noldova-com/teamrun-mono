/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { TerminalLine, TerminalTextRun } from "@noldova/teamrun-protocol";

import { Resources } from "../resources";

export class TerminalLineEncoder {
  public static encode(lines: readonly TerminalLine[], endsBroken: boolean): string {
    let text = String.empty;
    for (const [index, line] of lines.entries()) {
      let offset = 0;
      for (const run of line.runs) {
        text += TerminalLineEncoder.attributes(run) + line.text.slice(offset, offset + run.length);
        offset += run.length;
      }
      text += Resources.terminalResetAttributes;
      const next = lines[index + 1];
      if (Object.isUndefined(next) ? endsBroken : !next.wrapped)
        text += Resources.terminalLineBreak;
    }
    return text;
  }

  private static attributes(run: TerminalTextRun): string {
    const parameters: number[] = [Resources.sgrReset];
    for (const [style, parameter] of Resources.terminalStyleParameters)
      if ((run.style & style) !== 0)
        parameters.push(parameter);
    parameters.push(...TerminalLineEncoder.color(run.foreground, Resources.sgrForeground));
    parameters.push(...TerminalLineEncoder.color(run.background, Resources.sgrBackground));
    return Resources.formatSgr(parameters);
  }

  private static color(color: number, selector: number): number[] {
    if (color < 0)
      return [];
    if (color < Resources.terminalPaletteSize)
      return [selector, Resources.sgrPaletteColor, color];
    const rgb = color - Resources.terminalRgbColor;
    return [selector, Resources.sgrRgbColor, (rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff];
  }
}
