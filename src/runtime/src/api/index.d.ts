/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Socket } from "node:net";

import type { IEventListener, IProjectsService, ProviderRegistry, RequestDispatcher } from "@noldova/teamrun-core";
import type { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import type { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import type {
  Event,
  IRequestDispatcher,
  ProtocolVersion,
  Request,
  Response,
  TerminalLine,
  TerminalLinePage,
  TerminalLineRange,
  TerminalScreen,
  TerminalSize,
  TerminalState,
  WireMessage
} from "@noldova/teamrun-protocol";
import type { CommandRunner, ExecutableLocator, IProcessTracker, ProcessCommand } from "@noldova/teamrun-providers";
import type { IBufferCell, IBufferLine } from "@xterm/headless";
import type { IPty } from "node-pty";

/**
 * Process roles participating in one installation's update.
 */
export declare enum InstallationRole {
  /**
   * A desktop owning renderer state.
   */
  Desktop = "Desktop",
  /**
   * A background runtime owning provider and database handles.
   */
  Runtime = "Runtime",
}

/**
 * Persistent admission barrier phase.
 */
export declare enum InstallationUpdatePhase {
  /**
   * Renewable preparation lease; abandoned leases expire.
   */
  Preparing = "Preparing",
  /**
   * Installer handoff; only the target-version desktop can reopen admission automatically.
   */
  Installing = "Installing",
}

/**
 * Registered process identity and its private local control endpoint. Never send tokens to a renderer or log them.
 */
export declare class InstallationMember {
  /**
   * Unique process registration id.
   */
  public readonly id: string;
  /**
   * Process responsibility.
   */
  public readonly role: InstallationRole;
  /**
   * Native process id.
   */
  public readonly processId: number;
  /**
   * Data directory owned or viewed by this process.
   */
  public readonly dataDirectory: string;
  /**
   * Process product version.
   */
  public readonly productVersion: string;
  /**
   * Ready control endpoint, or null while starting.
   */
  public readonly endpoint: Endpoint | null;
  /**
   * Local capability token, or null while starting.
   */
  public readonly token: string | null;

  /**
   * Creates a registration; null endpoint/token must be paired.
   * @param id Nonblank instance id.
   * @param role Desktop or runtime.
   * @param processId Positive native process id.
   * @param dataDirectory Nonblank data path.
   * @param productVersion Nonblank version.
   * @param endpoint Control endpoint, or null before listening.
   * @param token Nonblank capability token, or null before listening.
   * @throws ArgumentException for blank fields or inconsistent readiness.
   * @throws ArgumentOutOfRangeException for an invalid process id.
   */
  public constructor(id: string, role: InstallationRole, processId: number, dataDirectory: string, productVersion: string, endpoint: Endpoint | null, token: string | null);

  /**
   * Marks a starting registration ready without changing its identity.
   * @param endpoint Bound endpoint.
   * @param token Nonblank capability token.
   * @returns Ready registration.
   */
  public withEndpoint(endpoint: Endpoint, token: string): InstallationMember;

  /**
   * Validates a persisted registration.
   * @param value Untrusted JSON value.
   * @returns Validated identity.
   * @throws JsonException or ArgumentException for malformed fields.
   */
  public static fromJson(value: unknown): InstallationMember;

  /**
   * Serializes into private local storage only.
   * @returns JSON including the local capability; never log it.
   */
  public toJson(): JsonObject;
}

/**
 * One installation update owner, target version and lease.
 */
export declare class InstallationUpdate {
  /**
   * Unique operation id.
   */
  public readonly id: string;
  /**
   * Registered desktop owning the operation.
   */
  public readonly ownerId: string;
  /**
   * Version allowed to reopen admission after installation.
   */
  public readonly targetVersion: string;
  /**
   * Preparing or installing.
   */
  public readonly phase: InstallationUpdatePhase;
  /**
   * Preparation lease deadline in Unix milliseconds; installing barriers do not expire.
   */
  public readonly expiresAt: number;

  /**
   * Creates the update ownership record.
   * @param id Nonblank operation id.
   * @param ownerId Nonblank member id.
   * @param targetVersion Nonblank target product version.
   * @param phase Barrier phase.
   * @param expiresAt Positive Unix millisecond deadline.
   * @throws ArgumentException or ArgumentOutOfRangeException for invalid values.
   */
  public constructor(id: string, ownerId: string, targetVersion: string, phase: InstallationUpdatePhase, expiresAt: number);

  /**
   * Validates persisted ownership.
   * @param value Untrusted JSON.
   * @returns Validated record.
   * @throws JsonException or ArgumentException for invalid input.
   */
  public static fromJson(value: unknown): InstallationUpdate;

  /**
   * Serializes ownership.
   * @returns Plain JSON.
   */
  public toJson(): JsonObject;
}

/**
 * Uses short SQLite transactions to serialize process registration and installer admission across processes.
 * This control registry is separate from conversation data. Connections are closed after every operation.
 */
export declare class InstallationRegistry {
  /**
   * Absolute control database path.
   */
  public readonly path: string;

  /**
   * Creates the control-store owner without opening the database.
   * @param path Nonblank registry path.
   * @param probe Optional process-liveness observer; defaults to native probing.
   * @throws ArgumentException for a blank path.
   */
  public constructor(path: string, probe?: ProcessProbe);

  /**
   * Resolves a packaged entry's installation by canonical executable path; source entries have no installation.
   * @param entryPath Entry within an app.asar, or a development path.
   * @param executable Executable whose path identifies the installation.
   * @param homeDirectory Current user's home directory.
   * @returns Registry, or null for a source entry.
   * @throws Error if a packaged executable cannot be resolved.
   */
  public static forEntry(entryPath: string, executable: string, homeDirectory: string): InstallationRegistry | null;

  /**
   * Reads a data directory's installation id without accepting arbitrary registry paths.
   * @param dataDirectory Data directory to inspect.
   * @param homeDirectory Current user's home directory.
   * @returns Linked registry, or null if no link exists.
   * @throws InvalidOperationException for an invalid id; filesystem errors are propagated.
   */
  public static forDataDirectory(dataDirectory: string, homeDirectory: string): InstallationRegistry | null;

  /**
   * Links a data directory after its runtime has acquired ownership.
   * @param dataDirectory Owned data directory.
   * @throws InvalidOperationException if the registry's parent is not a valid hashed installation id.
   */
  public linkDataDirectory(dataDirectory: string): void;

  /**
   * Atomically registers a process unless update admission is closed. A target-version desktop completes an installing barrier.
   * @param member New process identity.
   * @throws InvalidOperationException while an update blocks this version/role.
   */
  public register(member: InstallationMember): void;

  /**
   * Publishes the endpoint of an already registered starting process.
   * @param member Ready identity with the original id.
   * @throws InvalidOperationException if that registration disappeared.
   */
  public activate(member: InstallationMember): void;

  /**
   * Removes a departing process registration.
   * @param id Registration id.
   */
  public unregister(id: string): void;

  /**
   * Refuses startup while a live preparation or installing barrier exists.
   * @throws InvalidOperationException while admission is closed.
   */
  public assertLaunchAllowed(): void;

  /**
   * Acquires preparation ownership and snapshots all live, ready participants atomically with respect to registration.
   * @param update New preparation lease owned by a registered desktop.
   * @returns Live participants; dead registrations are removed.
   * @throws InvalidOperationException for an existing update, missing owner or starting participant.
   */
  public begin(update: InstallationUpdate): readonly InstallationMember[];

  /**
   * Renews preparation before its deadline.
   * @param update Replacement record with the same operation id.
   * @throws InvalidOperationException if ownership expired or installation began.
   */
  public renew(update: InstallationUpdate): void;

  /**
   * Makes the gate persistent across updater process exit.
   * @param id Current operation id.
   * @throws InvalidOperationException if the preparation lease was lost.
   */
  public markInstalling(id: string): void;

  /**
   * Releases only the named operation after a failed attempt.
   * @param id Owned operation id.
   */
  public release(id: string): void;

  /**
   * Checks that preparation still owns the live lease.
   * @param id Operation id.
   * @returns Whether the matching preparation remains active.
   */
  public isPreparing(id: string): boolean;

  /**
   * Checks a live preparing or installing owner.
   * @param id Operation id.
   * @returns Whether the same operation owns admission.
   */
  public ownsUpdate(id: string): boolean;

  /**
   * Checks persistent installer handoff ownership.
   * @param id Operation id.
   * @returns Whether installation is committed for this operation.
   */
  public isInstalling(id: string): boolean;

  /**
   * Lists live process registrations, pruning dead processes.
   * @returns Current registrations, including any still starting.
   */
  public members(): readonly InstallationMember[];
}

/**
 * Separates closing runtime-owned resources from closing the endpoint that carries the acknowledgement.
 */
export interface IUpdateShutdown {
  /**
   * Closes provider and database resources; called only while idle admission is held.
   * @throws Error if clean resource shutdown cannot be confirmed.
   */
  prepareUpdateShutdown(): Promise<void>;

  /**
   * Releases endpoint and process ownership after acknowledgement or failed preparation.
   */
  finishUpdateShutdown(): Promise<void>;
}

/**
 * How the runtime listens: a loopback TCP port or a local socket (a Unix socket path, a named
 * pipe on Windows).
 */
export declare enum EndpointKind {
  /**
   * A TCP port on `127.0.0.1`.
   */
  Tcp = "Tcp",
  /**
   * A local socket path.
   */
  Socket = "Socket",
}

/**
 * The client could not connect to the runtime, was refused, or lost the connection.
 */
export declare class ConnectionException extends Exception {
  /**
   * The runtime's refusal, or `null` when the failure is local (socket error, timeout, closed).
   */
  public readonly info: ServiceResponseInfo | null;

  /**
   * Initializes the exception.
   * @param message What happened.
   * @param info The runtime's refusal, or `null`.
   */
  public constructor(message: string, info: ServiceResponseInfo | null);
}

/**
 * An operation was requested in a state that does not allow it.
 */
export declare class InvalidOperationException extends Exception {
  /**
   * Initializes the exception.
   * @param message Why the operation is not allowed.
   */
  public constructor(message: string);
}

/**
 * The runtime process could not be started or did not publish its endpoint in time.
 */
export declare class LaunchException extends Exception {
  /**
   * Initializes the exception with the message `The runtime could not be started: <reason>`.
   * @param reason Why.
   * @param options The underlying process failure, when present.
   */
  public constructor(reason: string, options?: ExceptionOptions);
}

/**
 * Another runtime already serves the data directory.
 */
export declare class RuntimeAlreadyRunningException extends Exception {
  /**
   * The running runtime's lock.
   */
  public readonly lock: RuntimeLock;

  /**
   * Initializes the exception.
   * @param lock The running runtime's lock.
   */
  public constructor(lock: RuntimeLock);
}

/**
 * A runtime of another build holds the data directory, so a client neither uses it nor starts another.
 */
export declare class RuntimeBuildMismatchException extends Exception {
  /**
   * The lock of the runtime that holds the data directory.
   */
  public readonly lock: RuntimeLock;

  /**
   * Initializes the exception with a message that names the runtime and how to quit it.
   * @param lock The lock of the runtime that holds the data directory.
   * @param dataDirectory The data directory it holds.
   * @remarks The message names the program the runtime runs from when its lock records one, and when it started, in the local
   * date and time format.
   */
  public constructor(lock: RuntimeLock, dataDirectory: string);
}

/**
 * Something the idle monitor watches and stops.
 */
export interface IIdleParticipant {
  /**
   * Whether nothing is going on: no clients and no running turns.
   */
  readonly isIdle: boolean;

  /**
   * Called once the participant stayed idle for the grace period.
   */
  handleIdle(): void;
}

/**
 * Receives what a runtime client hears from the runtime.
 */
export interface IRuntimeClientListener {
  /**
   * Handles an event the runtime published.
   * @param event The event.
   */
  onEvent(event: Event): void;

  /**
   * Handles the loss of the connection; called once.
   */
  onDisconnected(): void;
}

/**
 * Receives session-count changes of a runtime server.
 */
export interface IServerListener {
  /**
   * Observes a successfully flushed ordinary response; endpoint owners may then exit without dropping its acknowledgement.
   * @param request Request whose response was written.
   */
  onResponseSent?(request: import("@noldova/teamrun-protocol").Request): void;

  /**
   * Handles a change in the number of connected sessions.
   * @param count The number of sessions, authenticated or not.
   */
  onSessionCountChanged(count: number): void;
}

/**
 * Receives the lines and the end of a client session.
 */
export interface ISessionListener {
  /**
   * Handles one line the client sent.
   * @param session The session.
   * @param line The line, trimmed and non-blank.
   */
  onLine(session: ClientSession, line: string): void;

  /**
   * Handles the session's end; called once.
   * @param session The session.
   */
  onClosed(session: ClientSession): void;
}

/**
 * Where a runtime listens.
 */
export declare class Endpoint {
  /**
   * The endpoint's kind.
   */
  public readonly kind: EndpointKind;
  /**
   * The TCP port, or `null` for a socket endpoint.
   */
  public readonly port: number | null;
  /**
   * The socket path, or `null` for a TCP endpoint.
   */
  public readonly path: string | null;

  /**
   * Initializes the endpoint.
   * @param kind The kind.
   * @param port The port, or `null`.
   * @param path The path, or `null`.
   * @throws ArgumentException when the kind and the values disagree or the path is blank.
   * @throws ArgumentOutOfRangeException when the port is not a positive integer.
   */
  public constructor(kind: EndpointKind, port: number | null, path: string | null);

  /**
   * Creates a loopback TCP endpoint.
   * @param port The port.
   * @returns The endpoint.
   */
  public static tcp(port: number): Endpoint;

  /**
   * Creates a socket endpoint.
   * @param path The socket path.
   * @returns The endpoint.
   */
  public static socket(path: string): Endpoint;

  /**
   * Reads an endpoint from JSON.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The endpoint.
   * @throws JsonException when the kind is missing or unknown.
   */
  public static fromJson(value: unknown, path?: string): Endpoint;

  /**
   * Describes the endpoint: `127.0.0.1:<port>` or the socket path.
   * @returns The text.
   */
  public describe(): string;

  /**
   * Serializes the endpoint.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * Splits a stream of text into trimmed, non-blank lines.
 */
export declare class LineBuffer {
  /**
   * Appends a chunk and returns the complete lines it finished.
   * @param chunk The chunk.
   * @returns The lines.
   */
  public append(chunk: string): readonly string[];
}

/**
 * A request a runtime client awaits.
 */
export declare class PendingCall {
  /**
   * The request's method.
   */
  public readonly method: string;

  /**
   * Initializes the call.
   * @param method The request's method.
   * @param resolvers The promise resolvers the caller awaits.
   * @param timer The timeout timer, cleared when the call settles.
   */
  public constructor(method: string, resolvers: PromiseWithResolvers<Response>, timer: NodeJS.Timeout);

  /**
   * Resolves the call.
   * @param response The response.
   */
  public complete(response: Response): void;

  /**
   * Rejects the call.
   * @param error The failure.
   */
  public fail(error: Error): void;
}

/**
 * What a running runtime publishes beside its data: its process, endpoint, and capability token.
 */
export declare class RuntimeLock {
  /**
   * The runtime's process id.
   */
  public readonly processId: number;
  /**
   * Where the runtime listens.
   */
  public readonly endpoint: Endpoint;
  /**
   * The capability token a client presents in its hello.
   */
  public readonly token: string;
  /**
   * The protocol version the runtime speaks.
   */
  public readonly protocolVersion: ProtocolVersion;
  /**
   * The runtime's product version.
   */
  public readonly productVersion: string;
  /**
   * When the runtime started, ISO 8601.
   */
  public readonly startedAt: string;
  /**
   * The runtime's build, the fingerprint of the inputs it was compiled from; absent in the lock of a runtime from before builds
   * were recorded.
   */
  public readonly build?: string;
  /**
   * The program the runtime runs from; absent in the lock of a runtime from before it was recorded.
   */
  public readonly executablePath?: string;

  /**
   * Initializes the lock.
   * @param processId The process id.
   * @param endpoint The endpoint.
   * @param token The capability token.
   * @param protocolVersion The protocol version.
   * @param productVersion The product version.
   * @param startedAt When the runtime started.
   * @param build The runtime's build; omitted only for a runtime from before builds were recorded.
   * @param executablePath The program the runtime runs from; omitted only for a runtime from before it was recorded.
   * @throws ArgumentOutOfRangeException when the process id is not a positive integer.
   * @throws ArgumentException when the token, product version, start time, build or program is blank.
   */
  public constructor(
    processId: number,
    endpoint: Endpoint,
    token: string,
    protocolVersion: ProtocolVersion,
    productVersion: string,
    startedAt: string,
    build?: string,
    executablePath?: string);

  /**
   * Reads a lock from JSON.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The lock; its build and program are absent when the JSON omits them.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): RuntimeLock;

  /**
   * Serializes the lock.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * How a runtime serves one data directory.
 */
export declare class RuntimeSettings {
  /**
   * The absolute data directory: database, lock, and socket.
   */
  public readonly dataDirectory: string;
  /**
   * The product version the runtime reports.
   */
  public readonly productVersion: string;
  /**
   * How the runtime listens.
   */
  public readonly endpointKind: EndpointKind;
  /**
   * The socket path used for a socket endpoint: a file in the data directory, a named pipe on
   * Windows.
   */
  public readonly socketPath: string;
  /**
   * How long the runtime stays without clients and turns before it stops, or `null` to run
   * until stopped.
   */
  public readonly idleGraceMilliseconds: number | null;

  /**
   * Initializes the settings.
   * @param dataDirectory The absolute data directory.
   * @param productVersion The product version.
   * @param endpointKind How the runtime listens.
   * @param socketPath The socket path.
   * @param idleGraceMilliseconds The idle grace, or `null`.
   * @throws ArgumentException when the directory is blank or relative or a text is blank.
   * @throws ArgumentOutOfRangeException when the grace is not a positive integer.
   */
  public constructor(dataDirectory: string, productVersion: string, endpointKind: EndpointKind, socketPath: string, idleGraceMilliseconds: number | null);

  /**
   * Creates the settings a platform uses: a TCP endpoint and a named pipe path on Windows, a
   * Unix socket in the data directory elsewhere.
   * @param platform The platform, as `process.platform`.
   * @param dataDirectory The absolute data directory.
   * @param productVersion The product version.
   * @param idleGraceMilliseconds The idle grace, or `null`.
   * @returns The settings.
   */
  public static forPlatform(platform: string, dataDirectory: string, productVersion: string, idleGraceMilliseconds: number | null): RuntimeSettings;

  /**
   * Computes the socket path for a data directory.
   * @param windows Whether the platform is Windows.
   * @param dataDirectory The data directory.
   * @returns A named pipe derived from the directory on Windows, `runtime.sock` inside it elsewhere.
   */
  public static createSocketPath(windows: boolean, dataDirectory: string): string;

  /**
   * The lock file path inside the data directory.
   */
  public get lockPath(): string;

  /**
   * The path of the file that records the provider processes started by runtimes.
   */
  public get processesPath(): string;

  /**
   * The folder that holds each open terminal's stored lines, one file per terminal; the runtime empties it when it
   * starts.
   */
  public get terminalsPath(): string;
}

/**
 * The timeouts of runtime clients and launchers, in milliseconds.
 */
/**
 * A provider process a runtime started: its id, its executable, and the runtime's process id.
 */
export declare class TrackedProcess {
  /**
   * The process id.
   */
  public readonly processId: number;
  /**
   * The executable the process runs.
   */
  public readonly executable: string;
  /**
   * The process id of the runtime that started it.
   */
  public readonly runtimeProcessId: number;

  /**
   * Initializes the entry.
   * @param processId The process id.
   * @param executable The executable the process runs.
   * @param runtimeProcessId The process id of the runtime that started it.
   */
  public constructor(processId: number, executable: string, runtimeProcessId: number);

  /**
   * Reads an entry.
   * @param value The JSON value.
   * @returns The entry, or `null` when the value is malformed.
   */
  public static fromJson(value: JsonValue): TrackedProcess | null;

  /**
   * Writes the entry.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * Names a process image through `tasklist` on Windows, `/proc/<pid>/exe` on Linux, and `ps` on other platforms.
 */
export declare class ProcessInspector {
  /**
   * Initializes the inspector.
   * @param platform The platform (`process.platform`).
   * @param run Runs a command and returns its output.
   */
  public constructor(platform: string, run: (executable: string, args: readonly string[]) => string);

  /**
   * Creates the inspector that runs the platform's command.
   * @param platform The platform.
   * @returns The inspector.
   */
  public static fromPlatform(platform: string): ProcessInspector;

  /**
   * Names the executable of a process.
   * @param processId The process id.
   * @returns The executable basename, or `null` when the process is unknown or inaccessible.
   */
  public imageOf(processId: number): string | null;
}

/**
 * The provider processes started by runtimes, in a file beside the lock; the next runtime ends the ones a dead runtime
 * left behind when they still run the recorded executable.
 */
export declare class ProcessRegistry implements IProcessTracker {
  /**
   * Initializes the registry.
   * @param path The file's path.
   * @param runtimeProcessId This runtime's process id, recorded with every process it tracks.
   * @param probe Tells whether a process is alive.
   * @param inspector Names a process's executable.
   */
  public constructor(path: string, runtimeProcessId: number, probe: ProcessProbe, inspector: ProcessInspector);

  /**
   * Records a started process; the unknown process id (0) is ignored.
   * @param processId The process id.
   * @param executable The executable.
   */
  public track(processId: number, executable: string): void;

  /**
   * Forgets a process that ended.
   * @param processId The process id.
   */
  public untrack(processId: number): void;

  /**
   * Ends the leftovers of dead runtimes: recorded processes whose runtime is gone, still alive, and still running the
   * recorded executable. Entries of live runtimes stay; every other entry is dropped.
   * @returns The process ids ended.
   */
  public reapLeftovers(): readonly number[];
}

export declare class RuntimeTimings {
  /**
   * How long the runtime may take to answer a hello.
   */
  public readonly helloTimeout: number;
  /**
   * How long the runtime may take to answer a request.
   */
  public readonly callTimeout: number;
  /**
   * How long a started runtime may take to publish a live lock.
   */
  public readonly launchTimeout: number;
  /**
   * How often the launcher reads the lock while waiting.
   */
  public readonly launchPollInterval: number;

  /**
   * Initializes the timings.
   * @param helloTimeout The hello timeout.
   * @param callTimeout The call timeout.
   * @param launchTimeout The launch timeout.
   * @param launchPollInterval The launch poll interval.
   * @throws ArgumentOutOfRangeException when a value is not a positive integer.
   */
  public constructor(helloTimeout: number, callTimeout: number, launchTimeout: number, launchPollInterval: number);

  /**
   * Returns the production timings.
   * @returns The timings.
   */
  public static createDefault(): RuntimeTimings;
}

/**
 * The package's literals: names, arguments, fields, timings, and messages.
 */
export declare class Resources {
  /**
   * installation link file used by update preparation and recovery.
   */
  public static readonly installationLinkFile: string;
  /**
   * installation id pattern used by update preparation and recovery.
   */
  public static readonly installationIdPattern: RegExp;
  /**
   * installation link invalid used by update preparation and recovery.
   */
  public static readonly installationLinkInvalid: string;
  /**
   * runtime stop requires pause used by update preparation and recovery.
   */
  public static readonly runtimeStopRequiresPause: string;
  /**
   * runtime shutdown failed used by update preparation and recovery.
   */
  public static readonly runtimeShutdownFailed: string;
  /**
   * update shutdown milliseconds used by update preparation and recovery.
   */
  public static readonly updateShutdownMilliseconds: number;
  /**
   * update rejected promise used by update preparation and recovery.
   */
  public static readonly updateRejectedPromise: string;
  /**
   * stopped for update used by update preparation and recovery.
   */
  public static readonly stoppedForUpdate: string;
  /**
   * installation id field used by update preparation and recovery.
   */
  public static readonly installationIdField: string;
  /**
   * installation role field used by update preparation and recovery.
   */
  public static readonly installationRoleField: string;
  /**
   * installation data directory field used by update preparation and recovery.
   */
  public static readonly installationDataDirectoryField: string;
  /**
   * installation owner field used by update preparation and recovery.
   */
  public static readonly installationOwnerField: string;
  /**
   * installation target field used by update preparation and recovery.
   */
  public static readonly installationTargetField: string;
  /**
   * installation phase field used by update preparation and recovery.
   */
  public static readonly installationPhaseField: string;
  /**
   * installation expiry field used by update preparation and recovery.
   */
  public static readonly installationExpiryField: string;
  /**
   * installation endpoint invalid used by update preparation and recovery.
   */
  public static readonly installationEndpointInvalid: string;
  /**
   * installation archive name used by update preparation and recovery.
   */
  public static readonly installationArchiveName: string;
  /**
   * app image variable used by update preparation and recovery.
   */
  public static readonly appImageVariable: string;
  /**
   * installation hash algorithm used by update preparation and recovery.
   */
  public static readonly installationHashAlgorithm: string;
  /**
   * installation hash encoding used by update preparation and recovery.
   */
  public static readonly installationHashEncoding: "hex";
  /**
   * installation registry segments used by update preparation and recovery.
   */
  public static readonly installationRegistrySegments: readonly string[];
  /**
   * installation registry file used by update preparation and recovery.
   */
  public static readonly installationRegistryFile: string;
  /**
   * installation directory mode used by update preparation and recovery.
   */
  public static readonly installationDirectoryMode: number;
  /**
   * installation json column used by update preparation and recovery.
   */
  public static readonly installationJsonColumn: string;
  /**
   * installation schema used by update preparation and recovery.
   */
  public static readonly installationSchema: string;
  /**
   * installation begin used by update preparation and recovery.
   */
  public static readonly installationBegin: string;
  /**
   * installation commit used by update preparation and recovery.
   */
  public static readonly installationCommit: string;
  /**
   * installation rollback used by update preparation and recovery.
   */
  public static readonly installationRollback: string;
  /**
   * installation put member used by update preparation and recovery.
   */
  public static readonly installationPutMember: string;
  /**
   * installation find member used by update preparation and recovery.
   */
  public static readonly installationFindMember: string;
  /**
   * installation delete member used by update preparation and recovery.
   */
  public static readonly installationDeleteMember: string;
  /**
   * installation select members used by update preparation and recovery.
   */
  public static readonly installationSelectMembers: string;
  /**
   * installation select update used by update preparation and recovery.
   */
  public static readonly installationSelectUpdate: string;
  /**
   * installation put update used by update preparation and recovery.
   */
  public static readonly installationPutUpdate: string;
  /**
   * installation delete update used by update preparation and recovery.
   */
  public static readonly installationDeleteUpdate: string;
  /**
   * installation updating used by update preparation and recovery.
   */
  public static readonly installationUpdating: string;
  /**
   * installation member missing used by update preparation and recovery.
   */
  public static readonly installationMemberMissing: string;
  /**
   * installation update lost used by update preparation and recovery.
   */
  public static readonly installationUpdateLost: string;
  /**
   * Runtime request-admission pause lease in milliseconds; 30 seconds.
   */
  public static readonly runtimePauseLeaseMilliseconds: number;
  /**
   * Busy runtime cannot pause.
   */
  public static readonly runtimePauseBusy: string;
  /**
   * New work is refused while paused.
   */
  public static readonly runtimePaused: string;
  /**
   * Another connection owns the pause.
   */
  public static readonly runtimePauseOwned: string;
  /**
   * Invalid runtime control payload.
   */
  public static readonly runtimePausePayloadInvalid: string;
  public static readonly grokProfileSegments: readonly string[];
  public static readonly linuxPlatform: string;
  public static readonly readLinkExecutable: string;
  /**
   * Suffix of the separate runtime ownership database.
   */
  public static readonly ownershipFileSuffix: string;
  /**
   * Acquires the exclusive transaction held throughout a runtime's lifetime.
   */
  public static readonly acquireOwnershipStatement: string;
  /**
   * Ends the transaction a check of ownership took.
   */
  public static readonly releaseOwnershipStatement: string;
  /**
   * The field of a SQLite error that holds its result code.
   */
  public static readonly sqliteErrorCodeField: "errcode";
  /**
   * SQLite's result code when another connection holds a lock the statement needs.
   */
  public static readonly sqliteBusyCode: number;
  public static readonly lockFileName: string;
  /**
   * The file in the data directory that records the provider processes started by runtimes.
   */
  public static readonly processesFileName: string;
  public static readonly win32Platform: string;
  public static readonly taskListExecutable: string;
  public static readonly psExecutable: string;
  public static readonly quote: string;
  /**
   * The process id an adapter records when its spawn failed; never tracked.
   */
  public static readonly unknownProcessId: number;
  public static readonly lockTemporarySuffix: string;
  public static readonly socketFileName: string;
  public static readonly windowsPipePrefix: string;
  public static readonly windowsPlatform: string;
  public static readonly loopbackHost: string;
  public static readonly ephemeralPort: number;
  public static readonly tokenByteLength: number;
  public static readonly hexEncoding: BufferEncoding;
  public static readonly utf8Encoding: BufferEncoding;
  public static readonly lockFileMode: number;
  public static readonly lineSeparator: string;
  public static readonly requestIdSeparator: string;
  public static readonly clientName: string;
  public static readonly clientTitle: string;
  public static readonly pipeHashAlgorithm: string;
  public static readonly pipeHashLength: number;
  public static readonly dataEvent: string;
  public static readonly closeEvent: string;
  public static readonly errorEvent: string;
  public static readonly endEvent: string;
  public static readonly connectEvent: string;
  public static readonly listeningEvent: string;
  public static readonly interruptSignal: NodeJS.Signals;
  public static readonly terminateSignal: NodeJS.Signals;
  public static readonly processIdField: string;
  public static readonly endpointField: string;
  public static readonly kindField: string;
  public static readonly portField: string;
  public static readonly pathField: string;
  public static readonly tokenField: string;
  public static readonly protocolVersionField: string;
  public static readonly productVersionField: string;
  public static readonly startedAtField: string;
  /**
   * The lock field holding the runtime's build.
   */
  public static readonly buildField: string;
  /**
   * The lock field holding the program the runtime runs from.
   */
  public static readonly executablePathField: string;
  public static readonly dataDirectoryArgument: string;
  public static readonly productVersionArgument: string;
  public static readonly idleGraceArgument: string;
  public static readonly providersArgument: string;
  public static readonly noProvidersValue: string;
  public static readonly stopOnInputEndArgument: string;
  public static readonly defaultProductVersion: string;
  /**
   * This package's build: the fingerprint of the inputs it was compiled from, which the build stamps.
   * Builds from the same inputs share it; any change to them gives a new one.
   */
  public static readonly build: string;
  public static readonly helloTimeout: number;
  public static readonly callTimeout: number;
  public static readonly launchTimeout: number;
  public static readonly launchPollInterval: number;
  public static readonly idleGrace: number;
  public static readonly dataDirectoryParameterName: string;
  public static readonly productVersionParameterName: string;
  public static readonly idleGraceParameterName: string;
  public static readonly portParameterName: string;
  public static readonly pathParameterName: string;
  public static readonly socketPathParameterName: string;
  public static readonly tokenParameterName: string;
  public static readonly processIdParameterName: string;
  public static readonly clientNameParameterName: string;
  public static readonly helloTimeoutParameterName: string;
  public static readonly callTimeoutParameterName: string;
  public static readonly launchTimeoutParameterName: string;
  public static readonly launchPollIntervalParameterName: string;
  public static readonly entryPathParameterName: string;
  public static readonly executablePathParameterName: string;
  public static readonly tcpEndpointNeedsPort: string;
  public static readonly socketEndpointNeedsPath: string;
  public static readonly dataDirectoryNotAbsolute: string;
  public static readonly serviceAlreadyStarted: string;
  public static readonly serverAlreadyStarted: string;
  public static readonly helloRequired: string;
  public static readonly tokenRejected: string;
  public static readonly requestRequired: string;
  public static readonly messageUnreadable: string;
  public static readonly clientClosed: string;
  public static readonly helloTimedOut: string;
  public static readonly helloRefused: string;
  /**
   * The runtime's successful hello response does not contain a valid protocol version.
   */
  public static readonly invalidWelcomeVersion: string;
  public static readonly launchTimedOut: string;
  /**
   * The child-process notification that execution has started.
   */
  public static readonly spawnEvent: string;
  /**
   * The Linux shell used to close inherited descriptors before runtime execution.
   */
  public static readonly runtimeLaunchShell: string;
  /**
   * The Linux descriptor directory that must be readable and searchable before launch.
   */
  public static readonly runtimeLaunchDescriptors: string;
  /**
   * Explains how to restore the required Linux launch shell.
   */
  public static readonly runtimeLaunchShellUnavailable: string;
  /**
   * Explains how to restore access to the Linux descriptor directory.
   */
  public static readonly runtimeLaunchDescriptorsUnavailable: string;
  /**
   * Fixed shell options and program; the destination executable and arguments follow them.
   */
  public static readonly runtimeLaunchShellArguments: readonly string[];
  public static readonly dataDirectoryRequired: string;
  public static readonly stoppedByIdle: string;
  public static readonly stoppedBySignal: string;
  public static readonly stoppedByInputEnd: string;

  /**
   * Formats the refusal when a runtime of another build holds the data directory.
   * @param dataDirectory The data directory the other runtime holds.
   * @param runtime Which runtime holds it and when it started, from {@link Resources.formatRuntimeProgram} or {@link Resources.formatRuntimeVersion}.
   * @returns The explanation, with how to quit that TeamRun and when its runtime stops.
   */
  public static formatRuntimeBuildMismatch(dataDirectory: string, runtime: string): string;

  /**
   * Describes a runtime of another build by the program it runs from.
   * @param executablePath The program the runtime runs from.
   * @param productVersion The runtime's product version.
   * @param date The local date the runtime started.
   * @param time The local time the runtime started.
   * @returns One sentence naming the program, the version and the start.
   */
  public static formatRuntimeProgram(executablePath: string, productVersion: string, date: string, time: string): string;

  /**
   * Describes a runtime of another build whose lock records no program.
   * @param productVersion The runtime's product version.
   * @param date The local date the runtime started.
   * @param time The local time the runtime started.
   * @returns One sentence naming the version and the start.
   */
  public static formatRuntimeVersion(productVersion: string, date: string, time: string): string;

  /**
   * How a refusal shows the date a runtime of another build started.
   */
  public static readonly runtimeStartedDateFormat: Intl.DateTimeFormatOptions;
  /**
   * How a refusal shows the time a runtime of another build started.
   */
  public static readonly runtimeStartedTimeFormat: Intl.DateTimeFormatOptions;

  /**
   * The macOS platform name: `darwin`.
   */
  public static readonly macPlatform: string;
  /**
   * The separator of an operating system release's parts: `.`.
   */
  public static readonly versionSeparator: string;
  /**
   * Parameter name reported for a blank shell name.
   */
  public static readonly shellNameParameterName: string;
  /**
   * Parameter name reported for a blank executable.
   */
  public static readonly executableParameterName: string;
  /**
   * Parameter name reported for a blank environment variable name.
   */
  public static readonly variableNameParameterName: string;
  /**
   * Parameter name reported for an invalid wait for a shell to end.
   */
  public static readonly endMillisecondsParameterName: string;
  /**
   * Parameter name reported for an invalid output amount that pauses a shell.
   */
  public static readonly highWatermarkParameterName: string;
  /**
   * Parameter name reported for an invalid output amount that lets a shell continue.
   */
  public static readonly lowWatermarkParameterName: string;
  /**
   * The data directory's folder for stored terminal lines: `terminals`.
   */
  public static readonly terminalsDirectoryName: string;
  /**
   * The permissions of the stored-lines folder: owner only.
   */
  public static readonly terminalDirectoryMode: number;
  /**
   * The extension of a stored-lines file: `.jsonl`, one JSON line per stored line.
   */
  public static readonly terminalHistoryExtension: string;
  /**
   * How a stored-lines file is opened: created or emptied, for reading and writing.
   */
  public static readonly terminalHistoryFlags: string;
  /**
   * The permissions of a stored-lines file: owner only, because output can contain secrets.
   */
  public static readonly terminalHistoryMode: number;
  /**
   * How many stored lines share one remembered file position: 64.
   */
  public static readonly terminalHistoryBlockLines: number;
  /**
   * How many bytes a page read takes from the file at a time: 64 KiB.
   */
  public static readonly terminalHistoryReadBytes: number;
  /**
   * The byte that ends a stored line in the file.
   */
  public static readonly lineFeedByte: number;
  /**
   * How many recent rows the emulator keeps above its screen for reflow before storing them: 1000.
   */
  public static readonly terminalCaptureScrollback: number;
  /**
   * How long to wait for a shell to end after each attempt: 2 seconds.
   */
  public static readonly terminalEndMilliseconds: number;
  /**
   * The waiting output that pauses a shell: 1 MiB.
   */
  public static readonly terminalHighWatermark: number;
  /**
   * The waiting output that lets a paused shell continue: 256 KiB.
   */
  public static readonly terminalLowWatermark: number;
  /**
   * The signal that forces a shell to end outside Windows: `SIGKILL`.
   */
  public static readonly forceKillSignal: string;
  /**
   * The emulator's name for the Windows pseudo-console: `conpty`.
   */
  public static readonly conptyBackend: "conpty";
  /**
   * The field of `node-pty`'s Windows terminal that holds its pseudo-console agent: `_agent`.
   */
  public static readonly ptyAgentField: "_agent";
  /**
   * The field of that agent that holds the thread reading the pseudo-console's output: `_conoutSocketWorker`.
   */
  public static readonly ptyOutputReaderField: "_conoutSocketWorker";
  /**
   * The method that releases that thread: `dispose`.
   */
  public static readonly disposeMethod: "dispose";
  /**
   * The emulator's name for the normal screen: `normal`.
   */
  public static readonly normalBufferType: "normal";
  /**
   * The final character of Erase in Display: `J`.
   */
  public static readonly eraseInDisplayFinal: string;
  /**
   * The prefix of private control sequences: `?`.
   */
  public static readonly privatePrefix: string;
  /**
   * The final character of a full reset: `c`.
   */
  public static readonly fullResetFinal: string;
  /**
   * The final character of the primary device attributes query: `c`.
   */
  public static readonly deviceAttributesFinal: string;
  /**
   * The answer to the primary device attributes query, the one `@xterm/xterm` gives: a VT100 with advanced video.
   */
  public static readonly deviceAttributesAnswer: string;
  /**
   * The Erase in Display parameter that erases the saved lines: 3.
   */
  public static readonly eraseSavedLinesParameter: number;
  /**
   * The text of an empty cell: a space.
   */
  public static readonly blankCell: string;
  /**
   * The terminal type shells see outside Windows: `xterm-256color`.
   */
  public static readonly terminalTermName: string;
  /**
   * The terminal type variable: `TERM`.
   */
  public static readonly termVariable: string;
  /**
   * The color support variable: `COLORTERM`.
   */
  public static readonly colorTermVariable: string;
  /**
   * The value that announces 24-bit color: `truecolor`.
   */
  public static readonly trueColorValue: string;
  /**
   * The language variable: `LANG`.
   */
  public static readonly languageVariable: string;
  /**
   * The character type variable: `LC_CTYPE`.
   */
  public static readonly characterTypeVariable: string;
  /**
   * The variables that set a locale: `LANG`, `LC_ALL` and `LC_CTYPE`.
   */
  public static readonly localeVariables: readonly string[];
  /**
   * The locale that sets only UTF-8 characters: `UTF-8`.
   */
  public static readonly utf8Locale: string;
  /**
   * The variables TeamRun's launch adds to its own processes, which shells do not see.
   */
  public static readonly launchVariables: readonly string[];
  /**
   * The variable where Electron keeps the desktop name it replaced: `ORIGINAL_XDG_CURRENT_DESKTOP`.
   */
  public static readonly originalDesktopVariable: string;
  /**
   * The desktop name variable: `XDG_CURRENT_DESKTOP`.
   */
  public static readonly desktopVariable: string;
  /**
   * The shell variable: `SHELL`.
   */
  public static readonly shellVariable: string;
  /**
   * The shell used when no login shell is recorded: `/bin/sh`.
   */
  public static readonly defaultUnixShell: string;
  /**
   * The argument that starts a login shell: `-l`.
   */
  public static readonly loginShellArgument: string;
  /**
   * The Windows search path variable: `Path`.
   */
  public static readonly pathVariable: string;
  /**
   * The separator of Windows search path entries: `;`.
   */
  public static readonly windowsPathSeparator: string;
  /**
   * Matches separators at the end of a search path.
   */
  public static readonly trailingPathSeparators: RegExp;
  /**
   * Matches a `%NAME%` reference in a Windows environment value.
   */
  public static readonly environmentReferencePattern: RegExp;
  /**
   * The program files variable: `ProgramFiles`.
   */
  public static readonly programFilesVariable: string;
  /**
   * The Windows folder variable: `SystemRoot`.
   */
  public static readonly systemRootVariable: string;
  /**
   * The display name of PowerShell 7.
   */
  public static readonly powerShellName: string;
  /**
   * The executable of PowerShell 7.
   */
  public static readonly powerShellExecutable: string;
  /**
   * Where PowerShell 7 installs under the program files folder.
   */
  public static readonly powerShellDirectorySegments: readonly string[];
  /**
   * The local application data variable: `LOCALAPPDATA`.
   */
  public static readonly localAppDataVariable: string;
  /**
   * Where Microsoft Store apps keep their execution aliases under the local application data folder.
   */
  public static readonly appAliasDirectorySegments: readonly string[];
  /**
   * The display name of Windows PowerShell.
   */
  public static readonly windowsPowerShellName: string;
  /**
   * Where Windows PowerShell is under the Windows folder.
   */
  public static readonly windowsPowerShellSegments: readonly string[];
  /**
   * The Windows PowerShell arguments before the encoded registry script.
   */
  public static readonly windowsEnvironmentArguments: readonly string[];
  /**
   * How long reading the registry may take: 10 seconds.
   */
  public static readonly windowsEnvironmentMilliseconds: number;
  /**
   * The line that ends the registry script's output: `End`.
   */
  public static readonly windowsEnvironmentEnd: string;
  /**
   * The separator of a registry output line's fields: a space.
   */
  public static readonly windowsEnvironmentFieldSeparator: string;
  /**
   * How many fields a registry output line has: 4.
   */
  public static readonly windowsEnvironmentFieldCount: number;
  /**
   * The registry kind of a plain string value: `String`.
   */
  public static readonly plainValueKind: string;
  /**
   * The registry kind of an expandable string value: `ExpandString`.
   */
  public static readonly expandableValueKind: string;
  /**
   * Matches canonical base64 text.
   */
  public static readonly base64Pattern: RegExp;
  /**
   * The base64 encoding name.
   */
  public static readonly base64Encoding: BufferEncoding;
  /**
   * The UTF-16 encoding name, used for PowerShell's encoded commands.
   */
  public static readonly utf16Encoding: BufferEncoding;
  /**
   * Matches the end of an output line on any platform.
   */
  public static readonly outputLinePattern: RegExp;
  /**
   * The Windows PowerShell script that prints the machine, user and sign-in session environment variables.
   */
  public static readonly windowsEnvironmentScript: string;
  /**
   * The reason given when Windows PowerShell cannot start.
   */
  public static readonly windowsEnvironmentNotStarted: string;
  /**
   * The reason given when the registry read times out.
   */
  public static readonly windowsEnvironmentTimedOut: string;
  /**
   * The reason given when the registry read prints output that cannot be read.
   */
  public static readonly windowsEnvironmentUnreadable: string;
  /**
   * Message for a Windows environment without `SystemRoot`.
   */
  public static readonly systemRootMissing: string;
  /**
   * Message for a terminal that does not exist or belongs to another connection.
   */
  public static readonly terminalNotFound: string;
  /**
   * Message for input to a terminal whose shell is not running.
   */
  public static readonly terminalShellNotRunning: string;
  /**
   * Message for opening a terminal in a project that does not exist.
   */
  public static readonly terminalProjectNotFound: string;
  /**
   * Message for opening a terminal whose folder, the project's or the home folder, is missing.
   */
  public static readonly terminalFolderMissing: string;
  /**
   * Message for opening a terminal while the runtime or the connection is closing.
   */
  public static readonly terminalsStopped: string;
  /**
   * Message for stored lines that could not be written; the exception's cause is the file system failure.
   */
  public static readonly storedLinesFailed: string;
  /**
   * Message for a stored-lines file that ends before its lines.
   */
  public static readonly storedLinesDamaged: string;

  /**
   * Formats the version-mismatch refusal.
   * @param client The client's protocol version.
   * @param runtime The runtime's protocol version.
   * @returns The text.
   */
  public static formatVersionMismatch(client: string, runtime: string): string;

  /**
   * Formats the already-running message.
   * @param processId The running runtime's process id.
   * @param endpoint The running runtime's endpoint description.
   * @returns The text.
   */
  public static formatAlreadyRunning(processId: number, endpoint: string): string;

  /**
   * Formats the message for a request the runtime did not answer in time.
   * @param method The method.
   * @returns The text.
   */
  public static formatCallTimedOut(method: string): string;

  /**
   * Formats the launch-failure message.
   * @param reason Why.
   * @returns The text.
   */
  public static formatLaunchFailed(reason: string): string;

  /**
   * Formats `<host>:<port>`.
   * @param host The host.
   * @param port The port.
   * @returns The text.
   */
  public static formatTcpEndpoint(host: string, port: number): string;

  /**
   * Formats the message for an argument value the entry does not accept.
   * @param argument The argument.
   * @param value The value.
   * @returns The text.
   */
  public static formatUnknownArgumentValue(argument: string, value: string): string;

  /**
   * Composes the `tasklist` arguments that name one process's image.
   */
  public static formatTaskListArguments(processId: number): readonly string[];

  /**
   * Composes the `ps` arguments that name one process's command.
   */
  public static formatPsArguments(processId: number): readonly string[];

  /**
   * Formats the refusal of a method the terminal host does not answer.
   * @param method The method.
   * @returns The text.
   */
  public static formatUnknownTerminalMethod(method: string): string;

  /**
   * Formats the message for environment variables that could not be read from Windows.
   * @param reason Why they could not be read.
   * @returns The text.
   */
  public static formatWindowsEnvironmentFailed(reason: string): string;

  /**
   * Formats the reason given when Windows PowerShell fails.
   * @param exitCode Its exit code, or `null` when a signal ended it.
   * @returns The text.
   */
  public static formatWindowsEnvironmentExit(exitCode: number | null): string;

  /**
   * Formats a UTF-8 locale name.
   * @param language The language, such as `en`.
   * @param region The region, such as `US`.
   * @returns The locale, such as `en_US.UTF-8`.
   */
  public static formatUtf8Locale(language: string, region: string): string;
}

/**
 * One client connection on the server side: lines in, wire messages out.
 */
export declare class ClientSession implements ITerminalOwner {
  /**
   * Initializes the session over an accepted socket.
   * @param socket The socket.
   * @param listener Receives the lines and the end.
   */
  public constructor(socket: Socket, listener: ISessionListener);

  /**
   * Writes an acknowledgement and waits for the socket write callback before releasing endpoint ownership.
   * @param message Response to flush.
   * @returns Completion of the transport write.
   * @throws Error if the socket is closed or writing fails.
   */
  public writeAndFlush(message: WireMessage): Promise<void>;

  /**
   * Whether the hello was accepted.
   */
  public get isAuthenticated(): boolean;

  /**
   * The client's name from its hello, or `null` before authentication.
   */
  public get name(): string | null;

  /**
   * Whether the socket closed.
   */
  public get isClosed(): boolean;

  /**
   * Marks the hello as accepted.
   * @param clientName The client's name.
   */
  public authenticate(clientName: string): void;

  /**
   * Writes a message as one line; ignored once closed.
   * @param message The message.
   */
  public write(message: WireMessage): void;

  /**
   * Closes the socket.
   */
  public close(): void;
}

/**
 * A client of a running runtime: connects, says hello, sends requests, and receives events.
 */
export declare class RuntimeClient {
  /**
   * Connects to a runtime and completes the hello only when the runtime reports the current protocol version.
   * @param endpoint Where the runtime listens.
   * @param token The runtime's capability token.
   * @param clientName The client's name, used in request ids and diagnostics.
   * @param listener Receives events after version validation and receives the disconnection.
   * @param timings The timeouts.
   * @returns The connected client.
   * @throws ArgumentException when the client name is blank.
   * @throws ConnectionException when the socket cannot connect, the runtime refuses the hello
   * (`info` carries the refusal), or does not answer it in time.
   */
  public static connect(endpoint: Endpoint, token: string, clientName: string, listener: IRuntimeClientListener, timings: RuntimeTimings): Promise<RuntimeClient>;

  /**
   * Whether the connection is open.
   */
  public get isConnected(): boolean;

  /**
   * The protocol version the runtime reported in its welcome, or `null` before it.
   */
  public get version(): ProtocolVersion | null;

  /**
   * Sends a request and waits for its response.
   * @param method The method.
   * @param payload The parameters.
   * @returns The response, successful or failed.
   * @throws ConnectionException when the connection is closed or the response does not arrive in
   * time.
   */
  public call(method: string, payload: JsonValue): Promise<Response>;

  /**
   * Closes the connection.
   */
  public close(): void;
}

/**
 * The runtime's endpoint: accepts connections, requires a hello with the capability token and a
 * servable protocol version, dispatches requests, and fans events out to authenticated sessions.
 */
export declare class RuntimeServer implements ISessionListener, IEventListener {
  /**
   * Initializes the server without listening.
   * @param endpointKind How to listen.
   * @param socketPath The socket path for a socket endpoint.
   * @param token The capability token clients must present.
   * @param dispatcher Answers requests.
   * @param listener Receives session-count changes.
   * @param isBusy Reports background provider work that prevents admission pausing; defaults to false.
   * @param pauseLeaseMilliseconds Pause lifetime; defaults to 30 seconds. Repeated owner calls renew it.
   * @param shutdown Stops the runtime for an update, or `null` when the server cannot stop for one.
   * @param terminals Answers terminal requests for the connection that sends them and ends a closed connection's
   * terminals, or `null` when the server has no terminals.
   * @throws ArgumentException when the path or the token is blank.
   */
  public constructor(endpointKind: EndpointKind, socketPath: string, token: string, dispatcher: IRequestDispatcher, listener: IServerListener, isBusy?: () => boolean, pauseLeaseMilliseconds?: number, shutdown?: IUpdateShutdown | null,
    terminals?: TerminalHost | null);

  /**
   * Where the server listens, or `null` when it does not.
   */
  public get endpoint(): Endpoint | null;

  /**
   * The number of connected sessions.
   */
  public get sessionCount(): number;

  /**
   * The number of sessions whose hello was accepted.
   */
  public get authenticatedCount(): number;

  /**
   * Starts listening on an ephemeral loopback port or the supplied socket path without removing existing paths.
   * @returns The endpoint.
   * @throws InvalidOperationException when already started.
   * @throws Error when the endpoint cannot be bound, including an occupied socket path.
   */
  public start(): Promise<Endpoint>;

  /**
   * Closes every session and stops listening.
   */
  public stop(): Promise<void>;

  /**
   * Sends an event to every authenticated session.
   * @param event The event.
   */
  public onEvent(event: Event): void;

  /**
   * Handles a line: the hello on a new session (refused and closed on a bad token, an unservable
   * version, or anything but a hello), a request afterwards; unreadable lines and non-requests are
   * answered with a failed response.
   * @param session The session.
   * @param line The line.
   */
  public onLine(session: ClientSession, line: string): void;

  /**
   * Forgets a closed session and ends its terminals.
   * @param session The session.
   */
  public onClosed(session: ClientSession): void;
}

/**
 * Stops a participant that stays idle for a grace period.
 */
export declare class IdleMonitor implements Disposable {
  /**
   * Initializes the monitor.
   * @param graceMilliseconds The grace, or `null` to never stop.
   * @param participant What to watch and stop.
   * @throws ArgumentOutOfRangeException when the grace is not a positive integer.
   */
  public constructor(graceMilliseconds: number | null, participant: IIdleParticipant);

  /**
   * Whether the grace timer runs.
   */
  public get isArmed(): boolean;

  /**
   * Re-evaluates the participant: arms the timer when idle, disarms it otherwise.
   */
  public check(): void;

  /**
   * Disarms the timer.
   */
  public [Symbol.dispose](): void;
}

/**
 * The lock file beside the database: who serves the data directory and how to reach it.
 */
export declare class LockFile implements Disposable {
  /**
   * The file's path.
   */
  public readonly path: string;

  /**
   * Initializes the lock file.
   * @param path The file's path.
   * @param probe Tells whether a process is alive.
   * @throws ArgumentException when the path is blank.
   */
  public constructor(path: string, probe: ProcessProbe);

  /**
   * Reads the lock.
   * @returns The lock, or `null` when the file is missing or unreadable.
   */
  public read(): RuntimeLock | null;

  /**
   * Reads the lock of a live runtime.
   * @returns The lock when its process is alive, else `null`.
   */
  public readLive(): RuntimeLock | null;

  /**
   * Checks whether a runtime holds the data directory's ownership, which a runtime does for as long as it runs, whatever the
   * lock file records.
   * @returns `true` while a runtime holds ownership; `false` when none does, after briefly taking ownership and releasing it.
   * @throws Error when the ownership database cannot be opened or read.
   */
  public isHeld(): boolean;

  /**
   * Writes the lock, replacing a stale one; the write is atomic and the file is private to the
   * user.
   * @param lock The lock.
   * @throws RuntimeAlreadyRunningException when a live runtime with another process id or token
   * holds the lock.
   */
  public acquire(lock: RuntimeLock): void;

  /**
   * Claims exclusive ownership before accessing runtime state. Ownership is an exclusive SQLite
   * transaction in a separate file and is released by the operating system if this process exits.
   * Repeated calls on this instance keep the same ownership.
   * @throws RuntimeAlreadyRunningException when a live runtime has published its descriptor.
   * @throws Error when an unpublished owner holds the transaction or filesystem access fails.
   */
  public claim(): void;

  /**
   * Releases ownership without removing the published descriptor. Safe to call repeatedly.
   */
  public [Symbol.dispose](): void;

  /**
   * Removes the lock when it belongs to the process.
   * @param processId The releasing process.
   */
  public release(processId: number): void;

  /**
   * Removes the lock file when it still holds the given lock: the lock named a process that is alive by id but not
   * answering, which happens when the id was reused after a runtime died without releasing its lock.
   * @param lock The lock that could not be reached.
   */
  public discard(lock: RuntimeLock): void;
}

/**
 * Tells whether a process is alive.
 */
export declare class ProcessProbe {
  /**
   * Checks a process.
   * @param processId The process id.
   * @returns `true` when the process exists.
   */
  public isAlive(processId: number): boolean;
}

/**
 * Builds the production provider registry: the Codex and Claude Code adapters over the located
 * executables.
 */
export declare class ProviderRegistryFactory {
  /**
   * Initializes the factory.
   * @param platform The platform, as `process.platform`.
   * @param baseEnvironment The environment the adapters clean for provider processes.
   * @param locator Finds the executables.
   */
  public constructor(platform: string, baseEnvironment: NodeJS.ProcessEnv, locator: ExecutableLocator);

  /**
   * Creates the registry.
   * @param productVersion The product version reported to the providers.
   * @returns The registry with both adapters, each with a `null` command when its executable was
   * not found.
   */
  public create(productVersion: string, tracker: IProcessTracker, dataDirectory: string): ProviderRegistry;
}

/**
 * The runtime process entry: reads the arguments, builds the service, and runs it until it stops
 * by idleness, a signal, or the end of its input.
 */
export declare class RuntimeEntry {
  /**
   * Initializes the entry.
   * @param args The command-line arguments after the script.
   * @param platform The platform, as `process.platform`.
   * @param environment The process environment.
   */
  public constructor(args: readonly string[], platform: string, environment: NodeJS.ProcessEnv);

  /**
   * The path of this module, which a launcher runs with the same Node executable.
   */
  public static get entryPath(): string;

  /**
   * Whether `--stop-on-input-end` was given.
   */
  public get stopsOnInputEnd(): boolean;

  /**
   * Reads the settings from `--data-dir`, `--product-version`, and `--idle-grace`.
   * @returns The settings.
   * @throws ArgumentException when `--data-dir` is missing.
   */
  public createSettings(): RuntimeSettings;

  /**
   * Creates the provider registry: the production adapters, or none with `--providers none`.
   * @param productVersion The product version.
   * @returns The registry.
   * @throws ArgumentException for any other `--providers` value.
   */
  public createRegistry(productVersion: string, tracker: IProcessTracker): ProviderRegistry;

  /**
   * Runs the runtime until it stops.
   * @param input The process input, watched for its end when `--stop-on-input-end` was given.
   * @param signals The emitter of `SIGINT` and `SIGTERM`.
   * @returns Why the runtime stopped.
   */
  public run(input: NodeJS.ReadableStream, signals: NodeJS.EventEmitter): Promise<string>;
}

/**
 * The command for starting a runtime, with inherited descriptor cleanup on Linux.
 */
export declare class RuntimeLaunchCommand extends ProcessCommand {
  /**
   * Checks Linux prerequisites and creates the platform's launch command without executing it.
   * @param platform The host platform, as `process.platform`.
   * @param executablePath The executable that runs the runtime.
   * @param args The arguments, preserved literally and copied into the command.
   * @throws ArgumentException when the executable path is blank.
   * @throws LaunchException when Linux lacks executable `/bin/bash` or readable, searchable `/proc/self/fd`.
   */
  public constructor(platform: string, executablePath: string, args: readonly string[]);
}

/**
 * Attaches to the runtime of a data directory, starting one when none is live.
 * Linux startup requires `/bin/bash` and `/proc` to close inherited descriptors in the child.
 */
export declare class RuntimeLauncher {
  /**
   * Initializes the launcher.
   * @param settings The data directory and product version the runtime serves.
   * @param executablePath The Node executable that runs the entry.
   * @param entryPath The runtime entry module.
   * @param entryArguments Extra arguments for the entry.
   * @param environment The environment of the runtime process; an Electron host adds `ELECTRON_RUN_AS_NODE`.
   * @param timings The timeouts.
   * @throws ArgumentException when a path is blank.
   */
  public constructor(settings: RuntimeSettings, executablePath: string, entryPath: string, entryArguments: readonly string[], environment: NodeJS.ProcessEnv, timings: RuntimeTimings);

  /**
   * Reads the lock of a live runtime.
   * @returns The lock, or `null`.
   */
  public readLiveLock(): RuntimeLock | null;

  /**
   * Checks, without connecting, that no runtime of another build holds the data directory.
   * @throws RuntimeBuildMismatchException when a live runtime of another build holds the data directory.
   * @remarks A client checks this before it opens a window, so it can explain the refusal instead of failing its first request.
   * The check never connects, because a connection would restart the other runtime's idle grace period.
   */
  public assertSameBuild(): void;

  /**
   * Connects to the live runtime, or starts a detached runtime process and connects once it
   * publishes its lock. A runtime of another build is refused before opening a connection.
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @returns The connected client.
   * @throws ConnectionException when the runtime refuses the hello.
   * @throws RuntimeBuildMismatchException when a live runtime of another build holds the data directory.
   * @throws LaunchException when Linux launch prerequisites are unavailable, process creation fails,
   * or no runtime becomes reachable within the launch timeout.
   * @remarks A runtime of another build is left running; it is never killed or replaced while its work may be active.
   * The lock of another build is replaced only when no runtime holds the data directory's ownership.
   */
  public attach(clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient>;
}

/**
 * The runtime for one data directory: opens the database, wires the services and the engine,
 * listens on the endpoint, publishes the lock, and stops when told or when idle for the grace
 * period.
 */
export declare class RuntimeService implements IServerListener, IIdleParticipant, IEventListener, IUpdateShutdown {
  /**
   * The settings.
   */
  public readonly settings: RuntimeSettings;

  /**
   * Initializes the service without starting it.
   * @param settings The settings.
   * @param registry The provider adapters.
   * @param processes The provider processes started by runtimes; leftovers of dead runtimes are ended at start.
   * @param installation The installation's registry of processes, or `null` outside an installation.
   * @param shells Finds the shell a new terminal starts; the platform's default shell by default.
   */
  public constructor(settings: RuntimeSettings, registry: ProviderRegistry, processes: ProcessRegistry, installation?: InstallationRegistry | null,
    shells?: IShellLocator);

  /**
   * Creates an immutable verified recovery copy after update shutdown.
   * @param dataDirectory Runtime data directory.
   * @param operationId Update UUID.
   * @returns Backup path, or null if no database exists.
   * @throws Error or ServiceException when a recovery copy cannot be verified.
   */
  public static createRecoveryCopy(dataDirectory: string, operationId: string): Promise<string | null>;

  /**
   * Closes idle provider and database resources within a bounded deadline, leaving the endpoint for acknowledgement.
   * @throws Error if clean shutdown cannot be confirmed.
   */
  public prepareUpdateShutdown(): Promise<void>;

  /**
   * Releases the endpoint and ownership after the update acknowledgement has been attempted.
   */
  public finishUpdateShutdown(): Promise<void>;

  /**
   * The published lock, or `null` before start and after stop.
   */
  public get lock(): RuntimeLock | null;

  /**
   * Whether the service runs and is not stopping.
   */
  public get isRunning(): boolean;

  /**
   * Whether no client is connected and no turn runs.
   */
  public get isIdle(): boolean;

  /**
   * The number of connected sessions.
   */
  public get clientCount(): number;

  /**
   * Starts the service and publishes its lock. After acquiring ownership, clears a leftover
   * derived Unix socket path in this data directory before binding; custom socket paths are not removed.
   * @returns The lock.
   * @throws InvalidOperationException when already started.
   * @throws RuntimeAlreadyRunningException when another runtime serves the directory. Ownership
   * is acquired before opening the database, reconciling replies, or touching provider processes.
   * @throws Error when ownership or startup fails; resources acquired by this attempt are released.
   */
  public start(): Promise<RuntimeLock>;

  /**
   * Stops the service: closes the endpoint, shuts the engine and the adapters down, closes the
   * database, and removes the lock. Ignored before start or when already stopping.
   * @param reason Why, reported to `waitForStop`.
   */
  public stop(reason: string): Promise<void>;

  /**
   * Waits until the service stopped.
   * @returns Why it stopped.
   */
  public waitForStop(): Promise<string>;

  /**
   * Records the session count and re-evaluates idleness.
   * @param count The number of sessions.
   */
  public onSessionCountChanged(count: number): void;

  /**
   * Re-evaluates idleness after any event.
   * @param event The event.
   */
  public onEvent(event: Event): void;

  /**
   * Stops the service because it stayed idle.
   */
  public handleIdle(): void;
}

/**
 * Generates capability tokens.
 */
export declare class TokenGenerator {
  /**
   * Generates a random token of 64 hexadecimal characters.
   * @returns The token.
   */
  public generate(): string;
}

/**
 * Where a Windows environment variable is defined.
 */
export declare enum RegistryScope {
  /**
   * The machine's variables, which apply to every user.
   */
  System = "System",
  /**
   * The signed-in user's variables.
   */
  User = "User",
  /**
   * The variables Windows sets for each sign-in, such as `USERNAME` and `USERPROFILE`, which take precedence over the
   * machine's.
   */
  Session = "Session"
}

/**
 * The connection a terminal belongs to: it receives the terminal's events, and the terminal ends when it closes.
 */
export interface ITerminalOwner {
  /**
   * Whether the connection has closed.
   */
  readonly isClosed: boolean;

  /**
   * Sends a message to the connection; ignored once it has closed.
   * @param message The message.
   */
  write(message: WireMessage): void;
}

/**
 * Receives what a shell running in a pseudo-terminal prints and when it ends.
 */
export interface IPseudoTerminalListener {
  /**
   * Receives output as the shell printed it.
   * @param source The pseudo-terminal that received the output.
   * @param data The output.
   */
  onData(source: PseudoTerminal, data: string): void;

  /**
   * Receives the shell's end, after all of its output.
   * @param source The pseudo-terminal whose shell ended.
   * @param exitCode The shell's exit code.
   */
  onExit(source: PseudoTerminal, exitCode: number): void;
}

/**
 * Finds the shell a new terminal starts.
 */
export interface IShellLocator {
  /**
   * Finds the default shell.
   * @param environment The environment the shell will start with, which is also where it is looked for.
   * @returns The shell.
   * @throws ServiceException when no shell can be found.
   */
  findDefault(environment: ShellEnvironment): Shell;
}

/**
 * An environment variable read from the Windows registry, before any `%NAME%` reference in it is expanded.
 */
export declare class RegistryVariable {
  /**
   * Where the variable is defined.
   */
  public readonly scope: RegistryScope;
  /**
   * The variable's name, spelled as in the registry.
   */
  public readonly name: string;
  /**
   * The variable's value as stored.
   */
  public readonly value: string;
  /**
   * Whether `%NAME%` references in the value name other variables to expand.
   */
  public readonly isExpandable: boolean;

  /**
   * Initializes the variable.
   * @param scope Where the variable is defined.
   * @param name The name; must not be blank.
   * @param value The value as stored; may be empty.
   * @param isExpandable Whether the value is stored as an expandable string.
   * @throws ArgumentException when the name is blank.
   */
  public constructor(scope: RegistryScope, name: string, value: string, isExpandable: boolean);
}

/**
 * A shell a terminal can start: its display name and how to run it.
 */
export declare class Shell {
  /**
   * The display name, such as `PowerShell` or `zsh`.
   */
  public readonly name: string;
  /**
   * The executable's path.
   */
  public readonly executable: string;
  /**
   * The arguments, copied on construction.
   */
  public readonly arguments: readonly string[];

  /**
   * Initializes the shell.
   * @param name The display name; must not be blank.
   * @param executable The executable's path; must not be blank.
   * @param args The arguments; copied.
   * @throws ArgumentException when the name or the executable is blank.
   */
  public constructor(name: string, executable: string, args: readonly string[]);
}

/**
 * The environment variables a shell starts with. On Windows names ignore case, so each name appears once, spelled as
 * it was last set.
 */
export declare class ShellEnvironment {
  /**
   * Initializes an empty environment.
   * @param ignoresCase Whether names ignore case, as on Windows.
   */
  public constructor(ignoresCase: boolean);

  /**
   * Reads a variable.
   * @param name The name.
   * @returns The value, or `undefined` when the variable is not set.
   */
  public get(name: string): string | undefined;

  /**
   * Sets a variable, replacing any variable with the same name.
   * @param name The name.
   * @param value The value.
   */
  public set(name: string, value: string): void;

  /**
   * Removes a variable when it is set.
   * @param name The name.
   */
  public delete(name: string): void;

  /**
   * Renders the variables for starting a process.
   * @returns A new object with one property per variable.
   */
  public toRecord(): Record<string, string>;
}

/**
 * How terminals behave on the runtime's platform: the Windows build the emulator adapts to, how a shell is ended, and
 * how much unprocessed output pauses a shell.
 */
export declare class TerminalSettings {
  /**
   * The Windows build number, or `null` on other platforms.
   */
  public readonly windowsBuild: number | null;
  /**
   * The signal sent when a shell does not end after being asked; `undefined` on Windows, where ending a
   * pseudo-terminal already ends its processes.
   */
  public readonly forceSignal: string | undefined;
  /**
   * How long to wait for a shell to end after each attempt, in milliseconds.
   */
  public readonly endMilliseconds: number;
  /**
   * The waiting output above which the shell is paused: characters the emulator has not processed, bytes waiting to
   * be stored and characters sent to the owner that it has not acknowledged.
   */
  public readonly highWatermark: number;
  /**
   * The waiting output at or below which a paused shell continues.
   */
  public readonly lowWatermark: number;

  /**
   * Initializes the settings.
   * @param windowsBuild The Windows build number, or `null`.
   * @param forceSignal The signal that forces a shell to end, or `undefined`.
   * @param endMilliseconds How long to wait for a shell to end after each attempt; a positive integer.
   * @param highWatermark The waiting output that pauses a shell; a positive integer.
   * @param lowWatermark The waiting output that lets a paused shell continue; a non-negative integer below
   * `highWatermark`.
   * @throws ArgumentOutOfRangeException when a number is out of range.
   */
  public constructor(windowsBuild: number | null, forceSignal: string | undefined, endMilliseconds: number, highWatermark: number, lowWatermark: number);

  /**
   * Chooses the settings for a platform.
   * @param platform The platform, as `process.platform`.
   * @param release The operating system release, as `os.release()`; on Windows its third part is the build number.
   * @returns The settings, with two-second end attempts and a 1 MiB to 256 KiB pause range.
   */
  public static forPlatform(platform: string, release: string): TerminalSettings;
}

/**
 * Finds the default shell: PowerShell 7 on Windows, or Windows PowerShell when it is absent, and elsewhere the
 * person's login shell, started as a login shell so it reads their profile.
 */
export declare class ShellLocator implements IShellLocator {
  /**
   * Initializes the locator.
   * @param platform The platform, as `process.platform`.
   * @param userShell Reads the person's login shell from the system, or `null` when none is recorded; a failure counts
   * as none.
   * @param exists Tells whether a file exists.
   */
  public constructor(platform: string, userShell: () => string | null, exists: (path: string) => boolean);

  /**
   * Creates the locator for a platform, reading the login shell from the system's user record. A file counts as
   * present when the file system lists it, so a Microsoft Store app execution alias for PowerShell 7 counts although
   * it cannot be opened as a file; a path that cannot be inspected counts as absent.
   * @param platform The platform, as `process.platform`.
   * @returns The locator.
   */
  public static fromPlatform(platform: string): ShellLocator;

  /**
   * Finds the default shell. On Windows it looks for `pwsh.exe` in `Path`, in `%ProgramFiles%\PowerShell\7` and among
   * the Microsoft Store's aliases in `%LOCALAPPDATA%\Microsoft\WindowsApps`, and otherwise uses Windows PowerShell
   * under `%SystemRoot%`. Elsewhere it uses the login shell, then `SHELL`, then `/bin/sh`, with the `-l` argument.
   * @param environment The environment the shell will start with.
   * @returns The shell.
   * @throws ServiceException `Unavailable` on Windows when neither PowerShell 7 nor `SystemRoot` is found.
   */
  public findDefault(environment: ShellEnvironment): Shell;
}

/**
 * Reads the Windows machine, user and sign-in session environment variables from the registry through Windows
 * PowerShell, without expanding them, so a new shell sees variables set after TeamRun started.
 */
export declare class WindowsEnvironmentReader {
  /**
   * Initializes the reader.
   * @param command The command that prints the variables.
   * @param runner Runs the command.
   * @param timeoutMilliseconds How long the command may run; a positive integer.
   */
  public constructor(command: ProcessCommand, runner: CommandRunner, timeoutMilliseconds: number);

  /**
   * Creates the reader that runs Windows PowerShell from the Windows folder with a 20-second deadline.
   * @param systemRoot The Windows folder, from `SystemRoot`.
   * @param runner Runs the command.
   * @returns The reader.
   */
  public static forSystemRoot(systemRoot: string, runner: CommandRunner): WindowsEnvironmentReader;

  /**
   * Reads the variables. The command prints one line per string variable, its scope, its kind and its base64-encoded
   * UTF-8 name and value separated by spaces, and then `End`.
   * @param environment The environment to run the command with.
   * @returns The machine, user and session variables, in the order printed.
   * @throws ServiceException `Unavailable` (as a rejected promise) when the command cannot start, times out, fails or
   * prints output that cannot be read.
   */
  public read(environment: NodeJS.ProcessEnv): Promise<readonly RegistryVariable[]>;
}

/**
 * Builds the environment a new or restarted shell starts with. It starts from the runtime's environment without the
 * variables that TeamRun's own launch added, restores `XDG_CURRENT_DESKTOP` when Electron replaced it, and on Windows
 * adds the machine, then the user and then the sign-in session variables read from the registry, as Windows does,
 * expanding `%NAME%` references and joining the machine and user `Path`. It sets `COLORTERM=truecolor`, `TERM=xterm-256color` outside Windows, and on macOS, when no
 * locale variable is set, `LANG` for the system locale or `LC_CTYPE=UTF-8` when the locale has no region.
 */
export declare class TerminalEnvironment {
  /**
   * Initializes the builder.
   * @param platform The platform, as `process.platform`.
   * @param base The runtime's environment.
   * @param registry Reads the Windows registry variables, or `null` to add none.
   * @param locale The system locale as a BCP 47 tag, used on macOS.
   */
  public constructor(platform: string, base: NodeJS.ProcessEnv, registry: WindowsEnvironmentReader | null, locale: string);

  /**
   * Creates the builder for a platform, reading the registry only on Windows.
   * @param platform The platform, as `process.platform`.
   * @param base The runtime's environment.
   * @param locale The system locale as a BCP 47 tag.
   * @returns The builder.
   * @throws ServiceException `Unavailable` on Windows when `SystemRoot` is not set.
   */
  public static forPlatform(platform: string, base: NodeJS.ProcessEnv, locale: string): TerminalEnvironment;

  /**
   * Builds a fresh environment.
   * @returns The environment; each call reads the registry again on Windows.
   * @throws ServiceException `Unavailable` (as a rejected promise) when the registry cannot be read.
   */
  public create(): Promise<ShellEnvironment>;
}

/**
 * The pseudo-terminal a shell runs in, behind which `node-pty` stays: it passes input, size and flow control to the
 * shell, reports output and the shell's end, and ends the shell on request. When a shell ends by itself, it still asks
 * `node-pty` to end it, which closes the shell's input, and on Windows it releases the thread `node-pty` keeps reading
 * the pseudo-console's output. `node-pty` offers no public way to release that thread and otherwise keeps it until more
 * output arrives, which never happens after an exit (microsoft/node-pty#887); reaching it is the exception the coding
 * standards record.
 */
export declare class PseudoTerminal {
  /**
   * Wraps a started pseudo-terminal and listens to it until the shell ends.
   * @param pty The `node-pty` pseudo-terminal.
   * @param listener Receives output and the shell's end.
   * @param forceSignal The signal that forces the shell to end when asking does not, or `undefined` to ask again.
   * @param graceMilliseconds How long to wait for the shell to end after each attempt.
   */
  public constructor(pty: IPty, listener: IPseudoTerminalListener, forceSignal: string | undefined, graceMilliseconds: number);

  /**
   * Starts a shell in a pseudo-terminal. On Windows the shell runs in the pseudo-console that `node-pty` ships,
   * Microsoft's `conpty.dll` with `OpenConsole.exe`, rather than the one built into Windows.
   * @param shell The shell.
   * @param directory The folder the shell starts in.
   * @param environment The shell's environment.
   * @param size The pseudo-terminal's size.
   * @param listener Receives output and the shell's end.
   * @param forceSignal The signal that forces the shell to end, or `undefined`.
   * @param graceMilliseconds How long to wait for the shell to end after each attempt.
   * @returns The pseudo-terminal.
   * @throws Error when `node-pty` cannot start the process; on Windows a failed start is reported as an exit.
   */
  public static start(
    shell: Shell,
    directory: string,
    environment: ShellEnvironment,
    size: TerminalSize,
    listener: IPseudoTerminalListener,
    forceSignal: string | undefined,
    graceMilliseconds: number): PseudoTerminal;

  /**
   * Whether the shell has ended.
   */
  public get hasExited(): boolean;

  /**
   * Sends input to the shell.
   * @param data The input.
   */
  public write(data: string): void;

  /**
   * Resizes the pseudo-terminal.
   * @param size The new size.
   */
  public resize(size: TerminalSize): void;

  /**
   * Stops reading output, so a shell that keeps printing waits.
   */
  public pause(): void;

  /**
   * Reads output again after `pause`.
   */
  public resume(): void;

  /**
   * Ends the shell: asks it to end (a hangup outside Windows), waits, then forces it and waits again. It reads the
   * output again first, because the Windows pseudo-console cannot end a shell while its output waits to be read.
   * @returns A promise that settles when the shell has ended or the second wait has passed; `hasExited` tells which.
   */
  public end(): Promise<void>;
}

/**
 * Reads a line of the headless emulator's buffer as a stored `TerminalLine`: its text, whether it continues the line
 * before, and its styles.
 */
export declare class TerminalLineReader {
  /**
   * Initializes the reader.
   * @param cell A cell of the emulator's buffer that the reader reuses for every cell it reads.
   */
  public constructor(cell: IBufferCell);

  /**
   * Reads a line. Trailing blanks without a background color, inverse video or a line are left out, unless the next
   * line continues this one.
   * @param line The buffer line.
   * @param isContinued Whether the next line continues this one.
   * @returns The stored line.
   */
  public read(line: IBufferLine, isContinued: boolean): TerminalLine;
}

/**
 * A terminal's stored lines, in a file of the runtime's data directory, written without blocking the runtime. Line
 * numbers keep counting after the lines are cleared. The file is created with the first line and deleted by `close`.
 */
export declare class TerminalHistory {
  /**
   * Initializes the history without creating its file.
   * @param path The file's path.
   * @param onWritten Called after each write finishes, when `backlog` has shrunk.
   */
  public constructor(path: string, onWritten: () => void);

  /**
   * The lines stored so far.
   */
  public get stored(): TerminalLineRange;

  /**
   * The bytes of stored lines not yet written to the file.
   */
  public get backlog(): number;

  /**
   * Stores a line; nothing is stored after a write has failed.
   * @param line The line.
   */
  public append(line: TerminalLine): void;

  /**
   * Forgets every stored line, as clearing a terminal does.
   */
  public clear(): void;

  /**
   * Reads a page of stored lines once the lines stored before it are written.
   * @param start The number of the first line to read; lines already cleared are skipped.
   * @param limit How many lines at most.
   * @returns The page.
   * @throws ServiceException `Unavailable` (as a rejected promise) when a write failed, or `Internal` when the file
   * is damaged.
   */
  public read(start: number, limit: number): Promise<TerminalLinePage>;

  /**
   * Discards lines not yet written, then closes and deletes the file.
   * @returns A promise that settles when the file is gone.
   * @throws Error (as a rejected promise) when the file cannot be closed or deleted.
   */
  public close(): Promise<void>;
}

/**
 * The runtime's copy of a terminal's screen, drawn by `@xterm/headless`. Recent rows remain available for reflow;
 * rows leaving that bounded buffer are stored in history. Erasing saved lines or a full reset clears the history, and the alternate
 * screen of full-screen programs is not stored. It answers the primary device attributes query, which the Windows
 * pseudo-console asks when it starts and waits for, so the answer never depends on a window being attached; on
 * Windows it also rewraps the line holding the cursor when the width changes, so a resize keeps the prompt.
 */
export declare class TerminalEmulator implements Disposable {
  /**
   * Initializes an empty screen.
   * @param size The screen's size.
   * @param history Receives the rows that leave the retained buffer.
   * @param windowsBuild The Windows build the pseudo-terminal runs on, or `null` elsewhere.
   * @param answer Sends the emulator's answers to the shell.
   */
  public constructor(size: TerminalSize, history: TerminalHistory, windowsBuild: number | null, answer: (data: string) => void);

  /**
   * The screen's size.
   */
  public get size(): TerminalSize;

  /**
   * The characters written but not yet processed.
   */
  public get backlog(): number;

  /**
   * Processes output after the output written before it.
   * @param data The output.
   * @param parsed Called once the output has been processed.
   */
  public write(data: string, parsed: () => void): void;

  /**
   * Runs an action once everything written so far has been processed.
   * @param action The action.
   */
  public afterWrites(action: () => void): void;

  /**
   * Resizes the screen now, reflowing its retained rows and storing any rows beyond the retention limit.
   * @param size The new size.
   */
  public resize(size: TerminalSize): void;

  /**
   * Serializes the retained rows, screen, cursor and modes programs set, including an active alternate screen.
   * @returns Terminal output that restores the buffer in an emulator of the same size and scrollback capacity.
   */
  public screen(): string;

  /**
   * Stores retained rows and the screen's lines up to the cursor or the last line with text, whichever is lower, as a restart does
   * before the new shell starts on an empty screen.
   */
  public storeScreen(): void;

  /**
   * Releases the emulator.
   */
  public [Symbol.dispose](): void;
}

/**
 * One terminal: the shell in its pseudo-terminal, the runtime's copy of its screen and its stored lines. It sends the
 * processed output and its changes to its owner as `TerminalOutput` and `TerminalChanged` events, in the order they
 * happened, and pauses the shell while too much output waits to be processed or stored.
 */
export declare class HostedTerminal implements IPseudoTerminalListener {
  /**
   * The terminal id.
   */
  public readonly id: string;
  /**
   * The connection the terminal belongs to.
   */
  public readonly owner: ITerminalOwner;

  /**
   * Starts a shell in a new terminal.
   * @param id The terminal id.
   * @param owner The connection the terminal belongs to.
   * @param projectId The id of the project whose folder the shell starts in, or `null` when it starts in the home folder.
   * @param folder The folder the shell starts in.
   * @param shell The shell.
   * @param environment The shell's environment.
   * @param size The terminal's size.
   * @param historyPath The file for the stored lines.
   * @param settings The platform's terminal settings.
   * @returns The terminal; a shell whose executable cannot run ends at once with an exit code.
   * @throws Error when `node-pty` cannot start the pseudo-terminal.
   */
  public static start(
    id: string,
    owner: ITerminalOwner,
    projectId: string | null,
    folder: string,
    shell: Shell,
    environment: ShellEnvironment,
    size: TerminalSize,
    historyPath: string,
    settings: TerminalSettings): HostedTerminal;

  /**
   * The terminal's state as of the last event sent.
   */
  public get state(): TerminalState;

  /**
   * Sends input to the shell.
   * @param data The input.
   * @throws ServiceException `Conflict` when the shell is not running.
   */
  public input(data: string): void;

  /**
   * Resizes the pseudo-terminal now and the screen after the output already received, then sends `TerminalChanged`;
   * the current size does nothing.
   * @param size The new size.
   */
  public resize(size: TerminalSize): void;

  /**
   * Sends the processed output, then reads the screen. The owner starts again from this screen, so all output sent
   * before it counts as acknowledged.
   * @returns The state and the screen, which match each other.
   */
  public screen(): TerminalScreen;

  /**
   * Records that the owner processed output it was sent, which lets a shell paused for unacknowledged output continue.
   * @param characters How many characters of output the owner processed; an acknowledgement never counts more than
   * the output still unacknowledged.
   */
  public acknowledge(characters: number): void;

  /**
   * Reads a page of stored lines.
   * @param start The number of the first line.
   * @param limit How many lines at most.
   * @returns The page.
   * @throws ServiceException (as a rejected promise) when the lines cannot be read.
   */
  public lines(start: number, limit: number): Promise<TerminalLinePage>;

  /**
   * Ends the running shell, moves the screen into the stored lines and starts the same shell again, after any earlier
   * restart or close; the old shell's end is reported first.
   * @param environment The new shell's environment.
   * @returns A promise that settles once the new shell runs and `TerminalChanged` was sent.
   * @throws ServiceException (as a rejected promise) `NotFound` after the terminal closed, or Error when `node-pty`
   * cannot start the pseudo-terminal.
   */
  public restart(environment: ShellEnvironment): Promise<void>;

  /**
   * Ends the shell, releases the screen and deletes the stored lines, after any earlier restart.
   * @returns A promise that settles when the terminal is gone.
   * @throws Error (as a rejected promise) when the stored lines cannot be deleted.
   */
  public close(): Promise<void>;

  /**
   * Processes the running shell's output; output of a shell that was replaced or closed is ignored.
   * @param source The pseudo-terminal.
   * @param data The output.
   */
  public onData(source: PseudoTerminal, data: string): void;

  /**
   * Records the running shell's end once its output is processed, and sends `TerminalChanged`.
   * @param source The pseudo-terminal.
   * @param exitCode The exit code.
   */
  public onExit(source: PseudoTerminal, exitCode: number): void;
}

/**
 * The runtime's terminals. A terminal belongs to the connection that opened it: only that connection lists it,
 * receives its events and can use it, and the terminal ends when the connection closes.
 */
export declare class TerminalHost {
  /**
   * Initializes the host.
   * @param projects Finds the project a terminal opens in.
   * @param home The person's home folder, where a terminal without a project opens.
   * @param directory The folder for the stored lines.
   * @param shells Finds the shell a new terminal starts.
   * @param environment Builds each shell's environment.
   * @param settings The platform's terminal settings.
   */
  public constructor(projects: IProjectsService, home: string, directory: string, shells: IShellLocator, environment: TerminalEnvironment,
    settings: TerminalSettings);

  /**
   * Empties the folder for stored lines, removing what a runtime that did not stop cleanly left behind.
   * @throws Error when the folder cannot be emptied or created.
   */
  public prepare(): void;

  /**
   * Tells whether a method is a terminal method.
   * @param method The method.
   * @returns Whether `dispatch` answers it.
   */
  public handles(method: string): boolean;

  /**
   * Answers a terminal request from a connection; never throws.
   * @param owner The connection that sent the request.
   * @param request The request.
   * @returns The response: `NotFound` for a terminal of another connection, `UnknownMethod` for a method that is not a
   * terminal method.
   */
  public dispatch(owner: ITerminalOwner, request: Request): Promise<Response>;

  /**
   * Ends every terminal of a connection that closed, without waiting.
   * @param owner The connection.
   */
  public endOwnedBy(owner: ITerminalOwner): void;

  /**
   * Refuses new terminals, ends every terminal and waits for terminals that are opening or closing.
   * @returns A promise that settles when every terminal has ended.
   */
  public shutdown(): Promise<void>;
}
