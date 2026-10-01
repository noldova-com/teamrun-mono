/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcess } from "node:child_process";

import type { AccountInfo, Options, PermissionMode, PermissionResult, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type {
  ApprovalAsk,
  ForkRequest,
  IProviderAdapter,
  ITurnListener,
  SignInCheck,
  TurnDetail,
  TurnOutcome,
  TurnRequest,
  TurnResult
} from "@noldova/teamrun-core";
import type { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/teamrun-foundation-json";
import type { DetailKind, ObservedSettings, ProviderAccount, ProviderAccountIdentity, ProviderDescriptor, ProviderModel } from "@noldova/teamrun-protocol";

/**
 * Where an executable was found.
 */
export declare enum ExecutableSource {
  /**
   * An explicit path the user configured.
   */
  Override = "Override",
  /**
   * The native binary inside a global npm installation.
   */
  GlobalNpm = "GlobalNpm",
  /**
   * The user's `~/.local/bin` directory.
   */
  LocalBin = "LocalBin",
  /**
   * A directory on `PATH`.
   */
  Path = "Path",
}

/**
 * A JSON-RPC error answered by the Codex app-server.
 */
export declare class AppServerException extends Exception {
  /**
   * The method whose request failed.
   */
  public readonly method: string;
  /**
   * The error the server returned.
   */
  public readonly error: JsonRpcError;

  /**
   * Initializes the exception with the message `<method>: <message> (code <code>)`.
   * @param method The method whose request failed.
   * @param error The error the server returned.
   */
  public constructor(method: string, error: JsonRpcError);
}

/**
 * The Codex app-server is not running, did not answer in time, or exited.
 */
export declare class AppServerUnavailableException extends Exception {
  /**
   * Initializes the exception.
   * @param message What happened.
   */
  public constructor(message: string);
}

/**
 * A provider executable was not found on this machine.
 */
export declare class ExecutableNotFoundException extends Exception {
  /**
   * Initializes the exception.
   * @param message Which executable is missing and how to install it.
   */
  public constructor(message: string);
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
 * A server-initiated request TeamRun does not answer; the provider treats the error as a decline.
 */
export declare class UnsupportedServerRequestException extends Exception {
  /**
   * The unsupported method.
   */
  public readonly method: string;

  /**
   * Initializes the exception.
   * @param method The unsupported method.
   */
  public constructor(method: string);
}

/**
 * One Claude Code session started through the Agent SDK: the message stream plus its controls.
 */
export interface IClaudeQuery extends AsyncIterable<SDKMessage> {
  /**
   * Asks Claude Code to stop the current turn.
   * @returns Resolves when the interrupt was delivered.
   */
  interrupt(): Promise<unknown>;

  /**
   * Reads the signed-in account's details as Claude Code reports them.
   * @returns The account details.
   */
  accountInfo(): Promise<AccountInfo>;

  /**
   * Reads model metadata without a user prompt.
   */
  supportedModels(): Promise<import("@anthropic-ai/claude-agent-sdk").ModelInfo[]>;

  /**
   * Ends the session and its process.
   */
  close(): void;
}

/**
 * Starts Claude Code sessions; the real factory wraps the Agent SDK, tests use a scripted one.
 */
export interface IClaudeQueryFactory {
  /**
   * Starts a session.
   * @param prompt The user's message.
   * @param options The Agent SDK options.
   * @returns The session.
   */
  start(prompt: string | AsyncIterable<SDKUserMessage>, options: Options): IClaudeQuery;
}

/**
 * Receives the exit of a Codex app-server process.
 */
/**
 * Records the provider processes an adapter starts, so that a later runtime can end the ones a dead runtime left behind.
 */
export interface IProcessTracker {
  /**
   * Records a started process.
   * @param processId The process id; 0 (the spawn failed) is ignored.
   * @param executable The executable the process runs.
   */
  track(processId: number, executable: string): void;

  /**
   * Forgets a process that ended.
   * @param processId The process id.
   */
  untrack(processId: number): void;
}

export interface IExitHandler {
  /**
   * Handles the exit.
   * @param exit How the process ended.
   */
  handleExit(exit: ProcessExit): void;
}

/**
 * Receives notifications from a Codex app-server.
 */
export interface INotificationHandler {
  /**
   * Handles one notification.
   * @param method The notification's method.
   * @param params The notification's parameters, an empty object when absent.
   */
  handleNotification(method: string, params: JsonReader): void;
}

/**
 * Answers requests the Codex app-server sends to its client, such as approvals.
 */
export interface IServerRequestHandler {
  /**
   * Answers one request.
   * @param method The request's method.
   * @param params The request's parameters, an empty object when absent.
   * @returns The result to send back.
   * @throws UnsupportedServerRequestException when TeamRun does not answer the method; the
   * server receives an error response.
   */
  handleServerRequest(method: string, params: JsonReader): Promise<JsonValue>;
}

/**
 * How the client introduces itself to the Codex app-server.
 */
export declare class AppServerClientInfo {
  /**
   * The client's name, recorded by Codex.
   */
  public readonly name: string;
  /**
   * The client's display title.
   */
  public readonly title: string;
  /**
   * The client's version.
   */
  public readonly version: string;

  /**
   * Initializes the info.
   * @param name The client's name.
   * @param title The client's display title.
   * @param version The client's version.
   * @throws ArgumentException when a value is blank.
   */
  public constructor(name: string, title: string, version: string);

  /**
   * Serializes the info as the `clientInfo` parameter of `initialize`.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * What the Codex app-server answered to `initialize`.
 */
export declare class AppServerInitialization {
  /**
   * The server's user agent, such as `codex-cli/0.153.4 (Windows)`.
   */
  public readonly userAgent: string;
  /**
   * The version parsed from the user agent, or `null` when it carries none.
   */
  public readonly version: string | null;

  /**
   * Initializes the result.
   * @param userAgent The server's user agent.
   * @throws ArgumentException when the user agent is blank.
   */
  public constructor(userAgent: string);

  /**
   * Reads the result from JSON.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The result.
   * @throws JsonException when the user agent is missing or blank.
   */
  public static fromJson(value: unknown, path?: string): AppServerInitialization;
}

/**
 * Text accumulated up to a maximum length; later chunks are dropped.
 */
export declare class BoundedOutput {
  /**
   * Initializes the output.
   * @param maximumLength The maximum number of characters kept.
   * @throws ArgumentOutOfRangeException when the maximum is not a positive integer.
   */
  public constructor(maximumLength: number);

  /**
   * Whether the maximum was reached.
   */
  public get isFull(): boolean;

  /**
   * Appends a chunk, keeping only what fits.
   * @param chunk The chunk.
   */
  public append(chunk: string): void;

  /**
   * Returns the accumulated text.
   * @returns The text.
   */
  public toString(): string;
}

/**
 * A running Claude Code session with the controls needed to stop it.
 */
export declare class ClaudeRun {
  /**
   * Initializes the run.
   * @param query The session.
   * @param abort The controller that ends the session's process.
   */
  public constructor(query: IClaudeQuery, abort: AbortController);

  /**
   * Interrupts the session, tolerating a session that no longer answers, then aborts it.
   */
  public stop(): Promise<void>;

  /**
   * Closes the session, tolerating one that already ended.
   */
  public close(): void;
}

/**
 * The account the Codex app-server reports through `account/read`.
 */
export declare class CodexAccount {
  /**
   * The account type, such as `chatgpt` or `apiKey`.
   */
  public readonly type: string;
  /**
   * The email of a ChatGPT account, when reported.
   */
  public readonly email: string | null;
  /**
   * The plan of a ChatGPT account, when reported.
   */
  public readonly planType: string | null;

  /**
   * Initializes the account.
   * @param type The account type.
   * @param email The email, when reported.
   * @param planType The plan, when reported.
   */
  public constructor(type: string, email: string | null, planType: string | null);

  /**
   * Reads the `account/read` result.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The account, or `null` when nobody is signed in.
   * @throws JsonException when the result has no `account` field.
   */
  public static fromJson(value: unknown, path?: string): CodexAccount | null;

  /**
   * Converts the account to the protocol's identity, with the type as the auth method.
   * @returns The identity.
   */
  public toIdentity(): ProviderAccountIdentity;
}

/**
 * How a command run to completion ended.
 */
export declare class CommandResult {
  /**
   * The exit code, or `null` when a signal ended the process.
   */
  public readonly exitCode: number | null;
  /**
   * The signal that ended the process, or `null`.
   */
  public readonly signal: string | null;
  /**
   * The captured standard output, bounded.
   */
  public readonly stdout: string;
  /**
   * The captured standard error, bounded.
   */
  public readonly stderr: string;
  /**
   * Whether the command was terminated because it exceeded its timeout.
   */
  public readonly timedOut: boolean;

  /**
   * Initializes the result.
   * @param exitCode The exit code, or `null`.
   * @param signal The signal, or `null`.
   * @param stdout The standard output.
   * @param stderr The standard error.
   * @param timedOut Whether the command timed out.
   */
  public constructor(exitCode: number | null, signal: string | null, stdout: string, stderr: string, timedOut: boolean);

  /**
   * Whether the command exited with code zero without timing out.
   */
  public get succeeded(): boolean;

  /**
   * The trimmed standard output, or the trimmed standard error when the output is blank.
   */
  public get output(): string;
}

/**
 * A handler registered in a set; disposing removes it.
 * @template T The handler type.
 */
export declare class HandlerSubscription<T> implements Disposable {
  /**
   * Initializes the subscription.
   * @param handlers The set holding the handler.
   * @param handler The handler.
   */
  public constructor(handlers: Set<T>, handler: T);

  /**
   * Whether the handler is still registered.
   */
  public get isActive(): boolean;

  /**
   * Removes the handler.
   */
  public [Symbol.dispose](): void;
}

/**
 * A JSON-RPC error object.
 */
export declare class JsonRpcError {
  /**
   * The error code.
   */
  public readonly code: number;
  /**
   * The error message.
   */
  public readonly message: string;
  /**
   * Additional data, or `null`.
   */
  public readonly data: JsonValue;

  /**
   * Initializes the error.
   * @param code The error code.
   * @param message The error message.
   * @param data Additional data, or `null`.
   */
  public constructor(code: number, message: string, data: JsonValue);

  /**
   * Reads an error from JSON; a missing `data` field reads as `null`.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The error.
   * @throws JsonException when `code` or `message` is missing or of the wrong type.
   */
  public static fromJson(value: unknown, path?: string): JsonRpcError;

  /**
   * Serializes the error.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A provider executable and where it was found.
 */
export declare class LocatedExecutable {
  /**
   * The executable's path.
   */
  public readonly path: string;
  /**
   * Where it was found.
   */
  public readonly source: ExecutableSource;

  /**
   * Initializes the executable.
   * @param path The executable's path.
   * @param source Where it was found.
   * @throws ArgumentException when the path is blank.
   */
  public constructor(path: string, source: ExecutableSource);

  /**
   * Returns the command that runs the executable without arguments.
   * @returns The command.
   */
  public toCommand(): ProcessCommand;
}

/**
 * A request awaiting the Codex app-server's response.
 */
export declare class PendingRequest {
  /**
   * The request's method.
   */
  public readonly method: string;

  /**
   * Initializes the request.
   * @param method The request's method.
   * @param resolvers The promise resolvers the caller awaits.
   * @param timer The timeout timer, cleared when the request settles.
   */
  public constructor(method: string, resolvers: PromiseWithResolvers<JsonValue>, timer: NodeJS.Timeout | null);

  /**
   * Resolves the request.
   * @param value The result.
   */
  public complete(value: JsonValue): void;

  /**
   * Rejects the request.
   * @param error The failure.
   */
  public fail(error: Error): void;
}

/**
 * An executable and the arguments that precede any operation-specific ones.
 */
export declare class ProcessCommand {
  /**
   * The executable's path.
   */
  public readonly executable: string;
  /**
   * The leading arguments, copied.
   */
  public readonly arguments: readonly string[];

  /**
   * Initializes the command.
   * @param executable The executable's path.
   * @param args The leading arguments.
   * @throws ArgumentException when the executable is blank.
   */
  public constructor(executable: string, args: readonly string[]);

  /**
   * Returns a command with more arguments appended.
   * @param args The arguments to append.
   * @returns The new command.
   */
  public withArguments(...args: readonly string[]): ProcessCommand;
}

/**
 * How a process ended.
 */
export declare class ProcessExit {
  /**
   * The exit code, or `null` when a signal ended the process or it never started.
   */
  public readonly code: number | null;
  /**
   * The signal, or `null`.
   */
  public readonly signal: string | null;

  /**
   * Initializes the exit.
   * @param code The exit code, or `null`.
   * @param signal The signal, or `null`.
   */
  public constructor(code: number | null, signal: string | null);
}

/**
 * The timeouts and grace periods the adapters use, in milliseconds.
 */
/**
 * Turns a provider's text deltas into growing details: the text of each item accumulates and is
 * reported at most once per interval under the item's id, so the engine updates one detail instead
 * of appending fragments.
 */
export declare class DeltaStream {
  /**
   * Initializes the stream.
   * @param listener Receives the accumulated details.
   * @param interval The longest wait between reports, in milliseconds.
   * @throws ArgumentOutOfRangeException when the interval is not a positive integer.
   */
  public constructor(listener: ITurnListener, interval: number);

  /**
   * Whether accumulated text is waiting to be reported.
   */
  public get isPending(): boolean;

  /**
   * Adds a delta to an item's text and schedules a report.
   * @param id The provider's item id.
   * @param kind The detail kind of the item.
   * @param delta The text to add.
   */
  public append(id: string, kind: DetailKind, delta: string): void;

  /**
   * Reports every pending item now.
   */
  public flush(): void;

  /**
   * Drops an item's accumulated text.
   * @param id The provider's item id.
   */
  public forget(id: string): void;
}

export declare class ProviderTimings {
  /**
   * How long `--version` may take.
   */
  public readonly versionTimeout: number;
  /**
   * How long a sign-in check command may take.
   */
  public readonly signInCheckTimeout: number;
  /**
   * How long the Codex app-server may take to answer `initialize`.
   */
  public readonly initializeTimeout: number;
  /**
   * How long any other Codex request may take.
   */
  public readonly requestTimeout: number;
  /**
   * How long `turn/interrupt` may take.
   */
  public readonly interruptTimeout: number;
  /**
   * How long an aborted Codex turn may keep running before it is reported as interrupted anyway.
   */
  public readonly interruptGrace: number;
  /**
   * How long a Codex app-server may take to exit after its input closes before it is terminated.
   */
  public readonly stopGrace: number;
  /**
   * How long an aborted Claude Code turn may take to stop before its process is aborted.
   */
  public readonly abortGrace: number;
  /**
   * How often, at most, a streamed text is reported while it grows.
   */
  public readonly streamInterval: number;
  /**
   * Milliseconds between the tries of a busy thread's resume.
   */
  public readonly resumeRetryDelay: number;

  /**
   * Initializes the timings.
   * @param versionTimeout How long `--version` may take.
   * @param signInCheckTimeout How long a sign-in check may take.
   * @param initializeTimeout How long `initialize` may take.
   * @param requestTimeout How long other requests may take.
   * @param interruptTimeout How long `turn/interrupt` may take.
   * @param interruptGrace The grace after an abort before a Codex turn is given up.
   * @param stopGrace The grace before a stopping app-server is terminated.
   * @param abortGrace The grace after an abort before a Claude Code process is aborted.
   * @param streamInterval How often, at most, a streamed text is reported while it grows.
   * @param resumeRetryDelay Milliseconds between the tries of a busy thread's resume.
   * @throws ArgumentOutOfRangeException when a value is not a positive integer.
   */
  public constructor(versionTimeout: number, signInCheckTimeout: number, initializeTimeout: number, requestTimeout: number, interruptTimeout: number, interruptGrace: number, stopGrace: number, abortGrace: number, streamInterval: number, resumeRetryDelay: number);

  /**
   * Returns the production timings.
   * @returns The timings.
   */
  public static createDefault(): ProviderTimings;
}

/**
 * The last chunks of a stream, up to a maximum count.
 */
export declare class TailBuffer {
  /**
   * Initializes the buffer.
   * @param maximumCount The maximum number of chunks kept.
   * @throws ArgumentOutOfRangeException when the maximum is not a positive integer.
   */
  public constructor(maximumCount: number);

  /**
   * Whether nothing was pushed yet.
   */
  public get isEmpty(): boolean;

  /**
   * Pushes a chunk, dropping the oldest when the maximum is exceeded.
   * @param chunk The chunk.
   */
  public push(chunk: string): void;

  /**
   * Returns the kept chunks joined.
   * @returns The text.
   */
  public toString(): string;
}

/**
 * What the Codex app-server answered to `thread/start` or `thread/resume`.
 */
export declare class ThreadStartResult {
  /**
   * The thread id, TeamRun's native session id for Codex.
   */
  public readonly threadId: string;
  /**
   * The model the thread uses.
   */
  public readonly model: string;
  /**
   * The thread's reasoning effort, or `null` when Codex reports none.
   */
  public readonly reasoningEffort: string | null;

  /**
   * Initializes the result.
   * @param threadId The thread id.
   * @param model The model.
   * @param reasoningEffort The reasoning effort, or `null`.
   * @throws ArgumentException when the thread id or model is blank.
   */
  public constructor(threadId: string, model: string, reasoningEffort: string | null);

  /**
   * Reads the result from JSON.
   * @param value The JSON value.
   * @param path The value's path for error messages.
   * @returns The result.
   * @throws JsonException when `thread.id` or `model` is missing or blank.
   */
  public static fromJson(value: unknown, path?: string): ThreadStartResult;
}

/**
 * The package's literals: names, arguments, fields, methods, limits, timings, and messages.
 */
export declare class Resources {
  public static readonly grokBase64Encoding: BufferEncoding;
  public static readonly grokExecutableName: string;
  public static readonly grokWindowsExecutableName: string;
  public static readonly grokDirectoryName: string;
  public static readonly sessionIdField: string;
  public static readonly nameField: string;
  public static readonly titleField: string;
  public static readonly optionsField: string;
  public static readonly contentField: string;
  public static readonly grokNotFound: string;
  public static readonly grokImagesUnavailable: string;
  public static readonly grokAgentArguments: readonly string[];
  public static readonly grokStdioArguments: readonly string[];
  public static readonly grokModelArgument: string;
  public static readonly grokEffortArgument: string;
  public static readonly grokInitialize: string;
  public static readonly grokAuthenticate: string;
  public static readonly grokSessionNew: string;
  public static readonly grokSessionLoad: string;
  public static readonly grokSessionPrompt: string;
  public static readonly grokSessionCancel: string;
  public static readonly grokSessionSetModel: string;
  public static readonly grokModelsField: string;
  public static readonly grokStopReasonField: string;
  public static readonly grokEndTurn: string;
  public static readonly grokRefusal: string;
  public static readonly grokProviderId: string;
  public static readonly grokDisplayName: string;
  public static readonly grokMetaField: string;
  public static readonly grokModelStateField: string;
  public static readonly grokCurrentModelField: string;
  public static readonly grokModelIdField: string;
  public static readonly grokAvailableModelsField: string;
  public static readonly grokCapabilitiesField: string;
  public static readonly grokPromptCapabilitiesField: string;
  public static readonly grokImageCapabilityField: string;
  public static readonly grokReasoningEffortsField: string;
  public static readonly grokValueField: string;
  public static readonly grokAgentVersionField: string;
  public static readonly grokAuthMethodsField: string;
  public static readonly grokCachedAuthMethod: string;
  public static readonly grokSessionUpdate: string;
  public static readonly grokUpdateField: string;
  public static readonly grokSessionUpdateField: string;
  public static readonly grokMessageChunk: string;
  public static readonly grokThoughtChunk: string;
  public static readonly grokToolCall: string;
  public static readonly grokToolUpdate: string;
  public static readonly grokRequestPermission: string;
  public static readonly grokToolCallField: string;
  public static readonly grokToolCallIdField: string;
  public static readonly grokOptionIdField: string;
  public static readonly grokLocationsField: string;
  public static readonly grokToolTitle: string;
  public static readonly grokOtherKind: string;
  public static readonly grokExecuteKind: string;
  public static readonly grokEditKind: string;
  public static readonly grokCompletedStatus: string;
  public static readonly grokDiffType: string;
  public static readonly grokOldTextField: string;
  public static readonly grokNewTextField: string;
  public static readonly addChangeKind: string;
  public static readonly updateChangeKind: string;
  public static readonly diffRemovedPrefix: string;
  public static readonly diffAddedPrefix: string;
  public static readonly grokAllowOnce: string;
  public static readonly grokRejectOnce: string;
  public static readonly grokSelected: string;
  public static readonly grokCancelled: string;
  public static readonly acpJsonRpcVersion: string;
  public static readonly acpMaximumPending: number;
  public static readonly acpMaximumBufferedCharacters: number;
  public static readonly acpKillWait: number;
  public static readonly acpAlreadyStarted: string;
  public static readonly acpDisconnected: string;
  public static readonly acpTooManyRequests: string;
  public static readonly acpDidNotStop: string;
  public static readonly acpFrameTooLarge: string;
  public static readonly acpInvalidFrame: string;
  public static readonly acpUnsupportedRequest: string;
  public static readonly acpUnsupportedCode: number;
  public static readonly spawnEvent: string;
  public static readonly grokProfileAbsolute: string;
  public static readonly grokProfileParameter: string;
  public static readonly grokProfileNotManaged: string;
  public static readonly grokProfileMarker: string;
  public static readonly grokProfileMarkerValue: string;
  public static readonly grokHostHomeDirectory: string;
  public static readonly grokConfigFile: string;
  public static readonly grokRequirementsFile: string;
  public static readonly grokProfileRequirements: string;
  public static readonly grokProfileConfig: string;
  public static readonly grokExcludedEnvironment: RegExp;
  public static readonly grokHomeVariable: string;
  public static readonly homeVariable: string;
  public static readonly userProfileVariable: string;
  public static readonly appDataVariable: string;
  public static readonly localAppDataVariable: string;
  public static readonly xdgConfigVariable: string;
  public static readonly xdgDataVariable: string;
  public static readonly grokRoamingDirectory: string;
  public static readonly grokLocalDirectory: string;
  public static readonly grokXdgConfigDirectory: string;
  public static readonly grokXdgDataDirectory: string;
  public static readonly grokDisabledValue: string;
  public static readonly grokFolderTrustVariable: string;
  public static readonly grokPermissionVariable: string;
  public static readonly grokRejectPermission: string;
  public static readonly grokDisabledFeatures: readonly string[];
  public static readonly modelDisplayNameField: string;
  public static readonly modelDescriptionField: string;
  public static readonly modelIsDefaultField: string;
  public static readonly supportedReasoningEffortsField: string;
  public static readonly inputModalitiesField: string;
  public static readonly nextCursorField: string;
  public static readonly cursorField: string;
  public static readonly maximumModelPages: number;
  public static readonly modelCatalogTooLarge: string;
  public static readonly modelDiscoveryTimedOut: string;
  public static readonly claudeDefaultModel: string;
  public static readonly streamInterval: number;
  public static readonly diffField: string;
  public static readonly maximumItemJsonLength: number;
  public static readonly agentMessageDeltaNotification: string;
  public static readonly deltaField: string;
  public static readonly userMessageItemType: string;
  public static readonly streamEventType: "stream_event";
  public static readonly messageStartEventType: "message_start";
  public static readonly contentBlockDeltaEventType: "content_block_delta";
  public static readonly textDeltaType: "text_delta";
  public static readonly thinkingDeltaType: "thinking_delta";
  public static readonly streamIdPrefix: string;
  public static readonly streamIntervalParameterName: string;
  public static readonly resumeRetryDelayParameterName: string;
  /**
   * Codex local-image input discriminator.
   */
  public static readonly localImageInputType: string;
  /**
   * Claude image block discriminator.
   */
  public static readonly imageInputType: "image";
  /**
   * Claude base64 image source discriminator.
   */
  public static readonly base64SourceType: "base64";
  /**
   * PNG image media type.
   */
  public static readonly pngMediaType: "image/png";
  /**
   * JPEG image media type.
   */
  public static readonly jpegMediaType: "image/jpeg";
  /**
   * GIF image media type.
   */
  public static readonly gifMediaType: "image/gif";
  /**
   * WebP image media type.
   */
  public static readonly webpMediaType: "image/webp";
  public static readonly codexProviderId: string;
  public static readonly codexDisplayName: string;
  public static readonly codexEffortLevels: readonly string[];
  public static readonly claudeProviderId: string;
  public static readonly claudeDisplayName: string;
  public static readonly claudeEffortLevels: readonly string[];
  public static readonly windowsPlatform: string;
  public static readonly codexExecutableName: string;
  public static readonly codexWindowsExecutableName: string;
  public static readonly codexWindowsShimName: string;
  public static readonly claudeExecutableName: string;
  public static readonly claudeWindowsExecutableName: string;
  public static readonly claudeWindowsShimName: string;
  public static readonly localDirectoryName: string;
  public static readonly binDirectoryName: string;
  public static readonly libDirectoryName: string;
  public static readonly nodeModulesDirectoryName: string;
  public static readonly openAiScopeName: string;
  public static readonly codexPackageName: string;
  public static readonly codexPlatformPackagePrefix: string;
  public static readonly vendorDirectoryName: string;
  public static readonly platformArchitectureSeparator: string;
  public static readonly codexTargetTriples: ReadonlyMap<string, string>;
  public static readonly versionArgument: string;
  public static readonly appServerArgument: string;
  public static readonly authArgument: string;
  public static readonly statusArgument: string;
  public static readonly jsonArgument: string;
  public static readonly taskkillExecutable: string;
  public static readonly taskkillProcessIdArgument: string;
  public static readonly taskkillTreeArgument: string;
  public static readonly taskkillForceArgument: string;
  public static readonly terminateSignal: NodeJS.Signals;
  public static readonly versionPattern: RegExp;
  public static readonly userAgentVersionPattern: RegExp;
  public static readonly openAiApiKeyVariable: string;
  public static readonly codexApiKeyVariable: string;
  public static readonly codexHomeVariable: string;
  public static readonly claudeConfigDirVariable: string;
  public static readonly claudeClientAppVariable: string;
  public static readonly disableAutoupdaterVariable: string;
  public static readonly enabledValue: string;
  public static readonly claudeCredentialVariablePattern: RegExp;
  public static readonly claudeRoutingVariables: ReadonlySet<string>;
  public static readonly clientAppPrefix: string;
  public static readonly lineSeparator: string;
  public static readonly listSeparator: string;
  public static readonly requestIdSeparator: string;
  public static readonly ellipsis: string;
  public static readonly jsonObjectStart: string;
  public static readonly maximumOutputLength: number;
  public static readonly maximumStderrChunks: number;
  public static readonly maximumSummaryLength: number;
  public static readonly maximumReasoningLength: number;
  public static readonly maximumCommandOutputLength: number;
  public static readonly maximumToolResultLength: number;
  public static readonly maximumInputKeys: number;
  public static readonly claudeMaximumTurns: number;
  /**
   * The Claude Code argument that chooses how thinking is shown: `thinking-display`.
   */
  public static readonly claudeThinkingDisplayArgument: string;
  /**
   * The thinking display that streams summarized thinking text: `summarized`.
   */
  public static readonly claudeSummarizedThinkingDisplay: string;
  /**
   * The project instruction file TeamRun appends to Claude Code's system prompt.
   */
  public static readonly projectInstructionsFileName: string;
  /**
   * The prefix of an import line in the instruction file.
   */
  public static readonly importPrefix: string;
  /**
   * Characters of instructions kept, imports included.
   */
  public static readonly maximumInstructionsLength: number;
  public static readonly space: string;
  public static readonly versionTimeout: number;
  public static readonly signInCheckTimeout: number;
  public static readonly initializeTimeout: number;
  public static readonly requestTimeout: number;
  public static readonly interruptTimeout: number;
  public static readonly interruptGrace: number;
  public static readonly stopGrace: number;
  public static readonly claudeAbortGrace: number;
  public static readonly utf8Encoding: BufferEncoding;
  public static readonly dataEvent: string;
  public static readonly errorEvent: string;
  public static readonly closeEvent: string;
  public static readonly abortEvent: string;
  public static readonly pathVariable: string;
  public static readonly parentDirectory: string;
  public static readonly codexCredentialVariables: readonly string[];
  public static readonly defaultProfileKey: string;
  public static readonly modelReasoningEffortSetting: string;
  public static readonly startedSuffix: string;
  public static readonly pendingSessionId: string;
  public static readonly unknownCommand: string;
  public static readonly errorPath: string;
  public static readonly paramsPath: string;
  public static readonly resultPath: string;
  public static readonly signInStatusPath: string;
  public static readonly toolInputPath: string;
  public static readonly systemMessageType: "system";
  public static readonly assistantMessageType: "assistant";
  public static readonly userMessageType: "user";
  public static readonly resultMessageType: "result";
  public static readonly initSubtype: "init";
  /**
   * The subtype of Claude Code's system messages that report thinking progress without text: `thinking_tokens`.
   */
  public static readonly thinkingTokensSubtype: "thinking_tokens";
  public static readonly successSubtype: "success";
  public static readonly textBlockType: "text";
  public static readonly thinkingBlockType: "thinking";
  public static readonly toolUseBlockType: "tool_use";
  public static readonly toolResultBlockType: "tool_result";
  public static readonly allowBehavior: "allow";
  public static readonly denyBehavior: "deny";
  public static readonly presetSystemPromptType: "preset";
  public static readonly claudeCodePreset: "claude_code";
  public static readonly acceptEditsPermissionMode: PermissionMode;
  public static readonly idField: string;
  public static readonly methodField: string;
  public static readonly paramsField: string;
  public static readonly resultField: string;
  public static readonly errorField: string;
  public static readonly codeField: string;
  public static readonly messageField: string;
  public static readonly dataField: string;
  public static readonly userAgentField: string;
  public static readonly accountField: string;
  public static readonly typeField: string;
  public static readonly emailField: string;
  public static readonly planTypeField: string;
  public static readonly modelField: string;
  public static readonly hiddenField: string;
  public static readonly threadField: string;
  public static readonly turnField: string;
  public static readonly reasoningEffortField: string;
  public static readonly cwdField: string;
  public static readonly textField: string;
  public static readonly itemField: string;
  public static readonly itemIdField: string;
  public static readonly statusField: string;
  public static readonly summaryField: string;
  public static readonly commandField: string;
  public static readonly exitCodeField: string;
  public static readonly aggregatedOutputField: string;
  public static readonly changesField: string;
  public static readonly pathField: string;
  public static readonly kindField: string;
  public static readonly serverField: string;
  public static readonly toolField: string;
  public static readonly queryField: string;
  public static readonly fromModelField: string;
  public static readonly toModelField: string;
  public static readonly reasonField: string;
  public static readonly willRetryField: string;
  public static readonly grantRootField: string;
  public static readonly loggedInField: string;
  public static readonly subscriptionTypeField: string;
  public static readonly organizationNameField: string;
  public static readonly authMethodField: string;
  public static readonly initializeMethod: string;
  public static readonly initializedMethod: string;
  public static readonly accountReadMethod: string;
  public static readonly modelListMethod: string;
  public static readonly threadStartMethod: string;
  public static readonly threadResumeMethod: string;
  /**
   * The app-server method that unarchives a thread so that it can be resumed.
   */
  public static readonly threadUnarchiveMethod: string;
  /**
   * The app-server method that forks a thread through a turn: `thread/fork`.
   */
  public static readonly threadForkMethod: string;
  /**
   * Name of a fork request's last turn: `lastTurnId`.
   */
  public static readonly lastTurnIdField: string;
  /**
   * Name of a thread request's thread id: `threadId`.
   */
  public static readonly threadIdField: string;
  /**
   * The message of the exception a Claude Code fork request raises.
   */
  public static readonly forkNotSupported: string;
  /**
   * The text an archived thread's resume failure carries.
   */
  public static readonly archivedMarker: string;
  /**
   * The text a resume failure carries while another app-server still holds the thread.
   */
  public static readonly activeWriterMarker: string;
  /**
   * How many times a busy thread's resume is tried again.
   */
  public static readonly resumeRetryCount: number;
  /**
   * The process id recorded when a spawn failed.
   */
  public static readonly unknownProcessId: number;
  /**
   * Milliseconds between the tries of a busy thread's resume.
   */
  public static readonly resumeRetryDelay: number;
  public static readonly turnStartMethod: string;
  public static readonly turnInterruptMethod: string;
  public static readonly itemStartedNotification: string;
  public static readonly itemCompletedNotification: string;
  public static readonly turnCompletedNotification: string;
  public static readonly modelReroutedNotification: string;
  public static readonly errorNotification: string;
  public static readonly commandApprovalRequest: string;
  public static readonly fileChangeApprovalRequest: string;
  public static readonly userInputRequest: string;
  public static readonly chatGptAccountType: string;
  public static readonly workspaceWriteSandbox: string;
  public static readonly onRequestApprovalPolicy: string;
  public static readonly textInputType: "text";
  public static readonly completedTurnStatus: string;
  public static readonly interruptedTurnStatus: string;
  public static readonly agentMessageItemType: string;
  public static readonly reasoningItemType: string;
  public static readonly planItemType: string;
  public static readonly commandExecutionItemType: string;
  public static readonly fileChangeItemType: string;
  public static readonly mcpToolCallItemType: string;
  public static readonly dynamicToolCallItemType: string;
  public static readonly webSearchItemType: string;
  public static readonly contextCompactionItemType: string;
  public static readonly imageGenerationItemType: string;
  public static readonly savedPathField: string;
  public static readonly revisedPromptField: string;
  public static readonly failureField: string;
  public static readonly imageDataField: string;
  public static readonly mediaTypeField: string;
  public static readonly maximumImageDataLength: number;
  public static readonly base64Pattern: RegExp;
  public static readonly imageSignatures: Readonly<Record<string, string>>;
  public static readonly imageNotSaved: string;
  public static readonly acceptDecision: string;
  public static readonly acceptForSessionDecision: string;
  public static readonly declineDecision: string;
  public static readonly allowLabel: string;
  public static readonly allowForSessionLabel: string;
  public static readonly denyLabel: string;
  public static readonly unsupportedServerRequestCode: number;
  public static readonly serverRequestFailedCode: number;
  public static readonly claudeAllowDecision: string;
  public static readonly claudeDenyDecision: string;
  public static readonly claudeCommandTools: readonly string[];
  public static readonly claudeEditToolPattern: RegExp;
  public static readonly claudeMcpToolPattern: string;
  public static readonly claudeInputCommandKey: string;
  public static readonly claudeInputPathKeys: readonly string[];
  public static readonly claudeSignedInMethod: string;
  public static readonly claudeApiKeySourceNone: string;
  public static readonly claudeNoMcpServers: string;
  public static readonly executableParameterName: string;
  public static readonly pathParameterName: string;
  public static readonly nameParameterName: string;
  public static readonly titleParameterName: string;
  public static readonly versionParameterName: string;
  public static readonly userAgentParameterName: string;
  public static readonly threadIdParameterName: string;
  public static readonly modelParameterName: string;
  public static readonly timeoutParameterName: string;
  public static readonly delayParameterName: string;
  public static readonly maximumLengthParameterName: string;
  public static readonly maximumCountParameterName: string;
  public static readonly turnIdParameterName: string;
  public static readonly versionTimeoutParameterName: string;
  public static readonly signInCheckTimeoutParameterName: string;
  public static readonly initializeTimeoutParameterName: string;
  public static readonly requestTimeoutParameterName: string;
  public static readonly interruptTimeoutParameterName: string;
  public static readonly interruptGraceParameterName: string;
  public static readonly stopGraceParameterName: string;
  public static readonly abortGraceParameterName: string;
  public static readonly codexNotFound: string;
  public static readonly claudeNotFound: string;
  public static readonly appServerAlreadyStarted: string;
  public static readonly appServerNoRequestHandler: string;
  public static readonly appServerExitedDuringTurn: string;
  public static readonly claudeNoResult: string;
  public static readonly turnNotSettled: string;
  public static readonly claudeDenied: string;
  public static readonly contextCompacted: string;
  public static readonly planPrefix: string;
  public static readonly runningPrefix: string;
  public static readonly commandPrompt: string;
  public static readonly runCommandPrefix: string;
  public static readonly applyFileChanges: string;
  public static readonly retryableErrorPrefix: string;
  public static readonly errorPrefix: string;
  public static readonly stderrHeading: string;

  public static formatRolePrompt(instructions: string | null, prompt: string): string;

  /**
   * Explains the native sign-in required for the dedicated profile.
   */
  public static formatGrokSignIn(directory: string): string;

  /**
   * Describes an unavailable native model selection.
   */
  public static formatGrokModelUnavailable(model: string): string;

  /**
   * Describes an incomplete native prompt outcome.
   */
  public static formatGrokStopped(reason: string): string;

  public static formatAcpTimeout(method: string): string;

  /**
   * Formats `<method>: <message> (code <code>)`.
   * @param method The method.
   * @param message The error message.
   * @param code The error code.
   * @returns The text.
   */
  public static formatAppServerError(method: string, message: string, code: number): string;

  /**
   * Formats the message for a request made while the app-server is not running.
   * @param method The method.
   * @returns The text.
   */
  public static formatAppServerNotRunning(method: string): string;

  /**
   * Formats the message for a request that timed out.
   * @param method The method.
   * @returns The text.
   */
  public static formatAppServerTimedOut(method: string): string;

  /**
   * Formats the message for an app-server exit, with the stderr tail when there is one.
   * @param code The exit code, or `null`.
   * @param signal The signal, or `null`.
   * @param stderr The stderr tail.
   * @returns The text.
   */
  public static formatAppServerExited(code: number | null, signal: string | null, stderr: string): string;

  /**
   * Formats the error for a turn that ended with a status other than completed, interrupted, or
   * a failure with a message.
   * @param status The status.
   * @returns The text.
   */
  public static formatTurnStatus(status: string): string;

  /**
   * Formats the message for a server request TeamRun does not answer.
   * @param method The method.
   * @returns The text.
   */
  public static formatUnsupportedServerRequest(method: string): string;

  /**
   * Formats the error for an effort the provider does not accept.
   * @param effort The effort.
   * @param provider The provider's display name.
   * @returns The text.
   */
  public static formatUnknownEffort(effort: string, provider: string): string;

  /**
   * Formats the note for a native session that could not be resumed.
   * @param error Why.
   * @returns The text.
   */
  public static formatResumeFailed(error: string): string;

  /**
   * Composes the system prompt addition that carries the project's instruction file.
   */
  public static formatProjectInstructions(content: string): string;

  /**
   * Formats the note for an account that could not be read.
   * @param error Why.
   * @returns The text.
   */
  public static formatAccountUnavailable(error: string): string;

  /**
   * Formats the note for account details that could not be read.
   * @param error Why.
   * @returns The text.
   */
  public static formatAccountInfoUnavailable(error: string): string;

  /**
   * Formats a command's transcript: the prompt line, the output, and the exit code when known.
   * @param command The command.
   * @param output The output shown.
   * @param exitCode The exit code, or `null`.
   * @returns The text.
   */
  public static formatCommandStatus(command: string, output: string, exitCode: number | null): string;

  /**
   * Formats a file-change summary.
   * @param status The change's status.
   * @param changes The described changes.
   * @returns The text.
   */
  public static formatFileChanges(status: string, changes: string): string;

  /**
   * Formats one file change as `<kind> <path>`.
   * @param kind The change kind.
   * @param path The file path.
   * @returns The text.
   */
  public static formatFileChange(kind: string, path: string): string;

  /**
   * Formats an MCP tool call.
   * @param server The server.
   * @param tool The tool.
   * @param status The status.
   * @returns The text.
   */
  public static formatMcpToolCall(server: string, tool: string, status: string): string;

  /**
   * Formats a dynamic tool call.
   * @param tool The tool.
   * @param status The status.
   * @returns The text.
   */
  public static formatToolCall(tool: string, status: string): string;

  /**
   * Formats a web search.
   * @param query The query.
   * @returns The text.
   */
  public static formatWebSearch(query: string): string;

  public static formatGeneratedImage(status: string, path: string | null): string;

  /**
   * Formats a model reroute note.
   * @param fromModel The requested model.
   * @param toModel The model served instead.
   * @param reason Why.
   * @returns The text.
   */
  public static formatModelRerouted(fromModel: string, toModel: string, reason: string): string;

  /**
   * Formats a file-change approval summary.
   * @param reason The reason, or `null`.
   * @param grantRoot The root to grant, or `null`.
   * @returns The text.
   */
  public static formatFileChangeApproval(reason: string | null, grantRoot: string | null): string;

  /**
   * Formats the error for sign-in check output that could not be read.
   * @param output The output or the parse failure.
   * @returns The text.
   */
  public static formatUnexpectedSignInOutput(output: string): string;

  /**
   * Formats the auth method for an API key source.
   * @param source The source Claude Code reports.
   * @returns The text.
   */
  public static formatApiKeySource(source: string): string;

  /**
   * Formats the note describing a Claude Code session's tools, MCP servers, and permission mode.
   * @param tools The tools.
   * @param servers The servers.
   * @param permissionMode The permission mode.
   * @returns The text.
   */
  public static formatClaudeSession(tools: string, servers: string, permissionMode: string): string;

  /**
   * Formats one MCP server as `<name> (<status>)`.
   * @param name The server's name.
   * @param status The server's status.
   * @returns The text.
   */
  public static formatClaudeServer(name: string, status: string): string;

  /**
   * Formats a Claude Code failure from its result subtype and errors.
   * @param subtype The result subtype.
   * @param errors The errors, possibly empty.
   * @returns The text.
   */
  public static formatClaudeFailure(subtype: string, errors: readonly string[]): string;

  /**
   * Formats `<tool>: <command or path>`.
   * @param tool The tool.
   * @param command The command or path.
   * @returns The text.
   */
  public static formatToolWithCommand(tool: string, command: string): string;

  /**
   * Formats `<tool> (<keys>)`.
   * @param tool The tool.
   * @param keys The input keys.
   * @returns The text.
   */
  public static formatToolWithKeys(tool: string, keys: string): string;
}

/**
 * The production `IClaudeQueryFactory`: starts sessions through the Agent SDK.
 */
export declare class AgentSdkQueryFactory implements IClaudeQueryFactory {
  /**
   * Starts a session through the Agent SDK's `query`.
   * @param prompt The user's message.
   * @param options The Agent SDK options.
   * @returns The session.
   */
  public start(prompt: string | AsyncIterable<SDKUserMessage>, options: Options): IClaudeQuery;
}

/**
 * The project's instruction file for Claude Code, read by TeamRun because the session runs without the project's
 * settings: CLAUDE.md in the working directory with its "@path" import lines replaced by the imported files (one level,
 * inside the project only), capped in length.
 */
export declare class ProjectInstructions {
  /**
   * Reads the instruction file and expands imports only when their resolved targets remain inside the project.
   * @param workingDirectory The project's working directory.
   * @returns The system prompt addition, or `null` when CLAUDE.md is missing, unreadable or resolves outside the project.
   */
  public static read(workingDirectory: string): string | null;
}

/**
 * Drives the user's unmodified Claude Code executable through the Agent SDK. Each account profile
 * has its own `CLAUDE_CONFIG_DIR`; Claude Code owns sign-in and credential storage, and TeamRun
 * does not inspect its credential files. The adapter requests no settings sources or MCP servers;
 * native enforcement of these options requires separate provider verification.
 */
export declare class ClaudeAdapter implements IProviderAdapter {
  /**
   * The `claude` provider.
   */
  public readonly descriptor: ProviderDescriptor;

  /**
   * Initializes the adapter.
   * @param command How to run Claude Code, or `null` when it was not found.
   * @param baseEnvironment The environment to clean for provider processes.
   * @param appVersion TeamRun's version, reported to Claude Code as the client app.
   * @param queryFactory Starts sessions.
   * @param runner Runs the version and sign-in check commands.
   * @param versionReader Reads the executable's version.
   * @param timings The timeouts and grace periods.
   */
  public constructor(command: ProcessCommand | null, baseEnvironment: NodeJS.ProcessEnv, appVersion: string, queryFactory: IClaudeQueryFactory, runner: CommandRunner, versionReader: ExecutableVersionReader, timings: ProviderTimings);

  /**
   * How many turns are running.
   */
  public get activeRunCount(): number;

  /**
   * Runs `claude auth status --json` with the profile's environment and reads the outcome.
   * @param account The account whose profile is checked; its directory is created when missing.
   * @returns The check: `Error` when the executable is missing, the command fails, or its output
   * cannot be read.
   */
  public checkSignIn(account: ProviderAccount): Promise<SignInCheck>;

  /**
   * Lists the model aliases Claude Code accepts.
   * @param account Ignored; the list is static.
   * @returns `fable`, `opus`, `sonnet`, `haiku`.
   */
  public listModels(account: ProviderAccount | null): Promise<readonly ProviderModel[]>;

  /**
   * Runs one turn. Fails without starting when the executable is missing or the effort is not
   * one Claude Code accepts. An abort interrupts the session and, after the abort grace, aborts
   * its process.
   * @param request What to run and where.
   * @param listener Where progress is reported.
   * @param signal Aborted to interrupt the turn.
   * @returns How the turn ended; the native session id is Claude Code's session id.
   */
  public runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /**
   * Rejects: the Agent SDK cannot fork a session (the descriptor says so; a rewind continues with the
   * transcript).
   * @param request What to fork.
   * @returns Never resolves.
   * @throws InvalidOperationException always.
   */
  public forkSession(request: ForkRequest): Promise<string>;

  /**
   * Interrupts and aborts every running turn.
   */
  public shutdown(): Promise<void>;
}

/**
 * Builds the environment for a Claude Code process: inherited `CLAUDE_*`, `CLAUDEPID`, and
 * `ANTHROPIC_*` variables are dropped except the provider-routing switches, so credentials in the
 * launching shell cannot change which profile signs in; the profile directory, the client app, and
 * the auto-updater switch are then set.
 */
export declare class ClaudeEnvironment {
  /**
   * Builds the environment.
   * @param base The environment to clean.
   * @param profileDir The profile directory, or `null` to keep the base `CLAUDE_CONFIG_DIR`.
   * @param appVersion TeamRun's version.
   * @returns The environment.
   */
  public static build(base: NodeJS.ProcessEnv, profileDir: string | null, appVersion: string): NodeJS.ProcessEnv;
}

/**
 * Reads the output of `claude auth status --json`.
 */
export declare class ClaudeSignInReader {
  /**
   * Reads the output.
   * @param output The command's output, possibly with text before the JSON object.
   * @param harnessVersion The executable's version, or `null`.
   * @returns `LoggedIn` with the identity, `LoggedOut`, or `Error` when the output has no
   * readable JSON object.
   */
  public read(output: string, harnessVersion: string | null): SignInCheck;
}

/**
 * One Claude Code turn: consumes the session's messages, reports them to the turn listener, and
 * decides tool use through it.
 */
export declare class ClaudeTurn {
  /**
   * Initializes the turn.
   * @param listener Where progress is reported.
   * @param resumeNativeSessionId The session the turn asked to resume, or `null`.
   * @param stream Accumulates the streamed text and thinking deltas.
   */
  public constructor(listener: ITurnListener, resumeNativeSessionId: string | null, stream: DeltaStream, roleApplied?: import("@noldova/teamrun-protocol").RoleApplication | null);

  /**
   * The session id Claude Code reported, or `null` before the session started.
   */
  public get sessionId(): string | null;

  /**
   * What was observed so far.
   */
  public get observed(): ObservedSettings;

  /**
   * How the turn ended, or `null` while it runs.
   */
  public get outcome(): TurnOutcome | null;

  /**
   * Whether an interruption was requested.
   */
  public get isInterrupted(): boolean;

  /**
   * Consumes the session until it ends; a stream that ends without a result is a failure.
   * @param query The session.
   */
  public consume(query: IClaudeQuery): Promise<void>;

  /**
   * Records that an interruption was requested, so later failures count as interruptions.
   */
  public markInterrupted(): void;

  /**
   * Ends the turn as failed unless it already ended.
   * @param error Why.
   */
  public fail(error: string): void;

  /**
   * Asks the listener whether a tool may run.
   * @param toolName The tool.
   * @param input The tool's input.
   * @returns Allow with the unchanged input, or deny.
   */
  public decide(toolName: string, input: Record<string, unknown>): Promise<PermissionResult>;

  /**
   * Builds the turn's result; a turn that never ended counts as failed.
   * @returns The result.
   */
  public toResult(): TurnResult;
}

/**
 * JSON-RPC client for one `codex app-server` process over stdio, newline-delimited. Requests
 * carry an id; server-initiated requests are answered through the server request handler;
 * notifications go to every subscribed handler. Lines that are not JSON objects are dropped and
 * counted; a handler that throws is counted.
 */
export declare class AppServerClient {
  /**
   * Initializes the client without starting the process.
   * @param command How to start the app-server.
   * @param environment The process environment.
   * @param clientInfo How the client introduces itself.
   * @param terminator Terminates a process that ignores its closed input.
   * @param timings The timeouts and grace periods.
   * @param tracker Records the process for a later runtime to clean up.
   */
  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, clientInfo: AppServerClientInfo, terminator: ProcessTerminator, timings: ProviderTimings, tracker: IProcessTracker);

  /**
   * Whether the process was started and has not exited.
   */
  public get isAlive(): boolean;

  /**
   * What `initialize` answered, or `null` before it did.
   */
  public get initialization(): AppServerInitialization | null;

  /**
   * The server's version, or `null` before initialization or when the user agent carries none.
   */
  public get version(): string | null;

  /**
   * How many lines were dropped because they were not JSON objects.
   */
  public get droppedLineCount(): number;

  /**
   * How many notification handlers threw.
   */
  public get handlerFailureCount(): number;

  /**
   * The tail of the process's standard error.
   */
  public get stderr(): string;

  /**
   * Waits for the process to exit.
   * @returns How it exited; `null` code and signal when it never started.
   */
  public waitForExit(): Promise<ProcessExit>;

  /**
   * Starts the process, sends `initialize`, and confirms with `initialized`.
   * @returns What `initialize` answered.
   * @throws AppServerUnavailableException when already started, the process cannot start, exits
   * first, or does not answer in time.
   * @throws AppServerException when the server answers `initialize` with an error.
   */
  public start(): Promise<AppServerInitialization>;

  /**
   * Subscribes to notifications.
   * @param handler The handler.
   * @returns The subscription; dispose it to unsubscribe.
   */
  public subscribe(handler: INotificationHandler): HandlerSubscription<INotificationHandler>;

  /**
   * Subscribes to the process exit.
   * @param handler The handler.
   * @returns The subscription; dispose it to unsubscribe.
   */
  public subscribeExit(handler: IExitHandler): HandlerSubscription<IExitHandler>;

  /**
   * Sets who answers server-initiated requests; without one they are declined.
   * @param handler The handler, or `null`.
   */
  public setServerRequestHandler(handler: IServerRequestHandler | null): void;

  /**
   * Sends a request and waits for its response.
   * @param method The method.
   * @param params The parameters.
   * @param timeoutMilliseconds How long to wait.
   * @returns The result, `null` when the response carries none.
   * @throws ArgumentOutOfRangeException when the timeout is not a positive integer.
   * @throws AppServerUnavailableException when the process is not running, exits, or does not
   * answer in time.
   * @throws AppServerException when the server answers with an error.
   */
  public request(method: string, params: JsonValue, timeoutMilliseconds: number): Promise<JsonValue>;

  /**
   * Sends a notification when the process is running.
   * @param method The method.
   * @param params The parameters.
   */
  public notify(method: string, params: JsonValue): void;

  /**
   * Closes the process's input and terminates it after the stop grace when it has not exited.
   */
  public stop(): Promise<void>;
}

/**
 * Drives Codex through `codex app-server`: one process per account profile (`CODEX_HOME`), shared
 * by that profile's threads; turns are routed by thread id. Threads start in the workspace-write
 * sandbox with approvals on request and without the profile's MCP servers and plugins.
 */
export declare class CodexAdapter implements IProviderAdapter {
  /**
   * The `codex` provider.
   */
  public readonly descriptor: ProviderDescriptor;

  /**
   * Initializes the adapter.
   * @param command How to run Codex, or `null` when it was not found.
   * @param baseEnvironment The environment to clean for provider processes.
   * @param clientInfo How TeamRun introduces itself to the app-server.
   * @param terminator Terminates processes that ignore their closed input.
   * @param timings The timeouts and grace periods.
   * @param tracker Records the app-server processes for a later runtime to clean up.
   */
  public constructor(command: ProcessCommand | null, baseEnvironment: NodeJS.ProcessEnv, clientInfo: AppServerClientInfo, terminator: ProcessTerminator, timings: ProviderTimings, tracker: IProcessTracker);

  /**
   * How many app-server processes are running or starting.
   */
  public get clientCount(): number;

  /**
   * Reads the profile's account through `account/read`.
   * @param account The account whose profile is checked; its directory is created when missing.
   * @returns `LoggedIn` with the identity, `LoggedOut` when no account is reported, or `Error`
   * when the executable is missing or the app-server fails.
   */
  public checkSignIn(account: ProviderAccount): Promise<SignInCheck>;

  /**
   * Lists the visible models through `model/list`.
   * @param account The account, or `null` for the default profile.
   * @returns The model names.
   * @throws ExecutableNotFoundException when Codex was not found.
   * @throws AppServerUnavailableException when the app-server cannot start or answer.
   * @throws AppServerException when the server answers with an error.
   */
  public listModels(account: ProviderAccount | null): Promise<readonly ProviderModel[]>;

  /**
   * Runs one turn: resumes the native thread when asked and possible, else starts one; reports
   * items, reroutes, and errors; routes approvals to the listener; interrupts on abort and gives
   * up after the interrupt grace.
   * @param request What to run and where.
   * @param listener Where progress is reported.
   * @param signal Aborted to interrupt the turn.
   * @returns How the turn ended; the native session id is the thread id.
   */
  public runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /**
   * Forks a thread through a turn into a new thread (`thread/fork` with `lastTurnId`, the source
   * unarchived first when needed, a busy source tried again): the fork holds the history through
   * that turn and the source is untouched.
   * @param request The thread, the turn, and where the fork works.
   * @returns The new thread id.
   * @throws AppServerException when the app-server refuses (the thread is gone).
   * @throws ExecutableNotFoundException when Codex is missing.
   */
  public forkSession(request: ForkRequest): Promise<string>;

  /**
   * Stops every app-server process.
   */
  public shutdown(): Promise<void>;
}

/**
 * Builds the environment for a Codex app-server: API keys inherited from the launching shell are
 * dropped so the profile's own sign-in is the only credential source.
 */
export declare class CodexEnvironment {
  /**
   * Builds the environment.
   * @param base The environment to clean.
   * @param profileDir The profile directory set as `CODEX_HOME`, or `null` to keep the base one.
   * @returns The environment.
   */
  public static build(base: NodeJS.ProcessEnv, profileDir: string | null): NodeJS.ProcessEnv;
}

/**
 * Converts Codex thread items into turn details.
 */
export declare class CodexItemReader {
  /**
   * Reads a started item; only command executions are reported.
   * @param item The item.
   * @returns The detail, or `null` when nothing is reported.
   * @throws JsonException when the item lacks its id or type.
   */
  public readStarted(item: JsonReader): TurnDetail | null;

  /**
   * Reads a completed item: agent messages, reasoning, plans, commands, file changes, tool calls,
   * web searches, and context compactions; others and blank texts are not reported.
   * @param item The item.
   * @returns The detail, or `null` when nothing is reported.
   * @throws JsonException when the item lacks a field its type requires.
   */
  public readCompleted(item: JsonReader): TurnDetail | null;
}

/**
 * Routes server-initiated requests of a shared app-server to the turn of their thread.
 */
export declare class CodexRequestRouter implements IServerRequestHandler {
  /**
   * How many turns are registered.
   */
  public get activeCount(): number;

  /**
   * Registers a turn under its thread id.
   * @param turn The turn.
   */
  public register(turn: CodexTurn): void;

  /**
   * Removes a turn when it is the one registered under its thread id.
   * @param turn The turn.
   */
  public unregister(turn: CodexTurn): void;

  /**
   * Returns the registered turns.
   * @returns The turns.
   */
  public all(): readonly CodexTurn[];

  /**
   * Routes the request by its `threadId`.
   * @param method The request's method.
   * @param params The request's parameters.
   * @returns The turn's answer.
   * @throws UnsupportedServerRequestException when no turn is registered for the thread.
   */
  public handleServerRequest(method: string, params: JsonReader): Promise<JsonValue>;
}

/**
 * One Codex turn on one thread: handles the thread's notifications and server requests and
 * settles once with the turn's outcome.
 */
export declare class CodexTurn implements INotificationHandler, IServerRequestHandler {
  /**
   * The thread the turn runs on.
   */
  public readonly threadId: string;

  /**
   * Initializes the turn.
   * @param threadId The thread.
   * @param listener Where progress is reported.
   * @param observed What was observed when the thread started.
   * @param itemReader Converts items into details.
   * @param stream Accumulates the agent message deltas.
   * @throws ArgumentException when the thread id is blank.
   */
  public constructor(threadId: string, listener: ITurnListener, observed: ObservedSettings, itemReader: CodexItemReader, stream: DeltaStream);

  /**
   * The turn id once `turn/start` answered, or `null`.
   */
  public get turnId(): string | null;

  /**
   * What was observed so far.
   */
  public get observed(): ObservedSettings;

  /**
   * How the turn ended, or `null` while it runs.
   */
  public get outcome(): TurnOutcome | null;

  /**
   * The failure, or `null`.
   */
  public get error(): string | null;

  /**
   * Whether the turn ended.
   */
  public get isComplete(): boolean;

  /**
   * Records the turn id so that `turn/completed` of other turns is ignored.
   * @param turnId The turn id.
   * @throws ArgumentException when the turn id is blank.
   */
  public begin(turnId: string): void;

  /**
   * Waits until the turn ends.
   */
  public waitForCompletion(): Promise<void>;

  /**
   * Ends the turn as failed unless it already ended.
   * @param error Why.
   */
  public fail(error: string): void;

  /**
   * Ends the turn as interrupted unless it already ended.
   */
  public interrupt(): void;

  /**
   * Builds the turn's result, with the turn's id from `turn/start`; an aborted turn that did not complete counts as
   * interrupted.
   * @param aborted Whether the abort signal fired.
   * @returns The result.
   * @throws InvalidOperationException when the turn has not ended.
   */
  public toResult(aborted: boolean): TurnResult;

  /**
   * Handles a notification, ignoring those of other threads.
   * @param method The notification's method.
   * @param params The notification's parameters.
   */
  public handleNotification(method: string, params: JsonReader): void;

  /**
   * Answers command and file-change approvals with the listener's decision, user-input requests
   * with no answers.
   * @param method The request's method.
   * @param params The request's parameters.
   * @returns The answer.
   * @throws UnsupportedServerRequestException for any other method.
   */
  public handleServerRequest(method: string, params: JsonReader): Promise<JsonValue>;
}

/**
 * Finds the Codex and Claude Code executables. Codex: an override, else the native binary behind
 * the global npm shim, else the shim on `PATH`. Claude Code: an override, else `~/.local/bin`,
 * else `PATH`.
 */
export declare class ExecutableLocator {
  /**
   * Initializes the locator.
   * @param platform The platform, as `process.platform`.
   * @param architecture The architecture, as `process.arch`.
   * @param pathEntries The directories of `PATH`.
   * @param homeDirectory The user's home directory.
   */
  public constructor(platform: string, architecture: string, pathEntries: readonly string[], homeDirectory: string);

  /**
   * Creates a locator for the current process.
   * @returns The locator.
   */
  public static fromProcess(): ExecutableLocator;

  /**
   * Splits a `PATH` value into its non-blank directories.
   * @param value The variable's value, or `undefined` when it is not set.
   * @returns The directories.
   */
  public static splitPath(value: string | undefined): readonly string[];

  /**
   * Locates Codex.
   * @param override An explicit path, or `null`; an override that does not exist finds nothing.
   * @returns The executable, or `null`.
   */
  public locateCodex(override: string | null): LocatedExecutable | null;

  /**
   * Locates Claude Code.
   * @param override An explicit path, or `null`; an override that does not exist finds nothing.
   * @returns The executable, or `null`.
   */
  public locateClaude(override: string | null): LocatedExecutable | null;

  /**
   * Finds Grok on PATH or in its native user installation.
   */
  public locateGrok(override: string | null): LocatedExecutable | null;
}

/**
 * Reads an executable's version from `--version`.
 */
export declare class ExecutableVersionReader {
  /**
   * Initializes the reader.
   * @param runner Runs the command.
   * @param timeoutMilliseconds How long `--version` may take.
   * @throws ArgumentOutOfRangeException when the timeout is not a positive integer.
   */
  public constructor(runner: CommandRunner, timeoutMilliseconds: number);

  /**
   * Reads the version.
   * @param command How to run the executable.
   * @param environment The process environment.
   * @returns The first `x.y.z` in the output, or `null` when there is none or the command fails.
   */
  public read(command: ProcessCommand, environment: NodeJS.ProcessEnv): Promise<string | null>;
}

/**
 * Describes a thrown value.
 */
export declare class FailureDescriber {
  /**
   * Returns an error's message, or the value as text.
   * @param error The thrown value.
   * @returns The description.
   */
  public static describe(error: unknown): string;
}

/**
 * A timer that starts when a signal aborts and elapses after a delay; used as a grace period.
 */
export declare class AbortTimer implements Disposable {
  /**
   * Initializes the timer; it arms immediately for an aborted signal.
   * @param signal The signal.
   * @param delayMilliseconds The delay after the abort.
   * @throws ArgumentOutOfRangeException when the delay is not a positive integer.
   */
  public constructor(signal: AbortSignal, delayMilliseconds: number);

  /**
   * Whether the delay elapsed.
   */
  public get elapsed(): boolean;

  /**
   * Waits until the delay elapses; never resolves for a signal that does not abort.
   */
  public wait(): Promise<void>;

  /**
   * Stops listening and cancels the timer.
   */
  public [Symbol.dispose](): void;
}

/**
 * Runs a command to completion without a shell, with bounded output and a timeout.
 */
export declare class CommandRunner {
  /**
   * Initializes the runner.
   * @param terminator Terminates commands that exceed their timeout.
   */
  public constructor(terminator: ProcessTerminator);

  /**
   * Runs the command.
   * @param command The command.
   * @param environment The process environment.
   * @param timeoutMilliseconds How long the command may take.
   * @returns How the command ended.
   * @throws ArgumentOutOfRangeException when the timeout is not a positive integer.
   * @throws Error when the process cannot be spawned.
   */
  public run(command: ProcessCommand, environment: NodeJS.ProcessEnv, timeoutMilliseconds: number): Promise<CommandResult>;
}

/**
 * Terminates a process: on Windows the whole tree through `taskkill`, elsewhere with `SIGTERM`.
 */
export declare class ProcessTerminator {
  /**
   * Initializes the terminator.
   * @param platform The platform, as `process.platform`.
   */
  public constructor(platform: string);

  /**
   * Terminates the process; a process that never started or already exited is left alone.
   * @param child The process.
   */
  public terminate(child: ChildProcess): Promise<void>;
}

/**
 * A single structured Claude user message with native image blocks.
 * Reads image bytes during construction so filesystem failures are reported outside the SDK's input generator.
 */
export declare class ClaudePrompt implements AsyncIterable<SDKUserMessage> {
  /**
   * Prepares the SDK input.
   * @param request Turn with durable attachment paths and a text prompt.
   * @throws Error when an image cannot be read.
   */
  public constructor(request: TurnRequest);

  /**
   * Yields the prepared message once.
   * @returns The SDK user-message iterator.
   */
  public [Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage>;
}

/**
 * A dedicated, TeamRun-managed native Grok profile. Authentication files remain CLI-owned.
 */
export declare class GrokProfile {
  /**
   * Native GROK_HOME directory.
   */
  public readonly directory: string;
  /**
   * Separate host home for cross-tool discovery isolation.
   */
  public readonly homeDirectory: string;

  /**
   * Requires an absolute directory.
   */
  public constructor(directory: string);

  /**
   * Initializes an empty/managed profile; refuses to alter an existing unmanaged profile.
   */
  public prepare(): void;
}

/**
 * Builds the cleaned environment for a dedicated native Grok process.
 */
export declare class GrokEnvironment {
  /**
   * Overrides profile/home discovery and removes inherited credential and provider settings.
   */
  public static build(base: NodeJS.ProcessEnv, profile: GrokProfile): NodeJS.ProcessEnv;
}

/**
 * Receives ACP notifications, reverse requests, and unexpected process exit.
 */
export interface IAcpClientListener {
  /**
   * Ends prompt event delivery synchronously before the response promise resolves.
   */
  onResponse(method: string): void;

  /**
   * Handles one agent notification.
   */
  onNotification(method: string, params: JsonReader): void;

  /**
   * Handles a reverse request with its observed native id. Rejections produce a protocol error.
   */
  onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue>;

  /**
   * Handles an unexpected exit.
   */
  onExit(): void;
}

/**
 * Bounded JSON-RPC over a native ACP agent stdin/stdout.
 */
export declare class AcpClient {
  /**
   * Creates a single-use client with explicit launch environment and process ownership.
   */
  public constructor(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string, terminator: ProcessTerminator, timings: ProviderTimings, tracker: IProcessTracker);

  /**
   * Starts the process; a second start throws.
   */
  public start(): void;

  /**
   * Sets or removes the active session listener.
   */
  public setListener(listener: IAcpClientListener | null): void;

  /**
   * Sends a request; null timeout is reserved for a turn whose lifetime is explicitly cancelled/stopped.
   */
  public request(method: string, params: JsonObject, timeout?: number | null): Promise<JsonValue>;

  /**
   * Sends a notification when connected.
   */
  public notify(method: string, params: JsonObject): void;

  /**
   * Closes stdin, terminates after a grace period, and bounds the final exit wait.
   */
  public stop(): Promise<void>;
}

/**
 * Grok CLI integration using ACP and dedicated managed profiles.
 */
export declare class GrokAdapter implements IProviderAdapter {
  /**
   * Supported adapter operations.
   */
  public readonly descriptor: ProviderDescriptor;

  /**
   * Creates the adapter with the managed default profile location.
   */
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, defaultProfileDirectory: string, clientInfo: AppServerClientInfo, terminator: ProcessTerminator, timings: ProviderTimings, tracker: IProcessTracker);

  /**
   * Reads provider model metadata without a prompt.
   */
  public listModels(account: ProviderAccount | null): Promise<readonly ProviderModel[]>;

  /**
   * Checks only cached native authentication; never opens a login flow.
   */
  public checkSignIn(account: ProviderAccount): Promise<SignInCheck>;

  /**
   * Runs a turn with streaming, approvals and bounded cancellation.
   */
  public runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /**
   * Forking is unavailable; the engine uses transcript continuation after rewind.
   */
  public forkSession(request: ForkRequest): Promise<string>;

  /**
   * Stops every owned ACP process.
   */
  public shutdown(): Promise<void>;
}

/**
 * Reads the metadata advertised by the native Grok ACP initialize response.
 */
export declare class GrokModelReader {
  /**
   * Returns native model choices and advertised capabilities.
   */
  public static read(initialized: JsonReader): readonly ProviderModel[];

  /**
   * Returns the observed native harness version.
   */
  public static version(initialized: JsonReader): string | null;

  /**
   * Whether cached, noninteractive authentication is advertised.
   */
  public static canAuthenticate(initialized: JsonReader): boolean;
}

/**
 * Translates one ACP session's streaming events and per-request approvals.
 */
export declare class GrokTurn implements IAcpClientListener {
  /**
   * Creates an inactive listener; replayed history is ignored until begin.
   */
  public constructor(listener: ITurnListener, signal: AbortSignal, streamInterval: number);

  /**
   * Starts delivery for the observed native session.
   */
  public begin(sessionId: string, resumed: boolean, observed: ObservedSettings, roleApplied?: import("@noldova/teamrun-protocol").RoleApplication | null): void;

  /**
   * Flushes remaining text and stops delivery.
   */
  public finish(): void;

  /**
   * Handles session updates.
   */
  public onNotification(method: string, params: JsonReader): void;

  /**
   * Routes supported per-request approvals; rejects unsupported requests.
   */
  public onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue>;

  /**
   * Ends delivery at the prompt response boundary.
   */
  public onResponse(method: string): void;

  /**
   * Ends delivery on process exit.
   */
  public onExit(): void;
}
