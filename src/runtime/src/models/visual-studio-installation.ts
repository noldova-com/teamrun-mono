/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class VisualStudioInstallation {
  public readonly instanceId: string;
  public readonly name: string;
  public readonly path: string;

  public constructor(instanceId: string, name: string, path: string) {
    ArgumentException.throwIfNullOrWhitespace(instanceId, Resources.instanceIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(name, Resources.shellNameParameterName);
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathParameterName);

    this.instanceId = instanceId;
    this.name = name;
    this.path = path;
  }
}
