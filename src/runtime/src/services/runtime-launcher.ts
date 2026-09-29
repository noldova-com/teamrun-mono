/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { homedir } from "node:os";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { ConnectionException } from "../exceptions/connection.exception.js";
import { LaunchException } from "../exceptions/launch.exception.js";
import { RuntimeBuildMismatchException } from "../exceptions/runtime-build-mismatch.exception.js";
import type { IRuntimeClientListener } from "../interfaces/i-runtime-client-listener.js";
import type { RuntimeLock } from "../models/runtime-lock.js";
import type { RuntimeSettings } from "../models/runtime-settings.js";
import type { RuntimeTimings } from "../models/runtime-timings.js";
import { Resources } from "../resources.js";
import { RuntimeClient } from "./endpoint/runtime-client.js";
import { LockFile } from "./lock/lock-file.js";
import { ProcessProbe } from "./lock/process-probe.js";
import { InstallationRegistry } from "./installation-registry.js";

export class RuntimeLauncher {
  private readonly settings: RuntimeSettings;
  private readonly executablePath: string;
  private readonly entryPath: string;
  private readonly entryArguments: readonly string[];
  private readonly environment: NodeJS.ProcessEnv;
  private readonly timings: RuntimeTimings;
  private readonly lockFile: LockFile;

  public constructor(
    settings: RuntimeSettings,
    executablePath: string,
    entryPath: string,
    entryArguments: readonly string[],
    environment: NodeJS.ProcessEnv,
    timings: RuntimeTimings) {
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);
    ArgumentException.throwIfNullOrWhitespace(entryPath, Resources.entryPathParameterName);

    this.settings = settings;
    this.executablePath = executablePath;
    this.entryPath = entryPath;
    this.entryArguments = [...entryArguments];
    this.environment = environment;
    this.timings = timings;
    this.lockFile = new LockFile(settings.lockPath, new ProcessProbe());
  }

  public readLiveLock(): RuntimeLock | null {
    return this.lockFile.readLive();
  }

  public assertSameBuild(): void {
    const running = this.lockFile.readLive();
    if (!Object.isNull(running) && this.isOtherBuildRunning(running))
      throw new RuntimeBuildMismatchException(running, this.settings.dataDirectory);
  }

  public async attach(clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient> {
    const installation = InstallationRegistry.forEntry(this.entryPath, this.environment[Resources.appImageVariable] ?? this.executablePath, homedir())
      ?? InstallationRegistry.forDataDirectory(this.settings.dataDirectory, homedir());
    installation?.assertLaunchAllowed();
    const running = this.lockFile.readLive();
    if (!Object.isNull(running)) {
      const client = await this.tryConnect(running, clientName, listener);
      if (!Object.isNull(client))
        return client;
      this.lockFile.discard(running);
    }

    this.startProcess();
    return this.waitForRuntime(clientName, listener);
  }

  private startProcess(): void {
    const args = [
      this.entryPath,
      Resources.dataDirectoryArgument,
      this.settings.dataDirectory,
      Resources.productVersionArgument,
      this.settings.productVersion,
      ...this.entryArguments
    ];
    if (!Object.isNull(this.settings.idleGraceMilliseconds))
      args.push(Resources.idleGraceArgument, String(this.settings.idleGraceMilliseconds));
    const child = spawn(this.executablePath, args, { detached: true, stdio: "ignore", windowsHide: true, env: this.environment });
    child.unref();
  }

  private async waitForRuntime(clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient> {
    const deadline = Date.now() + this.timings.launchTimeout;
    while (Date.now() < deadline) {
      const lock = this.lockFile.readLive();
      if (!Object.isNull(lock)) {
        const client = await this.tryConnect(lock, clientName, listener);
        if (!Object.isNull(client))
          return client;
      }
      await new Promise(resolve => setTimeout(resolve, this.timings.launchPollInterval));
    }

    throw new LaunchException(Resources.launchTimedOut);
  }

  private async tryConnect(lock: RuntimeLock, clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient | null> {
    if (this.isOtherBuildRunning(lock))
      throw new RuntimeBuildMismatchException(lock, this.settings.dataDirectory);

    try {
      return await RuntimeClient.connect(lock.endpoint, lock.token, clientName, listener, this.timings);
    }
    catch (error) {
      if (error instanceof ConnectionException && Object.isNull(error.info))
        return null;

      throw error;
    }
  }

  private isOtherBuildRunning(lock: RuntimeLock): boolean {
    return lock.build !== Resources.build && this.lockFile.isHeld();
  }
}
