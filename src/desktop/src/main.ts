/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { app } from "electron";
import "@noldova/teamrun-foundation-core";

import { InstallationRegistry, RuntimeEntry, RuntimeLauncher, RuntimeService, RuntimeSettings, RuntimeTimings } from "@noldova/teamrun-runtime";

import { DesktopInfo } from "./models/desktop-info.js";
import { DesktopSettings } from "./models/desktop-settings.js";
import { UpdateSettings } from "./models/update-settings.js";
import { Resources } from "./resources.js";
import { BridgeGateway } from "./services/bridge-gateway.js";
import { DesktopApplication } from "./services/desktop-application.js";
import { ElectronBridgeHost } from "./services/electron-bridge-host.js";
import { ElectronUpdateBackend } from "./services/electron-update-backend.js";
import { RuntimeConnection } from "./services/runtime-connection.js";
import { SenderPolicy } from "./services/sender-policy.js";
import { TimedAttacher } from "./services/timed-attacher.js";
import { UpdateService } from "./services/update.service.js";
import { WindowFactory } from "./services/window-factory.js";
import { WindowStateStore } from "./services/window-state-store.js";
import { RendererCheckpoint } from "./services/renderer-checkpoint.js";
import { RestartCoordinator } from "./services/restart-coordinator.js";
import { RestartProcesses } from "./services/restart-processes.js";
import { UpdatePeer } from "./services/update-peer.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const isPackaged = app.isPackaged && !process.defaultApp;
const settings = DesktopSettings.fromEnvironment(
  process.env, app.getPath(Resources.homePathName), moduleDirectory, Resources.productVersion,
  isPackaged ? process.resourcesPath : undefined);
const runtimeSettings = RuntimeSettings.forPlatform(process.platform, settings.dataDirectory, settings.productVersion, Resources.idleGrace);
const runtimeEnvironment = { ...process.env, [Resources.runAsNodeVariable]: Resources.enabledValue };
const launcher = new RuntimeLauncher(runtimeSettings, process.execPath, RuntimeEntry.entryPath, [], runtimeEnvironment, RuntimeTimings.createDefault());
const host = new ElectronBridgeHost();
const attacher = new TimedAttacher(launcher, line => console.error(line));
const connection = new RuntimeConnection(attacher, { forward: event => host.broadcast(Resources.eventChannel, event.toJson()) }, Resources.clientName);
const info = new DesktopInfo(settings.dataDirectory, settings.productVersion, process.platform);
const updateSettings = UpdateSettings.fromEnvironment(process.env, isPackaged, process.platform, process.arch,
  process.platform === Resources.macPlatform && app.isInApplicationsFolder());
const checkpoints = new RendererCheckpoint(host);
const installedExecutable = process.env[Resources.appImageVariable] ?? process.execPath;
const installation = InstallationRegistry.forEntry(moduleDirectory, installedExecutable, app.getPath(Resources.homePathName));
const peer = Object.isNull(installation) ? null : new UpdatePeer(installation, settings.dataDirectory, settings.productVersion,
  checkpoints, () => application.quitPrepared());
const restart = Object.isNull(installation) || Object.isNull(peer) ? null : new RestartCoordinator(installation, peer.member,
  new RestartProcesses(installedExecutable, process.env), value => application.setInstalling(value),
  async (directory, operationId) => { await RuntimeService.createRecoveryCopy(directory, operationId); });
const updates = new UpdateService(updateSettings, settings.productVersion, new ElectronUpdateBackend(updateSettings, settings.dataDirectory),
  t => host.broadcast(Resources.updateEventChannel, t.toJson()), restart);
const gateway = new BridgeGateway(new SenderPolicy(settings), connection, host, info, updates, checkpoints);
const windowStates = new WindowStateStore(join(settings.dataDirectory, Resources.windowStateFileName));
const windows = new WindowFactory(settings, join(moduleDirectory, Resources.preloadFileName), windowStates);
const application = new DesktopApplication(settings, host, gateway, connection, windows, updates, checkpoints, peer);
application.run();
