/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { TerminalShellKind } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class Shell {
  public readonly id: string;
  public readonly name: string;
  public readonly kind: TerminalShellKind;
  public readonly executable: string;
  public readonly arguments: readonly string[];

  public constructor(id: string, name: string, kind: TerminalShellKind, executable: string, args: readonly string[]) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.shellIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(name, Resources.shellNameParameterName);
    ArgumentException.throwIfNullOrWhitespace(executable, Resources.executableParameterName);

    this.id = id;
    this.name = name;
    this.kind = kind;
    this.executable = executable;
    this.arguments = [...args];
  }
}
