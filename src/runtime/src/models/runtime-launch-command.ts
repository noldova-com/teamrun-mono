/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { accessSync, constants, readdirSync } from "node:fs";

import { ArgumentException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { ProcessCommand } from "@noldova/teamrun-providers";

import { LaunchException } from "../exceptions/launch.exception.js";
import { Resources } from "../resources.js";

export class RuntimeLaunchCommand extends ProcessCommand {
  public constructor(platform: string, executablePath: string, args: readonly string[]) {
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);

    const linux = platform === Resources.linuxPlatform;
    if (linux)
      RuntimeLaunchCommand.assertLinuxPrerequisites();
    super(linux ? Resources.runtimeLaunchShell : executablePath,
      linux ? [...Resources.runtimeLaunchShellArguments, executablePath, ...args] : [...args]);
  }

  private static assertLinuxPrerequisites(): void {
    try {
      accessSync(Resources.runtimeLaunchShell, constants.X_OK);
    }
    catch (error) {
      throw new LaunchException(Resources.runtimeLaunchShellUnavailable, new ExceptionOptions(error));
    }
    try {
      accessSync(Resources.runtimeLaunchDescriptors, constants.R_OK | constants.X_OK);
      readdirSync(Resources.runtimeLaunchDescriptors);
    }
    catch (error) {
      throw new LaunchException(Resources.runtimeLaunchDescriptorsUnavailable, new ExceptionOptions(error));
    }
  }
}
