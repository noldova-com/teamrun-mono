/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Shell } from "../models/shell.js";
import type { ShellEnvironment } from "../models/shell-environment.js";

export interface IShellLocator {
  findDefault(environment: ShellEnvironment): Shell;
  findAll(environment: ShellEnvironment): readonly Shell[];
}
