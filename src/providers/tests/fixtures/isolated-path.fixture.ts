/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class IsolatedPath {
  private static readonly PATH_VARIABLE: string = "PATH";

  public static environment(directory: string): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const [name, value] of Object.entries(process.env))
      if (name.toUpperCase() !== IsolatedPath.PATH_VARIABLE && value !== undefined)
        environment[name] = value;
    environment[IsolatedPath.PATH_VARIABLE] = directory;
    return environment;
  }
}
