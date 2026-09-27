/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

export class Resources {
  public static readonly publicUpdateFeed: string = "https://github.com/noldova-com/teamrun/releases/latest/download/";
  public static readonly appImageVariable: string = "APPIMAGE";
  public static readonly updateTestInstallVariable: string = "TEAMRUN_UPDATE_TEST_INSTALL";
  public static readonly updateInstallerFailed: string = "The update installer could not start. Your saved workspace is available; try again.";
  public static readonly updateInstallReady: string = "The update is verified. Restart when your conversations are idle.";
  public static readonly updatePreparing: string = "Saving workspaces and stopping idle runtimes…";
  public static readonly updateInstalling: string = "Installing the update. TeamRun will restart when the installation finishes.";
  public static readonly updateRejectedPromise: string = "rejected";
  public static readonly updateExitMilliseconds: number = 15_000;
  public static readonly macUpdateExitMilliseconds: number = 120_000;
  public static readonly updateExitPollMilliseconds: number = 50;
  public static readonly updateIgnoredStdio: "ignore" = "ignore";
  public static readonly updateSpawnEvent: "spawn" = "spawn";
  public static readonly updateErrorEvent: "error" = "error";
  public static readonly appImageRenamedEvent: "appimage-filename-updated" = "appimage-filename-updated";
  public static readonly appImageRestartShell: string = "bash";
  public static readonly appImageRestartShellOption: string = "-c";
  public static readonly appImageRestartName: string = "teamrun-restart";
  public static readonly appImageRestartPolls: number = 150;
  public static readonly appImageRestartScript: string = 'for fd in /proc/$$/fd/*; do fd=${fd##*/}; [ "$fd" -gt 2 ] && exec {fd}>&-; done; ' +
    'for ((i = 0; i < $3; i++)); do kill -0 "$2" 2>/dev/null || break; sleep 0.1; done; exec "$1"';
  public static readonly updateClientName: string = "teamrun-updater";
  public static readonly updatePreparationLeaseMilliseconds: number = 30_000;
  public static readonly updateRenewMilliseconds: number = 5000;
  public static readonly updateProcessStillRunning: string = "A TeamRun process did not exit. The update was not installed.";
  public static readonly updateActiveWork: string = "A conversation or another operation is still running. Finish active work before restarting to update.";
  public static readonly updateShutdownNotConfirmed: string = "A runtime could not confirm shutdown. The update was not installed.";
  public static readonly updateCloseNotConfirmed: string = "Another TeamRun window could not close. The update was not installed.";
  public static readonly updateRecoveryFailed: string = "A TeamRun window could not resume after update preparation failed.";
  public static readonly updateUnknownRuntime: string = "Another or older TeamRun installation is using this data. Close it after its work finishes, then retry the update.";
  public static readonly updatePeerMonitorMilliseconds: number = 1000;
  public static readonly updatePeerSocketName: string = "teamrun-update-control";
  public static readonly updatePreparationExpired: string = "Update preparation expired. Try again.";
  public static readonly updateWorkspaceNotReady: string = "A TeamRun window could not save its workspace. Finish pending work or resolve its draft error, then retry.";
  public static readonly updateControlUnknown: string = "This update control request is not supported.";
  public static readonly checkpointEventChannel: string = "teamrun:checkpoint";
  public static readonly checkpointAckChannel: string = "teamrun:checkpointAck";
  public static readonly checkpointTimeoutMilliseconds: number = 15_000;
  public static readonly checkpointBusy: string = "TeamRun is saving the workspace before restarting. Try again shortly.";
  public static readonly updateChannel: string = "teamrun:update";
  public static readonly updateEventChannel: string = "teamrun:updateState";
  public static readonly updateTestFeedVariable: string = "TEAMRUN_UPDATE_TEST_FEED";
  public static readonly updateArchitectures: readonly string[] = ["x64", "arm64"];
  public static readonly updateLoopbackHosts: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];
  public static readonly updateTrailingSlashes: RegExp = /\/+$/;
  public static readonly updatePrereleasePattern: RegExp = /^[^+]*-/;
  public static readonly updateStartupMilliseconds: number = 15_000;
  public static readonly updateIntervalMilliseconds: number = 6 * 60 * 60 * 1000;
  public static readonly fullUpdateProgress: number = 100;
  public static readonly updateConfigFileName: string = "update-test.json";
  public static readonly updateCachePrefix: string = "teamrun-update-test-";
  public static readonly updateHashAlgorithm: string = "sha256";
  public static readonly updateHashEncoding: "hex" = "hex";
  public static readonly customUpdateProvider: "custom" = "custom";
  public static readonly releaseFeedUrlKey: string = "url";
  public static readonly releaseFeedTargetKey: string = "target";
  public static readonly updateInfoInvalid: string = "The update information is invalid.";
  public static readonly updateVersionField: string = "version";
  public static readonly updateFilesField: string = "files";
  public static readonly updateUrlField: string = "url";
  public static readonly updateSha512Field: string = "sha512";
  public static readonly updateSizeField: string = "size";
  public static readonly updateReleaseDateField: string = "releaseDate";
  public static readonly updateProgressEvent: "download-progress" = "download-progress";
  public static readonly updatesDevelopmentDisabled: string = "Updates are unavailable when running TeamRun from source.";
  public static readonly updatesUnsupported: string = "This installation cannot update itself. New versions are published on GitHub.";
  public static readonly updatesOutsideApplications: string = "Move TeamRun to the Applications folder to update it.";
  public static readonly updatesFeedMissing: string = "Update downloads are not configured for this build.";
  public static readonly updatesFeedInvalid: string = "The local update test feed must be an HTTP loopback URL without credentials, a query or a fragment.";
  public static readonly updateCheckFailed: string = "Could not check for updates. Check the connection to the update server and try again.";
  public static readonly updateDownloadFailed: string = "The update could not be downloaded or verified. Try downloading it again.";
  public static readonly updateInstallDeferred: string = "Download verified. Installation is not enabled in this test build; restart will not install it.";

  public static formatUpdateTarget(platform: string, architecture: string): string {
    const name = platform === Resources.windowsPlatform ? Resources.windowsTargetName : platform === Resources.macPlatform ? Resources.macTargetName : platform;
    return `${name}-${architecture}`;
  }

  public static formatUpdateInfoName(target: string): string {
    return `latest-${target}.yml`;
  }

  public static formatAppImageRestartArguments(appImage: string, processId: number, polls: number): readonly string[] {
    return [Resources.appImageRestartShellOption, Resources.appImageRestartScript, Resources.appImageRestartName, appImage, String(processId), String(polls)];
  }
  public static readonly imageReadMode: string = "r";
  public static readonly connectionClosed: string = "The desktop runtime connection is closed.";
  public static readonly productVersion: string = "__VERSION__";
  public static readonly applicationName: string = "TeamRun";
  public static readonly clientName: string = "teamrun-desktop";
  public static readonly invokeChannel: string = "teamrun:invoke";
  public static readonly eventChannel: string = "teamrun:event";
  public static readonly openExternalChannel: string = "teamrun:openExternal";
  public static readonly pickDirectoryChannel: string = "teamrun:pickDirectory";
  public static readonly infoChannel: string = "teamrun:info";
  public static readonly titleBarChannel: string = "teamrun:titleBar";
  public static readonly imageChannel: string = "teamrun:image";
  public static readonly imageMediaTypes: Readonly<Record<string, string>> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp"
  };
  public static readonly maximumImageBytes: number = 10 * 1024 * 1024;
  public static readonly dataUrlPrefix: string = "data:";
  public static readonly base64DataUrlSeparator: string = ";base64,";
  public static readonly rootPathField: string = "rootPath";
  public static readonly projectListRequestId: string = "desktop-projects";
  public static readonly parentDirectory: string = "..";
  public static readonly imagesDirectoryName: string = "images";
  public static readonly attachmentsDirectoryName: string = "attachments";
  public static readonly titleBarHeight: number = 35;
  // The application user model id, the same the installer's shortcuts carry (electron-builder.json), so a pinned entry and
  // the jump list name TeamRun and relaunch it, not the Electron executable that runs it from source.
  public static readonly appUserModelId: string = "com.noldova.teamrun";
  public static readonly appIconIndex: number = 0;
  // Electron's own profile (local storage, caches, the single-instance lock) lives inside the data directory, so every data
  // directory has its own settings and its own instance.
  public static readonly userDataPathName: "userData" = "userData";
  public static readonly electronDirectoryName: string = "electron";
  public static readonly secondInstanceEvent: "second-instance" = "second-instance";
  public static readonly mainScriptArgumentIndex: number = 1;
  public static readonly titleBarColor: string = "#181818";
  public static readonly titleBarSymbolColor: string = "#cccccc";
  public static readonly hiddenTitleBarStyle: "hidden" = "hidden";
  // macOS: the traffic lights level with the window controls in the 35-pixel row the renderer keeps clear (measured on
  // Ross's Mac: macOS draws them a few pixels below the given point, so 8 puts their centre at 18).
  public static readonly trafficLightPosition: Readonly<{ x: number; y: number }> = { x: 12, y: 8 };
  public static readonly colorPattern: RegExp = /^#[0-9a-fA-F]{6}$/;
  public static readonly dataDirectoryVariable: string = "TEAMRUN_DATA_DIR";
  public static readonly rendererUrlVariable: string = "TEAMRUN_RENDERER_URL";
  public static readonly rendererIndexVariable: string = "TEAMRUN_RENDERER_INDEX";
  public static readonly screenshotVariable: string = "TEAMRUN_SCREENSHOT";
  public static readonly screenshotDelayVariable: string = "TEAMRUN_SCREENSHOT_DELAY_MS";
  public static readonly startViewVariable: string = "TEAMRUN_START_VIEW";
  public static readonly runAsNodeVariable: string = "ELECTRON_RUN_AS_NODE";
  public static readonly enabledValue: string = "1";
  public static readonly dataDirectorySegments: readonly string[] = [".noldova", "teamrun"];
  public static readonly rendererIndexSegments: readonly string[] = ["_build", "renderer", "browser", "index.html"];
  public static readonly lightIconFileName: string = "icon-light-512.png";
  public static readonly darkIconFileName: string = "icon-dark-512.png";
  public static readonly defaultIconFileName: string = Resources.darkIconFileName;
  public static readonly iconSegments: readonly string[] = ["assets", "icons", Resources.defaultIconFileName];
  public static readonly lightWindowsIconFileName: string = "icon-light.ico";
  public static readonly darkWindowsIconFileName: string = "icon-dark.ico";
  public static readonly dockIconFileName: string = "icon-dock-512.png";
  public static readonly windowsPlatform: "win32" = "win32";
  public static readonly macPlatform: "darwin" = "darwin";
  public static readonly linuxPlatform: "linux" = "linux";
  public static readonly windowsTargetName: string = "windows";
  public static readonly macTargetName: string = "mac";
  public static readonly themeUpdatedEvent: "updated" = "updated";
  public static readonly closedEvent: "closed" = "closed";
  public static readonly repositoryRootSegments: readonly string[] = ["..", "..", ".."];
  public static readonly preloadFileName: string = "preload.cjs";
  public static readonly homePathName: "home" = "home";
  public static readonly defaultScreenshotDelay: number = 2500;
  public static readonly idleGrace: number = 30_000;
  public static readonly windowWidth: number = 1480;
  public static readonly windowHeight: number = 940;
  public static readonly windowMinimumWidth: number = 1000;
  public static readonly windowMinimumHeight: number = 640;
  public static readonly windowBackground: string = "#14161a";
  public static readonly windowStateFileName: string = "window.json";
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly windowStateSaveDelay: number = 300;
  public static readonly xField: string = "x";
  public static readonly yField: string = "y";
  public static readonly widthField: string = "width";
  public static readonly heightField: string = "height";
  public static readonly maximizedField: string = "maximized";
  public static readonly resizeEvent: "resize" = "resize";
  public static readonly moveEvent: "move" = "move";
  public static readonly maximizeEvent: "maximize" = "maximize";
  public static readonly unmaximizeEvent: "unmaximize" = "unmaximize";
  public static readonly closeEvent: "close" = "close";
  public static readonly hashPrefix: string = "#";
  public static readonly queryPrefix: string = "?";
  public static readonly httpProtocol: string = "http:";
  public static readonly httpsProtocol: string = "https:";
  public static readonly contentSecurityPolicyHeader: string = "Content-Security-Policy";
  public static readonly productionContentSecurityPolicy: string = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'"
  ].join("; ");
  public static readonly developmentContentSecurityPolicy: string = [
    "default-src 'self' http://localhost:* ws://localhost:*",
    "script-src 'self' http://localhost:* 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' http://localhost:*",
    "img-src 'self' data: blob:",
    "connect-src 'self' http://localhost:* ws://localhost:*"
  ].join("; ");
  public static readonly denyWindowOpen: "deny" = "deny";
  public static readonly directoryDialogTitle: string = "Choose a project folder";
  public static readonly openDirectoryProperty: "openDirectory" = "openDirectory";
  public static readonly activateEvent: "activate" = "activate";
  public static readonly windowAllClosedEvent: "window-all-closed" = "window-all-closed";
  public static readonly beforeQuitEvent: "before-quit" = "before-quit";
  public static readonly willNavigateEvent: "will-navigate" = "will-navigate";
  public static readonly didFinishLoadEvent: "did-finish-load" = "did-finish-load";
  public static readonly didFailLoadEvent: "did-fail-load" = "did-fail-load";
  public static readonly consoleMessageEvent: "console-message" = "console-message";
  public static readonly preloadErrorEvent: "preload-error" = "preload-error";
  public static readonly renderProcessGoneEvent: "render-process-gone" = "render-process-gone";
  public static readonly devToolsProtocolVersion: string = "1.3";
  public static readonly captureScreenshotCommand: string = "Page.captureScreenshot";
  public static readonly screenshotFormat: string = "png";
  public static readonly screenshotDataProperty: "data" = "data";
  public static readonly base64Encoding: "base64" = "base64";
  public static readonly screenshotResultUnreadable: string = "The screenshot command returned no image data.";
  public static readonly rendererMissingPage: string =
    "data:text/html,<h1 style=\"font-family:sans-serif\">Renderer not built</h1><p>Run <code>npm run build</code> first.</p>";
  public static readonly untrustedSender: string = "The request did not come from the application window.";
  public static readonly clipboardWritePermission: string = "clipboard-sanitized-write";
  public static readonly runtimeUnavailable: string = "The runtime could not be reached.";

  public static readonly dataDirectoryParameterName: string = "dataDirectory";
  public static readonly productVersionParameterName: string = "productVersion";
  public static readonly rendererIndexParameterName: string = "rendererIndexPath";
  public static readonly iconParameterName: string = "iconPath";
  public static readonly platformParameterName: string = "platform";
  public static readonly dataDirectoryField: string = "dataDirectory";
  public static readonly productVersionField: string = "productVersion";
  public static readonly platformField: string = "platform";
  public static readonly screenshotDelayParameterName: string = "screenshotDelayMilliseconds";
  public static readonly clientNameParameterName: string = "clientName";

  public static formatRelaunchCommand(executable: string, script: string | null): string {
    return Object.isNull(script) ? `"${executable}"` : `"${executable}" "${script}"`;
  }

  public static formatRuntimeAttachFailed(milliseconds: number, error: string): string {
    return `TeamRun runtime not reached after ${milliseconds} ms: ${error}`;
  }

  public static formatRuntimeFailure(message: string): string {
    return `${Resources.runtimeUnavailable} ${message}`;
  }

  public static formatScreenshotWritten(path: string): string {
    return `Screenshot written to ${path}.`;
  }

  public static formatScreenshotFailed(message: string): string {
    return `The screenshot could not be captured: ${message}`;
  }

  public static formatConsoleMessage(level: string, message: string): string {
    return `renderer ${level}: ${message}`;
  }

  public static formatLoadFailure(code: number, description: string, url: string): string {
    return `The renderer failed to load ${url}: ${description} (${code}).`;
  }

  public static formatPreloadError(path: string, message: string): string {
    return `The preload ${path} failed: ${message}`;
  }

  public static formatRendererGone(reason: string): string {
    return `The renderer process ended: ${reason}.`;
  }
}
