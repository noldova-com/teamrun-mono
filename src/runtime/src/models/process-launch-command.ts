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

import { ProcessLaunchException } from "../exceptions/process-launch.exception.js";
import { Resources } from "../resources.js";

export class ProcessLaunchCommand extends ProcessCommand {
  public constructor(platform: string, executablePath: string, args: readonly string[]) {
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);

    const linux = platform === Resources.linuxPlatform;
    if (linux)
      ProcessLaunchCommand.assertLinuxPrerequisites();
    super(linux ? Resources.processLaunchShell : executablePath,
      linux ? [...Resources.processLaunchShellArguments, executablePath, ...args] : [...args]);
  }

  private static assertLinuxPrerequisites(): void {
    try {
      accessSync(Resources.processLaunchShell, constants.X_OK);
    }
    catch (error) {
      throw new ProcessLaunchException(Resources.processLaunchShellUnavailable, new ExceptionOptions(error));
    }
    try {
      accessSync(Resources.processLaunchDescriptors, constants.R_OK | constants.X_OK);
      readdirSync(Resources.processLaunchDescriptors);
    }
    catch (error) {
      throw new ProcessLaunchException(Resources.processLaunchDescriptorsUnavailable, new ExceptionOptions(error));
    }
  }
}
