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

import { RegistryScope } from "../../enums/registry-scope.js";
import { RegistryVariable } from "../../models/registry-variable.js";
import { Resources } from "../../resources.js";

export class WindowsEnvironmentReader {
  private readonly command: ProcessCommand;
  private readonly runner: CommandRunner;
  private readonly timeoutMilliseconds: number;

  public constructor(command: ProcessCommand, runner: CommandRunner, timeoutMilliseconds: number) {
    this.command = command;
    this.runner = runner;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  public static forSystemRoot(systemRoot: string, runner: CommandRunner): WindowsEnvironmentReader {
    const script = Buffer.from(Resources.windowsEnvironmentScript, Resources.utf16Encoding).toString(Resources.base64Encoding);
    const command = new ProcessCommand(win32.join(systemRoot, ...Resources.windowsPowerShellSegments), [...Resources.windowsEnvironmentArguments, script]);
    return new WindowsEnvironmentReader(command, runner, Resources.windowsEnvironmentMilliseconds);
  }

  public async read(environment: NodeJS.ProcessEnv): Promise<readonly RegistryVariable[]> {
    let result: CommandResult;
    try {
      result = await this.runner.run(this.command, environment, this.timeoutMilliseconds);
    }
    catch (error) {
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatWindowsEnvironmentFailed(Resources.windowsEnvironmentNotStarted), [],
        new ExceptionOptions(error));
    }
    if (result.timedOut)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatWindowsEnvironmentFailed(Resources.windowsEnvironmentTimedOut));
    if (result.exitCode !== 0)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatWindowsEnvironmentFailed(Resources.formatWindowsEnvironmentExit(result.exitCode)));

    return WindowsEnvironmentReader.parse(result.stdout);
  }

  private static parse(output: string): readonly RegistryVariable[] {
    const lines = output.split(Resources.outputLinePattern).filter(t => t.length > 0);
    if (lines.pop() !== Resources.windowsEnvironmentEnd)
      throw WindowsEnvironmentReader.unreadable();

    return lines.map(t => WindowsEnvironmentReader.parseLine(t));
  }

  private static parseLine(line: string): RegistryVariable {
    const fields = line.split(Resources.windowsEnvironmentFieldSeparator);
    const scope = Object.values(RegistryScope).find(t => t === fields[0]);
    const kind = fields[1];
    const name = fields[2];
    const value = fields[3];
    if (fields.length !== Resources.windowsEnvironmentFieldCount || Object.isUndefined(scope) || Object.isUndefined(name) || Object.isUndefined(value) ||
        (kind !== Resources.plainValueKind && kind !== Resources.expandableValueKind) ||
        !Resources.base64Pattern.test(name) || !Resources.base64Pattern.test(value))
      throw WindowsEnvironmentReader.unreadable();

    return new RegistryVariable(scope, WindowsEnvironmentReader.decode(name), WindowsEnvironmentReader.decode(value), kind === Resources.expandableValueKind);
  }

  private static decode(value: string): string {
    return Buffer.from(value, Resources.base64Encoding).toString(Resources.utf8Encoding);
  }

  private static unreadable(): ServiceException {
    return new ServiceException(ErrorCode.Unavailable, Resources.formatWindowsEnvironmentFailed(Resources.windowsEnvironmentUnreadable));
  }
}
