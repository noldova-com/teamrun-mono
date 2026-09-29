/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { BrowserWindow, type BrowserWindowConstructorOptions, type Rectangle, app, nativeTheme, screen, shell } from "electron";

import "@noldova/teamrun-foundation-core";

import type { DesktopSettings } from "../models/desktop-settings.js";
import { SenderInfo } from "../models/sender-info.js";
import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import { SenderPolicy } from "./sender-policy.js";
import type { WindowStateStore } from "./window-state-store.js";

export class WindowFactory {
  private readonly settings: DesktopSettings;
  private readonly preloadPath: string;
  private readonly states: WindowStateStore;
  private readonly senders: SenderPolicy;

  public constructor(settings: DesktopSettings, preloadPath: string, states: WindowStateStore) {
    this.settings = settings;
    this.preloadPath = preloadPath;
    this.states = states;
    this.senders = new SenderPolicy(settings);
  }

  public create(): BrowserWindow {
    const state = this.states.read();
    const options: BrowserWindowConstructorOptions = {
      width: state.width,
      height: state.height,
      minWidth: Resources.windowMinimumWidth,
      minHeight: Resources.windowMinimumHeight,
      title: Resources.applicationName,
      backgroundColor: Resources.windowBackground,
      titleBarStyle: Resources.hiddenTitleBarStyle,
      webPreferences: { preload: this.preloadPath, contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false }
    };
    if (process.platform === Resources.macPlatform)
      options.trafficLightPosition = { ...Resources.trafficLightPosition };
    else
      options.titleBarOverlay = { color: Resources.titleBarColor, symbolColor: Resources.titleBarSymbolColor, height: Resources.titleBarHeight };
    const iconPath = this.getIconPath();
    if (existsSync(iconPath))
      options.icon = iconPath;
    if (!Object.isNull(state.x) && !Object.isNull(state.y) && WindowFactory.isVisible({ x: state.x, y: state.y, width: state.width, height: state.height })) {
      options.x = state.x;
      options.y = state.y;
    }
    const window = new BrowserWindow(options);
    this.describeToTaskbar(window, iconPath);
    this.followIconTheme(window);
    if (state.maximized)
      window.maximize();
    this.remember(window);
    window.webContents.on(Resources.willNavigateEvent, (event, url) => {
      if (!this.senders.isTrusted(new SenderInfo(url, true)))
        event.preventDefault();
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith(Resources.httpProtocol) || url.startsWith(Resources.httpsProtocol))
        void shell.openExternal(url);
      return { action: Resources.denyWindowOpen };
    });
    this.scheduleScreenshot(window);
    void this.load(window);

    return window;
  }

  private getIconPath(): string {
    if (basename(this.settings.iconPath) !== Resources.defaultIconFileName)
      return this.settings.iconPath;

    const isWindows = process.platform === Resources.windowsPlatform;
    const isDark = isWindows ? nativeTheme.shouldUseDarkColorsForSystemIntegratedUI : nativeTheme.shouldUseDarkColors;
    const variant = join(dirname(this.settings.iconPath), WindowFactory.iconFileName(process.platform, isDark));

    return existsSync(variant) ? variant : this.settings.iconPath;
  }

  private static iconFileName(platform: string, dark: boolean): string {
    switch (platform) {
      case Resources.windowsPlatform:
        return dark ? Resources.darkWindowsIconFileName : Resources.lightWindowsIconFileName;
      case Resources.macPlatform:
        return Resources.dockIconFileName;
      default:
        return dark ? Resources.darkIconFileName : Resources.lightIconFileName;
    }
  }

  private describeToTaskbar(window: BrowserWindow, iconPath: string): void {
    if (process.platform !== Resources.windowsPlatform)
      return;
    const script = process.defaultApp ? resolve(process.argv[Resources.mainScriptArgumentIndex] ?? String.empty) : null;
    window.setAppDetails({
      appId: Resources.appUserModelId,
      ...(existsSync(iconPath) ? { appIconPath: iconPath, appIconIndex: Resources.appIconIndex } : {}),
      relaunchCommand: Resources.formatRelaunchCommand(process.execPath, script),
      relaunchDisplayName: Resources.applicationName
    });
  }

  private followIconTheme(window: BrowserWindow): void {
    const update = (): void => {
      const iconPath = this.getIconPath();
      if (!existsSync(iconPath))
        return;
      if (process.platform === Resources.macPlatform)
        app.dock?.setIcon(iconPath);
      else {
        window.setIcon(iconPath);
        this.describeToTaskbar(window, iconPath);
      }
    };
    if (process.platform === Resources.macPlatform)
      update();
    nativeTheme.on(Resources.themeUpdatedEvent, update);
    window.once(Resources.closedEvent, () => nativeTheme.off(Resources.themeUpdatedEvent, update));
  }

  private remember(window: BrowserWindow): void {
    let timer: NodeJS.Timeout | null = null;
    const save = (): void => {
      const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
      this.states.write(new WindowState(bounds.x, bounds.y, bounds.width, bounds.height, window.isMaximized()));
    };
    const later = (): void => {
      if (!Object.isNull(timer))
        clearTimeout(timer);
      timer = setTimeout(save, Resources.windowStateSaveDelay);
    };
    window.on(Resources.resizeEvent, later);
    window.on(Resources.moveEvent, later);
    window.on(Resources.maximizeEvent, later);
    window.on(Resources.unmaximizeEvent, later);
    window.on(Resources.closeEvent, () => {
      if (!Object.isNull(timer))
        clearTimeout(timer);
      save();
    });
    window.once(Resources.closedEvent, () => {
      if (!Object.isNull(timer))
        clearTimeout(timer);
      window.off(Resources.resizeEvent, later);
      window.off(Resources.moveEvent, later);
      window.off(Resources.maximizeEvent, later);
      window.off(Resources.unmaximizeEvent, later);
    });
  }

  private static isVisible(bounds: Rectangle): boolean {
    return screen.getAllDisplays().some(display => {
      const area = display.workArea;
      return bounds.x < area.x + area.width && bounds.x + bounds.width > area.x && bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;
    });
  }

  private load(window: BrowserWindow): Promise<void> {
    if (!Object.isNull(this.settings.rendererUrl))
      return window.loadURL(this.settings.rendererUrl);
    if (existsSync(this.settings.rendererIndexPath))
      return Object.isNull(this.settings.startView)
        ? window.loadFile(this.settings.rendererIndexPath)
        : window.loadFile(this.settings.rendererIndexPath, { hash: this.settings.startView });

    return window.loadURL(Resources.rendererMissingPage);
  }

  private scheduleScreenshot(window: BrowserWindow): void {
    const path = this.settings.screenshotPath;
    if (Object.isNull(path))
      return;

    const contents = window.webContents;
    contents.on(Resources.consoleMessageEvent, event => process.stdout.write(`${Resources.formatConsoleMessage(event.level, event.message)}\n`));
    contents.on(Resources.didFailLoadEvent, (_event, code, description, url) =>
      process.stdout.write(`${Resources.formatLoadFailure(code, description, url)}\n`));
    contents.on(Resources.preloadErrorEvent, (_event, preloadPath, error) =>
      process.stdout.write(`${Resources.formatPreloadError(preloadPath, error.message)}\n`));
    contents.on(Resources.renderProcessGoneEvent, (_event, details) => process.stdout.write(`${Resources.formatRendererGone(details.reason)}\n`));
    contents.once(Resources.didFinishLoadEvent, () => {
      setTimeout(() => void this.captureScreenshot(window, path), this.settings.screenshotDelayMilliseconds);
    });
  }

  private async captureScreenshot(window: BrowserWindow, path: string): Promise<void> {
    try {
      await writeFile(path, await WindowFactory.captureThroughDevTools(window));
      process.stdout.write(`${Resources.formatScreenshotWritten(path)}\n`);
    }
    catch (error) {
      process.stderr.write(`${Resources.formatScreenshotFailed(error instanceof Error ? error.message : String(error))}\n`);
      process.exitCode = 1;
    }
    app.quit();
  }

  private static async captureThroughDevTools(window: BrowserWindow): Promise<Buffer> {
    const contents = window.webContents;
    contents.debugger.attach(Resources.devToolsProtocolVersion);
    try {
      const result: unknown = await contents.debugger.sendCommand(Resources.captureScreenshotCommand, { format: Resources.screenshotFormat });
      if (!WindowFactory.isScreenshotResult(result))
        throw new TypeError(Resources.screenshotResultUnreadable);

      return Buffer.from(result.data, Resources.base64Encoding);
    }
    finally {
      contents.debugger.detach();
    }
  }

  private static isScreenshotResult(value: unknown): value is { readonly data: string } {
    return Object.isObject(value) && Resources.screenshotDataProperty in value && Object.isString(value[Resources.screenshotDataProperty]);
  }
}
