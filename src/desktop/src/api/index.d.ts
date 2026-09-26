/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { AppUpdateCommand, AppUpdateState, Event, IRequestDispatcher, Request, Response, UpdateCheckpointResult } from "@noldova/teamrun-protocol";
import type { InstallationMember, InstallationRegistry, IRuntimeClientListener, IServerListener, ProcessProbe, RuntimeClient, RuntimeTimings } from "@noldova/teamrun-runtime";

/**
 * Prepares all affected instances before invoking one verified installer handoff.
 */
export interface IUpdateRestart {
  /**
   * Runs one restart transaction; restores surviving workspaces if preparation fails.
   * @param version Verified target product version.
   * @param install Installer callback, invoked only after checkpoint/shutdown/backup/exit checks.
   * @throws Error when preparation, installer launch or recovery fails.
   */
  install(version: string, install: () => Promise<void>): Promise<void>;
}

/**
 * Process lifetime boundary used by the restart coordinator.
 */
export interface IRestartProcesses {
  /**
   * Waits for a process to exit without killing it.
   * @param processId Previously acknowledged participant's process id.
   * @throws Error if it remains alive after the deadline.
   */
  waitForExit(processId: number): Promise<void>;

  /**
   * Reopens a closed desktop using the same installation after failed preparation.
   * @param dataDirectory Data directory whose workspace was checkpointed.
   * @throws Error if spawning fails.
   */
  reopen(dataDirectory: string): Promise<void>;
}

/**
 * Waits for acknowledged process exit and reopens desktops without a shell.
 */
export declare class RestartProcesses implements IRestartProcesses {
  /**
   * Captures the installation executable and environment.
   * @param executable Current application executable.
   * @param environment Launch environment; Node mode is removed when reopening a desktop.
   * @param probe Optional native liveness observer.
   * @param timeout Exit deadline in milliseconds; default 15 seconds.
   */
  public constructor(executable: string, environment: NodeJS.ProcessEnv, probe?: ProcessProbe, timeout?: number);

  /**
   * Waits for exit without forced cancellation.
   * @param processId Process to observe.
   * @throws Error after the deadline.
   */
  public waitForExit(processId: number): Promise<void>;

  /**
   * Starts a desktop for the saved data directory.
   * @param dataDirectory Previously checkpointed directory.
   * @throws Error if the executable cannot spawn.
   */
  public reopen(dataDirectory: string): Promise<void>;
}

/**
 * Authenticated connection to one participant. Its local capability never reaches the renderer.
 */
export declare class UpdateParticipant {
  /**
   * Registered identity.
   */
  public readonly member: InstallationMember;
  /**
   * Owned control connection; close it after the attempt.
   */
  public readonly client: RuntimeClient;

  private constructor();

  /**
   * Connects to a ready participant.
   * @param member Registered endpoint and capability.
   * @param timings Connection and call deadlines.
   * @returns Connected participant.
   * @throws Error when readiness or connection fails.
   */
  public static connect(member: InstallationMember, timings: RuntimeTimings): Promise<UpdateParticipant>;

  /**
   * Requests one update operation, exposing only a caller-owned failure message.
   * @param method Supported control method.
   * @param payload Validated operation payload.
   * @param failureMessage Safe user-facing message.
   * @throws Error with the safe message on a rejected or failed request.
   */
  public call(method: string, payload: JsonValue, failureMessage: string): Promise<void>;
}

/**
 * Desktop control endpoint, kept independent of the runtime so workspace recovery works after runtime exit.
 */
export declare class UpdatePeer implements IRequestDispatcher, IServerListener {
  /**
   * Creates a peer without registering or listening.
   * @param registry Installation control registry.
   * @param dataDirectory Desktop data directory.
   * @param version Product version.
   * @param checkpoints Renderer checkpoint owner.
   * @param closeWindow Called only after a prepared close response is flushed.
   * @param monitorMilliseconds Lease-check interval; default one second.
   */
  public constructor(registry: InstallationRegistry, dataDirectory: string, version: string, checkpoints: RendererCheckpoint, closeWindow: () => void, monitorMilliseconds?: number);

  /**
   * Starting or ready registration; its identity is stable across start.
   */
  public get member(): InstallationMember;

  /**
   * Registers before opening the endpoint, then publishes readiness.
   * @throws Error when admission or endpoint startup fails.
   */
  public start(): Promise<void>;

  /**
   * Validates and handles desktop checkpoint/resume/close controls.
   * @param request Authenticated request.
   * @returns Correlated response; invalid or unavailable operations are failures.
   */
  public dispatch(request: Request): Promise<Response>;

  /**
   * Observes transport lifetime; preparation ownership follows the persistent lease.
   * @param count Current client count.
   */
  public onSessionCountChanged(count: number): void;

  /**
   * Closes only after the matching close response has been flushed.
   * @param request Completed request.
   */
  public onResponseSent(request: Request): void;

  /**
   * Releases a matching renderer freeze.
   * @param id Update operation id.
   */
  public resume(id: string): void;

  /**
   * Closes the endpoint, timer and registration.
   */
  public dispose(): Promise<void>;
}

/**
 * Holds installation admission, saves every desktop, stops idle runtimes, creates backups and closes other desktops before handoff.
 * A failed attempt resumes surviving peers and reopens desktops already closed. No installer is invoked without all acknowledgements.
 */
export declare class RestartCoordinator implements IUpdateRestart {
  /**
   * Creates a coordinator; no gate is acquired yet.
   * @param registry Installation control registry.
   * @param owner This desktop's registration identity.
   * @param processes Process lifetime operations.
   * @param permitQuit Allows or cancels the installer's subsequent app quit.
   * @param backup Makes a verified data backup after runtime shutdown.
   * @param timings Optional control deadlines; defaults to RuntimeTimings.createDefault().
   */
  public constructor(registry: InstallationRegistry, owner: InstallationMember, processes: IRestartProcesses, permitQuit: (value: boolean) => void, backup: (dataDirectory: string, operationId: string) => Promise<void>, timings?: RuntimeTimings);

  /**
   * Coordinates a single explicit restart attempt.
   * @param version Verified target version.
   * @param install Installer handoff callback.
   * @throws Error when a participant is busy, cannot save/close, the lease is lost, or recovery fails.
   */
  public install(version: string, install: () => Promise<void>): Promise<void>;
}

/**
 * Main-process workspace checkpoint. Owns acknowledgement correlation and timeout, independently of the runtime connection.
 */
export declare class RendererCheckpoint {
  /**
   * Creates a checkpoint owner.
   * @param host Window transport.
   * @param milliseconds Checkpoint timeout, default 15 seconds.
   */
  public constructor(host: IBridgeHost, milliseconds?: number);

  /**
   * Whether every captured window acknowledged persistence.
   */
  public get isPrepared(): boolean;

  /**
   * Whether editing is frozen during a preparation.
   */
  public get isFrozen(): boolean;

  /**
   * Freezes all live windows and waits for each one. A repeated matching id shares the operation.
   * @param id Unique operation id.
   * @returns True only after every window acknowledges; false for busy, absent, timed-out or failed windows.
   */
  public prepare(id: string): Promise<boolean>;

  /**
   * Freezes all live windows and waits for each one before TeamRun closes. A repeated matching id shares the operation.
   * @param id Unique operation id.
   * @returns True after every window acknowledges, and when no window can answer: none is open, or one does not answer before the timeout.
   * False when a window reports a failed save or another checkpoint is active.
   */
  public prepareToClose(id: string): Promise<boolean>;

  /**
   * Accepts each window acknowledgement once.
   * @param windowId Native web-contents id.
   * @param result Validated correlated result.
   * @returns Whether it matched a pending window and operation.
   */
  public acknowledge(windowId: number, result: UpdateCheckpointResult): boolean;

  /**
   * Unfreezes windows and clears a matching checkpoint.
   * @param id Operation id; unrelated ids do nothing.
   */
  public resume(id: string): void;

  /**
   * Releases timers and any active preparation.
   */
  public dispose(): void;
}

/**
 * One target's update information from a release: the single file the updater downloads, with its integrity data.
 */
export declare class ReleaseUpdateInfo {
  /**
   * Product version the update installs.
   */
  public readonly version: string;
  /**
   * Absolute download address of the update file.
   */
  public readonly url: string;
  /**
   * Base64 SHA-512 digest the updater verifies after downloading.
   */
  public readonly sha512: string;
  /**
   * Positive size of the update file in bytes.
   */
  public readonly size: number;
  /**
   * ISO 8601 date of the release revision.
   */
  public readonly releaseDate: string;

  private constructor();

  /**
   * Reads a latest-<platform>-<arch>.yml file published by the release workflow.
   * @param text JSON text downloaded from the update feed; untrusted.
   * @returns The validated update information.
   * @throws Error when the text is not JSON, a field is missing or invalid, the size is not a positive integer, or the file lists
   * other than exactly one update file.
   */
  public static parse(text: string): ReleaseUpdateInfo;
}

/**
 * Read-only build/feed selection. Development and builds without a feed stay disabled.
 */
export declare class UpdateSettings {
  /**
   * Whether an explicit Restart to update action is allowed after download and coordinated preparation.
   * Enabled for packaged Windows x64 and Linux x64 AppImage public releases; local feeds require TEAMRUN_UPDATE_TEST_INSTALL=1.
   */
  public readonly allowInstallation: boolean;
  /**
   * Public release feed for Windows x64 and Linux x64 AppImages, a loopback feed folder, or null when disabled.
   */
  public readonly feedUrl: string | null;
  /**
   * Safe explanation for a development build or an invalid test feed; null when enabled or when a packaged target has no in-app
   * update delivery.
   */
  public readonly disabledReason: string | null;
  /**
   * Whether a local loopback test feed was explicitly selected.
   */
  public readonly isTestFeed: boolean;

  private constructor();

  /**
   * Selects the fixed public release feed for packaged Windows x64 and Linux x64 AppImages, or validates an explicit local test override.
   * @param environment TEAMRUN_UPDATE_TEST_FEED optionally supplies an HTTP loopback base URL without credentials, query or fragment.
   * On Linux, APPIMAGE must name the running AppImage; other Linux builds cannot update themselves.
   * @param isPackaged Whether Electron is running a packaged app.
   * @param platform Node platform; Windows and Linux AppImages can install updates, other platforms cannot yet.
   * @param architecture Node CPU architecture; public releases support x64, local test overrides also accept arm64.
   * @returns Validated settings. Development builds and invalid test feeds are disabled with an explanation; other packaged
   * targets without in-app delivery are disabled without one.
   */
  public static fromEnvironment(environment: NodeJS.ProcessEnv, isPackaged: boolean, platform: string, architecture: string): UpdateSettings;
}

/**
 * Updater-library boundary. Installation is invoked only after the restart coordinator completes preparation.
 */
export interface IUpdateBackend {
  /**
   * Starts the verified installer and quits after coordinated preparation.
   * @throws Error when installation is disabled or the installer cannot start.
   */
  install(): Promise<void>;

  /**
   * Checks the configured OS/CPU feed and retains a candidate for download.
   * @returns Newer eligible version, or null.
   * @throws Error when the check fails.
   */
  check(): Promise<string | null>;

  /**
   * Downloads the retained candidate and verifies its digest before resolving.
   * @param progress Receives percentages during this operation only.
   * @throws Error when download or verification fails, including cancellation.
   */
  download(progress: (percent: number) => void): Promise<void>;

  /**
   * Cancels downloads and prevents future operations; may be repeated.
   */
  dispose(): void;
}

/**
 * Serializes checks/downloads, publishes state and owns desktop polling. No automatic download or installation.
 */
export declare class UpdateService {
  /**
   * Creates an idle or disabled service without starting timers or network activity.
   * @param settings Validated build/feed settings.
   * @param version Nonblank installed product version.
   * @param backend Library adapter; owned and disposed by this service.
   * @param publish Receives changed snapshots synchronously; must not throw.
   * @throws ArgumentException when version is blank.
   */
  public constructor(settings: UpdateSettings, version: string, backend: IUpdateBackend, publish: (state: AppUpdateState) => void, restart?: IUpdateRestart | null);

  /**
   * Latest immutable snapshot.
   */
  public get state(): AppUpdateState;

  /**
   * Starts one startup check and periodic checks; disabled/disposed/repeated starts do nothing.
   * @param startupMilliseconds Delay before first check; defaults to 15 seconds.
   * @param intervalMilliseconds Check interval; defaults to six hours. Positive milliseconds for both arguments.
   */
  public start(startupMilliseconds?: number, intervalMilliseconds?: number): void;

  /**
   * Runs or joins an operation; Status never waits. Backend failures become safe Error snapshots.
   * @param command Requested operation. Download without a candidate is ignored.
   * @returns Latest state after the operation, or the immediate snapshot for Status/disabled/disposed/downloaded states.
   */
  public execute(command: AppUpdateCommand): Promise<AppUpdateState>;

  /**
   * Stops timers, cancels downloads and ignores late completions. Safe to repeat.
   */
  public dispose(): void;
}

/**
 * What the preload bridge asks the main process to do, keyed by the IPC channel that carries it.
 * The Electron host translates IPC events into these calls; tests call them directly.
 */
export interface IBridgeHandlers {
  /**
   * Accepts a restart checkpoint only from its trusted window.
   * @param sender Sender identity including native web-contents id.
   * @param result Untrusted checkpoint acknowledgement.
   * @returns Whether the acknowledgement matched an outstanding checkpoint.
   */
  checkpoint(sender: SenderInfo, result: unknown): Promise<boolean>;

  /**
   * Dispatches a desktop update command, independently of the runtime.
   * @param sender Who sent the IPC message.
   * @param command An AppUpdateCommand wire value; no URL or installation command is accepted.
   * @returns A snapshot, or null for an untrusted sender or unknown command.
   */
  update(sender: SenderInfo, command: unknown): Promise<JsonValue>;

  /**
   * Forwards a chat request to the runtime.
   * @param sender Who sent the IPC message.
   * @param request The request as sent by the renderer, not yet validated.
   * @returns The response as plain JSON, a failure when the sender is untrusted, the request is
   * malformed, or the runtime is unavailable.
   */
  invoke(sender: SenderInfo, request: unknown): Promise<JsonValue>;

  /**
   * Opens an `http:` or `https:` URL in the user's browser.
   * @param sender Who sent the IPC message.
   * @param url The URL as sent by the renderer, not yet validated.
   * @returns Whether the URL was opened.
   */
  openExternal(sender: SenderInfo, url: unknown): Promise<boolean>;

  /**
   * Shows the folder picker.
   * @param sender Who sent the IPC message.
   * @returns The chosen folder, or `null` when the sender is untrusted or the user cancelled.
   */
  pickDirectory(sender: SenderInfo): Promise<string | null>;

  /**
   * Describes the desktop process to the renderer.
   * @param sender Who sent the IPC message.
   * @returns The `DesktopInfo` JSON, or `null` when the sender is untrusted.
   */
  describe(sender: SenderInfo): Promise<JsonValue>;

  /**
   * Recolours the window controls overlay to match the renderer's theme.
   * @param sender Who sent the IPC message.
   * @param color The overlay background as `#rrggbb`, not yet validated.
   * @param symbolColor The overlay symbol colour as `#rrggbb`, not yet validated.
   * @returns Whether the colours were applied.
   */
  setTitleBar(sender: SenderInfo, color: unknown, symbolColor: unknown): Promise<boolean>;

  /**
   * Reads an image file from inside a project the runtime knows.
   * @param sender Who sent the IPC message.
   * @param path The absolute file path as sent by the renderer, not yet validated.
   * @returns The image as a `data:` URL, or `null` when the sender is untrusted, the path is not an
   * image inside a project, or the file is missing or larger than the cap.
   */
  readImage(sender: SenderInfo, path: unknown): Promise<string | null>;
}

/**
 * What the desktop tells the renderer about itself.
 */
export declare class DesktopInfo {
  /**
   * The data directory shared with the runtime and the CLI.
   */
  public readonly dataDirectory: string;
  /**
   * The product version.
   */
  public readonly productVersion: string;
  /**
   * The operating system platform (`process.platform`).
   */
  public readonly platform: string;

  /**
   * Initializes the info.
   * @param dataDirectory The data directory.
   * @param productVersion The product version.
   * @param platform The platform.
   * @throws ArgumentException when a value is blank.
   */
  public constructor(dataDirectory: string, productVersion: string, platform: string);

  /**
   * Renders the JSON the renderer reads.
   * @returns The object with `dataDirectory`, `productVersion`, and `platform`.
   */
  public toJson(): JsonObject;
}

/**
 * What the main process can do with Electron on behalf of the gateway. Implemented by the Electron
 * host in production and by doubles in tests.
 */
export interface IBridgeHost {
  /**
   * Lists current renderer identities used to correlate workspace checkpoints.
   * @returns Native web-contents ids of live windows.
   */
  windowIds(): readonly number[];

  /**
   * Sends a checkpoint request to one renderer.
   * @param windowId Native web-contents id.
   * @param channel Preload channel.
   * @param payload Validated JSON.
   */
  sendToWindow(windowId: number, channel: string, payload: JsonValue): void;

  /**
   * Routes the IPC channels to the handlers.
   * @param handlers The handlers.
   */
  attach(handlers: IBridgeHandlers): void;

  /**
   * Sends a payload to every open window.
   * @param channel The IPC channel.
   * @param payload The payload.
   */
  broadcast(channel: string, payload: JsonValue): void;

  /**
   * Opens a URL in the user's browser.
   * @param url An `http:` or `https:` URL, already validated.
   */
  openExternal(url: string): Promise<void>;

  /**
   * Shows the folder picker.
   * @returns The chosen folder, or `null` when the user cancelled.
   */
  pickDirectory(): Promise<string | null>;

  /**
   * Recolours the window controls overlay of every window.
   * @param color The overlay background as `#rrggbb`.
   * @param symbolColor The symbol colour as `#rrggbb`.
   */
  setTitleBar(color: string, symbolColor: string): void;
}

/**
 * Receives the runtime's events for delivery to the renderer.
 */
export interface IEventForwarder {
  /**
   * Forwards one event.
   * @param event The event.
   */
  forward(event: Event): void;
}

/**
 * Attaches to the runtime: the runtime launcher in production, a double in tests.
 */
export interface IRuntimeAttacher {
  /**
   * Connects to the runtime, starting it when needed.
   * @param clientName The client name.
   * @param listener Receives events and the disconnection.
   * @returns The connected client.
   */
  attach(clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient>;
}

/**
 * What the desktop process needs to know: where data lives, which renderer to load, and whether
 * to capture a screenshot for evidence.
 */
export declare class DesktopSettings {
  /**
   * The absolute data directory shared with the runtime and the CLI.
   */
  public readonly dataDirectory: string;
  /**
   * The product version, reported to the runtime.
   */
  public readonly productVersion: string;
  /**
   * The absolute path of the built renderer's `index.html`.
   */
  public readonly rendererIndexPath: string;
  /**
   * The absolute default icon path (`assets/icons/icon-dark-512.png` in development). For the standard
   * `icon-dark-512.png` name, the window selects the matching system-theme variant beside it,
   * or the Dock tile on macOS. A custom filename is used
   * unchanged; the default remains the fallback if its variant is missing.
   */
  public readonly iconPath: string;
  /**
   * The development server URL to load instead of the built renderer, or `null`.
   */
  public readonly rendererUrl: string | null;
  /**
   * Where to write a screenshot of the first window after it loads, or `null` for a normal run.
   */
  public readonly screenshotPath: string | null;
  /**
   * How long to wait after the page loads before capturing the screenshot.
   */
  public readonly screenshotDelayMilliseconds: number;
  /**
   * The view the renderer opens on, passed as the URL hash (`settings`), or `null` for the chat.
   */
  public readonly startView: string | null;

  /**
   * Initializes the settings.
   * @param dataDirectory The absolute data directory.
   * @param productVersion The product version.
   * @param rendererIndexPath The renderer's `index.html`.
   * @param iconPath The default window icon; the standard `icon-dark-512.png` name enables adjacent theme variants.
   * @param rendererUrl The development server URL, or `null`.
   * @param screenshotPath The screenshot path, or `null`.
   * @param screenshotDelayMilliseconds The screenshot delay.
   * @param startView The start view, or `null`.
   * @throws ArgumentException when the data directory is blank or relative, or the version, the
   * index path, or the icon path is blank.
   * @throws ArgumentOutOfRangeException when the delay is not a positive integer.
   */
  public constructor(dataDirectory: string, productVersion: string, rendererIndexPath: string, iconPath: string, rendererUrl: string | null, screenshotPath: string | null, screenshotDelayMilliseconds: number, startView?: string | null);

  /**
   * Reads the settings from the environment: `TEAMRUN_DATA_DIR` (default `~/.noldova/teamrun`, the CLI's default, so both
   * clients attach to the same runtime),
   * `TEAMRUN_RENDERER_INDEX` (default the repository's `_build/renderer/browser/index.html`),
   * `TEAMRUN_RENDERER_URL`, `TEAMRUN_SCREENSHOT`, `TEAMRUN_SCREENSHOT_DELAY_MS`, and `TEAMRUN_START_VIEW`.
   * @param environment The process environment.
   * @param homeDirectory The user's home directory.
   * @param moduleDirectory The directory of the desktop package's main module.
   * @param productVersion The product version.
   * @param resourcesDirectory The physical packaged resource directory for native icons; omitted in development,
   * where icons are resolved from the repository root. Renderer paths still follow the desktop module, including ASAR.
   * @returns The settings.
   */
  public static fromEnvironment(environment: NodeJS.ProcessEnv, homeDirectory: string, moduleDirectory: string, productVersion: string, resourcesDirectory?: string): DesktopSettings;

  /**
   * Whether a development server URL replaces the built renderer.
   */
  public get usesDevelopmentServer(): boolean;

  /**
   * The origin trusted senders must come from: the `file:` URL of the index, or the development
   * server's origin.
   */
  public get rendererOrigin(): string;

  /**
   * The content security policy for the renderer: strict for the built renderer, relaxed for the
   * development server's live reload.
   */
  public get contentSecurityPolicy(): string;
}

/**
 * Where the window was and how big, and whether it was maximized; the position is `null` for a window
 * the system placed. The size never goes under the minimum the window allows.
 */
export declare class WindowState {
  /**
   * The left edge, or `null`.
   */
  public readonly x: number | null;
  /**
   * The top edge, or `null`.
   */
  public readonly y: number | null;
  /**
   * The width, at least `Resources.windowMinimumWidth`.
   */
  public readonly width: number;
  /**
   * The height, at least `Resources.windowMinimumHeight`.
   */
  public readonly height: number;
  /**
   * Whether the window was maximized.
   */
  public readonly maximized: boolean;

  /**
   * Initializes the state; sizes are rounded and raised to the minimum.
   * @param x The left edge, or `null`.
   * @param y The top edge, or `null`.
   * @param width The width.
   * @param height The height.
   * @param maximized Whether the window was maximized.
   */
  public constructor(x: number | null, y: number | null, width: number, height: number, maximized: boolean);

  /**
   * The default: no position, `Resources.windowWidth` by `Resources.windowHeight`, not maximized.
   * @returns The default state.
   */
  public static createDefault(): WindowState;

  /**
   * Reads the state leniently: anything that is not an object gives the default, a malformed field its default, and
   * a position needs both coordinates.
   * @param value The untrusted value.
   * @returns The state.
   */
  public static fromJson(value: unknown): WindowState;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `x`, `y`, `width`, `height`, `maximized`.
   */
  public toJson(): JsonObject;
}

/**
 * Who sent an IPC message: the frame's URL and whether it is the window's top-level frame.
 */
export declare class SenderInfo {
  /**
   * Native web-contents id, or zero outside an Electron sender.
   */
  public readonly windowId: number;
  /**
   * The sender frame's URL.
   */
  public readonly frameUrl: string;
  /**
   * Whether the frame is the window's top-level frame.
   */
  public readonly isTopLevel: boolean;

  /**
   * Initializes the sender.
   * @param frameUrl The frame URL.
   * @param isTopLevel Whether the frame is top-level.
   */
  public constructor(frameUrl: string, isTopLevel: boolean, windowId?: number);
}

/**
 * The desktop package's literals.
 */
export declare class Resources {
  /**
   * CPU architecture for the published release channel.
   */
  public static readonly publicUpdateArchitecture: string;
  /**
   * Fixed anonymous HTTPS feed for the repository's latest public release.
   */
  public static readonly publicUpdateFeed: string;
  /**
   * app image variable used by update preparation and recovery.
   */
  public static readonly appImageVariable: string;
  /**
   * update test install variable used by update preparation and recovery.
   */
  public static readonly updateTestInstallVariable: string;
  /**
   * update installer failed used by update preparation and recovery.
   */
  public static readonly updateInstallerFailed: string;
  /**
   * update install ready used by update preparation and recovery.
   */
  public static readonly updateInstallReady: string;
  /**
   * update preparing used by update preparation and recovery.
   */
  public static readonly updatePreparing: string;
  /**
   * update rejected promise used by update preparation and recovery.
   */
  public static readonly updateRejectedPromise: string;
  /**
   * update exit milliseconds used by update preparation and recovery.
   */
  public static readonly updateExitMilliseconds: number;
  /**
   * update exit poll milliseconds used by update preparation and recovery.
   */
  public static readonly updateExitPollMilliseconds: number;
  /**
   * update ignored stdio used by update preparation and recovery.
   */
  public static readonly updateIgnoredStdio: "ignore";
  /**
   * update spawn event used by update preparation and recovery.
   */
  public static readonly updateSpawnEvent: "spawn";
  /**
   * update error event used by update preparation and recovery.
   */
  public static readonly updateErrorEvent: "error";
  /**
   * Updater event reporting the new path when an AppImage update is saved under a different file name.
   */
  public static readonly appImageRenamedEvent: "appimage-filename-updated";
  /**
   * Shell that restarts an updated AppImage from outside the old version's mount.
   */
  public static readonly appImageRestartShell: string;
  /**
   * Shell option that runs {@link Resources.appImageRestartScript}.
   */
  public static readonly appImageRestartShellOption: string;
  /**
   * Process name the restart shell reports while it waits.
   */
  public static readonly appImageRestartName: string;
  /**
   * Number of 0.1-second checks the restart waits for the old process to exit before starting the new version anyway.
   */
  public static readonly appImageRestartPolls: number;
  /**
   * Restart script: closes descriptors above standard error, waits up to `$3` checks for process `$2` to exit, then replaces
   * itself with the AppImage `$1`. Arguments are passed as positional parameters, never inserted into the script.
   */
  public static readonly appImageRestartScript: string;
  /**
   * update client name used by update preparation and recovery.
   */
  public static readonly updateClientName: string;
  /**
   * update preparation lease milliseconds used by update preparation and recovery.
   */
  public static readonly updatePreparationLeaseMilliseconds: number;
  /**
   * update renew milliseconds used by update preparation and recovery.
   */
  public static readonly updateRenewMilliseconds: number;
  /**
   * update process still running used by update preparation and recovery.
   */
  public static readonly updateProcessStillRunning: string;
  /**
   * update active work used by update preparation and recovery.
   */
  public static readonly updateActiveWork: string;
  /**
   * update shutdown not confirmed used by update preparation and recovery.
   */
  public static readonly updateShutdownNotConfirmed: string;
  /**
   * update close not confirmed used by update preparation and recovery.
   */
  public static readonly updateCloseNotConfirmed: string;
  /**
   * update recovery failed used by update preparation and recovery.
   */
  public static readonly updateRecoveryFailed: string;
  /**
   * update unknown runtime used by update preparation and recovery.
   */
  public static readonly updateUnknownRuntime: string;
  /**
   * update peer monitor milliseconds used by update preparation and recovery.
   */
  public static readonly updatePeerMonitorMilliseconds: number;
  /**
   * update peer socket name used by update preparation and recovery.
   */
  public static readonly updatePeerSocketName: string;
  /**
   * update preparation expired used by update preparation and recovery.
   */
  public static readonly updatePreparationExpired: string;
  /**
   * update workspace not ready used by update preparation and recovery.
   */
  public static readonly updateWorkspaceNotReady: string;
  /**
   * update control unknown used by update preparation and recovery.
   */
  public static readonly updateControlUnknown: string;
  /**
   * checkpoint event channel used by update preparation and recovery.
   */
  public static readonly checkpointEventChannel: string;
  /**
   * checkpoint ack channel used by update preparation and recovery.
   */
  public static readonly checkpointAckChannel: string;
  /**
   * checkpoint timeout milliseconds used by update preparation and recovery.
   */
  public static readonly checkpointTimeoutMilliseconds: number;
  /**
   * checkpoint busy used by update preparation and recovery.
   */
  public static readonly checkpointBusy: string;
  /**
   * app user model id used by update preparation and recovery.
   */
  public static readonly appUserModelId: string;
  /**
   * app icon index used by update preparation and recovery.
   */
  public static readonly appIconIndex: number;
  /**
   * user data path name used by update preparation and recovery.
   */
  public static readonly userDataPathName: "userData";
  /**
   * electron directory name used by update preparation and recovery.
   */
  public static readonly electronDirectoryName: string;
  /**
   * second instance event used by update preparation and recovery.
   */
  public static readonly secondInstanceEvent: "second-instance";
  /**
   * main script argument index used by update preparation and recovery.
   */
  public static readonly mainScriptArgumentIndex: number;
  /**
   * did fail load event used by update preparation and recovery.
   */
  public static readonly didFailLoadEvent: "did-fail-load";
  /**
   * console message event used by update preparation and recovery.
   */
  public static readonly consoleMessageEvent: "console-message";
  /**
   * preload error event used by update preparation and recovery.
   */
  public static readonly preloadErrorEvent: "preload-error";
  /**
   * render process gone event used by update preparation and recovery.
   */
  public static readonly renderProcessGoneEvent: "render-process-gone";
  /**
   * dev tools protocol version used by update preparation and recovery.
   */
  public static readonly devToolsProtocolVersion: string;
  /**
   * capture screenshot command used by update preparation and recovery.
   */
  public static readonly captureScreenshotCommand: string;
  /**
   * screenshot format used by update preparation and recovery.
   */
  public static readonly screenshotFormat: string;
  /**
   * screenshot data property used by update preparation and recovery.
   */
  public static readonly screenshotDataProperty: "data";
  /**
   * base64 encoding used by update preparation and recovery.
   */
  public static readonly base64Encoding: "base64";
  /**
   * screenshot result unreadable used by update preparation and recovery.
   */
  public static readonly screenshotResultUnreadable: string;
  /**
   * Request channel for the local desktop updater.
   */
  public static readonly updateChannel: string;
  /**
   * Broadcast channel for update snapshots.
   */
  public static readonly updateEventChannel: string;
  /**
   * Explicit local-feed opt-in environment variable.
   */
  public static readonly updateTestFeedVariable: string;
  /**
   * Supported local-test CPU names.
   */
  public static readonly updateArchitectures: readonly string[];
  /**
   * Loopback hosts accepted for local testing.
   */
  public static readonly updateLoopbackHosts: readonly string[];
  /**
   * Removes trailing slashes before appending the target.
   */
  public static readonly updateTrailingSlashes: RegExp;
  /**
   * Identifies a prerelease separator before SemVer build metadata.
   */
  public static readonly updatePrereleasePattern: RegExp;
  /**
   * Startup check delay in milliseconds.
   */
  public static readonly updateStartupMilliseconds: number;
  /**
   * Periodic check interval in milliseconds.
   */
  public static readonly updateIntervalMilliseconds: number;
  /**
   * Maximum download percentage.
   */
  public static readonly fullUpdateProgress: number;
  /**
   * Per-data-directory local feed configuration filename.
   */
  public static readonly updateConfigFileName: string;
  /**
   * Prefix of isolated test download caches.
   */
  public static readonly updateCachePrefix: string;
  /**
   * Algorithm for the test cache directory identity.
   */
  public static readonly updateHashAlgorithm: string;
  /**
   * Digest encoding for the test cache directory identity.
   */
  public static readonly updateHashEncoding: "hex";
  /**
   * Provider name that makes electron-updater read update information through TeamRun's release update source.
   */
  public static readonly customUpdateProvider: "custom";
  /**
   * Keys of the update feed address and release target in the custom provider options.
   */
  public static readonly releaseFeedUrlKey: string;
  public static readonly releaseFeedTargetKey: string;
  /**
   * Error for unreadable, malformed or multi-file update information.
   */
  public static readonly updateInfoInvalid: string;
  /**
   * Update-information field names, as written by the release publisher.
   */
  public static readonly updateVersionField: string;
  public static readonly updateFilesField: string;
  public static readonly updateUrlField: string;
  public static readonly updateSha512Field: string;
  public static readonly updateSizeField: string;
  public static readonly updateReleaseDateField: string;
  /**
   * Library progress event name.
   */
  public static readonly updateProgressEvent: "download-progress";
  /**
   * Explanation for source builds.
   */
  public static readonly updatesDevelopmentDisabled: string;
  /**
   * Explanation for builds without a feed.
   */
  public static readonly updatesFeedMissing: string;
  /**
   * Invalid local feed explanation.
   */
  public static readonly updatesFeedInvalid: string;
  /**
   * Sanitized check failure.
   */
  public static readonly updateCheckFailed: string;
  /**
   * Sanitized download or integrity failure.
   */
  public static readonly updateDownloadFailed: string;
  /**
   * Downloaded state explains that installation remains disabled.
   */
  public static readonly updateInstallDeferred: string;
  /**
   * Durable composer attachment directory.
   */
  public static readonly attachmentsDirectoryName: string;
  /**
   * The read-only mode used to open an authorized image.
   */
  public static readonly imageReadMode: string;
  /**
   * Explains a call after the desktop connection was closed.
   */
  public static readonly connectionClosed: string;
  public static readonly productVersion: string;
  public static readonly applicationName: string;
  public static readonly clientName: string;
  public static readonly invokeChannel: string;
  public static readonly eventChannel: string;
  public static readonly openExternalChannel: string;
  public static readonly pickDirectoryChannel: string;
  public static readonly infoChannel: string;
  public static readonly titleBarChannel: string;
  public static readonly imageChannel: string;
  public static readonly imageMediaTypes: Readonly<Record<string, string>>;
  public static readonly maximumImageBytes: number;
  public static readonly dataUrlPrefix: string;
  public static readonly base64DataUrlSeparator: string;
  public static readonly rootPathField: string;
  public static readonly projectListRequestId: string;
  public static readonly parentDirectory: string;
  /**
   * The directory under the data directory where the runtime stores generated images.
   */
  public static readonly imagesDirectoryName: string;
  public static readonly titleBarHeight: number;
  public static readonly titleBarColor: string;
  public static readonly titleBarSymbolColor: string;
  public static readonly hiddenTitleBarStyle: "hidden";
  /**
   * macOS: where the traffic lights sit, level with the window controls in the 36-pixel row the renderer keeps clear.
   */
  public static readonly trafficLightPosition: Readonly<{
    x: number;
    y: number;
  }>;
  public static readonly colorPattern: RegExp;
  public static readonly dataDirectoryVariable: string;
  public static readonly rendererUrlVariable: string;
  public static readonly rendererIndexVariable: string;
  public static readonly screenshotVariable: string;
  public static readonly screenshotDelayVariable: string;
  public static readonly startViewVariable: string;
  public static readonly runAsNodeVariable: string;
  public static readonly enabledValue: string;
  public static readonly dataDirectorySegments: readonly string[];
  public static readonly rendererIndexSegments: readonly string[];
  public static readonly defaultIconFileName: string;
  public static readonly iconSegments: readonly string[];
  /**
   * The 512px PNG for a light system surface.
   */
  public static readonly lightIconFileName: string;
  /**
   * The 512px PNG for a dark system surface.
   */
  public static readonly darkIconFileName: string;
  /**
   * The light-theme Windows ICO with multiple pixel sizes.
   */
  public static readonly lightWindowsIconFileName: string;
  /**
   * The dark-theme Windows ICO with multiple pixel sizes.
   */
  public static readonly darkWindowsIconFileName: string;
  /**
   * The 512px macOS Dock PNG with its own background, used in both system themes.
   */
  public static readonly dockIconFileName: string;
  public static readonly windowsPlatform: "win32";
  public static readonly macPlatform: "darwin";
  public static readonly linuxPlatform: "linux";
  /**
   * The platform segment used for Windows in release file names.
   */
  public static readonly windowsTargetName: string;
  /**
   * The platform segment used for macOS in release file names.
   */
  public static readonly macTargetName: string;
  public static readonly themeUpdatedEvent: "updated";
  public static readonly closedEvent: "closed";
  public static readonly repositoryRootSegments: readonly string[];
  public static readonly preloadFileName: string;
  public static readonly homePathName: "home";
  public static readonly defaultScreenshotDelay: number;
  public static readonly idleGrace: number;
  public static readonly windowWidth: number;
  public static readonly windowHeight: number;
  public static readonly windowMinimumWidth: number;
  public static readonly windowMinimumHeight: number;
  public static readonly windowBackground: string;
  /**
   * The file in the data directory that keeps the window's state: `window.json`.
   */
  public static readonly windowStateFileName: string;
  /**
   * How long after a resize or move the state is saved: 300 ms.
   */
  public static readonly windowStateSaveDelay: number;
  public static readonly utf8Encoding: BufferEncoding;
  public static readonly xField: string;
  public static readonly yField: string;
  public static readonly widthField: string;
  public static readonly heightField: string;
  public static readonly maximizedField: string;
  public static readonly resizeEvent: "resize";
  public static readonly moveEvent: "move";
  public static readonly maximizeEvent: "maximize";
  public static readonly unmaximizeEvent: "unmaximize";
  public static readonly closeEvent: "close";
  public static readonly hashPrefix: string;
  public static readonly queryPrefix: string;
  public static readonly httpProtocol: string;
  public static readonly httpsProtocol: string;
  public static readonly contentSecurityPolicyHeader: string;
  public static readonly productionContentSecurityPolicy: string;
  public static readonly developmentContentSecurityPolicy: string;
  public static readonly denyWindowOpen: "deny";
  public static readonly directoryDialogTitle: string;
  public static readonly openDirectoryProperty: "openDirectory";
  public static readonly activateEvent: "activate";
  public static readonly windowAllClosedEvent: "window-all-closed";
  public static readonly beforeQuitEvent: "before-quit";
  public static readonly willNavigateEvent: "will-navigate";
  public static readonly didFinishLoadEvent: "did-finish-load";
  public static readonly rendererMissingPage: string;
  public static readonly untrustedSender: string;
  /**
   * Electron permission for writing clipboard content; clipboard reads remain denied.
   */
  public static readonly clipboardWritePermission: string;
  public static readonly runtimeUnavailable: string;
  public static readonly dataDirectoryParameterName: string;
  public static readonly productVersionParameterName: string;
  public static readonly rendererIndexParameterName: string;
  public static readonly iconParameterName: string;
  public static readonly platformParameterName: string;
  public static readonly dataDirectoryField: string;
  public static readonly productVersionField: string;
  public static readonly platformField: string;
  public static readonly screenshotDelayParameterName: string;
  public static readonly clientNameParameterName: string;

  /**
   * Names a release target as it appears in release file names.
   * @param platform Node platform: win32, darwin or linux.
   * @param architecture Node CPU architecture, x64 or arm64.
   * @returns The target, such as windows-x64, mac-arm64 or linux-x64.
   */
  public static formatUpdateTarget(platform: string, architecture: string): string;

  /**
   * Names the update information a release publishes for one target.
   * @param target Target from {@link Resources.formatUpdateTarget}.
   * @returns The file name, such as latest-windows-x64.yml.
   */
  public static formatUpdateInfoName(target: string): string;

  /**
   * Builds the shell arguments that restart an updated AppImage after the current process exits.
   * @param appImage Path of the installed AppImage to start.
   * @param processId Process that must exit before the AppImage starts.
   * @param polls Number of 0.1-second checks before starting the AppImage anyway.
   * @returns The arguments for {@link Resources.appImageRestartShell}.
   */
  public static formatAppImageRestartArguments(appImage: string, processId: number, polls: number): readonly string[];

  /**
   * Formats the message of a failed runtime call.
   * @param message What went wrong.
   * @returns The message.
   */
  public static formatRuntimeFailure(message: string): string;

  /**
   * Formats the notice printed after a screenshot is written.
   * @param path The screenshot path.
   * @returns The notice.
   */
  public static formatScreenshotWritten(path: string): string;
}

/**
 * The main-process side of the preload bridge: checks the sender, validates the request, forwards
 * it to the runtime, and turns runtime events into broadcasts. Never throws to the renderer: every
 * outcome is a response.
 */
export declare class BridgeGateway implements IBridgeHandlers, IEventForwarder {
  /**
   * Initializes the gateway.
   * @param policy Decides which senders are trusted.
   * @param connection The runtime connection.
   * @param host The Electron host.
   * @param info What the desktop tells the renderer about itself.
   * @param updates The desktop-owned update service.
   */
  public constructor(policy: SenderPolicy, connection: RuntimeConnection, host: IBridgeHost, info: DesktopInfo, updates: UpdateService, checkpoints?: RendererCheckpoint);

  /**
   * Correlates a trusted renderer's acknowledgement.
   * @param sender Native sender identity.
   * @param result Untrusted wire value.
   * @returns Whether it matched an outstanding request; false for malformed or untrusted input.
   */
  public checkpoint(sender: SenderInfo, result: unknown): Promise<boolean>;

  /**
   * Checks sender and command before allowing a local update operation.
   * @param sender Who sent the IPC message.
   * @param command AppUpdateCommand wire value.
   * @returns The snapshot, or null for a refused request.
   */
  public update(sender: SenderInfo, command: unknown): Promise<JsonValue>;

  /**
   * Forwards a chat request to the runtime. An untrusted sender gets an `unauthorized` failure,
   * a malformed request an `invalidParams` failure, an unreachable runtime an `unavailable`
   * failure carrying the request id.
   * @param sender Who sent the IPC message.
   * @param request The request as sent by the renderer.
   * @returns The response as plain JSON.
   */
  public invoke(sender: SenderInfo, request: unknown): Promise<JsonValue>;

  /**
   * Opens an `http:` or `https:` URL in the user's browser; anything else is refused.
   * @param sender Who sent the IPC message.
   * @param url The URL as sent by the renderer.
   * @returns Whether the URL was opened.
   */
  public openExternal(sender: SenderInfo, url: unknown): Promise<boolean>;

  /**
   * Shows the folder picker for a trusted sender.
   * @param sender Who sent the IPC message.
   * @returns The chosen folder, or `null`.
   */
  public pickDirectory(sender: SenderInfo): Promise<string | null>;

  /**
   * Describes the desktop to a trusted sender.
   * @param sender Who sent the IPC message.
   * @returns The `DesktopInfo` JSON, or `null`.
   */
  public describe(sender: SenderInfo): Promise<JsonValue>;

  /**
   * Recolours the window controls overlay for a trusted sender; both colours must be `#rrggbb`.
   * @param sender Who sent the IPC message.
   * @param color The overlay background.
   * @param symbolColor The symbol colour.
   * @returns Whether the colours were applied.
   */
  public setTitleBar(sender: SenderInfo, color: unknown, symbolColor: unknown): Promise<boolean>;

  /**
   * Reads an image from inside a project the runtime lists, as a `data:` URL; refuses other paths,
   * other file types, and files over the size cap.
   * @param sender Who sent the IPC message.
   * @param path The absolute file path as sent by the renderer.
   * @returns The data URL, or `null`.
   */
  public readImage(sender: SenderInfo, path: unknown): Promise<string | null>;

  /**
   * Broadcasts a runtime event on the event channel.
   * @param event The event.
   */
  public forward(event: Event): void;
}

/**
 * The desktop's connection to the runtime: attaches on first use, reattaches after a
 * disconnection, and forwards the runtime's events.
 * A successful reconnection requests message resynchronization; ordinary catalog notices do not.
 */
export declare class RuntimeConnection implements IRuntimeClientListener {
  /**
   * Initializes the connection without attaching.
   * @param attacher Attaches to the runtime.
   * @param forwarder Receives the runtime's events.
   * @param clientName The client name presented to the runtime.
   * @throws ArgumentException when the client name is blank.
   */
  public constructor(attacher: IRuntimeAttacher, forwarder: IEventForwarder, clientName: string);

  /**
   * Whether a client is attached and connected.
   */
  public get isConnected(): boolean;

  /**
   * Sends a request, attaching first when needed. Concurrent first calls share one attachment.
   * @param request The request.
   * @returns The runtime's response.
   * @throws LaunchException when the runtime cannot be started.
   * @throws ConnectionException when closed, when the runtime cannot be reached, or when it does not answer in time.
   */
  public call(request: Request): Promise<Response>;

  /**
   * Forwards a runtime event.
   * @param event The event.
   */
  public onEvent(event: Event): void;

  /**
   * Drops the client so the next call reattaches.
   */
  public onDisconnected(): void;

  /**
   * Permanently closes this connection, including any attachment still in progress. Safe to repeat.
   */
  public close(): void;
}

/**
 * Decides whether an IPC sender is the application's own top-level page: the built renderer's
 * `file:` URL (with an optional hash or query), or any page of the development server.
 */
/**
 * Keeps the window's state in a JSON file (`window.json` in the data directory).
 */
export declare class WindowStateStore {
  /**
   * The file's path.
   */
  public readonly path: string;

  /**
   * Initializes the store over a file.
   * @param path The file's path; its directory is created on the first write.
   */
  public constructor(path: string);

  /**
   * Reads the state: the default when the file is missing or unreadable.
   * @returns The state.
   */
  public read(): WindowState;

  /**
   * Writes the state; a failure is swallowed (the window still works, its place is only not remembered).
   * @param state The state.
   */
  public write(state: WindowState): void;
}

/**
 * Attaches through another attacher, reporting elapsed time only when attachment fails.
 */
export declare class TimedAttacher implements IRuntimeAttacher {
  /**
   * Initializes the attacher.
   * @param attacher The attacher that does the work.
   * @param report Receives the elapsed time and error for each failed attempt; successful attempts are silent.
   */
  public constructor(attacher: IRuntimeAttacher, report: (line: string) => void);

  /**
   * Attaches silently on success; reports the elapsed time and rethrows on failure.
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @returns The connected client.
   */
  public attach(clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient>;
}

export declare class SenderPolicy {
  /**
   * Initializes the policy.
   * @param settings The settings naming the renderer.
   */
  public constructor(settings: DesktopSettings);

  /**
   * Whether the sender is trusted.
   * @param sender The sender.
   * @returns `true` for the application's own top-level page.
   */
  public isTrusted(sender: SenderInfo): boolean;

  /**
   * Allows clipboard writes only from the trusted top-level renderer.
   * @param sender The requesting frame.
   * @param permission Electron's permission name.
   * @returns Whether the request is an allowed clipboard write.
   */
  public allowsPermission(sender: SenderInfo, permission: string): boolean;
}
