/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { join } from "node:path";

import { BrowserWindow, Menu, app, dialog, session } from "electron";

import { Guid } from "@noldova/teamrun-foundation-core";

import type { IBridgeHost } from "../interfaces/i-bridge-host.js";
import type { DesktopSettings } from "../models/desktop-settings.js";
import { SenderInfo } from "../models/sender-info.js";
import { Resources } from "../resources.js";
import type { BridgeGateway } from "./bridge-gateway.js";
import type { RuntimeConnection } from "./runtime-connection.js";
import type { WindowFactory } from "./window-factory.js";
import { SenderPolicy } from "./sender-policy.js";
import type { UpdateService } from "./update.service.js";
import type { RendererCheckpoint } from "./renderer-checkpoint.js";
import type { UpdatePeer } from "./update-peer.js";

export class DesktopApplication {
  private readonly settings: DesktopSettings;
  private readonly host: IBridgeHost;
  private readonly gateway: BridgeGateway;
  private readonly connection: RuntimeConnection;
  private readonly windows: WindowFactory;
  private readonly updates: UpdateService;
  private readonly checkpoints: RendererCheckpoint;
  private readonly peer: UpdatePeer | null;
  private quitting: boolean = false;
  private installing: boolean = false;
  private cancelledInstallerQuit: boolean = false;
  private closing: Promise<void> | null = null;

  public constructor(settings: DesktopSettings, host: IBridgeHost, gateway: BridgeGateway, connection: RuntimeConnection,
    windows: WindowFactory, updates: UpdateService, checkpoints: RendererCheckpoint, peer: UpdatePeer | null) {
    this.settings = settings;
    this.host = host;
    this.gateway = gateway;
    this.connection = connection;
    this.windows = windows;
    this.updates = updates;
    this.checkpoints = checkpoints;
    this.peer = peer;
  }

  public run(): void {
    app.setName(Resources.applicationName);
    app.setAppUserModelId(Resources.appUserModelId);
    app.setPath(Resources.userDataPathName, join(this.settings.dataDirectory, Resources.electronDirectoryName));
    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return;
    }
    app.on(Resources.secondInstanceEvent, () => this.focus());
    app.enableSandbox();
    Menu.setApplicationMenu(null);
    app.on(Resources.windowAllClosedEvent, () => app.quit());
    app.on(Resources.beforeQuitEvent, event => {
      if (!this.quitting && !this.installing) {
        event.preventDefault();
        if (this.cancelledInstallerQuit)
          this.cancelledInstallerQuit = false;
        else
          void this.saveAndQuit();
        return;
      }
      this.updates.dispose();
      this.connection.close();
      this.checkpoints.dispose();
      void this.peer?.dispose();
    });
    void app.whenReady().then(() => this.start());
  }

  public setInstalling(value: boolean): void {
    if (!value && this.installing)
      this.cancelledInstallerQuit = true;
    if (value)
      this.cancelledInstallerQuit = false;
    this.installing = value;
  }

  public quitPrepared(): void {
    if (!this.checkpoints.isPrepared)
      return;
    this.quitting = true;
    app.quit();
  }

  private async start(): Promise<void> {
    try {
      await this.peer?.start();
      this.applyContentSecurityPolicy();
      this.host.attach(this.gateway);
      this.createWindow();
      this.updates.start();
    }
    catch (error) {
      dialog.showErrorBox(Resources.applicationName, error instanceof Error ? error.message : Resources.updateWorkspaceNotReady);
      this.quitting = true;
      app.quit();
      return;
    }
    app.on(Resources.activateEvent, () => {
      if (BrowserWindow.getAllWindows().length === 0)
        this.createWindow();
    });
  }

  private createWindow(): void {
    const window = this.windows.create();
    window.on(Resources.closeEvent, event => {
      if (this.quitting || this.installing)
        return;
      event.preventDefault();
      void this.saveAndQuit();
    });
  }

  private saveAndQuit(): Promise<void> {
    if (!Object.isNull(this.closing))
      return this.closing;
    const id = Guid.createVersion7().toString();
    this.closing = this.checkpoints.prepareToClose(id).then(ready => {
      if (ready) {
        this.quitting = true;
        app.quit();
      }
    }).finally(() => {
      if (!this.quitting)
        this.checkpoints.resume(id);
      this.closing = null;
    });
    return this.closing;
  }

  private focus(): void {
    const window = BrowserWindow.getAllWindows()[0];
    if (Object.isUndefined(window))
      return;
    if (window.isMinimized())
      window.restore();
    window.focus();
  }

  private applyContentSecurityPolicy(): void {
    const senders = new SenderPolicy(this.settings);
    session.defaultSession.setPermissionCheckHandler((_contents, permission, _origin, details) =>
      senders.allowsPermission(new SenderInfo(details.requestingUrl ?? String.empty, details.isMainFrame), permission));
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) =>
      callback(senders.allowsPermission(new SenderInfo(details.requestingUrl, details.isMainFrame), permission)));
    const policy = this.settings.contentSecurityPolicy;
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({ responseHeaders: { ...details.responseHeaders, [Resources.contentSecurityPolicyHeader]: [policy] } });
    });
  }
}
