/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { ProcessLaunchCommand, ProcessProbe } from "@noldova/teamrun-runtime";

import type { IRestartProcesses } from "../interfaces/i-restart-processes.js";
import { Resources } from "../resources.js";

export class RestartProcesses implements IRestartProcesses {
  private readonly executable: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly probe: ProcessProbe;
  private readonly timeout: number;

  public constructor(executable: string, environment: NodeJS.ProcessEnv, probe: ProcessProbe = new ProcessProbe(),
    timeout: number = Resources.updateExitMilliseconds) {
    this.executable = executable;
    this.environment = { ...environment };
    this.probe = probe;
    this.timeout = timeout;
  }

  public async waitForExit(processId: number): Promise<void> {
    const deadline = Date.now() + this.timeout;
    while (this.probe.isAlive(processId)) {
      if (Date.now() >= deadline)
        throw new Error(Resources.updateProcessStillRunning);
      await delay(Resources.updateExitPollMilliseconds);
    }
  }

  public async reopen(dataDirectory: string): Promise<void> {
    const environment = { ...this.environment, [Resources.dataDirectoryVariable]: dataDirectory };
    delete environment[Resources.runAsNodeVariable];
    const command = new ProcessLaunchCommand(process.platform, this.executable, []);
    const child = spawn(command.executable, command.arguments, { env: environment, detached: true, stdio: Resources.updateIgnoredStdio, windowsHide: true });
    child.unref();
    return new Promise((resolve, reject) => {
      child.once(Resources.updateSpawnEvent, () => resolve());
      child.once(Resources.updateErrorEvent, reject);
    });
  }
}
