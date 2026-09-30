/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { AppUpdateCommand, AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

import { UpdateSignatureException } from "../exceptions/update-signature.exception.js";
import type { IUpdateBackend } from "../interfaces/i-update-backend.js";
import type { UpdateSettings } from "../models/update-settings.js";
import type { IUpdateRestart } from "../interfaces/i-update-restart.js";
import { Resources } from "../resources.js";

export class UpdateService {
  private readonly backend: IUpdateBackend;
  private readonly publish: (state: AppUpdateState) => void;
  private current: AppUpdateState;
  private busy: Promise<AppUpdateState> | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private periodicTimer: NodeJS.Timeout | null = null;
  private disposed: boolean = false;
  private readonly restart: IUpdateRestart | null;
  private readonly allowInstallation: boolean;
  private downloaded: boolean = false;

  public constructor(settings: UpdateSettings, version: string, backend: IUpdateBackend, publish: (state: AppUpdateState) => void,
    restart: IUpdateRestart | null = null) {
    this.backend = backend;
    this.publish = publish;
    this.restart = restart;
    this.allowInstallation = settings.allowInstallation;
    this.current = new AppUpdateState(Object.isNull(settings.feedUrl) ? AppUpdateStatus.Disabled : AppUpdateStatus.Idle,
      version, null, null, settings.disabledReason, null, settings.isTestFeed);
  }

  public get state(): AppUpdateState {
    return this.current;
  }

  public start(startupMilliseconds: number = Resources.updateStartupMilliseconds, intervalMilliseconds: number = Resources.updateIntervalMilliseconds): void {
    if (this.disposed || this.current.status === AppUpdateStatus.Disabled || !Object.isNull(this.startupTimer))
      return;
    this.startupTimer = setTimeout(() => void this.execute(AppUpdateCommand.Check), startupMilliseconds);
    this.periodicTimer = setInterval(() => void this.execute(AppUpdateCommand.Check), intervalMilliseconds);
    this.startupTimer.unref();
    this.periodicTimer.unref();
  }

  public execute(command: AppUpdateCommand): Promise<AppUpdateState> {
    if (this.disposed || command === AppUpdateCommand.Status || this.current.status === AppUpdateStatus.Disabled)
      return Promise.resolve(this.current);
    if (!Object.isNull(this.busy))
      return this.busy;
    if (command === AppUpdateCommand.Install) {
      if (!this.current.canInstall)
        return Promise.resolve(this.current);
      this.busy = Promise.resolve().then(() => this.install()).finally(() => { this.busy = null; });
      return this.busy;
    }
    if (this.downloaded)
      return Promise.resolve(this.current);
    if (command === AppUpdateCommand.Download && Object.isNull(this.current.availableVersion))
      return Promise.resolve(this.current);

    // Defer work one microtask so reentrant event listeners also see the operation as busy.
    const operation = Promise.resolve().then(() => command === AppUpdateCommand.Check ? this.check() : this.download());
    this.busy = operation.finally(() => { this.busy = null; });
    return this.busy;
  }

  public dispose(): void {
    if (this.disposed)
      return;
    this.disposed = true;
    if (!Object.isNull(this.startupTimer))
      clearTimeout(this.startupTimer);
    if (!Object.isNull(this.periodicTimer))
      clearInterval(this.periodicTimer);
    this.backend.dispose();
  }

  private async check(): Promise<AppUpdateState> {
    if (this.disposed)
      return this.current;
    this.setState(AppUpdateStatus.Checking, null, null, null);
    try {
      const version = await this.backend.check();
      this.setState(Object.isNull(version) ? AppUpdateStatus.UpToDate : AppUpdateStatus.Available, version, null, null, new Date().toISOString());
    }
    catch {
      this.setState(AppUpdateStatus.Error, null, null, Resources.updateCheckFailed);
    }
    return this.current;
  }

  private async download(): Promise<AppUpdateState> {
    if (this.disposed)
      return this.current;
    const version = this.current.availableVersion;
    this.setState(AppUpdateStatus.Downloading, version, 0, null);
    try {
      await this.backend.download(t => {
        if (!Number.isFinite(t))
          return;
        const progress = Math.max(0, Math.min(Resources.fullUpdateProgress, Math.floor(t)));
        if (progress !== this.current.progressPercent)
          this.setState(AppUpdateStatus.Downloading, version, progress, null);
      });
      this.downloaded = true;
      this.setState(AppUpdateStatus.Downloaded, version, Resources.fullUpdateProgress,
        this.allowInstallation && !Object.isNull(this.restart) ? Resources.updateInstallReady : Resources.updateInstallDeferred);
    }
    catch (error) {
      this.setState(AppUpdateStatus.Error, version, null, error instanceof UpdateSignatureException ? error.message : Resources.updateDownloadFailed);
    }
    return this.current;
  }

  private setState(status: AppUpdateStatus, version: string | null, progress: number | null, message: string | null,
    checkedAt: string | null = this.current.lastCheckedAt): void {
    if (this.disposed)
      return;
    this.current = new AppUpdateState(status, this.current.currentVersion, version, progress, message, checkedAt, this.current.isTestFeed,
      this.downloaded && this.allowInstallation && !Object.isNull(this.restart));
    this.publish(this.current);
  }

  private async install(): Promise<AppUpdateState> {
    const version = this.current.availableVersion;
    if (Object.isNull(version) || Object.isNull(this.restart) || this.disposed)
      return this.current;
    this.setState(AppUpdateStatus.Preparing, version, Resources.fullUpdateProgress, Resources.updatePreparing);
    try {
      await this.restart.install(version, () => {
        this.setState(AppUpdateStatus.Installing, version, Resources.fullUpdateProgress, Resources.updateInstalling);
        return this.backend.install();
      });
    }
    catch (error) {
      this.setState(AppUpdateStatus.Error, version, Resources.fullUpdateProgress,
        error instanceof Error ? error.message : Resources.updateInstallerFailed);
    }
    return this.current;
  }
}
