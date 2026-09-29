/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader, JsonValue } from "@noldova/teamrun-foundation-json";
import type { ServiceResponse, ServiceResponseInfo, ServiceResponseStatus } from "@noldova/teamrun-foundation-services";

/**
 * Dispatches validated local requests into one process's supported operations.
 */
export interface IRequestDispatcher {
  /**
   * Handles a request, including unsupported-method and application failures.
   * @param request Validated request.
   * @returns The correlated success or failure response.
   */
  dispatch(request: Request): Promise<Response>;
}

/**
 * Renderer checkpoint state controlled only by desktop main.
 */
export declare enum UpdateCheckpointPhase {
  /**
   * Freeze editing and durably save the workspace.
   */
  Prepare = "Prepare",
  /**
   * Resume editing after a failed or cancelled preparation.
   */
  Resume = "Resume"
}

/**
 * Correlates a renderer checkpoint with one restart attempt.
 */
export declare class UpdateCheckpoint {
  /**
   * Nonblank operation id.
   */
  public readonly id: string;
  /**
   * Requested checkpoint phase.
   */
  public readonly phase: UpdateCheckpointPhase;
  /**
   * Creates a checkpoint request.
   * @param id Nonblank operation id.
   * @param phase Prepare or resume.
   * @throws ArgumentException if id is blank.
   */
  public constructor(id: string, phase: UpdateCheckpointPhase);
  /**
   * Validates a checkpoint request.
   * @param value Untrusted JSON.
   * @returns The checkpoint.
   * @throws JsonException or ArgumentException for invalid fields.
   */
  public static fromJson(value: unknown): UpdateCheckpoint;
  /**
   * Serializes the checkpoint.
   * @returns Plain JSON.
   */
  public toJson(): JsonObject;
}

/**
 * A renderer's confirmation that the named workspace snapshot is durable.
 */
export declare class UpdateCheckpointResult {
  /**
   * Matching operation id.
   */
  public readonly id: string;
  /**
   * True only when draft and UI persistence succeeded.
   */
  public readonly ready: boolean;
  /**
   * Creates the acknowledgement.
   * @param id Nonblank operation id.
   * @param ready Whether persistence succeeded.
   * @throws ArgumentException if id is blank.
   */
  public constructor(id: string, ready: boolean);
  /**
   * Validates an acknowledgement.
   * @param value Untrusted JSON.
   * @returns The result.
   * @throws JsonException or ArgumentException for invalid fields.
   */
  public static fromJson(value: unknown): UpdateCheckpointResult;
  /**
   * Serializes the result.
   * @returns Plain JSON.
   */
  public toJson(): JsonObject;
}

/**
 * Identifies the installation update requested through a local control endpoint.
 */
export declare class UpdateOperation {
  /**
   * Matching installation operation id.
   */
  public readonly id: string;
  /**
   * Creates a reference.
   * @param id Nonblank operation id.
   * @throws ArgumentException if id is blank.
   */
  public constructor(id: string);
  /**
   * Validates a reference.
   * @param value Untrusted JSON.
   * @returns The operation reference.
   * @throws JsonException or ArgumentException for invalid fields.
   */
  public static fromJson(value: unknown): UpdateOperation;
  /**
   * Serializes the reference.
   * @returns Plain JSON.
   */
  public toJson(): JsonObject;
}

/**
 * Commands accepted by the local desktop update bridge. Install requires explicit opt-in and coordinated preparation.
 */
export declare enum AppUpdateCommand {
  /**
   * Reads the latest snapshot without starting work.
   */
  Status = "Status",
  /**
   * Checks the configured feed without downloading.
   */
  Check = "Check",
  /**
   * Downloads and verifies the available update.
   */
  Download = "Download",
  /**
   * Explicitly prepares all instances and hands a verified update to the installer when enabled for this build.
   */
  Install = "Install"
}

/**
 * The desktop update operation's visible state.
 */
export declare enum AppUpdateStatus {
  /**
   * The build or feed does not allow updates.
   */
  Disabled = "Disabled",
  /**
   * No check has completed yet.
   */
  Idle = "Idle",
  /**
   * Reading the feed.
   */
  Checking = "Checking",
  /**
   * The feed has no eligible newer version.
   */
  UpToDate = "UpToDate",
  /**
   * An eligible newer version can be downloaded.
   */
  Available = "Available",
  /**
   * Downloading and verifying the candidate.
   */
  Downloading = "Downloading",
  /**
   * The download is verified; this state does not authorize installation.
   */
  Downloaded = "Downloaded",
  /**
   * Saving workspaces and closing idle runtime resources before handoff.
   */
  Preparing = "Preparing",
  /**
   * Preparation finished and the platform installer has the update; TeamRun restarts when the installation finishes.
   */
  Installing = "Installing",
  /**
   * The last check or download failed and can be retried.
   */
  Error = "Error"
}

/**
 * Immutable update snapshot sent by desktop main, separate from the shared runtime protocol.
 */
export declare class AppUpdateState {
  /**
   * Whether a verified download may be explicitly installed through the configured coordinator.
   */
  public readonly canInstall: boolean;
  /**
   * Current operation state.
   */
  public readonly status: AppUpdateStatus;
  /**
   * Installed product version, never the runtime protocol version.
   */
  public readonly currentVersion: string;
  /**
   * Eligible version, or null; retained after a failed download to permit retry.
   */
  public readonly availableVersion: string | null;
  /**
   * Integer download percentage in [0, 100], or null outside a download.
   */
  public readonly progressPercent: number | null;
  /**
   * Safe user-facing explanation, or null.
   */
  public readonly message: string | null;
  /**
   * ISO timestamp of the last successful check, or null.
   */
  public readonly lastCheckedAt: string | null;
  /**
   * Whether the explicitly configured local test feed is active.
   */
  public readonly isTestFeed: boolean;

  /**
   * Creates a snapshot.
   * @param status Operation state.
   * @param currentVersion Nonblank installed version.
   * @param availableVersion Nonblank candidate version, or null.
   * @param progressPercent Integer percentage in [0, 100], or null.
   * @param message Safe explanation, or null.
   * @param lastCheckedAt Last successful check timestamp, or null.
   * @param isTestFeed Whether this is a local test feed.
   * @throws ArgumentException when a version is blank or progress is outside its range.
   */
  public constructor(status: AppUpdateStatus, currentVersion: string, availableVersion: string | null,
    progressPercent: number | null, message: string | null, lastCheckedAt: string | null, isTestFeed: boolean, canInstall?: boolean);

  /**
   * Validates an IPC snapshot; unknown fields are ignored.
   * @param value Untrusted JSON.
   * @param path Optional path used in validation errors.
   * @returns The validated snapshot.
   * @throws JsonException when a required field is missing or has the wrong type.
   * @throws ArgumentException when a version is blank or progress is outside its range.
   */
  public static fromJson(value: unknown, path?: string): AppUpdateState;

  /**
   * Serializes the snapshot without retaining any download or renderer objects.
   * @returns Its plain JSON wire form.
   */
  public toJson(): JsonObject;
}

/**
 * Reads a typed payload from its JSON value: a model's `fromJson`, or a function over a primitive.
 * The path, `$.payload`, is reported by the `JsonException` the reader throws.
 */
export declare type PayloadReader<T> = (value: JsonValue, path: string) => T;

/**
 * Writes a typed payload as JSON: a model's `toJson`, or a function over a primitive.
 */
export declare type PayloadWriter<T> = (value: T) => JsonValue;

/**
 * Discriminator carried by every wire message in its `kind` field.
 */
export declare enum WireMessageKind {
  /**
   * The first message on a connection, sent by the client.
   */
  Hello = "Hello",
  /**
   * A call from a client to the runtime.
   */
  Request = "Request",
  /**
   * The answer to a request, its result or its failure, or a connection-level answer.
   */
  Response = "Response",
  /**
   * A notification pushed by the runtime.
   */
  Event = "Event"
}

/**
 * Classification of a protocol error, stable across versions so clients can act on it.
 */
export declare enum ErrorCode {
  /**
   * The request's parameters did not satisfy the method's contract.
   */
  InvalidParams = "InvalidParams",
  /**
   * The runtime has no method of the requested name.
   */
  UnknownMethod = "UnknownMethod",
  /**
   * The referenced entity does not exist.
   */
  NotFound = "NotFound",
  /**
   * The request conflicts with the current state, such as starting a run on a busy task.
   */
  Conflict = "Conflict",
  /**
   * The hello carried a missing or wrong capability token.
   */
  Unauthorized = "Unauthorized",
  /**
   * The client's protocol version cannot be served by this runtime.
   */
  VersionMismatch = "VersionMismatch",
  /**
   * A provider failed; the message carries the provider's own explanation.
   */
  ProviderError = "ProviderError",
  /**
   * The runtime cannot serve the request now, for example while stopping.
   */
  Unavailable = "Unavailable",
  /**
   * An unexpected failure inside the runtime.
   */
  Internal = "Internal"
}

/**
 * What a provider asks permission for.
 */
export declare enum ApprovalKind {
  /**
   * Running a shell command.
   */
  Command = "Command",
  /**
   * Writing to files in the workspace.
   */
  FileChange = "FileChange",
  /**
   * Using a tool the provider gates behind a permission, such as a web fetch.
   */
  Tool = "Tool"
}

/**
 * What choosing an approval option means for the provider's request.
 */
export declare enum ApprovalOutcome {
  /**
   * The request is granted, possibly with a wider scope such as the rest of the session.
   */
  Approved = "Approved",
  /**
   * The request is refused.
   */
  Denied = "Denied"
}

/**
 * Where an approval request stands.
 */
export declare enum ApprovalStatus {
  /**
   * Waiting for the user's decision.
   */
  Pending = "Pending",
  /**
   * The user allowed it.
   */
  Approved = "Approved",
  /**
   * The user refused it.
   */
  Denied = "Denied",
  /**
   * The reply ended before a decision was made.
   */
  Cancelled = "Cancelled"
}

/**
 * What the last check of a provider account observed about its sign-in.
 */
export declare enum AuthStatus {
  /**
   * Never checked, or the check could not tell.
   */
  Unknown = "Unknown",
  /**
   * The provider tooling reported a signed-in account.
   */
  LoggedIn = "LoggedIn",
  /**
   * The provider tooling reported no account.
   */
  LoggedOut = "LoggedOut",
  /**
   * The provider tooling reported credentials that need a new sign-in.
   */
  Expired = "Expired",
  /**
   * The check itself failed; `ProviderAccount.lastError` says why.
   */
  Error = "Error"
}

/**
 * What a detail of a message carries; the renderer picks the presentation from it.
 */
export declare enum DetailKind {
  /**
   * Plain prose.
   */
  Text = "Text",
  /**
   * The provider's reasoning summary, when it emits one.
   */
  Reasoning = "Reasoning",
  /**
   * A command the provider ran; the payload carries output and exit code.
   */
  Command = "Command",
  /**
   * Files the provider changed; the payload carries the paths and diff.
   */
  FileChange = "FileChange",
  /**
   * A note from TeamRun inside a message, such as a resumed session.
   */
  Note = "Note",
  /**
   * An error from the provider or TeamRun.
   */
  Error = "Error"
}

/**
 * Who wrote a message.
 */
export declare enum MessageAuthor {
  /**
   * The user, typing in the conversation.
   */
  User = "User",
  /**
   * The provider, replying to the user.
   */
  Provider = "Provider",
  /**
   * TeamRun itself, such as status notes and results.
   */
  TeamRun = "TeamRun"
}

/**
 * Where a message stands. The user's and TeamRun's messages are complete when stored; a provider's
 * moves through the open states.
 */
export declare enum MessageStatus {
  /**
   * Recorded and not yet sent to the provider.
   */
  Pending = "Pending",
  /**
   * The provider is working.
   */
  Running = "Running",
  /**
   * The provider asked for permission and waits for the user.
   */
  AwaitingApproval = "AwaitingApproval",
  /**
   * The message is complete.
   */
  Completed = "Completed",
  /**
   * The provider or TeamRun reported an error; an `error` detail says which.
   */
  Failed = "Failed",
  /**
   * The user stopped the reply.
   */
  Cancelled = "Cancelled",
  /**
   * The runtime stopped before the reply finished, such as on shutdown.
   */
  Interrupted = "Interrupted"
}

/**
 * Known operation identifiers carried in a request's `method` field. Values exactly match the
 * PascalCase member names, such as `ProviderList`. Each member describes its parameter and result
 * types; a method without parameters carries `null`, and one without a result answers `null`.
 */
export declare enum MethodName {
  /**
   * Pauses an idle runtime's request admission for the authenticated caller's connection. Null payload.
   * Refused while a request or provider reply is active; renewed by the owner repeating the call.
   * The lease expires or is released when the owner disconnects. This does not stop the runtime or authorize installation.
   */
  RuntimePause = "RuntimePause",
  /**
   * Resumes admission for a pause owned by the caller; null payload. Another connection cannot release it.
   */
  RuntimeResume = "RuntimeResume",
  /**
   * Stops an idle runtime held by the caller's pause; acknowledges after provider and database closure. Null payload.
   */
  RuntimeStopForUpdate = "RuntimeStopForUpdate",
  /**
   * Freezes a registered desktop and awaits its renderer checkpoints for the supplied update id.
   */
  DesktopPrepareUpdate = "DesktopPrepareUpdate",
  /**
   * Releases the named desktop preparation after a failed update attempt.
   */
  DesktopResumeUpdate = "DesktopResumeUpdate",
  /**
   * Closes a prepared desktop after saving its workspace.
   */
  DesktopCloseForUpdate = "DesktopCloseForUpdate",
  /**
   * Lists saved teammates. Parameters: `null`. Result: an array of `Teammate`.
   */
  TeammateList = "TeammateList",
  /**
   * Creates a teammate. Parameters: `TeammateCreateParams`. Result: `Teammate`.
   */
  TeammateCreate = "TeammateCreate",
  /**
   * Updates a teammate. Parameters: `TeammateUpdateParams`. Result: `Teammate`.
   */
  TeammateUpdate = "TeammateUpdate",
  /**
   * Deletes a teammate. Parameters: `TeammateIdParams`. Result: `null`.
   */
  TeammateDelete = "TeammateDelete",
  /**
   * Adds a teammate to a conversation. Parameters: `ConversationMemberParams`. Result: `ConversationMember`.
   */
  ConversationAddMember = "ConversationAddMember",
  /**
   * Removes a teammate from a conversation. Parameters: `ConversationMemberParams`. Result: `null`.
   */
  ConversationRemoveMember = "ConversationRemoveMember",
  /**
   * Lists conversation memberships. Parameters: `ConversationIdParams`. Result: an array of `ConversationMember`.
   */
  ConversationListMembers = "ConversationListMembers",
  /** Prepares one bounded file for a subsequent message; AttachmentInput in, MessageAttachment out. */
  AttachmentPrepare = "AttachmentPrepare",
  /** Discards a prepared MessageAttachment; refuses committed message assets. */
  AttachmentDiscard = "AttachmentDiscard",
  /**
   * Pages provider action summaries using MessagePageParams; returns ReplyPage.
   */
  MessageActivityPage = "MessageActivityPage",
  /**
   * Pages file change summaries using MessagePageParams; returns ReplyPage.
   */
  MessageChangesPage = "MessageChangesPage",
  /**
   * Reads one ReplySummary using MessageIdParams, or null after deletion.
   */
  MessageSummary = "MessageSummary",
  /**
   * Reads one message with its non-text details using MessageIdParams, or null after deletion.
   */
  MessageDetails = "MessageDetails",

  /**
   * Lists all currently open provider replies; the payload is null.
   */
  MessageListOpen = "MessageListOpen",
  /**
   * Lists all currently pending approvals; the payload is null.
   */
  ApprovalListPending = "ApprovalListPending",
  /**
   * Lists the registered providers. Parameters: none, `null` on the wire. Result:
   * an array of `ProviderDescriptor`.
   */
  ProviderList = "ProviderList",
  /**
   * Lists the models a provider reports, optionally through a given account. Parameters:
   * `ProviderListModelsParams`. Result: an array of model names.
   */
  ProviderListModels = "ProviderListModels",
  ProviderModelCatalog = "ProviderModelCatalog",
  /**
   * Lists the provider accounts. Parameters: none, `null` on the wire. Result:
   * an array of `ProviderAccount`.
   */
  ProviderAccountList = "ProviderAccountList",
  /**
   * Creates a provider account for a profile directory the provider tooling will own. Parameters:
   * `ProviderAccountCreateParams`. Result: `ProviderAccount`.
   */
  ProviderAccountCreate = "ProviderAccountCreate",
  /**
   * Runs the adapter's sign-in check and records what it observed. Parameters:
   * `ProviderAccountIdParams`. Result: `ProviderAccount`.
   */
  ProviderAccountCheck = "ProviderAccountCheck",
  /**
   * Forgets a provider account; the profile directory is left in place. Parameters:
   * `ProviderAccountIdParams`. Result: none, `null` on the wire.
   */
  ProviderAccountDelete = "ProviderAccountDelete",
  /**
   * Lists the projects. Parameters: none, `null` on the wire. Result: an array of `Project`.
   */
  ProjectList = "ProjectList",
  /**
   * Opens a folder as a project, creating the project on first open. Parameters:
   * `ProjectOpenParams`. Result: `Project`.
   */
  ProjectOpen = "ProjectOpen",
  /**
   * Forgets a project and its conversations; the folder is left untouched. Parameters:
   * `ProjectIdParams`. Result: none, `null` on the wire.
   */
  ProjectForget = "ProjectForget",
  /**
   * Lists a project's conversations. Parameters: `ProjectIdParams`. Result:
   * an array of `Conversation`.
   */
  ConversationList = "ConversationList",
  /**
   * Creates a conversation in a project. Parameters: `ConversationCreateParams`. Result:
   * `Conversation`.
   */
  ConversationCreate = "ConversationCreate",
  /**
   * Renames a conversation. Parameters: `ConversationRenameParams`. Result: `Conversation`.
   */
  ConversationRename = "ConversationRename",
  ConversationMove = "ConversationMove",
  /**
   * Deletes a conversation with its messages and approvals. Parameters: `ConversationIdParams`.
   * Result: none, `null` on the wire.
   */
  ConversationDelete = "ConversationDelete",
  /**
   * Removes a message and everything after it, marks the conversation so that its next reply starts a fresh provider
   * session fed with the kept transcript, and optionally restores the project's files to the snapshot taken before the
   * removed reply started (git projects). Parameters: `ConversationRewindParams`. Result:
   * `ConversationRewindResult`. Fails with `Conflict` while a reply is open, `NotFound` for an unknown conversation
   * or message.
   */
  ConversationRewind = "ConversationRewind",
  /**
   * Finds conversations whose title or message texts contain a text, case-insensitively for ASCII, one hit per
   * conversation (the title when it matches, else the latest matching message with a snippet), the latest first.
   * Parameters: `ConversationSearchParams`. Result: `ConversationSearchResult`.
   */
  ConversationSearch = "ConversationSearch",
  /**
   * Lists a conversation's messages with their details, optionally after a sequence. Parameters:
   * `MessageListParams`. Result: an array of `Message`.
   */
  MessageList = "MessageList",
  MessagePage = "MessagePage",
  /**
   * Stores the user's message and queues its replies; fails with `Conflict` while a reply is
   * pending or running. Parameters: `MessageSendParams`. Result: `MessageSendResult`.
   */
  MessageSend = "MessageSend",
  /**
   * Cancels a running reply. Parameters: `MessageIdParams`. Result: `Message`.
   */
  MessageCancel = "MessageCancel",
  /**
   * Lists a conversation's pending approvals. Parameters: `ConversationIdParams`. Result:
   * an array of `Approval`.
   */
  ApprovalList = "ApprovalList",
  /**
   * Decides a pending approval by choosing one of its options. Parameters: `ApprovalDecideParams`.
   * Result: `Approval`.
   */
  ApprovalDecide = "ApprovalDecide",
  /**
   * Lists the terminals the calling connection opened, oldest first. Parameters: `null`. Result: an array of
   * `TerminalState`.
   */
  TerminalList = "TerminalList",
  /**
   * Lists the shells installed on the computer, found again on each call, with the platform's default shell marked.
   * Parameters: `null`. Result: an array of `TerminalShell`.
   */
  TerminalShells = "TerminalShells",
  /**
   * Starts a shell, the platform's default shell unless the parameters name another, in a project's folder or in the
   * person's home folder, with a fresh environment read from the operating system. The terminal belongs to the calling
   * connection: only it receives the terminal's events and can use it, and the terminal ends when that connection
   * closes. Parameters: `TerminalOpenParams`. Result: `TerminalState`. Fails with `NotFound` for an unknown project, a
   * missing folder or a shell that is not installed, and `Unavailable` when the shell cannot start.
   */
  TerminalOpen = "TerminalOpen",
  /**
   * Types into a terminal's shell. Parameters: `TerminalInputParams`. Result: `null`. Fails with `Conflict` after the
   * shell exited.
   */
  TerminalInput = "TerminalInput",
  /**
   * Resizes a terminal. The new size applies after the output already received, at the `TerminalChanged` event that
   * reports it; resizing to the current size does nothing. Parameters: `TerminalResizeParams`. Result: `null`.
   */
  TerminalResize = "TerminalResize",
  /**
   * Starts the terminal's shell again, ending the running one first. The screen joins the stored lines and the new
   * shell starts on an empty screen, reported by `TerminalChanged`. Parameters: `TerminalIdParams`. Result:
   * `TerminalState`.
   */
  TerminalRestart = "TerminalRestart",
  /**
   * Ends a terminal's shell and deletes its stored lines. Parameters: `TerminalIdParams`. Result: `null`.
   */
  TerminalClose = "TerminalClose",
  /**
   * Reads a terminal's current screen, for a window that attaches to a running terminal. Parameters:
   * `TerminalIdParams`. Result: `TerminalScreen`.
   */
  TerminalScreen = "TerminalScreen",
  /**
   * Reads a page of a terminal's stored lines. Parameters: `TerminalLinesParams`. Result: `TerminalLinePage`.
   */
  TerminalLines = "TerminalLines",
  /**
   * Reports how much of a terminal's output the caller has processed, counted as the length of the `data` strings of
   * its `TerminalOutput` events. The runtime pauses a shell while about a million characters of the output it sent are
   * not acknowledged, and resumes it as acknowledgements arrive. `TerminalScreen` counts all output before the screen it
   * returns as acknowledged, and an acknowledgement never counts more than the output still waiting. Parameters:
   * `TerminalAcknowledgeParams`. Result: `null`.
   */
  TerminalAcknowledge = "TerminalAcknowledge"
}

/**
 * Known event identifiers carried in an event's `name` field. Values exactly match the PascalCase
 * member names, such as `MessageCreated`. Each member describes its payload; models use their JSON form.
 */
export declare enum EventName {
  /**
   * Catalog or connection state changed; clients reload their catalog and active work, preserving message windows. Payload: null.
   */
  StateInvalidated = "StateInvalidated",
  /**
   * The desktop reconnected and may have missed message events; reload catalog, active work, and the selected conversation. Payload: null.
   */
  StateResyncRequested = "StateResyncRequested",
  /**
   * A message was stored: the user's, a provider's pending reply, or a note from TeamRun. Payload:
   * `Message`.
   */
  MessageCreated = "MessageCreated",
  /**
   * A message's status, provenance, or end time changed. Payload: `Message`.
   */
  MessageUpdated = "MessageUpdated",
  /**
   * A detail was added to a message. Payload: `DetailEventPayload`.
   */
  DetailAppended = "DetailAppended",
  /**
   * An existing detail changed, such as streamed text or command output. Payload:
   * `DetailEventPayload`.
   */
  DetailUpdated = "DetailUpdated",
  /**
   * A provider asked for permission. Payload: `Approval`.
   */
  ApprovalCreated = "ApprovalCreated",
  /**
   * An approval was decided or cancelled. Payload: `Approval`.
   */
  ApprovalUpdated = "ApprovalUpdated",
  /**
   * A provider account's observed state changed after a check. Payload: `ProviderAccount`.
   */
  ProviderAccountUpdated = "ProviderAccountUpdated",
  /**
   * A conversation was cut: every message from a sequence on is gone. Payload: `ConversationRewoundPayload`.
   */
  ConversationRewound = "ConversationRewound",
  /**
   * A terminal's shell printed output, which the runtime's emulator has processed. Sent only to the connection that
   * owns the terminal. Payload: `TerminalOutputPayload`.
   */
  TerminalOutput = "TerminalOutput",
  /**
   * A terminal's size, exit code or run changed. Sent only to the connection that owns the terminal. Payload:
   * `TerminalState`.
   */
  TerminalChanged = "TerminalChanged"
}

/**
 * Every literal of the protocol package: wire field names, the version separator, and message
 * texts. Code reads names only; enum values stay in their enums.
 */
export declare class Resources {
  /** can install field used by update preparation and recovery. */
  static readonly canInstallField: string;
  /** checkpoint phase field used by update preparation and recovery. */
  static readonly checkpointPhaseField: string;
  /** checkpoint ready field used by update preparation and recovery. */
  static readonly checkpointReadyField: string;
  /**
   * Update snapshot's installed version field.
   */
  public static readonly currentVersionField: string;
  /**
   * Update snapshot's candidate version field.
   */
  public static readonly availableVersionField: string;
  /**
   * Update snapshot's integer percentage field.
   */
  public static readonly progressPercentField: string;
  /**
   * Marks an opted-in local update test.
   */
  public static readonly isTestFeedField: string;
  /**
   * Maximum download percentage: 100.
   */
  public static readonly fullUpdateProgress: number;
  /**
   * Invalid progress error text.
   */
  public static readonly invalidUpdateProgress: string;
  public static readonly mentionMarker: string;
  public static readonly mentionEscape: string;
  public static readonly mentionBacktick: string;
  public static readonly mentionTilde: string;
  public static readonly mentionFenceLength: number;
  public static readonly mentionCandidatePattern: RegExp;
  /**
   * Participant send protocol literal.
   */
  public static readonly defaultResponderSettingsRequired: string;
  /**
   * Participant send protocol literal.
   */
  public static readonly mentionedTeammateIdsField: string;
  /**
   * Participant send protocol literal.
   */
  public static readonly responderTeammateIdField: string;
  /**
   * Participant send protocol literal.
   */
  public static readonly roleAppliedField: string;
  /** Wire field name. */
  public static readonly teammateIdField: string;
  /** Wire field name. */
  public static readonly teammateNameField: string;
  /** Wire field name. */
  public static readonly roleField: string;
  /** Wire field name. */
  public static readonly harnessField: string;
  /** Wire field name. */
  public static readonly joinedAtField: string;
  /** Wire field name. */
  public static readonly mentionsField: string;
  /** Participant validation literal. */
  public static readonly teammateNamePattern: RegExp;
  /** Participant validation literal. */
  public static readonly teammateNameNormalization: "NFC";
  /** Participant validation literal. */
  public static readonly invalidTeammateName: string;
  /** Participant validation literal. */
  public static readonly invalidHarness: string;
  /** Participant validation literal. */
  public static readonly invalidTeammateAuthor: string;
  /** Participant validation literal. */
  public static readonly invalidMessageMentions: string;
  public static readonly descriptionField: string;
  public static readonly isDefaultField: string;
  public static readonly resolvedModelField: string;
  public static readonly supportsImagesField: string;
  /**
   * Attachment array wire key.
   */
  public static readonly attachmentsField: string;
  /**
   * Media type wire key.
   */
  public static readonly mediaTypeField: string;
  /**
   * Base64 payload wire key.
   */
  public static readonly dataField: string;
  /**
   * Byte size wire key.
   */
  public static readonly sizeField: string;
  /**
   * Invalid attachment source diagnostic.
   */
  public static readonly attachmentSourceRequired: string;
  /**
   * Maximum files in one send: 10.
   */
  public static readonly maximumAttachments: number;
  /**
   * Maximum raw bytes per file: 100 MiB.
   */
  public static readonly maximumAttachmentBytes: number;
  /**
   * Maximum bytes per native image: 10 MiB.
   */
  public static readonly maximumAttachmentImageBytes: number;
  /**
   * PNG, JPEG, GIF and WebP MIME types accepted for native image input.
   */
  public static readonly attachmentImageMediaTypes: readonly string[];

  /**
   * The maximumPreviewTitleLength protocol value.
   */
  public static readonly maximumPreviewTitleLength: number;
  /**
   * The previewField protocol value.
   */
  public static readonly previewField: string;
  /**
   * The filesField protocol value.
   */
  public static readonly filesField: string;
  /**
   * The repliesField protocol value.
   */
  public static readonly repliesField: string;
  /**
   * The additionsField protocol value.
   */
  public static readonly additionsField: string;
  /**
   * The deletionsField protocol value.
   */
  public static readonly deletionsField: string;
  /**
   * The hasDiffField protocol value.
   */
  public static readonly hasDiffField: string;
  /**
   * The imageGenerationItemType protocol value.
   */
  public static readonly imageGenerationItemType: string;
  /**
   * The itemTypeField protocol value.
   */
  public static readonly itemTypeField: string;
  /**
   * The workingTreeSource protocol value.
   */
  public static readonly workingTreeSource: string;
  /**
   * The sourceField protocol value.
   */
  public static readonly sourceField: string;
  /**
   * The isErrorField protocol value.
   */
  public static readonly isErrorField: string;
  /**
   * The toolUseIdField protocol value.
   */
  public static readonly toolUseIdField: string;
  /**
   * The moveKind protocol value.
   */
  public static readonly moveKind: string;
  /**
   * The jsonObjectStart protocol value.
   */
  public static readonly jsonObjectStart: string;
  /**
   * The diffContextPrefix protocol value.
   */
  public static readonly diffContextPrefix: string;
  /**
   * The diffRemovedPrefix protocol value.
   */
  public static readonly diffRemovedPrefix: string;
  /**
   * The diffAddedPrefix protocol value.
   */
  public static readonly diffAddedPrefix: string;
  /**
   * The diffHunkPrefix protocol value.
   */
  public static readonly diffHunkPrefix: string;
  /**
   * The diffRemovedFilePrefix protocol value.
   */
  public static readonly diffRemovedFilePrefix: string;
  /**
   * The diffAddedFilePrefix protocol value.
   */
  public static readonly diffAddedFilePrefix: string;
  /**
   * The lineSeparator protocol value.
   */
  public static readonly lineSeparator: string;
  /**
   * The contentField protocol value.
   */
  public static readonly contentField: string;
  /**
   * The addKind protocol value.
   */
  public static readonly addKind: string;
  /**
   * The writeTool protocol value.
   */
  public static readonly writeTool: string;
  /**
   * The editsField protocol value.
   */
  public static readonly editsField: string;
  /**
   * The multiEditTool protocol value.
   */
  public static readonly multiEditTool: string;
  /**
   * The newStringField protocol value.
   */
  public static readonly newStringField: string;
  /**
   * The oldStringField protocol value.
   */
  public static readonly oldStringField: string;
  /**
   * The updateKind protocol value.
   */
  public static readonly updateKind: string;
  /**
   * The editTool protocol value.
   */
  public static readonly editTool: string;
  /**
   * The filePathField protocol value.
   */
  public static readonly filePathField: string;
  /**
   * The inputField protocol value.
   */
  public static readonly inputField: string;
  /**
   * The toolField protocol value.
   */
  public static readonly toolField: string;
  /**
   * The diffField protocol value.
   */
  public static readonly diffField: string;
  /**
   * The pathField protocol value.
   */
  public static readonly pathField: string;
  /**
   * The changesField protocol value.
   */
  public static readonly changesField: string;
  /**
   * The beforeSequenceField protocol value.
   */
  public static readonly beforeSequenceField: string;
  /**
   * The kindsField protocol value.
   */
  public static readonly kindsField: string;
  /**
   * The messagesField protocol value.
   */
  public static readonly messagesField: string;
  /**
   * The hasEarlierField protocol value.
   */
  public static readonly hasEarlierField: string;
  /**
   * The hasLaterField protocol value.
   */
  public static readonly hasLaterField: string;
  /**
   * The maximumPageSize protocol value.
   */
  public static readonly maximumPageSize: number;
  /**
   * The pageCursorsMismatch protocol value.
   */
  public static readonly pageCursorsMismatch: string;

  /**
   * The protocol version this package implements as `major.minor` text, stamped by the build from
   * the root manifest's `teamrun.protocolVersion`. A `0` major means pre-release.
   */
  public static readonly protocolVersion: string;
  /**
   * Separator between the parts of a protocol version: `.`.
   */
  public static readonly versionSeparator: string;
  /**
   * Decimal major/minor text pattern; the parser requires the match to cover the entire input.
   */
  public static readonly versionTextPattern: RegExp;
  /**
   * Name of the field that carries a message's `WireMessageKind`: `kind`.
   */
  public static readonly kindField: string;
  /**
   * Name of the field that correlates requests and responses: `id`.
   */
  public static readonly idField: string;
  /**
   * Name of the hello's version field: `version`.
   */
  public static readonly versionField: string;
  /**
   * Name of a protocol version's major field: `major`.
   */
  public static readonly majorField: string;
  /**
   * Name of a protocol version's minor field: `minor`.
   */
  public static readonly minorField: string;
  /**
   * Name of the hello's token field: `token`.
   */
  public static readonly tokenField: string;
  /**
   * Name of the hello's client field: `client`.
   */
  public static readonly clientField: string;
  /**
   * Name of a request's method field: `method`.
   */
  public static readonly methodField: string;
  /**
   * Name of an error's message field: `message`.
   */
  public static readonly messageField: string;
  /**
   * Name of an error's detail field: `detail`.
   */
  public static readonly detailField: string;
  /**
   * Name of an event's name field: `name`.
   */
  public static readonly nameField: string;
  /**
   * Name of the field that carries a request's parameters, a response's result, or an event's
   * payload: `payload`.
   */
  public static readonly payloadField: string;
  /**
   * Name of the response field that carries the failure's info: `info`.
   */
  public static readonly infoField: string;
  /**
   * Name of the info field that carries the failure's arguments: `arguments`.
   */
  public static readonly argumentsField: string;
  /**
   * Path reported for a response's payload when a reader rejects it: `$.payload`.
   */
  public static readonly payloadPath: string;
  /**
   * Name of the creation timestamp field of a model: `createdAt`.
   */
  public static readonly createdAtField: string;
  /**
   * Name of the last-update timestamp field of a model: `updatedAt`.
   */
  public static readonly updatedAtField: string;
  /**
   * Name of the field carrying a registered provider id: `provider`.
   */
  public static readonly providerField: string;
  /**
   * Name of a provider account's label field: `label`.
   */
  public static readonly labelField: string;
  /**
   * Name of a provider account's profile directory field: `profileDir`.
   */
  public static readonly profileDirField: string;
  /**
   * Name of a provider account's `AuthStatus` field: `authStatus`.
   */
  public static readonly authStatusField: string;
  /**
   * Name of a provider account's identity field: `identity`.
   */
  public static readonly identityField: string;
  /**
   * Name of an observed harness version field: `harnessVersion`.
   */
  public static readonly harnessVersionField: string;
  /**
   * Name of a provider account's last-check timestamp field: `lastCheckedAt`.
   */
  public static readonly lastCheckedAtField: string;
  /**
   * Name of a provider account's last-error field: `lastError`.
   */
  public static readonly lastErrorField: string;
  /**
   * Name of a provider account identity's email field: `email`.
   */
  public static readonly emailField: string;
  /**
   * Name of a provider account identity's plan field: `plan`.
   */
  public static readonly planField: string;
  /**
   * Name of a provider account identity's organization field: `organization`.
   */
  public static readonly organizationField: string;
  /**
   * Name of a provider account identity's authentication method field: `authMethod`.
   */
  public static readonly authMethodField: string;
  /**
   * Name of a project's root path field: `rootPath`.
   */
  public static readonly rootPathField: string;
  /**
   * Name of the field referencing a project: `projectId`.
   */
  public static readonly projectIdField: string;
  /**
   * Name of a title field: `title`.
   */
  public static readonly titleField: string;
  /**
   * Name of the field referencing a conversation: `conversationId`.
   */
  public static readonly conversationIdField: string;
  /**
   * Name of a message's position field: `sequence`.
   */
  public static readonly sequenceField: string;
  /**
   * Name of a message's `MessageAuthor` field: `author`.
   */
  public static readonly authorField: string;
  /**
   * Name of the field referencing the message a reply answers: `inReplyTo`.
   */
  public static readonly inReplyToField: string;
  /**
   * Name of a message's details field: `details`.
   */
  public static readonly detailsField: string;
  /**
   * Name of a provider message's provenance field: `provenance`.
   */
  public static readonly provenanceField: string;
  /**
   * Name of the field referencing a message: `messageId`.
   */
  public static readonly messageIdField: string;
  /**
   * Name of a message's text field: `text`.
   */
  public static readonly textField: string;
  /**
   * Name of the field referencing a provider account: `providerAccountId`.
   */
  public static readonly providerAccountIdField: string;
  /**
   * Name of a provenance's requested settings field: `requested`.
   */
  public static readonly requestedField: string;
  /**
   * Name of a provenance's observed settings field: `observed`.
   */
  public static readonly observedField: string;
  /**
   * Name of a model name field: `model`.
   */
  public static readonly modelField: string;
  /**
   * Name of a reasoning effort field: `effort`.
   */
  public static readonly effortField: string;
  /**
   * Name of a provenance's native session field: `nativeSessionId`.
   */
  public static readonly nativeSessionIdField: string;
  /**
   * Name of a provenance's resumed-session flag: `resumedNativeSession`.
   */
  public static readonly resumedNativeSessionField: string;
  /**
   * Name of a provenance's native turn id: `nativeTurnId`.
   */
  public static readonly nativeTurnIdField: string;
  /**
   * Name of a status field: `status`.
   */
  public static readonly statusField: string;
  /**
   * Name of a reply's start timestamp field: `startedAt`.
   */
  public static readonly startedAtField: string;
  /**
   * Name of a message's end timestamp field: `endedAt`.
   */
  public static readonly endedAtField: string;
  /**
   * Name of an approval's summary field: `summary`.
   */
  public static readonly summaryField: string;
  /**
   * Name of an approval's decision timestamp field: `decidedAt`.
   */
  public static readonly decidedAtField: string;
  /**
   * Name of an approval's provider-defined kind field: `nativeKind`.
   */
  public static readonly nativeKindField: string;
  /**
   * Name of an approval's options field: `options`.
   */
  public static readonly optionsField: string;
  /**
   * Name of an approval's decision field: `decision`.
   */
  public static readonly decisionField: string;
  /**
   * Name of an approval option's outcome field: `outcome`.
   */
  public static readonly outcomeField: string;
  /**
   * Name of a provider descriptor's display name field: `displayName`.
   */
  public static readonly displayNameField: string;
  /**
   * Name of a provider descriptor's effort levels field: `effortLevels`.
   */
  public static readonly effortLevelsField: string;
  /**
   * Name of a provider descriptor's resume flag: `supportsResume`.
   */
  public static readonly supportsResumeField: string;
  /**
   * Name of a provider descriptor's sign-in check flag: `supportsSignInCheck`.
   */
  public static readonly supportsSignInCheckField: string;
  /**
   * Name of a provider descriptor's fork flag: `supportsFork`.
   */
  public static readonly supportsForkField: string;
  /**
   * Name of a message listing's lower bound field: `afterSequence`.
   */
  public static readonly afterSequenceField: string;
  public static readonly restoreFilesField: string;
  /**
   * Name of a search's text: `query`.
   */
  public static readonly queryField: string;
  /**
   * Name of a search's limit: `limit`.
   */
  public static readonly limitField: string;
  /**
   * Name of a search result's hits: `hits`.
   */
  public static readonly hitsField: string;
  /**
   * Name of a search hit's snippet: `snippet`.
   */
  public static readonly snippetField: string;
  /**
   * The most hits a search may ask for: 100.
   */
  public static readonly maximumSearchLimit: number;
  /**
   * Message of the exception a search limit outside 1–100 raises.
   */
  public static readonly searchLimitOutOfRange: string;
  public static readonly removedMessageIdsField: string;
  public static readonly restoredFilesField: string;
  public static readonly fromSequenceField: string;
  public static readonly sessionResetField: string;
  /**
   * Name of a conversation's forked session field: `forkedSession`.
   */
  public static readonly forkedSessionField: string;
  /**
   * Name of a rewind result's kept-session flag: `sessionKept`.
   */
  public static readonly sessionKeptField: string;
  public static readonly conversationField: string;
  /**
   * Name of a send result's stored user message field: `sent`.
   */
  public static readonly sentField: string;
  /**
   * Name of the field referencing an approval: `approvalId`.
   */
  public static readonly approvalIdField: string;
  /**
   * Name of the field naming a chosen approval option: `optionId`.
   */
  public static readonly optionIdField: string;
  /**
   * Name of the field referencing a terminal: `terminalId`.
   */
  public static readonly terminalIdField: string;
  /**
   * Name of a terminal size's width field: `columns`.
   */
  public static readonly columnsField: string;
  /**
   * Name of a terminal size's height field: `rows`.
   */
  public static readonly rowsField: string;
  /**
   * Name of a terminal's shell name field: `shell`.
   */
  public static readonly shellField: string;
  /**
   * Name of the field naming the shell a terminal opens with: `shellId`.
   */
  public static readonly shellIdField: string;
  /**
   * Name of a terminal's exit code field: `exitCode`.
   */
  public static readonly exitCodeField: string;
  /**
   * Name of a terminal's restart count field: `restartCount`.
   */
  public static readonly restartCountField: string;
  /**
   * Name of the field carrying a terminal's range of stored lines: `stored`.
   */
  public static readonly storedField: string;
  /**
   * Name of the field carrying where a range or page starts: `start`.
   */
  public static readonly startField: string;
  /**
   * Name of the field carrying where a range ends: `end`.
   */
  public static readonly endField: string;
  /**
   * Name of a page's terminal lines field: `lines`.
   */
  public static readonly linesField: string;
  /**
   * Name of a terminal line's wrapped field: `wrapped`.
   */
  public static readonly wrappedField: string;
  /**
   * Name of a terminal line's style runs field: `runs`.
   */
  public static readonly runsField: string;
  /**
   * Name of a text run's length field: `length`.
   */
  public static readonly lengthField: string;
  /**
   * Name of a text run's text color field: `foreground`.
   */
  public static readonly foregroundField: string;
  /**
   * Name of a text run's background color field: `background`.
   */
  public static readonly backgroundField: string;
  /**
   * Name of a text run's style flags field: `style`.
   */
  public static readonly styleField: string;
  /**
   * Name of a terminal screen's state field: `state`.
   */
  public static readonly stateField: string;
  /**
   * Name of a terminal screen's serialized screen field: `screen`.
   */
  public static readonly screenField: string;
  /**
   * The narrowest terminal in columns: 2, the least a terminal emulator draws.
   */
  public static readonly minimumTerminalColumns: number;
  /**
   * The widest terminal in columns: 1000.
   */
  public static readonly maximumTerminalColumns: number;
  /**
   * The tallest terminal in rows: 1000.
   */
  public static readonly maximumTerminalRows: number;
  /**
   * The color value that means the terminal's default color: -1.
   */
  public static readonly defaultTerminalColor: number;
  /**
   * How many palette colors a terminal has; palette colors are 0 through 255.
   */
  public static readonly terminalPaletteSize: number;
  /**
   * The value added to a 24-bit RGB color: `0x1000000`, so `0x1ff0000` is red.
   */
  public static readonly terminalRgbColor: number;
  /**
   * The largest color value: `0x1ffffff`, white as an RGB color.
   */
  public static readonly maximumTerminalColor: number;
  /**
   * Every `TerminalTextStyle` flag combined: `0x1ff`.
   */
  public static readonly terminalTextStyles: number;
  /**
   * Message for a range of terminal lines that ends before it starts.
   */
  public static readonly terminalLineRangeReversed: string;
  /**
   * Message for text runs whose lengths do not add up to their line's text.
   */
  public static readonly terminalRunsMismatch: string;
  /**
   * Message for a page of terminal lines that reaches outside the stored lines.
   */
  public static readonly terminalPageOutsideStored: string;
  /**
   * Message for provenance present on a message that is not a provider's, or absent on one that is.
   */
  public static readonly provenanceMismatch: string;
  /**
   * Message for an end time present on an open message or absent on an ended one.
   */
  public static readonly messageEndMismatch: string;
  /**
   * Message for a start time on a message that is not a provider's reply or on a reply still waiting, or none on a provider's
   * reply that runs or awaits approval.
   */
  public static readonly messageStartMismatch: string;
  /**
   * Message for a provider's message flagged as resumed without a native session id.
   */
  public static readonly resumedWithoutSession: string;
  /**
   * Message for an approval whose decision timestamp contradicts its status.
   */
  public static readonly approvalDecisionMismatch: string;
  /**
   * Message for an approval with no options or with duplicate option ids.
   */
  public static readonly approvalWithoutOptions: string;
  /**
   * Message for a decision present on a pending or cancelled approval, or absent on a decided one.
   */
  public static readonly decisionStatusMismatch: string;
  /**
   * Message for a decision that names no offered option.
   */
  public static readonly unknownDecision: string;
  /**
   * Message for a chosen option whose outcome contradicts the approval's status.
   */
  public static readonly decisionOutcomeMismatch: string;
  /**
   * Message for protocol version text that is not two non-negative decimal integers separated by a dot.
   */
  public static readonly versionTextInvalid: string;
  /**
   * Name of the text parameter of `ProtocolVersion.parse`, reported by its argument exception.
   */
  public static readonly versionParameterName: string;
  /**
   * Message of the invariant that a successful response carries no info.
   */
  public static readonly successForbidsInfo: string;
  /**
   * Message of the invariant that a failed response carries its info.
   */
  public static readonly failureRequiresInfo: string;
  /**
   * Message of the invariant that a failed response carries no payload.
   */
  public static readonly failureForbidsPayload: string;
  /**
   * Message of the invariant that a failure's info is named by an `ErrorCode`.
   */
  public static readonly unknownErrorCode: string;

}

/**
 * Base of every message that crosses a process boundary.
 *
 * @remarks
 * A message owns its wire form: its constructor checks its invariants, `toJson` produces plain
 * JSON with the kind first, and each subclass declares a static `fromJson` that narrows untrusted
 * input through a `JsonReader`. Instances never cross a boundary; their JSON does.
 */
export declare abstract class WireMessage {
  /**
   * Discriminator written to the wire as the `kind` field.
   */
  public abstract readonly kind: WireMessageKind;

  /**
   * Renders the message as plain JSON.
   * @returns The `kind` field followed by the message's own fields.
   */
  public toJson(): JsonObject;

  /**
   * Renders the message as one line of JSON text, the form sent over a stream.
   * @returns The JSON text without line breaks.
   */
  public toText(): string;

  /**
   * Renders the message's own fields, without the kind.
   * @returns The fields as JSON.
   */
  protected abstract toJsonFields(): JsonObject;
}

/**
 * Version of the wire contract.
 *
 * @remarks
 * Compatibility currently requires an exact major and minor version match. Older and newer
 * protocol versions are rejected; accepting unknown fields does not establish compatibility.
 */
export declare class ProtocolVersion {
  /**
   * The version this package implements, parsed from `Resources.protocolVersion`, which the build
   * stamps from the root manifest. A `0` major means pre-release: the contract may still change
   * between minors.
   */
  public static readonly current: ProtocolVersion;
  /**
   * The major protocol version component.
   */
  public readonly major: number;
  /**
   * The minor protocol version component; compatibility requires an exact match.
   */
  public readonly minor: number;

  /**
   * Initializes the version.
   * @param major The major part, a non-negative integer.
   * @param minor The minor part, a non-negative integer.
   * @throws ArgumentOutOfRangeException when either part is negative or not an integer.
   */
  public constructor(major: number, minor: number);

  /**
   * Parses `major.minor` text, the form used in configuration and shown to users.
   * @param text Two nonempty sequences of ASCII decimal digits separated by one dot, such as `0.1`.
   * Leading zeroes are accepted; signs, whitespace, base prefixes and exponents are rejected.
   * @returns The version.
   * @throws ArgumentException when the text has another form or either component overflows a finite number.
   */
  public static parse(text: string): ProtocolVersion;

  /**
   * Reads a version from untrusted JSON.
   * @param value The untrusted value, expected to be an object with integer `major` and `minor`
   * fields.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The version.
   * @throws JsonException when the value is not such an object.
   */
  public static fromJson(value: unknown, path?: string): ProtocolVersion;

  /**
   * Decides whether a runtime at this version can serve a client.
   * @param client The version the client speaks.
   * @returns `true` when the client's major and minor both equal this version.
   */
  public canServe(client: ProtocolVersion): boolean;

  /**
   * Compares two versions.
   * @param other The version to compare with.
   * @returns `true` when major and minor are both equal.
   */
  public equals(other: ProtocolVersion): boolean;

  /**
   * Renders the version as plain JSON.
   * @returns An object with `major` and `minor` fields.
   */
  public toJson(): JsonObject;

  /**
   * Renders the version as text.
   * @returns The version as `major.minor`, such as `1.0`.
   */
  public toString(): string;
}

/**
 * First message on a connection: the client's protocol version, its capability token, and a name
 * for diagnostics.
 *
 * @remarks
 * The runtime answers a hello with a `Response` when the token is valid and the version can be
 * served, and with a failed `Response` named `Unauthorized` or `VersionMismatch` otherwise.
 */
export declare class Hello extends WireMessage {
  /**
   * Always `WireMessageKind.Hello`.
   */
  public override readonly kind: WireMessageKind;
  /**
   * The protocol version the client speaks.
   */
  public readonly version: ProtocolVersion;
  /**
   * The capability token that authorizes the connection.
   */
  public readonly token: string;
  /**
   * The client's name for diagnostics, such as `cli` or `desktop`.
   */
  public readonly client: string;

  /**
   * Initializes the hello.
   * @param version The protocol version the client speaks.
   * @param token The capability token; must not be blank.
   * @param client The client's name for diagnostics; must not be blank.
   * @throws ArgumentException when the token or the client name is blank.
   */
  public constructor(version: ProtocolVersion, token: string, client: string);

  /**
   * Reads a hello from untrusted JSON.
   * @param value The untrusted value, expected to carry `version`, `token`, and `client`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The hello.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): Hello;

  /**
   * Renders the message's own fields.
   * @returns The `version`, `token`, and `client` fields.
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * A call from a client to the runtime.
 *
 * @remarks
 * The id correlates the `Response`. The payload is the method's own JSON, narrowed by the
 * method's parameter class in the runtime.
 */
export declare class Request extends WireMessage {
  /**
   * Always `WireMessageKind.Request`.
   */
  public override readonly kind: WireMessageKind;
  /**
   * Client-chosen identifier, unique per connection, echoed by the response.
   */
  public readonly id: string;
  /**
   * Name of the runtime method to call.
   */
  public readonly method: string;
  /**
   * The method's parameters as JSON; `null` when the method takes none.
   */
  public readonly payload: JsonValue;

  /**
   * Initializes the request.
   * @param id The client-chosen identifier; must not be blank.
   * @param method The runtime method's name; must not be blank.
   * @param payload The method's parameters as JSON, or `null` for none.
   * @throws ArgumentException when the id or the method is blank.
   */
  public constructor(id: string, method: string, payload: JsonValue);

  /**
   * Reads a request from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `method`, and `payload`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The request.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): Request;

  /**
   * Renders the message's own fields.
   * @returns The `id`, `method`, and `payload` fields.
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * The answer to a request: the service envelope on the wire (D12). A success carries the
 * method's result as the payload; a failure carries the info that says why, named by an
 * `ErrorCode`, and no payload. A `null` id answers a hello or reports a connection-level failure.
 *
 * @remarks
 * `fromServiceResponse` and `withPayload` convert between this message and the foundation's typed
 * `ServiceResponse<T>`, so services and clients never touch the wire form. Instances come from the
 * factories.
 */
export declare class Response extends WireMessage {
  /**
   * Always `WireMessageKind.Response`.
   */
  public override readonly kind: WireMessageKind;
  /**
   * Identifier of the request being answered, or `null` for the answer to a hello or a failure
   * not tied to a request.
   */
  public readonly id: string | null;
  /**
   * Whether the request was honoured.
   */
  public readonly status: ServiceResponseStatus;
  /**
   * Why the request was not honoured, named by an `ErrorCode`; `null` on success.
   */
  public readonly info: ServiceResponseInfo | null;
  /**
   * The method's result as JSON; `null` on failure and when the method returns nothing.
   */
  public readonly payload: JsonValue;

  /**
   * True when the status is `Failure`.
   */
  public get hasErrors(): boolean;

  /**
   * Returns a success.
   * @param id Identifier of the request being answered, or `null`; a non-null id must not be blank.
   * @param payload The method's result as JSON, or `null` for none.
   * @returns The response.
   * @throws ArgumentException when a non-null id is blank.
   */
  public static success(id: string | null, payload: JsonValue): Response;

  /**
   * Returns a failure.
   * @param id Identifier of the failed request, or `null` for a connection-level failure.
   * @param info Why the request was not honoured; its name must be an `ErrorCode` value.
   * @returns The response.
   * @throws ArgumentException when a non-null id is blank or the info's name is not an error code.
   */
  public static failure(id: string | null, info: ServiceResponseInfo): Response;

  /**
   * Converts a typed service response to the wire: a failure keeps its info, a success writes its
   * payload with the writer, or `null` when it has none.
   * @param id Identifier of the request being answered, or `null`.
   * @param response The typed response.
   * @param writePayload Writes the payload as JSON.
   * @returns The response.
   */
  public static fromServiceResponse<T>(id: string | null, response: ServiceResponse<T>, writePayload: PayloadWriter<T>): Response;

  /**
   * Reads a response from untrusted JSON.
   * @param value The untrusted value, expected to carry `id` (possibly `null`), `status`, `info`
   * (an object with `name`, `message`, and `arguments`, or `null`), and `payload`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The response.
   * @throws JsonException when a field is missing or invalid, or the info's name is not an
   * `ErrorCode`; ArgumentException when the status contradicts the info or the payload.
   */
  public static fromJson(value: unknown, path?: string): Response;

  /**
   * Converts to the typed service response: a failure keeps its info, a success reads its payload
   * with the reader at `$.payload`, or carries `null` when there is none.
   * @param readPayload Reads the payload from its JSON value.
   * @returns The typed response.
   * @throws JsonException when the reader rejects the payload.
   */
  public withPayload<T>(readPayload: PayloadReader<T>): ServiceResponse<T>;

  /**
   * Renders the message's own fields.
   * @returns The `id`, `status`, `info`, and `payload` fields.
   */
  protected override toJsonFields(): JsonObject;

  private constructor(id: string | null, status: ServiceResponseStatus, info: ServiceResponseInfo | null, payload: JsonValue);
}

/**
 * A notification pushed by the runtime to every attached client.
 *
 * @remarks
 * The name selects the payload's class; the payload is narrowed by that class in the client.
 */
export declare class Event extends WireMessage {
  /**
   * Always `WireMessageKind.Event`.
   */
  public override readonly kind: WireMessageKind;
  /**
   * Name of the event, such as `run.updated`.
   */
  public readonly name: string;
  /**
   * The event's payload as JSON; `null` when the event carries none.
   */
  public readonly payload: JsonValue;

  /**
   * Initializes the event.
   * @param name The event's name; must not be blank.
   * @param payload The payload as JSON, or `null` for none.
   * @throws ArgumentException when the name is blank.
   */
  public constructor(name: string, payload: JsonValue);

  /**
   * Reads an event from untrusted JSON.
   * @param value The untrusted value, expected to carry `name` and `payload`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The event.
   * @throws JsonException when a field is missing or invalid.
   */
  public static fromJson(value: unknown, path?: string): Event;

  /**
   * Renders the message's own fields.
   * @returns The `name` and `payload` fields.
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * Turns text or a value received at a boundary into the wire message it carries.
 *
 * @remarks
 * This is the protocol's one dispatcher: it reads the `kind` field and hands the value to that
 * kind's `fromJson`. The result is the concrete message; callers narrow it with `instanceof`.
 *
 * @example
 * ```ts
 * const message = new WireDecoder().decodeText(line);
 * if (message instanceof Request)
 *   handle(message.method, message.payload);
 * ```
 */
export declare class WireDecoder {
  /**
   * Decodes one line of JSON text.
   * @param text The JSON text of one message.
   * @returns The concrete message: a `Hello`, `Request`, `Response`, or `Event`.
   * @throws JsonException when the text is not valid JSON, has no known `kind`, or fails that
   * kind's validation.
   */
  public decodeText(text: string): WireMessage;

  /**
   * Decodes an untrusted value that has already been parsed, such as a structured-clone payload.
   * @param value The untrusted value.
   * @returns The concrete message: a `Hello`, `Request`, `Response`, or `Event`.
   * @throws JsonException when the value has no known `kind` or fails that kind's validation.
   */
  public decodeValue(value: unknown): WireMessage;
}

/**
 * A provider's request for permission while producing a message, the choices the provider offers,
 * and the user's decision. TeamRun classifies the request for rendering and owns its status; the
 * provider's own kind and decision vocabulary travel verbatim. TeamRun never decides on the user's
 * behalf; a reply that ends first cancels the request.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Approval {
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * The provider's `Message` the request was raised in.
   */
  public readonly messageId: string;
  /**
   * TeamRun's classification of the request, used for rendering.
   */
  public readonly kind: ApprovalKind;
  /**
   * The provider's own name for the request, verbatim, such as `commandExecution` or a tool name.
   */
  public readonly nativeKind: string;
  /**
   * One line for the user, such as the command to run.
   */
  public readonly summary: string;
  /**
   * The provider's own detail, such as the command, its working directory, or the paths; `null`
   * when there is none.
   */
  public readonly payload: JsonValue;
  /**
   * The choices the provider offers, at least one, with distinct ids. The instance keeps its own
   * copy.
   */
  public readonly options: readonly ApprovalOption[];
  /**
   * Where the request stands.
   */
  public readonly status: ApprovalStatus;
  /**
   * The id of the chosen option once approved or denied, `null` while pending or when cancelled.
   */
  public readonly decision: string | null;
  /**
   * ISO 8601 timestamp of the request.
   */
  public readonly createdAt: string;
  /**
   * ISO 8601 timestamp of the decision or cancellation, `null` while pending.
   */
  public readonly decidedAt: string | null;

  /**
   * Initializes the approval.
   * @param id Unique identifier.
   * @param messageId The provider's `Message` the request was raised in.
   * @param kind TeamRun's classification of the request, used for rendering.
   * @param nativeKind The provider's own name for the request, verbatim, such as `commandExecution`
   * or a tool name.
   * @param summary One line for the user, such as the command to run.
   * @param payload The provider's own detail, such as the command, its working directory, or the
   * paths; `null` when there is none.
   * @param options The offered choices; copied, so later changes to the array do not reach the
   * approval.
   * @param status Where the request stands.
   * @param decision The id of the chosen option once approved or denied, `null` while pending or
   * when cancelled.
   * @param createdAt ISO 8601 timestamp of the request.
   * @param decidedAt ISO 8601 timestamp of the decision or cancellation, `null` while pending.
   * @throws ArgumentException when the id, message id, native kind, summary, or creation timestamp
   * is blank; when no option is offered or two share an id; when a pending approval has a decision
   * time or a decided one has none; when an approved or denied approval names no decision or a
   * pending or cancelled one names one; when the decision names no offered option; or when the
   * chosen option's outcome contradicts the status.
   */
  public constructor(
    id: string,
    messageId: string,
    kind: ApprovalKind,
    nativeKind: string,
    summary: string,
    payload: JsonValue,
    options: readonly ApprovalOption[],
    status: ApprovalStatus,
    decision: string | null,
    createdAt: string,
    decidedAt: string | null);

  /**
   * Reads an approval from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `messageId`, `kind`, `nativeKind`,
   * `summary`, `payload`, the `options` array of objects, `status`, the nullable `decision`,
   * `createdAt`, and the nullable `decidedAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The approval.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Approval;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `messageId`, `kind`, `nativeKind`, `summary`, `payload`, the
   * `options` array of objects, `status`, the nullable `decision`, `createdAt`, and the nullable
   * `decidedAt`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a decided copy: the status follows the chosen option's outcome.
   * @param optionId Id of the chosen option.
   * @param decidedAt ISO 8601 timestamp of the decision.
   * @returns The copy.
   * @throws ArgumentException when the option is not one of the offered options.
   */
  public withDecision(optionId: string, decidedAt: string): Approval;

  /**
   * Returns a cancelled copy, for a request whose reply ended first.
   * @param decidedAt ISO 8601 timestamp of the cancellation.
   * @returns The copy.
   */
  public withCancellation(decidedAt: string): Approval;
}

/**
 * One choice a provider offers for an approval request: the provider's own id for it, the label the
 * user sees, and what choosing it means.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ApprovalOption {
  /**
   * The provider-defined id, such as `accept` or `acceptForSession`; the adapter maps it back to
   * its own wire.
   */
  public readonly id: string;
  /**
   * The text shown to the user.
   */
  public readonly label: string;
  /**
   * Whether choosing it grants or refuses the request.
   */
  public readonly outcome: ApprovalOutcome;

  /**
   * Initializes the approval option.
   * @param id The provider-defined id, such as `accept` or `acceptForSession`; the adapter maps it
   * back to its own wire.
   * @param label The text shown to the user.
   * @param outcome Whether choosing it grants or refuses the request.
   * @throws ArgumentException when the id or label is blank.
   */
  public constructor(id: string, label: string, outcome: ApprovalOutcome);

  /**
   * Reads an approval option from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `label`, and `outcome`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The approval option.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ApprovalOption;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `label`, and `outcome`.
   */
  public toJson(): JsonObject;
}

/**
 * A conversation in a project: the thread in which the user explains work and receives results.
 * Messages and turns reference it; a project can hold many.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Conversation {
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * The `Project` id.
   */
  public readonly projectId: string;
  /**
   * Display title, by default the first line of the first message.
   */
  public readonly title: string;
  /**
   * ISO 8601 timestamp of creation.
   */
  public readonly createdAt: string;
  /**
   * ISO 8601 timestamp of the last message or change.
   */
  public readonly updatedAt: string;
  /**
   * Whether the next reply must start a fresh provider session fed with the kept transcript (set by a rewind, cleared
   * by the next send).
   */
  public readonly sessionReset: boolean;
  /**
   * The provider session a rewind forked through the last kept reply, or `null`; the next send on
   * that provider and account resumes it instead of the session the history names. Never set
   * together with `sessionReset`.
   */
  public readonly forkedSession: ForkedSession | null;

  /**
   * Initializes the conversation.
   * @param id Unique identifier.
   * @param projectId The `Project` id.
   * @param title Display title, by default the first line of the first message.
   * @param createdAt ISO 8601 timestamp of creation.
   * @param updatedAt ISO 8601 timestamp of the last message or change.
   * @param forkedSession The forked session a rewind left, or `null` (the default).
   * @param sessionReset Whether the next reply must start a fresh provider session fed with the transcript (set by a
   * rewind, cleared by the next send); `false` by default.
   * @throws ArgumentException when the id, project id, title, or a timestamp is blank.
   */
  public constructor(
    id: string,
    projectId: string,
    title: string,
    createdAt: string,
    updatedAt: string,
    sessionReset?: boolean,
    forkedSession?: ForkedSession | null);

  /**
   * Reads a conversation from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `projectId`, `title`, `createdAt`,
   * and `updatedAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The conversation.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Conversation;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `projectId`, `title`, `createdAt`, and `updatedAt`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a copy with another title and update time.
   * @param title The new title; must not be blank.
   * @param updatedAt ISO 8601 timestamp of the change.
   * @returns The copy.
   * @throws ArgumentException when the title or the timestamp is blank.
   */
  public withTitle(title: string, updatedAt: string): Conversation;

  /**
   * A copy under another project.
   * @param projectId The id of the project the conversation moves to; must not be blank.
   * @param updatedAt ISO 8601 timestamp of the change.
   * @returns The copy.
   * @throws ArgumentException when the project id or the timestamp is blank.
   */
  public withProjectId(projectId: string, updatedAt: string): Conversation;

  /**
   * Returns a copy with the session-reset mark changed.
   * @param sessionReset The mark.
   * @param updatedAt ISO 8601 timestamp of the change.
   * @returns The copy.
   */
  public withSessionReset(sessionReset: boolean, updatedAt: string): Conversation;

  /**
   * Returns a copy with the forked session (and the reset mark cleared).
   * @param forkedSession The forked session, or `null` to clear it.
   * @param updatedAt ISO 8601 timestamp of the change.
   * @returns The copy.
   */
  public withForkedSession(forkedSession: ForkedSession | null, updatedAt: string): Conversation;
}

/**
 * The provider session a rewind forked, bound to the provider and account it was forked for.
 */
export declare class ForkedSession {
  /**
   * The provider id.
   */
  public readonly provider: string;
  /**
   * The `ProviderAccount` id, or `null` for the provider's default profile.
   */
  public readonly providerAccountId: string | null;
  /**
   * The provider's own id of the forked session.
   */
  public readonly nativeSessionId: string;

  /**
   * Initializes the forked session.
   * @param provider The provider id; must not be blank.
   * @param providerAccountId The account id, or `null`.
   * @param nativeSessionId The forked session id; must not be blank.
   * @throws ArgumentException when a text is blank.
   */
  public constructor(provider: string, providerAccountId: string | null, nativeSessionId: string);

  /**
   * Reads the forked session from untrusted JSON.
   * @param value The untrusted value, expected to carry `provider`, the nullable `providerAccountId`, and
   * `nativeSessionId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The forked session.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ForkedSession;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `provider`, `providerAccountId`, `nativeSessionId`.
   */
  public toJson(): JsonObject;

  /**
   * Returns whether a send on the given provider and account continues this session.
   * @param provider The provider id.
   * @param providerAccountId The account id, or `null`.
   * @returns `true` when both match.
   */
  public matches(provider: string, providerAccountId: string | null): boolean;
}

/**
 * One entry of a conversation: what the user sent, a provider's reply to it, or a note from
 * TeamRun. A message is made of ordered details; a provider's reply also carries the provenance of
 * the run that produced it and moves through the open statuses while that run lasts.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Message {
  /** Named author id; null for the user and the unnamed default participant. */
  public readonly teammateId: string | null;
  /** The author's name at message creation, retained after rename or deletion. */
  public readonly teammateName: string | null;
  /** Resolved user-message mentions, with their historical names. */
  public readonly mentions: readonly TeammateMention[];
  /**
   * Durable attachment metadata, without file bytes; copied on construction. Empty for older messages.
   */
  public readonly attachments: readonly MessageAttachment[];
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * The `Conversation` the message belongs to.
   */
  public readonly conversationId: string;
  /**
   * Position within the conversation, a non-negative integer, unique per conversation.
   */
  public readonly sequence: number;
  /**
   * Who sent it.
   */
  public readonly author: MessageAuthor;
  /**
   * The `Message` this one answers, or `null` for the user's own messages.
   */
  public readonly inReplyTo: string | null;
  /**
   * Where the message stands.
   */
  public readonly status: MessageStatus;
  /**
   * The ordered pieces of the message; empty while a provider's reply is pending. The instance
   * keeps its own copy.
   */
  public readonly details: readonly MessageDetail[];
  /**
   * Where a provider's reply came from; `null` for every other author.
   */
  public readonly provenance: Provenance | null;
  /**
   * ISO 8601 timestamp of creation; for a provider's reply, the creation time of the message it answers.
   */
  public readonly createdAt: string;
  /**
   * ISO 8601 timestamp when a provider's reply began running; `null` for other authors, for a reply still waiting for its turn,
   * and for one that ended before it ran.
   */
  public readonly startedAt: string | null;
  /**
   * ISO 8601 timestamp when the message reached an ended status, `null` while open.
   */
  public readonly endedAt: string | null;

  /**
   * Initializes the message.
   * @param id Unique identifier.
   * @param conversationId The `Conversation` the message belongs to.
   * @param sequence Position within the conversation, a non-negative integer, unique per
   * conversation.
   * @param author Who sent it.
   * @param inReplyTo The `Message` this one answers, or `null` for the user's own messages.
   * @param status Where the message stands.
   * @param details The pieces; copied, so later changes to the array do not reach the message.
   * @param provenance Where a provider's reply came from; `null` for every other author.
   * @param createdAt ISO 8601 timestamp of creation; for a provider's reply, the creation time of the message it answers.
   * @param startedAt ISO 8601 timestamp when a provider's reply began running; `null` for other authors, for a reply still
   * waiting for its turn, and for one that ended before it ran.
   * @param endedAt ISO 8601 timestamp when the message reached an ended status, `null` while open.
   * @param attachments Saved attachment metadata, copied; defaults to empty and is omitted from JSON when empty.
   * @throws ArgumentException when the id, conversation id, or creation timestamp is blank, when
   * `inReplyTo` is present but blank, when provenance is present on a message that is not a
   * provider's or absent on one that is, when an end time is present on an open message or
   * absent on an ended one, or when a start time is blank, present on a message that is not a
   * provider's or on a pending one, or absent on a provider's running or awaiting reply;
   * `ArgumentOutOfRangeException` when the sequence is negative or not an integer.
   */
  public constructor(
    id: string,
    conversationId: string,
    sequence: number,
    author: MessageAuthor,
    inReplyTo: string | null,
    status: MessageStatus,
    details: readonly MessageDetail[],
    provenance: Provenance | null,
    createdAt: string,
    startedAt: string | null,
    endedAt: string | null,
    attachments?: readonly MessageAttachment[],
    teammateId?: string | null,
    teammateName?: string | null,
    mentions?: readonly TeammateMention[]);

  /**
   * Reads a message from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `conversationId`, the integer
   * `sequence`, `author`, the nullable `inReplyTo`, `status`, the `details` array of objects, the
   * nullable `provenance` object, `createdAt`, the optional nullable `startedAt`, and the nullable `endedAt`.
   * Messages stored before start times were recorded have no `startedAt`: a provider's reply that is not
   * pending then counts from `createdAt`, and every other message has none.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The message.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Message;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `conversationId`, the integer `sequence`, `author`, the nullable
   * `inReplyTo`, `status`, the `details` array of objects, the nullable `provenance` object,
   * `createdAt`, the nullable `startedAt`, and the nullable `endedAt`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a copy of a waiting reply that began running; the same invariants apply.
   * @param startedAt ISO 8601 timestamp when the reply began running.
   * @returns The copy, with status `Running`, the start time and no end time.
   * @throws ArgumentException when the message is not a provider's reply or the start time is blank.
   */
  public withStart(startedAt: string): Message;

  /**
   * Returns a copy with another status and end time, keeping the start time; the same invariants apply.
   * @param status The new status.
   * @param endedAt The end time, `null` while the message is open.
   * @returns The copy.
   * @throws ArgumentException when the status and the end time disagree, or when the status
   * needs a start time the message does not have.
   */
  public withStatus(status: MessageStatus, endedAt: string | null): Message;

  /**
   * Returns a copy with the detail appended.
   * @param detail The detail to append.
   * @returns The copy.
   */
  public withDetail(detail: MessageDetail): Message;

  /**
   * A copy with these details in place of the message's own.
   * @param details The details.
   * @returns The copy.
   */
  public withDetails(details: readonly MessageDetail[]): Message;

  /**
   * Returns a copy with another provenance.
   * @param provenance The provenance.
   * @returns The copy.
   */
  public withProvenance(provenance: Provenance): Message;
}

/**
 * One piece of a message: a paragraph, a reasoning summary, a command the provider ran, a set of
 * file changes, a note, or an error. Details are ordered by `sequence` within their message.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class MessageDetail {
  /**
   * Position within the message, a non-negative integer.
   */
  public readonly sequence: number;
  /**
   * What it carries.
   */
  public readonly kind: DetailKind;
  /**
   * The text, possibly empty for kinds whose content is in the payload.
   */
  public readonly text: string;
  /**
   * Structured detail for the kind, such as a command's output; `null` when there is none.
   */
  public readonly payload: JsonValue;
  /**
   * ISO 8601 timestamp of creation.
   */
  public readonly createdAt: string;

  /**
   * Initializes the detail.
   * @param sequence Position within the message, a non-negative integer.
   * @param kind What it carries.
   * @param text The text, possibly empty for kinds whose content is in the payload.
   * @param payload Structured detail for the kind, such as a command's output; `null` when there is
   * none.
   * @param createdAt ISO 8601 timestamp of creation.
   * @throws ArgumentException when the creation timestamp is blank; `ArgumentOutOfRangeException`
   * when the sequence is negative or not an integer.
   */
  public constructor(sequence: number, kind: DetailKind, text: string, payload: JsonValue, createdAt: string);

  /**
   * Reads a detail from untrusted JSON.
   * @param value The untrusted value, expected to carry the integer `sequence`, `kind`, `text`,
   * `payload`, and `createdAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The detail.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessageDetail;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the integer `sequence`, `kind`, `text`, `payload`, and `createdAt`.
   */
  public toJson(): JsonObject;
}

/**
 * What a provider was observed to serve while producing a message, taken from provider events and
 * never from the request. Every part is `null` until observed; a requested value is never copied
 * here.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ObservedSettings {
  /**
   * The registered provider id that served the message, or `null` until known.
   */
  public readonly provider: string | null;
  /**
   * The model the provider reported, or `null` until known.
   */
  public readonly model: string | null;
  /**
   * The reasoning effort the provider reported, or `null` until known.
   */
  public readonly effort: string | null;
  /**
   * The provider tooling's version, or `null` until known.
   */
  public readonly harnessVersion: string | null;
  /**
   * The account identity the provider reported, or `null` until known.
   */
  public readonly identity: ProviderAccountIdentity | null;

  /**
   * Initializes the observed settings.
   * @param provider The registered provider id that served the message, or `null` until known.
   * @param model The model the provider reported, or `null` until known.
   * @param effort The reasoning effort the provider reported, or `null` until known.
   * @param harnessVersion The provider tooling's version, or `null` until known.
   * @param identity The account identity the provider reported, or `null` until known.
   * @throws nothing; every part may be `null`.
   */
  public constructor(
    provider: string | null,
    model: string | null,
    effort: string | null,
    harnessVersion: string | null,
    identity: ProviderAccountIdentity | null);

  /**
   * Reads the observed settings from untrusted JSON.
   * @param value The untrusted value, expected to carry the nullable `provider`, `model`, `effort`,
   * `harnessVersion`, and `identity`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The observed settings.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ObservedSettings;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the nullable `provider`, `model`, `effort`, `harnessVersion`, and
   * `identity`.
   */
  public toJson(): JsonObject;
}

/**
 * A folder TeamRun works in.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Project {
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * Display name, by default the folder's name.
   */
  public readonly name: string;
  /**
   * Absolute path of the folder.
   */
  public readonly rootPath: string;
  /**
  /**
   * ISO 8601 timestamp of creation.
   */
  public readonly createdAt: string;

  /**
   * Initializes the project.
   * @param id Unique identifier.
   * @param name Display name, by default the folder's name.
   * @param rootPath Absolute path of the folder.
   * @param createdAt ISO 8601 timestamp of creation.
   * @throws ArgumentException when the id, name, root path, or creation timestamp is blank.
   */
  public constructor(id: string, name: string, rootPath: string, createdAt: string);

  /**
   * Reads a project from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `name`, `rootPath`, `vcs`, and
   * `createdAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The project.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Project;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `name`, `rootPath`, and `createdAt`.
   */
  public toJson(): JsonObject;
}

/**
 * Where a provider's message came from: the account it ran under, what was requested, what the
 * provider was observed to serve, and the native session it ran in. Present on a provider's message
 * only.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class Provenance {
  /**
   * The `ProviderAccount` the run used, or `null` for the provider's default profile.
   */
  public readonly providerAccountId: string | null;
  /**
   * What was asked of the provider.
   */
  public readonly requested: RequestedSettings;
  /**
   * What the provider was observed to serve.
   */
  public readonly observed: ObservedSettings;
  /**
   * The provider's own session or thread id, or `null` until the provider reports one.
   */
  public readonly nativeSessionId: string | null;
  /**
   * `true` when the run continued an existing native session instead of starting one.
   */
  public readonly resumedNativeSession: boolean;
  /**
   * The provider's own id of the turn the reply ran, or `null` when the provider has none; a rewind
   * forks the session through it.
   */
  public readonly nativeTurnId: string | null;
  /**
   * Where the adapter placed role text; not a claim that the model obeyed it.
   */
  public readonly roleApplied: RoleApplication | null;
  /**
   * Preserves identity/session fields while recording the instruction route.
   */
  public withRoleApplied(roleApplied: RoleApplication | null): Provenance;

  /**
   * Initializes the provenance.
   * @param providerAccountId The `ProviderAccount` the run used, or `null` for the provider's
   * default profile.
   * @param requested What was asked of the provider.
   * @param observed What the provider was observed to serve.
   * @param nativeSessionId The provider's own session or thread id, or `null` until the provider
   * reports one.
   * @param resumedNativeSession `true` when the run continued an existing native session instead of
   * starting one.
   * @param nativeTurnId The provider's own turn id, or `null` (the default).
   * @throws ArgumentException when the message is flagged as resumed without a native session id.
   */
  public constructor(
    providerAccountId: string | null,
    requested: RequestedSettings,
    observed: ObservedSettings,
    nativeSessionId: string | null,
    resumedNativeSession: boolean,
    nativeTurnId?: string | null,
    roleApplied?: RoleApplication | null);

  /**
   * Reads the provenance from untrusted JSON.
   * @param value The untrusted value, expected to carry the nullable `providerAccountId`, the
   * `requested` and `observed` objects, the nullable `nativeSessionId`, the boolean
   * `resumedNativeSession`, and optionally the nullable `nativeTurnId` (`null` when absent).
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The provenance.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): Provenance;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the nullable `providerAccountId`, the `requested` and `observed`
   * objects, the nullable `nativeSessionId`, the boolean `resumedNativeSession`, and the nullable
   * `nativeTurnId`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a copy with the provider-native session the turn used.
   * @param nativeSessionId The native session id, or `null`.
   * @param resumedNativeSession Whether the session was resumed rather than started.
   * @param nativeTurnId The provider's turn id; the current one by default.
   * @returns The copy.
   * @throws ArgumentException when a resumed session has no id.
   */
  public withNativeSession(nativeSessionId: string | null, resumedNativeSession: boolean, nativeTurnId?: string | null): Provenance;

  /**
   * Returns a copy with the observed settings.
   * @param observed What the provider reported.
   * @returns The copy.
   */
  public withObserved(observed: ObservedSettings): Provenance;
}

/**
 * A provider sign-in TeamRun may use: a label, the profile directory the provider tooling owns, and
 * what the last check observed. TeamRun never reads the directory's contents; credentials stay with
 * the provider. Not a TeamRun account, which is the user's own account for optional services.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ProviderAccount {
  /**
   * Unique identifier.
   */
  public readonly id: string;
  /**
   * Id of the registered provider this profile belongs to, such as `codex` or `claude`. The runtime
   * rejects ids no adapter registered.
   */
  public readonly provider: string;
  /**
   * The user's label, such as `Work`.
   */
  public readonly label: string;
  /**
   * Absolute path of the directory the provider tooling uses for this profile.
   */
  public readonly profileDir: string;
  /**
   * What the last check observed.
   */
  public readonly authStatus: AuthStatus;
  /**
   * The identity the last check observed, or `null` when none was observed.
   */
  public readonly identity: ProviderAccountIdentity | null;
  /**
   * The provider tooling's version the last check observed, or `null` when unknown.
   */
  public readonly harnessVersion: string | null;
  /**
   * ISO 8601 timestamp of the last check, or `null` when never checked.
   */
  public readonly lastCheckedAt: string | null;
  /**
   * Why the last check failed, or `null` when it did not.
   */
  public readonly lastError: string | null;
  /**
   * ISO 8601 timestamp of creation.
   */
  public readonly createdAt: string;

  /**
   * Initializes the provider account.
   * @param id Unique identifier.
   * @param provider Id of the registered provider; must not be blank.
   * @param label The user's label, such as `Work`.
   * @param profileDir Absolute path of the directory the provider tooling uses for this profile.
   * @param authStatus What the last check observed.
   * @param identity The identity the last check observed, or `null` when none was observed.
   * @param harnessVersion The provider tooling's version the last check observed, or `null` when
   * unknown.
   * @param lastCheckedAt ISO 8601 timestamp of the last check, or `null` when never checked.
   * @param lastError Why the last check failed, or `null` when it did not.
   * @param createdAt ISO 8601 timestamp of creation.
   * @throws ArgumentException when the id, provider, label, profile directory, or creation timestamp
   * is blank.
   */
  public constructor(
    id: string,
    provider: string,
    label: string,
    profileDir: string,
    authStatus: AuthStatus,
    identity: ProviderAccountIdentity | null,
    harnessVersion: string | null,
    lastCheckedAt: string | null,
    lastError: string | null,
    createdAt: string);

  /**
   * Reads a provider account from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `provider`, `label`, `profileDir`,
   * `authStatus`, the nullable `identity`, `harnessVersion`, `lastCheckedAt`, and `lastError`, and
   * `createdAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The provider account.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderAccount;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `provider`, `label`, `profileDir`, `authStatus`, the nullable
   * `identity`, `harnessVersion`, `lastCheckedAt`, and `lastError`, and `createdAt`.
   */
  public toJson(): JsonObject;

  /**
   * Returns a copy carrying the outcome of a sign-in check.
   * @param authStatus The observed status.
   * @param identity The observed identity, or `null` when none was reported.
   * @param harnessVersion The observed harness version, or `null`.
   * @param lastCheckedAt ISO 8601 timestamp of the check, or `null`.
   * @param lastError The check's error, or `null` when it succeeded.
   * @returns The copy.
   */
  public withCheck(
    authStatus: AuthStatus,
    identity: ProviderAccountIdentity | null,
    harnessVersion: string | null,
    lastCheckedAt: string | null,
    lastError: string | null): ProviderAccount;
}

/**
 * What the provider tooling reported about a provider account's sign-in. Every part is optional
 * because providers report different subsets; an absent part is unknown, never guessed. A
 * provider's message records the same class as the identity it observed.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class ProviderAccountIdentity {
  /**
   * The account's email, when the provider reported one.
   */
  public readonly email?: string;
  /**
   * The subscription plan, such as `pro`, when the provider reported one.
   */
  public readonly plan?: string;
  /**
   * The organization or workspace name, when the provider reported one.
   */
  public readonly organization?: string;
  /**
   * How the account is signed in, such as `oauth` or `apiKey`, when the provider reported it.
   */
  public readonly authMethod?: string;

  /**
   * Initializes the identity.
   * @param email? The account's email, or `undefined` when unknown.
   * @param plan? The plan, or `undefined` when unknown.
   * @param organization? The organization, or `undefined` when unknown.
   * @param authMethod? The method, or `undefined` when unknown.
   * @throws ArgumentException when never; all parts are optional.
   */
  public constructor(email?: string, plan?: string, organization?: string, authMethod?: string);

  /**
   * Reads a identity from untrusted JSON.
   * @param value The untrusted value, expected to carry the optional `email`, `plan`,
   * `organization`, and `authMethod` strings; absent parts stay absent, `null` is rejected.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The identity.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderAccountIdentity;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the optional `email`, `plan`, `organization`, and `authMethod`
   * strings; absent parts stay absent, `null` is rejected.
   */
  public toJson(): JsonObject;
}

/**
 * A registered provider as `ProviderList` reports it: the id the protocol carries as text, the
 * name to show, and what the adapter supports. The descriptor is the only place the protocol learns
 * about a provider; nothing else is hardcoded.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderDescriptor {
  /**
   * The registered id, such as `codex`.
   */
  public readonly id: string;
  /**
   * The name shown to the user.
   */
  public readonly displayName: string;
  /**
   * The reasoning effort levels the provider accepts, in the provider's own words; empty when it
   * has none.
   */
  public readonly effortLevels: readonly string[];
  /**
   * `true` when a reply can continue an earlier native session.
   */
  public readonly supportsResume: boolean;
  /**
   * `true` when the adapter can observe a profile's sign-in state.
   */
  public readonly supportsSignInCheck: boolean;
  /**
   * `true` when the adapter can fork a native session through one of its turns (a rewind keeps
   * the provider's own context that way).
   */
  public readonly supportsFork: boolean;

  /**
   * Initializes a provider descriptor.
   * @param id The registered id, such as `codex`.
   * @param displayName The name shown to the user.
   * @param effortLevels The reasoning effort levels the provider accepts, in the provider's own
   * words; empty when it has none.
   * @param supportsResume `true` when a reply can continue an earlier native session.
   * @param supportsSignInCheck `true` when the adapter can observe a profile's sign-in state.
   * @param supportsFork `true` when a native session can be forked through a turn; `false` by default.
   * @throws ArgumentException when `id`, `displayName` are blank.
   */
  public constructor(
    id: string,
    displayName: string,
    effortLevels: readonly string[],
    supportsResume: boolean,
    supportsSignInCheck: boolean,
    supportsFork?: boolean);

  /**
   * Reads a provider descriptor from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `displayName`, the `effortLevels`
   * string array, `supportsResume`, `supportsSignInCheck`, and optionally `supportsFork` (`false`
   * when absent).
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The provider descriptor.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderDescriptor;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `displayName`, the `effortLevels` string array,
   * `supportsResume`, `supportsSignInCheck`, `supportsFork`.
   */
  public toJson(): JsonObject;
}

/**
 * What a provider's message asked of the provider: which provider, and the model and effort when
 * the user chose them. What the provider actually served is in `ObservedSettings`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire and storage shape.
 */
export declare class RequestedSettings {
  /**
   * The registered provider id.
   */
  public readonly provider: string;
  /**
   * The requested model, or `null` for the provider's default.
   */
  public readonly model: string | null;
  /**
   * The requested reasoning effort, or `null` for the provider's default.
   */
  public readonly effort: string | null;

  /**
   * Initializes the requested settings.
   * @param provider The registered provider id.
   * @param model The requested model, or `null` for the provider's default.
   * @param effort The requested reasoning effort, or `null` for the provider's default.
   * @throws ArgumentException when the provider is blank.
   */
  public constructor(provider: string, model: string | null, effort: string | null);

  /**
   * Reads the requested settings from untrusted JSON.
   * @param value The untrusted value, expected to carry `provider` and the nullable `model` and
   * `effort`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The requested settings.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): RequestedSettings;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `provider` and the nullable `model` and `effort`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ApprovalDecide`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ApprovalDecideParams {
  /**
   * The `Approval` id.
   */
  public readonly approvalId: string;
  /**
   * The id of the chosen `ApprovalOption`.
   */
  public readonly optionId: string;

  /**
   * Initializes the parameters.
   * @param approvalId The `Approval` id.
   * @param optionId The id of the chosen `ApprovalOption`.
   * @throws ArgumentException when `approvalId`, `optionId` are blank.
   */
  public constructor(approvalId: string, optionId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `approvalId`, `optionId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ApprovalDecideParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `approvalId`, `optionId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ConversationCreate`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationCreateParams {
  /**
   * The `Project` id.
   */
  public readonly projectId: string;
  /**
   * The title, or `null` to derive it from the first message.
   */
  public readonly title: string | null;

  /**
   * Initializes the parameters.
   * @param projectId The `Project` id.
   * @param title The title, or `null` to derive it from the first message.
   * @throws ArgumentException when `projectId` is blank.
   */
  public constructor(projectId: string, title: string | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `projectId`, the nullable `title`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ConversationCreateParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `projectId`, the nullable `title`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of the methods that address one conversation: `ConversationDelete` and
 * `ApprovalList`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationIdParams {
  /**
   * The `Conversation` id.
   */
  public readonly conversationId: string;

  /**
   * Initializes the parameters.
   * @param conversationId The `Conversation` id.
   * @throws ArgumentException when `conversationId` is blank.
   */
  public constructor(conversationId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ConversationIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ConversationRename`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationRenameParams {
  /**
   * The `Conversation` id.
   */
  public readonly conversationId: string;
  /**
   * The new title; must not be blank.
   */
  public readonly title: string;

  /**
   * Initializes the parameters.
   * @param conversationId The `Conversation` id.
   * @param title The new title; must not be blank.
   * @throws ArgumentException when `conversationId`, `title` are blank.
   */
  public constructor(conversationId: string, title: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `title`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ConversationRenameParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `title`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ConversationMove`: the conversation and the project it moves to.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationMoveParams {
  /**
   * The `Conversation` id.
   */
  public readonly conversationId: string;
  /**
   * The id of the project the conversation moves to; must not be blank.
   */
  public readonly projectId: string;

  /**
   * Initializes the parameters.
   * @param conversationId The `Conversation` id.
   * @param projectId The id of the project the conversation moves to.
   * @throws ArgumentException when `conversationId`, `projectId` are blank.
   */
  public constructor(conversationId: string, projectId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `projectId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or blank, naming its path.
   */
  public static fromJson(value: unknown, path?: string): ConversationMoveParams;

  /**
   * Renders the wire shape.
   * @returns An object with `conversationId`, `projectId`.
   */
  public toJson(): JsonObject;
}

/**
 * Payload of `DetailAppended` and `DetailUpdated`: the message the detail belongs to and the
 * detail itself.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
/**
 * Parameters of `ConversationSearch`: the text to find and how many hits at most.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationSearchParams {
  /**
   * The text to find; must not be blank.
   */
  public readonly query: string;
  /**
   * How many hits at most, 1 to 100.
   */
  public readonly limit: number;

  /**
   * Initializes the parameters.
   * @param query The text to find; must not be blank.
   * @param limit How many hits at most; an integer from 1 to 100.
   * @throws ArgumentException when the query is blank or the limit is outside 1–100.
   */
  public constructor(query: string, limit: number);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `query` and the integer `limit`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ConversationSearchParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `query` and `limit`.
   */
  public toJson(): JsonObject;
}

/**
 * One hit of `ConversationSearch`: the conversation, and the message that matched when the title did not.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationSearchHit {
  /**
   * The conversation id.
   */
  public readonly conversationId: string;
  /**
   * The conversation's project id.
   */
  public readonly projectId: string;
  /**
   * The conversation's title.
   */
  public readonly title: string;
  /**
   * The matching message's id, or `null` when the title matched.
   */
  public readonly messageId: string | null;
  /**
   * The title, or the part of the message text around the match.
   */
  public readonly snippet: string;
  /**
   * The matching message's sequence, or `null` when the title matched.
   */
  public readonly sequence: number | null;
  /**
   * The conversation's `updatedAt`.
   */
  public readonly updatedAt: string;

  /**
   * Initializes the hit.
   * @param conversationId The conversation id; must not be blank.
   * @param projectId The project id; must not be blank.
   * @param title The conversation's title.
   * @param messageId The matching message's id, or `null`.
   * @param snippet The text shown for the hit.
   * @param updatedAt The conversation's `updatedAt`; must not be blank.
   * @throws ArgumentException when an id or the timestamp is blank.
   */
  public constructor(conversationId: string, projectId: string, title: string, messageId: string | null, snippet: string, updatedAt: string,
    sequence?: number | null);

  /**
   * Reads the hit from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `projectId`, `title`, the nullable
   * `messageId`, `snippet`, and `updatedAt`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The hit.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ConversationSearchHit;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `projectId`, `title`, `messageId`, `snippet`, `updatedAt`.
   */
  public toJson(): JsonObject;
}

/**
 * Result of `ConversationSearch`: the hits, the latest conversation first.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationSearchResult {
  /**
   * The hits, one per conversation.
   */
  public readonly hits: readonly ConversationSearchHit[];

  /**
   * Initializes the result.
   * @param hits The hits.
   */
  public constructor(hits: readonly ConversationSearchHit[]);

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry the `hits` array.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): ConversationSearchResult;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `hits`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ConversationRewind`: the message to remove together with everything after it, and whether to restore
 * the project's files to the snapshot taken before the removed reply started.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationRewindParams {
  /**
   * The `Conversation` id.
   */
  public readonly conversationId: string;
  /**
   * The id of the first message to remove; it and every later message go.
   */
  public readonly messageId: string;
  /**
   * Whether to restore the project's files to the snapshot taken before the removed reply started.
   */
  public readonly restoreFiles: boolean;

  /**
   * Initializes the parameters.
   * @param conversationId The `Conversation` id.
   * @param messageId The id of the first message to remove.
   * @param restoreFiles Whether to restore the project's files.
   * @throws ArgumentException when `conversationId`, `messageId` are blank.
   */
  public constructor(conversationId: string, messageId: string, restoreFiles: boolean);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `messageId`, `restoreFiles`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ConversationRewindParams;

  /**
   * Renders the parameters.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * Result of `ConversationRewind`: the conversation as it stands, the ids of the messages removed, and how many files
 * the restore changed (`null` when no files were restored: not asked for, no git repository, or no snapshot).
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationRewindResult {
  /**
   * The conversation after the cut, with `sessionReset` set.
   */
  public readonly conversation: Conversation;
  /**
   * The ids of the messages removed, in sequence order.
   */
  public readonly removedMessageIds: readonly string[];
  /**
   * How many files the restore changed, or `null` when no files were restored.
   */
  public readonly restoredFiles: number | null;
  /**
   * `true` when the provider's own session continues from the cut (forked through the last kept
   * reply); `false` when the next reply starts a fresh session told the transcript.
   */
  public readonly sessionKept: boolean;

  /**
   * Initializes the result.
   * @param conversation The conversation after the cut.
   * @param removedMessageIds The ids of the messages removed.
   * @param restoredFiles How many files the restore changed, or `null`.
   * @param sessionKept Whether the provider's session continues; `false` by default.
   */
  public constructor(conversation: Conversation, removedMessageIds: readonly string[], restoredFiles: number | null, sessionKept?: boolean);

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversation`, `removedMessageIds`, `restoredFiles`, and optionally
   * `sessionKept` (`false` when absent).
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ConversationRewindResult;

  /**
   * Renders the result.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * Payload of `ConversationRewound`: which conversation was cut and from which sequence on.
 *
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ConversationRewoundPayload {
  /**
   * The `Conversation` id.
   */
  public readonly conversationId: string;
  /**
   * The sequence of the first message removed; every message from it on is gone.
   */
  public readonly fromSequence: number;

  /**
   * Initializes the payload.
   * @param conversationId The `Conversation` id.
   * @param fromSequence The sequence of the first message removed; must not be negative.
   * @throws ArgumentException when `conversationId` is blank.
   * @throws ArgumentOutOfRangeException when `fromSequence` is negative.
   */
  public constructor(conversationId: string, fromSequence: number);

  /**
   * Reads the payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `fromSequence`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ConversationRewoundPayload;

  /**
   * Renders the payload.
   * @returns The JSON object.
   */
  public toJson(): JsonObject;
}

export declare class DetailEventPayload {
  /**
   * The `Message` id.
   */
  public readonly messageId: string;
  /**
   * The appended or updated detail.
   */
  public readonly detail: MessageDetail;

  /**
   * Initializes the payload.
   * @param messageId The `Message` id.
   * @param detail The appended or updated detail.
   * @throws ArgumentException when `messageId` is blank.
   */
  public constructor(messageId: string, detail: MessageDetail);

  /**
   * Reads the payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `messageId`, the `detail` object.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): DetailEventPayload;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `messageId`, the `detail` object.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of the methods that address one message: `MessageCancel`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageIdParams {
  /**
   * The `Message` id.
   */
  public readonly messageId: string;

  /**
   * Initializes the parameters.
   * @param messageId The `Message` id.
   * @throws ArgumentException when `messageId` is blank.
   */
  public constructor(messageId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `messageId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessageIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `messageId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `MessageList`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageListParams {
  /**
   * The `Conversation` id.
   */
  public readonly conversationId: string;
  /**
   * Return only messages with a greater sequence, or `null` for all; a non-negative integer.
   */
  public readonly afterSequence: number | null;
  /**
   * The kinds of detail to return, or empty for every kind; a message keeps only the details of
   * these kinds.
   */
  public readonly kinds: readonly DetailKind[];

  /**
   * Initializes the parameters.
   * @param conversationId The `Conversation` id.
   * @param afterSequence Return only messages with a greater sequence, or `null` for all; a
   * non-negative integer.
   * @param kinds The kinds of detail to return; empty, the default, for every kind.
   * @throws ArgumentException when `conversationId` is blank; `ArgumentOutOfRangeException` when
   * `afterSequence` is present but negative or not an integer, or a kind is unknown.
   */
  public constructor(conversationId: string, afterSequence: number | null, kinds?: readonly DetailKind[]);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, the nullable
   * `afterSequence`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessageListParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, the nullable `afterSequence`.
   */
  public toJson(): JsonObject;
}

/**
 * A page of a conversation's messages in sequence order, and whether messages lie before its
 * first one and after its last one.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessagePage {
  /**
   * The messages, in sequence order.
   */
  public readonly messages: readonly Message[];
  /**
   * Whether messages lie before the first one; `false` for an empty page.
   */
  public readonly hasEarlier: boolean;
  /**
   * Whether messages lie after the last one; `false` for an empty page.
   */
  public readonly hasLater: boolean;

  /**
   * Initializes the page.
   * @param messages The messages, in sequence order.
   * @param hasEarlier Whether messages lie before the first one.
   * @param hasLater Whether messages lie after the last one.
   */
  public constructor(messages: readonly Message[], hasEarlier: boolean, hasLater: boolean);

  /**
   * Reads the page from untrusted JSON.
   * @param value The untrusted value, expected to carry `messages`, `hasEarlier`, `hasLater`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The page.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessagePage;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `messages`, `hasEarlier`, `hasLater`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `MessagePage`: a page of a conversation's messages, the newest ones when neither
 * cursor is given, the ones before a sequence, or the ones after one; at most `limit` of them.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessagePageParams {
  /**
   * The `Conversation` id.
   */
  public readonly conversationId: string;
  /**
   * Return the messages before this sequence, or `null`; a non-negative integer.
   */
  public readonly beforeSequence: number | null;
  /**
   * Return the messages after this sequence, or `null`; a non-negative integer.
   */
  public readonly afterSequence: number | null;
  /**
   * How many messages at most; 1 through 500.
   */
  public readonly limit: number;

  /**
   * Initializes the parameters.
   * @param conversationId The `Conversation` id.
   * @param beforeSequence Return the messages before this sequence, or `null`.
   * @param afterSequence Return the messages after this sequence, or `null`.
   * @param limit How many messages at most; 1 through 500.
   * @throws ArgumentException when `conversationId` is blank or both cursors are given;
   * `ArgumentOutOfRangeException` when a cursor is negative or not an integer, or the limit is
   * out of range.
   */
  public constructor(conversationId: string, beforeSequence: number | null, afterSequence: number | null, limit: number);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, the nullable
   * `beforeSequence` and `afterSequence`, `limit`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessagePageParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `beforeSequence`, `afterSequence`, `limit`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `MessageSend`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageSendParams {
  /**
   * Files to save with the message; copied on construction. Defaults to an empty list.
   */
  public readonly attachments: readonly AttachmentInput[];
  /**
   * The `Conversation` id.
   */
  public readonly conversationId: string;
  /**
   * The user's text; may be blank when attachments are present.
   */
  public readonly text: string;
  /**
   * Settings for the unnamed responder; may be null when mentions or a named responder select saved settings.
   */
  public readonly requested: RequestedSettings | null;
  /**
   * Mention identities in text order; repeated identities run once.
   */
  public readonly mentionedTeammateIds: readonly string[];
  /**
   * Named default responder, or null for the unnamed one.
   */
  public readonly responderTeammateId: string | null;
  /**
   * The `ProviderAccount` to run under, or `null` for the provider's default profile.
   */
  public readonly providerAccountId: string | null;

  /**
   * Initializes the parameters.
   * @param conversationId The `Conversation` id.
   * @param text The user's text; may be blank when attachments are present.
   * @param requested The provider, model, and effort to ask for.
   * @param providerAccountId The `ProviderAccount` to run under, or `null` for the provider's
   * default profile.
   * @param attachments Files to save; defaults to empty. The runtime enforces count, encoding, size and saved-path limits.
   * @throws ArgumentException when `conversationId` is blank, when `text` is blank without attachments, or when `providerAccountId`
   * is present but blank.
   */
  public constructor(conversationId: string, text: string, requested: RequestedSettings | null, providerAccountId: string | null,
    attachments?: readonly AttachmentInput[],
    mentionedTeammateIds?: readonly string[],
    responderTeammateId?: string | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `conversationId`, `text`, the `requested`
   * object, the nullable `providerAccountId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessageSendParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `conversationId`, `text`, the `requested` object, the nullable
   * `providerAccountId`.
   */
  public toJson(): JsonObject;
}

/**
 * Result of `MessageSend`: the stored user message and its ordered replies, which are updated
 * through events. The replies list may be empty.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class MessageSendResult {
  /**
   * The user's message as stored.
   */
  public readonly sent: Message;
  /**
   * Zero or more pending replies in responder order.
   */
  public readonly replies: readonly Message[];

  /**
   * Initializes the result.
   * @param sent The user's message as stored.
   * @param replies The pending replies in responder order, empty when all responders are unavailable.
   */
  public constructor(sent: Message, replies: readonly Message[]);

  /**
   * Reads the result from untrusted JSON.
   * @param value The untrusted value, expected to carry the `sent` object, the `reply` object.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The result.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): MessageSendResult;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with the `sent` object, the `reply` object.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of the methods that address one project: `ProjectForget` and `ConversationList`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProjectIdParams {
  /**
   * The `Project` id.
   */
  public readonly projectId: string;

  /**
   * Initializes the parameters.
   * @param projectId The `Project` id.
   * @throws ArgumentException when `projectId` is blank.
   */
  public constructor(projectId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `projectId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProjectIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `projectId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProjectOpen`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProjectOpenParams {
  /**
   * Absolute path of the folder.
   */
  public readonly rootPath: string;

  /**
   * Initializes the parameters.
   * @param rootPath Absolute path of the folder.
   * @throws ArgumentException when `rootPath` is blank.
   */
  public constructor(rootPath: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `rootPath`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProjectOpenParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `rootPath`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProviderAccountCreate`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderAccountCreateParams {
  /**
   * The registered provider id.
   */
  public readonly provider: string;
  /**
   * The user's label, such as `Work`.
   */
  public readonly label: string;
  /**
   * Absolute path of the directory the provider tooling will use for this profile.
   */
  public readonly profileDir: string;

  /**
   * Initializes the parameters.
   * @param provider The registered provider id.
   * @param label The user's label, such as `Work`.
   * @param profileDir Absolute path of the directory the provider tooling will use for this
   * profile.
   * @throws ArgumentException when `provider`, `label`, `profileDir` are blank.
   */
  public constructor(provider: string, label: string, profileDir: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `provider`, `label`, `profileDir`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderAccountCreateParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `provider`, `label`, `profileDir`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of the methods that address one provider account: `ProviderAccountCheck` and
 * `ProviderAccountDelete`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderAccountIdParams {
  /**
   * The `ProviderAccount` id.
   */
  public readonly providerAccountId: string;

  /**
   * Initializes the parameters.
   * @param providerAccountId The `ProviderAccount` id.
   * @throws ArgumentException when `providerAccountId` is blank.
   */
  public constructor(providerAccountId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `providerAccountId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderAccountIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `providerAccountId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `ProviderListModels`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class ProviderListModelsParams {
  /**
   * The registered provider id.
   */
  public readonly provider: string;
  /**
   * The `ProviderAccount` to ask through, or `null` for the provider's default profile.
   */
  public readonly providerAccountId: string | null;

  /**
   * Initializes the parameters.
   * @param provider The registered provider id.
   * @param providerAccountId The `ProviderAccount` to ask through, or `null` for the provider's
   * default profile.
   * @throws ArgumentException when `provider` is blank, or when `providerAccountId` is present but
   * blank.
   */
  public constructor(provider: string, providerAccountId: string | null);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `provider`, the nullable
   * `providerAccountId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's
   * path.
   */
  public static fromJson(value: unknown, path?: string): ProviderListModelsParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `provider`, the nullable `providerAccountId`.
   */
  public toJson(): JsonObject;
}

/**
 * The classification of a displayed diff line.
 */
export declare enum DiffLineKind {
  /**
   * Added diff line.
   */
  Added = "Added",
  /**
   * Removed diff line.
   */
  Removed = "Removed",
  /**
   * Context diff line.
   */
  Context = "Context",
  /**
   * Meta diff line.
   */
  Meta = "Meta",
}

/**
 * The two reply-history projections, each ordered newest first.
 */
export declare enum ReplyPanel {
  /**
   * Provider actions and reasoning.
   */
  Activity = "Activity",
  /**
   * Files edited by provider replies.
   */
  Changes = "Changes"
}

/**
 * One immutable diff line; text omits its added or removed prefix.
 */
export declare class DiffLine {
  /**
   * The line classification.
   */
  public readonly kind: DiffLineKind;
  /**
   * The line content.
   */
  public readonly text: string;
  /**
   * Creates a diff line.
   * @param kind The classification.
   * @param text The content without the line prefix.
   */
  public constructor(kind: DiffLineKind, text: string);
}

/**
 * One file change with its parsed diff. The caller owns the supplied immutable line array.
 */
export declare class FileEdit {
  /**
   * The recorded file path.
   */
  public readonly path: string;
  /**
   * The recorded change kind.
   */
  public readonly kind: string;
  /**
   * The parsed diff lines.
   */
  public readonly lines: readonly DiffLine[];
  /**
   * Creates a file change.
   * @param path The recorded path.
   * @param kind The recorded change kind.
   * @param lines Immutable parsed lines retained by this instance.
   */
  public constructor(path: string, kind: string, lines: readonly DiffLine[]);
  /**
   * The count of added lines.
   */
  public get additions(): number;
  /**
   * The count of removed lines.
   */
  public get deletions(): number;
  /**
   * Whether any line is content rather than metadata.
   */
  public get hasDiff(): boolean;
}

/**
 * A file row without diff content, suitable for paged history.
 */
export declare class FileChangeSummary {
  /**
   * The nonblank recorded file path.
   */
  public readonly path: string;
  /**
   * The recorded change kind.
   */
  public readonly kind: string;
  /**
   * The number of added lines.
   */
  public readonly additions: number;
  /**
   * The number of removed lines.
   */
  public readonly deletions: number;
  /**
   * Whether full diff content can be expanded.
   */
  public readonly hasDiff: boolean;
  /**
   * Creates a file summary.
   * @param path Nonblank path.
   * @param kind Change kind.
   * @param additions Nonnegative integer count.
   * @param deletions Nonnegative integer count.
   * @param hasDiff Whether diff content exists.
   * @throws ArgumentException When path is blank.
   * @throws ArgumentOutOfRangeException When a count is invalid.
   */
  public constructor(path: string, kind: string, additions: number, deletions: number, hasDiff: boolean);
  /**
   * Summarizes a parsed change without retaining its lines.
   * @param edit The parsed change.
   * @returns The summary.
   */
  public static fromEdit(edit: FileEdit): FileChangeSummary;
  /**
   * Reads a wire value and validates its fields.
   * @param value The untrusted JSON value.
   * @param path Optional diagnostic JSON path.
   * @returns The parsed FileChangeSummary.
   * @throws JsonException When a field has the wrong type or is missing.
   */
  public static fromJson(value: unknown, path?: string): FileChangeSummary;
  /**
   * Serializes this value.
   * @returns A new plain JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A lightweight reply projection. Preview details contain only first-line titles (at most 512 characters) and tool identity metadata, never output, diffs, or image data. This is not a complete message snapshot.
 */
export declare class ReplySummary {
  /**
   * Message metadata and title-only non-text details.
   */
  public readonly preview: Message;
  /**
   * File rows and counts without diff bodies.
   */
  public readonly files: readonly FileChangeSummary[];
  /**
   * Creates a summary from already projected fields.
   * @param preview The title-only message projection.
   * @param files File summaries, copied on construction.
   */
  public constructor(preview: Message, files: readonly FileChangeSummary[]);
  /**
   * Tests whether this reply has content for a panel.
   * @param panel The requested panel.
   * @returns Whether the reply belongs in that panel.
   */
  public matches(panel: ReplyPanel): boolean;
  /**
   * Projects one message without retaining its output or diff bodies.
   * @param message The complete source message.
   * @returns A lightweight summary.
   */
  public static fromMessage(message: Message): ReplySummary;
  /**
   * Reads a wire value and validates its fields.
   * @param value The untrusted JSON value.
   * @param path Optional diagnostic JSON path.
   * @returns The parsed ReplySummary.
   * @throws JsonException When a field has the wrong type or is missing.
   */
  public static fromJson(value: unknown, path?: string): ReplySummary;
  /**
   * Serializes this value.
   * @returns A new plain JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * A page of matching provider reply summaries, newest first; cursors are message sequences.
 */
export declare class ReplyPage {
  /**
   * The summaries in descending sequence order.
   */
  public readonly replies: readonly ReplySummary[];
  /**
   * Whether older matching replies exist.
   */
  public readonly hasEarlier: boolean;
  /**
   * Whether newer matching replies exist.
   */
  public readonly hasLater: boolean;
  /**
   * Creates a page.
   * @param replies Summaries in descending sequence order, copied on construction.
   * @param hasEarlier Whether older matching replies exist.
   * @param hasLater Whether newer matching replies exist.
   */
  public constructor(replies: readonly ReplySummary[], hasEarlier: boolean, hasLater: boolean);
  /**
   * Reads a wire value and validates its fields.
   * @param value The untrusted JSON value.
   * @param path Optional diagnostic JSON path.
   * @returns The parsed ReplyPage.
   * @throws JsonException When a field has the wrong type or is missing.
   */
  public static fromJson(value: unknown, path?: string): ReplyPage;
  /**
   * Serializes this value.
   * @returns A new plain JSON object.
   */
  public toJson(): JsonObject;
}

/**
 * Interprets recorded Codex file changes and Claude Edit, MultiEdit, and Write payloads consistently for full diffs and summaries.
 */
export declare class FileChangeReader {
  /**
   * Parses and merges changes by file path within one reply.
   * @param message The recorded message.
   * @returns Parsed file changes in their first-seen order; unsupported payloads are ignored.
   */
  public editsOf(message: Message): readonly FileEdit[];
}

/**
 * A new file's base64 bytes, or a reference to a previously saved attachment after rewind.
 * Exactly one of data and path is non-null. The runtime validates saved paths against its attachment store.
 */
export declare class AttachmentInput {
  /**
   * Original display filename; never used as a storage path.
   */
  public readonly name: string;
  /**
   * MIME type supplied by the client.
   */
  public readonly mediaType: string;
  /**
   * Canonical base64 bytes, or null when reusing a saved path. An empty string represents an empty file.
   */
  public readonly data: string | null;
  /**
   * Existing attachment-store path, or null for a new upload.
   */
  public readonly path: string | null;
  /**
   * Initializes an attachment source.
   * @param name Nonblank display filename.
   * @param mediaType Nonblank MIME type.
   * @param data Base64 bytes, or null for a saved file.
   * @param path Nonblank saved path, or null for new bytes.
   * @throws ArgumentException when names are blank or neither/both sources are supplied.
   */
  public constructor(name: string, mediaType: string, data: string | null, path: string | null);
  /**
   * Decodes untrusted attachment input.
   * @param value Object containing name, mediaType, nullable data and nullable path.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns Validated input; byte encoding, limits and filesystem access are checked by the runtime.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException for invalid source invariants.
   */
  public static fromJson(value: unknown, path?: string): AttachmentInput;
  /**
   * Encodes this input for a send request.
   * @returns The name, mediaType, data and path wire fields.
   */
  public toJson(): JsonObject;
}

/**
 * Metadata for a durable file copied into TeamRun storage. History pages contain no file bytes.
 */
export declare class MessageAttachment {
  /**
   * Original display filename.
   */
  public readonly name: string;
  /**
   * MIME type of the file.
   */
  public readonly mediaType: string;
  /**
   * File size in bytes, a non-negative safe integer.
   */
  public readonly size: number;
  /**
   * Absolute local path to the saved copy.
   */
  public readonly path: string;
  /**
   * Initializes durable file metadata.
   * @param name Nonblank original filename.
   * @param mediaType Nonblank MIME type.
   * @param size Non-negative safe integer byte size.
   * @param path Nonblank saved file path.
   * @throws ArgumentException when a string is blank.
   * @throws ArgumentOutOfRangeException when size is invalid.
   */
  public constructor(name: string, mediaType: string, size: number, path: string);
  /**
   * Whether this is a PNG, JPEG, GIF or WebP image accepted as native provider input.
   */
  public get isImage(): boolean;
  /**
   * Decodes stored metadata.
   * @param value Object containing name, mediaType, size and path.
   * @param path Diagnostic field path; defaults to the JSON root.
   * @returns Validated metadata; does not access the filesystem.
   * @throws JsonException for missing or incorrectly typed fields.
   * @throws ArgumentException or ArgumentOutOfRangeException for invalid metadata.
   */
  public static fromJson(value: unknown, path?: string): MessageAttachment;
  /**
   * Encodes metadata without file bytes.
   * @returns The name, mediaType, size and path wire fields.
   */
  public toJson(): JsonObject;
}

/** One provider-discovered model; null capabilities are unknown, empty effort levels mean no choices. */
export declare class ProviderModel {
  /** The selectable provider model id. */
  public readonly id: string;
  /** Provider display label. */
  public readonly displayName: string;
  /** Provider description. */
  public readonly description: string;
  /** Reported effort choices; null when not advertised. */
  public readonly effortLevels: readonly string[] | null;
  /** Whether this row represents the provider default. */
  public readonly isDefault: boolean;
  /** Canonical model id when the provider resolves an alias. */
  public readonly resolvedModel: string | null;
  /** Image-input capability, or null when not reported. */
  public readonly supportsImages: boolean | null;
  /** Creates metadata and retains a copy of effort choices. */
  public constructor(id: string, displayName: string, description: string, effortLevels: readonly string[] | null,
    isDefault: boolean, resolvedModel: string | null, supportsImages: boolean | null);
  /** Reads validated wire metadata. */
  public static fromJson(value: unknown, path?: string): ProviderModel;
  /** Matches a selected id, resolved alias, or null for the provider default. */
  public matches(id: string | null): boolean;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A durable named participant bound to a provider account. */
export declare class Teammate {
  /** id. */
  public readonly id: string;
  /** The name at this record's creation or update. */
  public readonly name: string;
  /** Optional Markdown role instructions. */
  public readonly role: string | null;
  /** The bound account id; a deleted account makes the teammate unavailable. */
  public readonly providerAccountId: string;
  /** The provider-owned harness for this stage. */
  public readonly harness: Harness;
  /** model. */
  public readonly model: string | null;
  /** effort. */
  public readonly effort: string | null;
  /** created At. */
  public readonly createdAt: string;
  /** updated At. */
  public readonly updatedAt: string;
  /** Creates a validated immutable value. */
  public constructor(
    id: string,
    name: string,
    role: string | null,
    providerAccountId: string,
    harness: Harness,
    model: string | null,
    effort: string | null,
    createdAt: string,
    updatedAt: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): Teammate;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters for teammate create. */
export declare class TeammateCreateParams {
  /** The name at this record's creation or update. */
  public readonly name: string;
  /** Optional Markdown role instructions. */
  public readonly role: string | null;
  /** The bound account id; a deleted account makes the teammate unavailable. */
  public readonly providerAccountId: string;
  /** The provider-owned harness for this stage. */
  public readonly harness: Harness;
  /** model. */
  public readonly model: string | null;
  /** effort. */
  public readonly effort: string | null;
  /** Creates a validated immutable value. */
  public constructor(
    name: string,
    role: string | null,
    providerAccountId: string,
    harness: Harness,
    model: string | null,
    effort: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammateCreateParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters for teammate update. */
export declare class TeammateUpdateParams {
  /** teammate Id. */
  public readonly teammateId: string;
  /** The name at this record's creation or update. */
  public readonly name: string;
  /** Optional Markdown role instructions. */
  public readonly role: string | null;
  /** The bound account id; a deleted account makes the teammate unavailable. */
  public readonly providerAccountId: string;
  /** The provider-owned harness for this stage. */
  public readonly harness: Harness;
  /** model. */
  public readonly model: string | null;
  /** effort. */
  public readonly effort: string | null;
  /** Creates a validated immutable value. */
  public constructor(
    teammateId: string,
    name: string,
    role: string | null,
    providerAccountId: string,
    harness: Harness,
    model: string | null,
    effort: string | null);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammateUpdateParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters for teammate id. */
export declare class TeammateIdParams {
  /** teammate Id. */
  public readonly teammateId: string;
  /** Creates a validated immutable value. */
  public constructor(
    teammateId: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammateIdParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** Parameters for conversation member. */
export declare class ConversationMemberParams {
  /** conversation Id. */
  public readonly conversationId: string;
  /** teammate Id. */
  public readonly teammateId: string;
  /** Creates a validated immutable value. */
  public constructor(
    conversationId: string,
    teammateId: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ConversationMemberParams;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** A teammate membership and its native session in one conversation. */
export declare class ConversationMember {
  /** conversation Id. */
  public readonly conversationId: string;
  /** teammate Id. */
  public readonly teammateId: string;
  /** joined At. */
  public readonly joinedAt: string;
  /** Native session, or null for a fresh join/reset. */
  public readonly nativeSessionId: string | null;
  /** resumed Native Session. */
  public readonly resumedNativeSession: boolean;
  /** Creates a validated immutable value. */
  public constructor(
    conversationId: string,
    teammateId: string,
    joinedAt: string,
    nativeSessionId: string | null,
    resumedNativeSession: boolean);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): ConversationMember;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
  /** Keeps the membership identity and join time while replacing native session state. */
  public withSession(nativeSessionId: string | null, resumedNativeSession: boolean): ConversationMember;
}

/** Resolved mention identity and name preserved at message creation. */
export declare class TeammateMention {
  /** teammate Id. */
  public readonly teammateId: string;
  /** The name at this record's creation or update. */
  public readonly name: string;
  /** Creates a validated immutable value. */
  public constructor(
    teammateId: string,
    name: string);
  /** Reads a wire value and reports malformed fields at their JSON path. */
  public static fromJson(value: unknown, path?: string): TeammateMention;
  /** Returns the wire representation. */
  public toJson(): JsonObject;
}

/** The harness running a teammate. */
export declare enum Harness {
  /** The provider CLI or SDK owns the agent loop. */
  Provider = "Provider"
}

/** Validation and canonical comparison for participant names. */
export declare class TeammateName {
  /** Requires 1 to 32 Unicode characters after NFC normalization, using letters, decimal digits, dash or underscore. */
  public static validate(name: string): void;
  /** Reads a name with the same character/length limits and reports failures at the name field path. */
  public static read(reader: JsonReader): string;
  /** Produces the NFC-normalized lowercase lookup key without changing the displayed name. */
  public static key(name: string): string;
}

/**
 * Resolves user-written mentions, excluding code, escapes and email addresses.
 */
export declare class MentionResolver {
  /**
   * Returns unique matches in text order with their identity and name snapshots.
   */
  public static resolve(text: string, available: readonly TeammateMention[]): readonly TeammateMention[];
  /**
   * Finds every resolved occurrence outside code and escapes, without deduplicating names.
   * @param text The original text whose UTF-16 offsets are returned.
   * @param available The identities and displayed names available for resolution.
   * @returns Occurrences in text order, with an exclusive end offset.
   */
  public static find(text: string, available: readonly TeammateMention[]): readonly MentionSpan[];
}

/**
 * A resolved mention and its half-open UTF-16 range in the input text.
 */
export declare class MentionSpan {
  /**
   * The resolved identity and name snapshot.
   */
  public readonly mention: TeammateMention;
  /**
   * The inclusive start offset, at the at-sign.
   */
  public readonly start: number;
  /**
   * The exclusive end offset.
   */
  public readonly end: number;
  /**
   * Records an occurrence found by the resolver.
   * @param mention The resolved identity and name.
   * @param start The inclusive UTF-16 start offset.
   * @param end The exclusive UTF-16 end offset.
   */
  public constructor(mention: TeammateMention, start: number, end: number);
}

/**
 * Placement of role instructions in the provider request.
 */
export declare enum RoleApplication {
  /**
   * Native harness instruction field.
   */
  Instructions = "Instructions",
  /**
   * Explicit prompt fallback.
   */
  Prompt = "Prompt"
}

/**
 * The family of an installed shell, which chooses its icon.
 */
export declare enum TerminalShellKind {
  /**
   * PowerShell 7, Windows PowerShell or a Visual Studio developer PowerShell.
   */
  PowerShell = "PowerShell",
  /**
   * Command Prompt or a Visual Studio developer command prompt.
   */
  CommandPrompt = "CommandPrompt",
  /**
   * Bash, including Git Bash on Windows.
   */
  Bash = "Bash",
  /**
   * Zsh.
   */
  Zsh = "Zsh",
  /**
   * Fish.
   */
  Fish = "Fish",
  /**
   * A Windows Subsystem for Linux distribution.
   */
  Wsl = "Wsl",
  /**
   * Any other shell.
   */
  Other = "Other"
}

/**
 * A shell installed on the computer that a terminal can start.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalShell {
  /**
   * The shell's id, stable while the shell stays installed, such as `pwsh`, `wsl:Ubuntu` or `/bin/zsh`.
   */
  public readonly id: string;
  /**
   * The shell's display name, such as `PowerShell` or `Ubuntu`.
   */
  public readonly name: string;
  /**
   * The shell's family.
   */
  public readonly kind: TerminalShellKind;
  /**
   * Whether this is the platform's default shell, which a terminal starts when no shell is named.
   */
  public readonly isDefault: boolean;

  /**
   * Initializes the shell.
   * @param id The shell's id; must not be blank.
   * @param name The shell's display name; must not be blank.
   * @param kind The shell's family.
   * @param isDefault Whether this is the platform's default shell.
   * @throws ArgumentException when `id` or `name` is blank.
   */
  public constructor(id: string, name: string, kind: TerminalShellKind, isDefault: boolean);

  /**
   * Reads the shell from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, `name`, `kind` and `isDefault`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The shell.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): TerminalShell;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `name`, `kind` and `isDefault`.
   */
  public toJson(): JsonObject;
}

/**
 * Style flags of terminal text; a `TerminalTextRun` combines them with bitwise OR.
 */
export declare enum TerminalTextStyle {
  /**
   * Bold text (SGR 1).
   */
  Bold = 1,
  /**
   * Faint text (SGR 2).
   */
  Dim = 2,
  /**
   * Italic text (SGR 3).
   */
  Italic = 4,
  /**
   * Underlined text (SGR 4).
   */
  Underline = 8,
  /**
   * Blinking text (SGR 5).
   */
  Blink = 16,
  /**
   * Text and background colors swapped (SGR 7).
   */
  Inverse = 32,
  /**
   * Hidden text (SGR 8).
   */
  Invisible = 64,
  /**
   * Crossed-out text (SGR 9).
   */
  Strikethrough = 128,
  /**
   * Text with a line above it (SGR 53).
   */
  Overline = 256
}

/**
 * The size of a terminal in character cells.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalSize {
  /**
   * The width in columns; 2 through 1000.
   */
  public readonly columns: number;
  /**
   * The height in rows; 1 through 1000.
   */
  public readonly rows: number;

  /**
   * Initializes the size.
   * @param columns The width in columns; an integer from 2 through 1000.
   * @param rows The height in rows; an integer from 1 through 1000.
   * @throws ArgumentOutOfRangeException when a dimension is not an integer in its range.
   */
  public constructor(columns: number, rows: number);

  /**
   * Makes the nearest size a terminal can have, for a space measured in character cells.
   * @param columns The width in columns; a fraction is dropped and the result kept within 2 through 1000.
   * @param rows The height in rows; a fraction is dropped and the result kept within 1 through 1000.
   * @returns The size.
   * @throws ArgumentOutOfRangeException when a dimension is not a finite number.
   * @example
   * ```ts
   * TerminalSize.fitting(120.6, 0); // 120 columns and 1 row
   * ```
   */
  public static fitting(columns: number, rows: number): TerminalSize;

  /**
   * Reads the size from untrusted JSON.
   * @param value The untrusted value, expected to carry `columns` and `rows`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The size.
   * @throws JsonException when a field is missing or not an integer; the exception names the field's path.
   * @throws ArgumentOutOfRangeException when a dimension is out of range.
   */
  public static fromJson(value: unknown, path?: string): TerminalSize;

  /**
   * Compares two sizes.
   * @param other The size to compare with.
   * @returns Whether both have the same columns and rows.
   */
  public equals(other: TerminalSize): boolean;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `columns` and `rows`.
   */
  public toJson(): JsonObject;
}

/**
 * A range of a terminal's stored lines, by line number from `start` up to but excluding `end`. Line numbers keep
 * counting when stored lines are cleared, so a number always names the same line.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalLineRange {
  /**
   * The number of the first line; a non-negative integer.
   */
  public readonly start: number;
  /**
   * The number after the last line; an integer not below `start`.
   */
  public readonly end: number;

  /**
   * Initializes the range.
   * @param start The number of the first line; a non-negative integer.
   * @param end The number after the last line; an integer not below `start`, which it equals when the range is empty.
   * @throws ArgumentOutOfRangeException when `start` is negative or either value is not an integer.
   * @throws ArgumentException when `end` is below `start`.
   */
  public constructor(start: number, end: number);

  /**
   * Reads the range from untrusted JSON.
   * @param value The untrusted value, expected to carry `start` and `end`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The range.
   * @throws JsonException when a field is missing or not an integer; the exception names the field's path.
   * @throws ArgumentOutOfRangeException when `start` is negative.
   * @throws ArgumentException when `end` is below `start`.
   */
  public static fromJson(value: unknown, path?: string): TerminalLineRange;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `start` and `end`.
   */
  public toJson(): JsonObject;
}

/**
 * What the runtime reports about one terminal: which shell runs where, its size, whether the shell exited, and how far
 * its events and stored lines have come. `TerminalList`, `TerminalOpen` and `TerminalRestart` answer with it, and
 * `TerminalChanged` carries it.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalState {
  /**
   * The terminal id.
   */
  public readonly id: string;
  /**
   * The id of the `Project` whose folder the shell started in, or `null` when it started in the person's home folder.
   */
  public readonly projectId: string | null;
  /**
   * The shell's display name, such as `PowerShell` or `zsh`.
   */
  public readonly shell: string;
  /**
   * The build of the Windows pseudo-console (ConPTY) that runs the shell, or `null` outside Windows. A client that
   * draws the terminal gives it to its emulator, because ConPTY redraws the screen after a resize and builds before
   * 21376 do so differently, so the client's screen wraps lines as the runtime's does.
   */
  public readonly conptyBuild: number | null;
  /**
   * The terminal's size.
   */
  public readonly size: TerminalSize;
  /**
   * The shell's exit code, or `null` while it runs.
   */
  public readonly exitCode: number | null;
  /**
   * How many times the shell was started again; 0 until the first restart.
   */
  public readonly restartCount: number;
  /**
   * The sequence of the last terminal event this state includes; 0 before the first event. A client that loads this
   * state ignores events with this sequence or a lower one.
   */
  public readonly sequence: number;
  /**
   * The lines stored so far, which have left the screen.
   */
  public readonly stored: TerminalLineRange;

  /**
   * Initializes the state.
   * @param id The terminal id; must not be blank.
   * @param projectId The id of the `Project` whose folder the shell started in, or `null` for the home folder; a given id
   * must not be blank.
   * @param shell The shell's display name; must not be blank.
   * @param conptyBuild The Windows build that runs the shell, a positive integer, or `null` outside Windows.
   * @param size The terminal's size.
   * @param exitCode The shell's exit code, an integer, or `null` while it runs.
   * @param restartCount How many times the shell was started again; a non-negative integer.
   * @param sequence The sequence of the last event this state includes; a non-negative integer.
   * @param stored The lines stored so far.
   * @throws ArgumentException when `id`, `projectId` or `shell` is blank.
   * @throws ArgumentOutOfRangeException when `conptyBuild` is not a positive integer, `exitCode` is not an integer or a
   * count is negative or not an integer.
   */
  public constructor(
    id: string,
    projectId: string | null,
    shell: string,
    conptyBuild: number | null,
    size: TerminalSize,
    exitCode: number | null,
    restartCount: number,
    sequence: number,
    stored: TerminalLineRange);

  /**
   * Reads the state from untrusted JSON.
   * @param value The untrusted value, expected to carry `id`, the nullable `projectId`, `shell`, the nullable
   * `conptyBuild`, `size`, the nullable `exitCode`, `restartCount`, `sequence` and `stored`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The state.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentException or ArgumentOutOfRangeException when a value breaks the constructor's rules.
   */
  public static fromJson(value: unknown, path?: string): TerminalState;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `id`, `projectId`, `shell`, `conptyBuild`, `size`, `exitCode`, `restartCount`, `sequence`
   * and `stored`.
   */
  public toJson(): JsonObject;
}

/**
 * A stretch of a terminal line's text drawn with one style.
 * @remarks
 * Colors are -1 for the terminal's default color, 0 through 255 for a palette color, and `0x1000000` plus a 24-bit
 * RGB value for any other color. Instances are immutable. `fromJson` validates untrusted input and reports the
 * offending field's path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalTextRun {
  /**
   * How many UTF-16 code units of the line's text the run covers; at least 1.
   */
  public readonly length: number;
  /**
   * The text color.
   */
  public readonly foreground: number;
  /**
   * The background color.
   */
  public readonly background: number;
  /**
   * The `TerminalTextStyle` flags combined with bitwise OR; 0 for plain text.
   */
  public readonly style: number;

  /**
   * Initializes the run.
   * @param length How many UTF-16 code units the run covers; a positive integer.
   * @param foreground The text color, as described for the class.
   * @param background The background color, as described for the class.
   * @param style `TerminalTextStyle` flags combined with bitwise OR.
   * @throws ArgumentOutOfRangeException when the length is not positive, a color is not a valid color value, or the
   * style has a bit that is not a `TerminalTextStyle` flag.
   */
  public constructor(length: number, foreground: number, background: number, style: number);

  /**
   * Reads the run from untrusted JSON.
   * @param value The untrusted value, expected to carry `length`, `foreground`, `background` and `style`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The run.
   * @throws JsonException when a field is missing or not an integer; the exception names the field's path.
   * @throws ArgumentOutOfRangeException when a value breaks the constructor's rules.
   */
  public static fromJson(value: unknown, path?: string): TerminalTextRun;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `length`, `foreground`, `background` and `style`.
   */
  public toJson(): JsonObject;
}

/**
 * One stored terminal line, with the wrapping it had when it left the screen. It is text to show, never markup.
 * @remarks
 * Instances are immutable; the runs are copied on construction. `fromJson` validates untrusted input and reports the
 * offending field's path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalLine {
  /**
   * The line's text without trailing blanks that have no color.
   */
  public readonly text: string;
  /**
   * Whether the line continues the line before it, which was too long for the terminal's width.
   */
  public readonly wrapped: boolean;
  /**
   * The styles of the text, in order; their lengths add up to the text's length.
   */
  public readonly runs: readonly TerminalTextRun[];

  /**
   * Initializes the line.
   * @param text The text; empty for a blank line.
   * @param wrapped Whether the line continues the one before it.
   * @param runs The styles of the text, in order; copied.
   * @throws ArgumentException when the runs' lengths do not add up to the text's length.
   */
  public constructor(text: string, wrapped: boolean, runs: readonly TerminalTextRun[]);

  /**
   * Reads the line from untrusted JSON.
   * @param value The untrusted value, expected to carry `text`, `wrapped` and `runs`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The line.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentException or ArgumentOutOfRangeException when a value breaks a constructor's rules.
   */
  public static fromJson(value: unknown, path?: string): TerminalLine;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `text`, `wrapped` and `runs`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `TerminalOpen`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalOpenParams {
  /**
   * The id of the `Project` whose folder the shell starts in, or `null` to start it in the person's home folder.
   */
  public readonly projectId: string | null;
  /**
   * The id of the `TerminalShell` to start, or `null` for the platform's default shell.
   */
  public readonly shellId: string | null;
  /**
   * The terminal's starting size.
   */
  public readonly size: TerminalSize;

  /**
   * Initializes the parameters.
   * @param projectId The `Project` id, or `null` for the home folder; a given id must not be blank.
   * @param shellId The `TerminalShell` id, or `null` for the platform's default shell; a given id must not be blank.
   * @param size The terminal's starting size.
   * @throws ArgumentException when `projectId` or `shellId` is blank.
   */
  public constructor(projectId: string | null, shellId: string | null, size: TerminalSize);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry the nullable `projectId`, the nullable `shellId` and `size`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentOutOfRangeException when the size is out of range.
   */
  public static fromJson(value: unknown, path?: string): TerminalOpenParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `projectId`, `shellId` and `size`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `TerminalAcknowledge`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalAcknowledgeParams {
  /**
   * The terminal id.
   */
  public readonly terminalId: string;
  /**
   * How many characters of output the caller processed since its last acknowledgement; a positive integer.
   */
  public readonly characters: number;

  /**
   * Initializes the parameters.
   * @param terminalId The terminal id; must not be blank.
   * @param characters How many characters of output the caller processed since its last acknowledgement, counted
   * as the length of the events' `data` strings; a positive integer.
   * @throws ArgumentException when `terminalId` is blank.
   * @throws ArgumentOutOfRangeException when `characters` is not a positive integer.
   */
  public constructor(terminalId: string, characters: number);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `terminalId` and `characters`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentOutOfRangeException when `characters` is not a positive integer.
   */
  public static fromJson(value: unknown, path?: string): TerminalAcknowledgeParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `terminalId` and `characters`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of the terminal methods that name only a terminal: `TerminalRestart`, `TerminalClose` and
 * `TerminalScreen`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalIdParams {
  /**
   * The terminal id.
   */
  public readonly terminalId: string;

  /**
   * Initializes the parameters.
   * @param terminalId The terminal id; must not be blank.
   * @throws ArgumentException when `terminalId` is blank.
   */
  public constructor(terminalId: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `terminalId`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when the field is missing or blank; the exception names the field's path.
   */
  public static fromJson(value: unknown, path?: string): TerminalIdParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `terminalId`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `TerminalInput`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalInputParams {
  /**
   * The terminal id.
   */
  public readonly terminalId: string;
  /**
   * What the person typed or pasted, including control characters such as `\r` for Enter.
   */
  public readonly data: string;

  /**
   * Initializes the parameters.
   * @param terminalId The terminal id; must not be blank.
   * @param data The input; must not be empty.
   * @throws ArgumentException when `terminalId` is blank or `data` is empty.
   */
  public constructor(terminalId: string, data: string);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `terminalId` and `data`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentException when `data` is empty.
   */
  public static fromJson(value: unknown, path?: string): TerminalInputParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `terminalId` and `data`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `TerminalResize`.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalResizeParams {
  /**
   * The terminal id.
   */
  public readonly terminalId: string;
  /**
   * The new size.
   */
  public readonly size: TerminalSize;

  /**
   * Initializes the parameters.
   * @param terminalId The terminal id; must not be blank.
   * @param size The new size.
   * @throws ArgumentException when `terminalId` is blank.
   */
  public constructor(terminalId: string, size: TerminalSize);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `terminalId` and `size`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentOutOfRangeException when the size is out of range.
   */
  public static fromJson(value: unknown, path?: string): TerminalResizeParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `terminalId` and `size`.
   */
  public toJson(): JsonObject;
}

/**
 * Parameters of `TerminalLines`: up to `limit` stored lines from line number `start` on.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalLinesParams {
  /**
   * The terminal id.
   */
  public readonly terminalId: string;
  /**
   * The number of the first line to read; a non-negative integer.
   */
  public readonly start: number;
  /**
   * How many lines at most; 1 through 500.
   */
  public readonly limit: number;

  /**
   * Initializes the parameters.
   * @param terminalId The terminal id; must not be blank.
   * @param start The number of the first line to read; a non-negative integer.
   * @param limit How many lines at most; 1 through 500.
   * @throws ArgumentException when `terminalId` is blank.
   * @throws ArgumentOutOfRangeException when `start` is negative or `limit` is out of range.
   */
  public constructor(terminalId: string, start: number, limit: number);

  /**
   * Reads the parameters from untrusted JSON.
   * @param value The untrusted value, expected to carry `terminalId`, `start` and `limit`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The parameters.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentOutOfRangeException when a number is out of range.
   */
  public static fromJson(value: unknown, path?: string): TerminalLinesParams;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `terminalId`, `start` and `limit`.
   */
  public toJson(): JsonObject;
}

/**
 * Result of `TerminalLines`: the stored lines found from a line number on, and the range stored now. When the
 * requested lines were cleared, the page starts at the first line still stored.
 * @remarks
 * Instances are immutable; the lines are copied on construction. `fromJson` validates untrusted input and reports the
 * offending field's path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalLinePage {
  /**
   * The number of the page's first line.
   */
  public readonly start: number;
  /**
   * The lines, in order; empty when none are stored from `start` on.
   */
  public readonly lines: readonly TerminalLine[];
  /**
   * The lines stored when the page was read.
   */
  public readonly stored: TerminalLineRange;

  /**
   * Initializes the page.
   * @param start The number of the page's first line.
   * @param lines The lines, in order; copied.
   * @param stored The lines stored when the page was read.
   * @throws ArgumentOutOfRangeException when `start` is not an integer.
   * @throws ArgumentException when the page reaches outside `stored`.
   */
  public constructor(start: number, lines: readonly TerminalLine[], stored: TerminalLineRange);

  /**
   * Reads the page from untrusted JSON.
   * @param value The untrusted value, expected to carry `start`, `lines` and `stored`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The page.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentException or ArgumentOutOfRangeException when a value breaks a constructor's rules.
   */
  public static fromJson(value: unknown, path?: string): TerminalLinePage;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `start`, `lines` and `stored`.
   */
  public toJson(): JsonObject;
}

/**
 * Result of `TerminalScreen`: a terminal's state and its current screen. Writing `screen` to an emulator of the
 * state's size restores the screen, the cursor and the modes programs set, including a full-screen program's
 * alternate screen.
 * @remarks
 * Instances are immutable. `fromJson` validates untrusted input and reports the offending field's
 * path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalScreen {
  /**
   * The terminal's state; its `sequence` is the last event the screen includes.
   */
  public readonly state: TerminalState;
  /**
   * The screen as terminal output; untrusted text for a terminal emulator, never markup.
   */
  public readonly screen: string;

  /**
   * Initializes the screen.
   * @param state The terminal's state.
   * @param screen The screen as terminal output.
   */
  public constructor(state: TerminalState, screen: string);

  /**
   * Reads the screen from untrusted JSON.
   * @param value The untrusted value, expected to carry `state` and `screen`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The screen.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentException or ArgumentOutOfRangeException when the state breaks its constructor's rules.
   */
  public static fromJson(value: unknown, path?: string): TerminalScreen;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `state` and `screen`.
   */
  public toJson(): JsonObject;
}

/**
 * Payload of `TerminalOutput`: output of a terminal's shell, in the order the runtime's emulator processed it.
 * @remarks
 * The output is untrusted text for a terminal emulator, never markup. Instances are immutable. `fromJson` validates
 * untrusted input and reports the offending field's path; `toJson` renders the canonical wire shape.
 */
export declare class TerminalOutputPayload {
  /**
   * The terminal id.
   */
  public readonly terminalId: string;
  /**
   * The event's sequence; each terminal event's sequence is one more than the one before.
   */
  public readonly sequence: number;
  /**
   * The output.
   */
  public readonly data: string;
  /**
   * The lines stored after the output was processed.
   */
  public readonly stored: TerminalLineRange;

  /**
   * Initializes the payload.
   * @param terminalId The terminal id; must not be blank.
   * @param sequence The event's sequence; a positive integer.
   * @param data The output; must not be empty.
   * @param stored The lines stored after the output was processed.
   * @throws ArgumentException when `terminalId` is blank or `data` is empty.
   * @throws ArgumentOutOfRangeException when `sequence` is not a positive integer.
   */
  public constructor(terminalId: string, sequence: number, data: string, stored: TerminalLineRange);

  /**
   * Reads the payload from untrusted JSON.
   * @param value The untrusted value, expected to carry `terminalId`, `sequence`, `data` and `stored`.
   * @param path Path to report for the value; the root path `$` by default.
   * @returns The payload.
   * @throws JsonException when a field is missing or invalid; the exception names the field's path.
   * @throws ArgumentException or ArgumentOutOfRangeException when a value breaks the constructor's rules.
   */
  public static fromJson(value: unknown, path?: string): TerminalOutputPayload;

  /**
   * Renders the JSON object `fromJson` accepts.
   * @returns The object with `terminalId`, `sequence`, `data` and `stored`.
   */
  public toJson(): JsonObject;
}
