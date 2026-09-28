/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class Shell {
  public readonly name: string;
  public readonly executable: string;
  public readonly arguments: readonly string[];

  public constructor(name: string, executable: string, args: readonly string[]) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.shellNameParameterName);
    ArgumentException.throwIfNullOrWhitespace(executable, Resources.executableParameterName);

    this.name = name;
    this.executable = executable;
    this.arguments = [...args];
  }
}
