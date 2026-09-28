/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { RegistryScope } from "../enums/registry-scope.js";
import { Resources } from "../resources.js";

export class RegistryVariable {
  public readonly scope: RegistryScope;
  public readonly name: string;
  public readonly value: string;
  public readonly isExpandable: boolean;

  public constructor(scope: RegistryScope, name: string, value: string, isExpandable: boolean) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.variableNameParameterName);

    this.scope = scope;
    this.name = name;
    this.value = value;
    this.isExpandable = isExpandable;
  }
}
