/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { win32 } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode } from "@noldova/teamrun-protocol";
import { type CommandResult, type CommandRunner, ProcessCommand } from "@noldova/teamrun-providers";

import type { ShellEnvironment } from "../../models/shell-environment.js";
import { VisualStudioInstallation } from "../../models/visual-studio-installation.js";
import { Resources } from "../../resources.js";

export class VisualStudioReader {
  private readonly command: ProcessCommand | null;
  private readonly runner: CommandRunner;
  private readonly timeoutMilliseconds: number;

  public constructor(command: ProcessCommand | null, runner: CommandRunner, timeoutMilliseconds: number) {
    this.command = command;
    this.runner = runner;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  public static forEnvironment(environment: ShellEnvironment, runner: CommandRunner): VisualStudioReader {
    const programFiles = environment.get(Resources.programFilesX86Variable);
    const command = Object.isUndefined(programFiles) ? null
      : new ProcessCommand(win32.join(programFiles, ...Resources.vswhereSegments), Resources.vswhereArguments);
    return new VisualStudioReader(command, runner, Resources.windowsEnvironmentMilliseconds);
  }

  public async read(environment: NodeJS.ProcessEnv): Promise<readonly VisualStudioInstallation[]> {
    if (Object.isNull(this.command) || !existsSync(this.command.executable))
      return [];

    let result: CommandResult;
    try {
      result = await this.runner.run(this.command, environment, this.timeoutMilliseconds);
    }
    catch (error) {
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatVisualStudioFailed(Resources.vswhereNotStarted), [], new ExceptionOptions(error));
    }
    if (result.timedOut)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatVisualStudioFailed(Resources.vswhereTimedOut));
    if (result.exitCode !== 0)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatVisualStudioFailed(Resources.formatVswhereExit(result.exitCode)));

    return VisualStudioReader.parse(result.stdout);
  }

  private static parse(output: string): readonly VisualStudioInstallation[] {
    let value: unknown;
    try {
      value = JSON.parse(output);
    }
    catch (error) {
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatVisualStudioFailed(Resources.vswhereUnreadable), [], new ExceptionOptions(error));
    }
    if (!Array.isArray(value))
      throw VisualStudioReader.unreadable();

    return value.map((t: unknown) => VisualStudioReader.parseInstance(t));
  }

  private static parseInstance(value: unknown): VisualStudioInstallation {
    if (!Object.isObject(value) || Array.isArray(value))
      throw VisualStudioReader.unreadable();
    const instanceId: unknown = Resources.vswhereInstanceIdField in value ? value[Resources.vswhereInstanceIdField] : undefined;
    const name: unknown = Resources.vswhereDisplayNameField in value ? value[Resources.vswhereDisplayNameField] : undefined;
    const path: unknown = Resources.vswhereInstallationPathField in value ? value[Resources.vswhereInstallationPathField] : undefined;
    if (!Object.isString(instanceId) || String.isNullOrWhitespace(instanceId) || !Object.isString(name) || String.isNullOrWhitespace(name) ||
        !Object.isString(path) || String.isNullOrWhitespace(path))
      throw VisualStudioReader.unreadable();

    return new VisualStudioInstallation(instanceId, name, path);
  }

  private static unreadable(): ServiceException {
    return new ServiceException(ErrorCode.Unavailable, Resources.formatVisualStudioFailed(Resources.vswhereUnreadable));
  }
}
