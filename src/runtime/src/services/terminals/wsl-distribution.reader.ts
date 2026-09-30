/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { win32 } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode } from "@noldova/teamrun-protocol";
import { type CommandResult, type CommandRunner, ProcessCommand } from "@noldova/teamrun-providers";

import { Resources } from "../../resources.js";

export class WslDistributionReader {
  private readonly command: ProcessCommand;
  private readonly runner: CommandRunner;
  private readonly timeoutMilliseconds: number;

  public constructor(command: ProcessCommand, runner: CommandRunner, timeoutMilliseconds: number) {
    this.command = command;
    this.runner = runner;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  public static forSystemRoot(systemRoot: string, runner: CommandRunner): WslDistributionReader {
    const script = Buffer.from(Resources.wslDistributionScript, Resources.utf16Encoding).toString(Resources.base64Encoding);
    const command = new ProcessCommand(win32.join(systemRoot, ...Resources.windowsPowerShellSegments), [...Resources.windowsEnvironmentArguments, script]);
    return new WslDistributionReader(command, runner, Resources.windowsEnvironmentMilliseconds);
  }

  public async read(environment: NodeJS.ProcessEnv): Promise<readonly string[]> {
    let result: CommandResult;
    try {
      result = await this.runner.run(this.command, environment, this.timeoutMilliseconds);
    }
    catch (error) {
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatWslDistributionsFailed(Resources.windowsEnvironmentNotStarted), [],
        new ExceptionOptions(error));
    }
    if (result.timedOut)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatWslDistributionsFailed(Resources.windowsEnvironmentTimedOut));
    if (result.exitCode !== 0)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatWslDistributionsFailed(Resources.formatWindowsEnvironmentExit(result.exitCode)));

    return WslDistributionReader.parse(result.stdout);
  }

  private static parse(output: string): readonly string[] {
    const lines = output.split(Resources.outputLinePattern).filter(t => t.length > 0);
    if (lines.pop() !== Resources.windowsEnvironmentEnd)
      throw WslDistributionReader.unreadable();

    const defaults: string[] = [];
    const others: string[] = [];
    for (const line of lines) {
      const [name, flag, ...rest] = line.split(Resources.windowsEnvironmentFieldSeparator);
      if (Object.isUndefined(name) || name.length === 0 || !Resources.base64Pattern.test(name) || rest.length > 0 ||
          (flag !== Resources.wslDefaultFlag && flag !== Resources.wslOtherFlag))
        throw WslDistributionReader.unreadable();
      (flag === Resources.wslDefaultFlag ? defaults : others).push(Buffer.from(name, Resources.base64Encoding).toString(Resources.utf8Encoding));
    }

    return [...defaults, ...others];
  }

  private static unreadable(): ServiceException {
    return new ServiceException(ErrorCode.Unavailable, Resources.formatWslDistributionsFailed(Resources.windowsEnvironmentUnreadable));
  }
}
