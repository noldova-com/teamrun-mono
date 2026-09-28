/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { TerminalState } from "../terminal-state.js";

export class TerminalScreen {
  public readonly state: TerminalState;
  public readonly screen: string;

  public constructor(state: TerminalState, screen: string) {
    this.state = state;
    this.screen = screen;
  }

  public static fromJson(value: unknown, path?: string): TerminalScreen {
    const reader = JsonReader.fromValue(value, path);
    const state = reader.readObject(Resources.stateField);
    return new TerminalScreen(TerminalState.fromJson(state.toJson(), state.path), reader.readString(Resources.screenField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.stateField]: this.state.toJson(),
      [Resources.screenField]: this.screen
    };
  }
}
