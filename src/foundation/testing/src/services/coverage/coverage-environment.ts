/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class CoverageEnvironment {
  public static forChild(base: Readonly<Record<string, string | undefined>>): Record<string, string | undefined> {
    const environment: Record<string, string | undefined> = { ...base };
    const directory = base[Resources.coverageDirectoryVariable];
    if (Object.isUndefined(directory))
      delete environment[Resources.coverageVariable];
    else
      environment[Resources.coverageVariable] = directory;

    return environment;
  }
}
