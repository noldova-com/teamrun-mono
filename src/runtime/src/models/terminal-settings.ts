/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class TerminalSettings {
  public readonly windowsBuild: number | null;
  public readonly forceSignal: string | undefined;
  public readonly endMilliseconds: number;
  public readonly highWatermark: number;
  public readonly lowWatermark: number;

  public constructor(windowsBuild: number | null, forceSignal: string | undefined, endMilliseconds: number, highWatermark: number, lowWatermark: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(endMilliseconds, Resources.endMillisecondsParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(highWatermark, Resources.highWatermarkParameterName);
    if (!Number.isInteger(lowWatermark) || lowWatermark < 0 || lowWatermark >= highWatermark)
      throw new ArgumentOutOfRangeException(Resources.lowWatermarkParameterName, lowWatermark);

    this.windowsBuild = windowsBuild;
    this.forceSignal = forceSignal;
    this.endMilliseconds = endMilliseconds;
    this.highWatermark = highWatermark;
    this.lowWatermark = lowWatermark;
  }

  public static forPlatform(platform: string, release: string): TerminalSettings {
    const isWindows = platform === Resources.windowsPlatform;
    return new TerminalSettings(isWindows ? Number(release.split(Resources.versionSeparator)[2]) : null, isWindows ? undefined : Resources.forceKillSignal,
      Resources.terminalEndMilliseconds, Resources.terminalHighWatermark, Resources.terminalLowWatermark);
  }
}
