/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DbContext, type DbContextOptions } from "@noldova/teamrun-foundation-data";
import type { MigrationBuilder, SqlConnection, SqlMigration } from "@noldova/teamrun-foundation-data-sql";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import type {
  Approval,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  AttachmentInput,
  AuthStatus,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMember,
  ConversationMemberParams,
  ConversationMoveParams,
  ConversationRenameParams,
  ConversationRewindParams,
  ConversationRewindResult,
  ConversationSearchParams,
  ConversationSearchResult,
  DetailKind,
  Event,
  ForkedSession,
  Message,
  MessageAttachment,
  MessageIdParams,
  MessageListParams,
  MessagePage,
  MessagePageParams,
  MessageSendParams,
  MessageSendResult,
  ObservedSettings,
  Project,
  ProjectIdParams,
  ProjectOpenParams,
  Provenance,
  ProviderAccount,
  ProviderAccountCreateParams,
  ProviderAccountIdentity,
  ProviderAccountIdParams,
  ProviderDescriptor,
  ProviderListModelsParams,
  ProviderModel,
  ReplyPage,
  ReplyPanel,
  Request,
  RequestedSettings,
  Response,
  RoleApplication,
  Teammate,
  TeammateCreateParams,
  TeammateIdParams,
  TeammateUpdateParams
} from "@noldova/teamrun-protocol";

/**
 * The kinds of record TeamRun writes to the change feed, as the feed's entity names.
 */
export declare enum ChangeEntity {
  /**
   * Durable participant.
   */
  Teammate = "Teammate",
  /**
   * Membership and native session state.
   */
  ConversationMember = "ConversationMember",
  /**
   * A `Project`.
   */
  Project = "Project",
  /**
   * A `Conversation`.
   */
  Conversation = "Conversation",
  /**
   * A `Message` with its details.
   */
  Message = "Message",
  /**
   * An `Approval`.
   */
  Approval = "Approval",
  /**
   * A `ProviderAccount`.
   */
  ProviderAccount = "ProviderAccount",
}

/**
 * How a provider's turn ended, as the adapter reports it.
 */
export declare enum TurnOutcome {
  /**
   * The provider finished its reply.
   */
  Completed = "Completed",
  /**
   * The provider or its harness failed; the result carries the error.
   */
  Failed = "Failed",
  /**
   * The turn was interrupted before it finished, by a cancellation or by the provider.
   */
  Interrupted = "Interrupted",
}

/**
 * What one provider's adapter does for TeamRun: reports itself, checks sign-in, lists models, and
 * runs turns. Implemented in the providers package; the core only sees this contract, so provider
 * protocol details never enter it.
 */
export interface IProviderAdapter {
  /**
   * The provider as the protocol describes it.
   */
  readonly descriptor: ProviderDescriptor;

  /**
   * Checks whether the account's profile is signed in and reports what the harness says about it.
   * @param account The account to check.
   * @returns The check's outcome.
   */
  checkSignIn(account: ProviderAccount): Promise<SignInCheck>;

  /**
   * Lists the model names the provider offers, through the account when one is given.
   * @param account The account, or `null` for the provider's default profile.
   * @returns The model names.
   */
  listModels(account: ProviderAccount | null): Promise<readonly ProviderModel[]>;

  /**
   * Runs one turn: delivers the prompt, reports progress through the listener, waits for approval
   * decisions the listener returns, and ends when the provider finishes, fails, or the signal
   * aborts.
   * @param request What to run and where.
   * @param listener Where progress is reported.
   * @param signal Aborted to interrupt the turn.
   * @returns How the turn ended.
   */
  runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;

  /**
   * Forks a native session through one of its turns into a new session that holds the history up
   * to that turn; only when the descriptor says `supportsFork`.
   * @param request The session, the turn, and where the fork works.
   * @returns The new native session id.
   * @throws When the provider cannot fork the session (the caller falls back to a transcript).
   */
  forkSession(request: ForkRequest): Promise<string>;

  /**
   * Stops the adapter's background processes.
   */
  shutdown(): Promise<void>;
}

/**
 * Where an adapter reports a turn's progress.
 */
export interface ITurnListener {
  /**
   * Reports that the provider accepted the turn, with the native session it runs in.
   * @param start The session facts.
   */
  onStarted(start: TurnStart): void;

  /**
   * Reports one detail of the reply, in order.
   * @param detail The detail.
   */
  onDetail(detail: TurnDetail): void;

  /**
   * Reports that the provider is thinking without sending text a reply can show, such as a thinking progress frame.
   * Called as often as the provider reports progress; the listener decides what to show.
   */
  onThinking(): void;

  /**
   * Asks for the user's decision on a request the provider made and resolves with the chosen
   * option's id; the adapter keeps the turn waiting meanwhile. Rejects when the reply is cancelled.
   * @param ask What the provider asks.
   * @returns The chosen option's id.
   */
  onApprovalRequested(ask: ApprovalAsk): Promise<string>;

  /**
   * Reports what the provider says about itself: model, effort, harness version, identity.
   * @param observed The observed settings.
   */
  onObserved(observed: ObservedSettings): void;
}

/**
 * Receives the events the core publishes.
 */
export interface IEventListener {
  /**
   * Receives one event.
   * @param event The event.
   */
  onEvent(event: Event): void;
}

/**
 * Where the core publishes its events: the runtime fans them out to attached clients.
 */
export interface IEventSink {
  /**
   * Publishes one event to every listener.
   * @param event The event.
   */
  publish(event: Event): void;
}

/**
 * The project methods of the catalog (`ProjectList`, `ProjectOpen`, `ProjectForget`) over
 * TeamRun's record, plus the lookup the engine needs.
 */
export interface IProjectsService {
  /**
   * Lists the projects, oldest first.
   * @returns The projects.
   */
  list(): readonly Project[];

  /**
   * Finds a project by id.
   * @param projectId The project id.
   * @returns The project, or `null` when it does not exist.
   */
  find(projectId: string): Project | null;

  /**
   * Opens a folder as a project, creating the project on first open.
   * @param params The absolute path of the folder.
   * @returns The existing or created project.
   * @throws ServiceException (foundation) named `ErrorCode.InvalidParams` when the path is not absolute.
   */
  open(params: ProjectOpenParams): Project;

  /**
   * Forgets a project; the folder is left untouched.
   * @param params The project id.
   * @throws ServiceException (foundation) named `ErrorCode.NotFound` when the project does not exist, and
   * `ErrorCode.Conflict` while the project still has conversations.
   */
  forget(params: ProjectIdParams): void;
}

/**
 * The conversation methods of the catalog over TeamRun's record, plus the lookup the engine needs.
 */
export interface IConversationsService {
  /**
   * Lists memberships in join order; the conversation must exist.
   */
  listMembers(params: ConversationIdParams): readonly ConversationMember[];

  /**
   * Adds a teammate once; repeated additions preserve join time and session state.
   */
  addMember(params: ConversationMemberParams): ConversationMember;

  /**
   * Removes an existing membership while its conversation is idle; missing membership is a no-op.
   */
  removeMember(params: ConversationMemberParams): void;

  /**
   * Finds a membership by both identities.
   */
  findMember(params: ConversationMemberParams): ConversationMember | null;

  /**
   * Updates session state for an existing membership and records the change.
   */
  setMemberSession(params: ConversationMemberParams, nativeSessionId: string | null, resumedNativeSession: boolean): ConversationMember;

  /**
   * Resets memberships for an account rebind; rejects when an affected conversation has an open reply.
   */
  resetTeammateSessions(teammateId: string): void;

  /**
   * Removes memberships before deleting a teammate; rejects while an affected conversation has an open reply.
   */
  removeTeammateMembers(teammateId: string): void;

  /**
   * Lists a project's conversations, oldest first.
   * @param params The project id.
   * @returns The conversations.
   */
  list(params: ProjectIdParams): readonly Conversation[];

  /**
   * Finds a conversation by id.
   * @param conversationId The conversation id.
   * @returns The conversation, or `null` when it does not exist.
   */
  find(conversationId: string): Conversation | null;

  /**
   * Creates a conversation in a project; a `null` title becomes `Resources.defaultConversationTitle`.
   * @param params The project id and the optional title.
   * @returns The conversation.
   * @throws ServiceException named `ErrorCode.NotFound` when the project does not exist.
   */
  create(params: ConversationCreateParams): Conversation;

  /**
   * Renames a conversation.
   * @param params The conversation id and the new title.
   * @returns The renamed conversation.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation does not exist.
   */
  rename(params: ConversationRenameParams): Conversation;

  /**
   * Moves a conversation under another project.
   * @param params The conversation id and the project id.
   * @returns The moved conversation.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation or the project does not exist.
   */
  move(params: ConversationMoveParams): Conversation;

  /**
   * Deletes a conversation with its messages and approvals, logging every deletion.
   * @param params The conversation id.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation does not exist.
   */
  delete(params: ConversationIdParams): void;

  /**
   * Removes a conversation's messages from a sequence on, with their approvals.
   * @param conversationId The conversation id.
   * @param fromSequence The sequence of the first message to remove.
   * @returns The messages removed, in sequence order.
   */
  removeFrom(conversationId: string, fromSequence: number): readonly Message[];

  /**
   * Marks or clears the conversation's need for a fresh provider session (set by a rewind, cleared by the next send).
   * @param conversationId The conversation id.
   * @param sessionReset The mark.
   * @returns The conversation as stored.
   */
  setSessionReset(conversationId: string, sessionReset: boolean): Conversation;

  /**
   * Records the forked session a rewind made (clearing the reset mark), or forgets it.
   * @param conversationId The conversation id.
   * @param forkedSession The forked session, or `null`.
   * @returns The conversation as stored.
   */
  setForkedSession(conversationId: string, forkedSession: ForkedSession | null): Conversation;

  /**
   * Finds the conversations whose title or message texts contain a text (case-insensitively for ASCII): one hit per
   * conversation, the title when it matches and else the latest matching message with a snippet, the latest
   * conversation first.
   * @param params The text and the most hits.
   * @returns The hits.
   */
  search(params: ConversationSearchParams): ConversationSearchResult;
}

/**
 * The message record: the `MessageList` method plus the reads and writes the engine needs. Writes
 * log to the change feed; the engine publishes the events.
 */
export interface IMessagesService {
  /**
   * Lists a conversation's messages in sequence order, optionally after a sequence.
   * @param params The conversation id and the sequence to start after, or `null` for all.
   * @returns The messages with their details.
   */
  list(params: MessageListParams): readonly Message[];

  /**
   * A page of a conversation's messages: the newest ones, the ones before a sequence, or the ones after one.
   * @param params The conversation id, at most one cursor, and the limit.
   * @returns The messages in sequence order, and whether messages lie before the first and after the last.
   */
  page(params: MessagePageParams): MessagePage;

  /**
   * Lists a bounded page of matching provider replies without output or diff bodies.
   * @param params Conversation, optional exclusive cursor, and page limit.
   * @param panel The panel whose replies to select.
   * @returns Matching summaries in descending sequence order and adjacent-page flags.
   */
  replyPage(params: MessagePageParams, panel: ReplyPanel): ReplyPage;

  /**
   * Finds a message by id.
   * @param messageId The message id.
   * @returns The message, or `null` when it does not exist.
   */
  find(messageId: string): Message | null;

  /**
   * Finds the conversation's reply that is pending, running, or awaiting approval.
   * @param conversationId The conversation id.
   * @returns The open reply, or `null` when there is none.
   */
  findOpenReply(conversationId: string): Message | null;

  /**
   * Finds the newest recorded native session for the requested provider and account.
   * @param conversationId The conversation to search.
   * @param provider The provider identifier.
   * @param accountId The account identifier, or null for the default account.
   * @returns The native session identifier, or null when no compatible session is recorded.
   * @remarks Queries the database directly without loading transcript details.
   */
  findResumableSession(conversationId: string, provider: string, accountId: string | null): string | null;

  /**
   * Lists every reply still pending, running, or awaiting an approval, across conversations.
   */
  listOpen(): readonly Message[];

  /**
   * Returns the sequence the conversation's next message takes: `0` for the first.
   * @param conversationId The conversation id.
   * @returns The next sequence.
   */
  nextSequence(conversationId: string): number;

  /**
   * Inserts a message and logs the insert.
   * @param message The message.
   */
  insert(message: Message): void;

  /**
   * Replaces a message's stored form and logs the update.
   * @param message The message.
   */
  update(message: Message): void;
}

/**
 * The approval record: the `ApprovalList` method plus the reads and writes the engine needs.
 */
export interface IApprovalsService {
  /**
   * Lists pending approvals across every conversation, ordered by identifier.
   * @returns The pending approvals.
   */
  listPendingAll(): readonly Approval[];

  /**
   * Lists a conversation's pending approvals, oldest first.
   * @param params The conversation id.
   * @returns The pending approvals.
   */
  list(params: ConversationIdParams): readonly Approval[];

  /**
   * Finds an approval by id.
   * @param approvalId The approval id.
   * @returns The approval, or `null` when it does not exist.
   */
  find(approvalId: string): Approval | null;

  /**
   * Lists a message's pending approvals, oldest first.
   * @param messageId The message id.
   * @returns The pending approvals.
   */
  listPending(messageId: string): readonly Approval[];

  /**
   * Inserts an approval and logs the insert.
   * @param approval The approval.
   */
  insert(approval: Approval): void;

  /**
   * Replaces an approval's stored form and logs the update.
   * @param approval The approval.
   */
  update(approval: Approval): void;
}

/**
 * The provider account methods of the catalog over TeamRun's record and the registered adapters.
 */
export interface IProviderAccountsService {
  /**
   * Lists the provider accounts, oldest first.
   * @returns The accounts.
   */
  list(): readonly ProviderAccount[];

  /**
   * Finds an account by id.
   * @param providerAccountId The account id.
   * @returns The account, or `null` when it does not exist.
   */
  find(providerAccountId: string): ProviderAccount | null;

  /**
   * Creates an account for a profile directory the provider tooling will own; the sign-in status
   * starts unknown.
   * @param params The provider, the label, and the absolute profile directory.
   * @returns The account.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider is not registered, and
   * `ErrorCode.InvalidParams` when the directory is not absolute.
   */
  create(params: ProviderAccountCreateParams): ProviderAccount;

  /**
   * Runs the adapter's sign-in check, records what it observed, and publishes
   * `ProviderAccountUpdated`.
   * @param params The account id.
   * @returns The checked account.
   * @throws ServiceException named `ErrorCode.NotFound` when the account does not exist.
   */
  check(params: ProviderAccountIdParams): Promise<ProviderAccount>;

  /**
   * Forgets an account; the profile directory is left in place.
   * @param params The account id.
   * @throws ServiceException named `ErrorCode.NotFound` when the account does not exist.
   */
  delete(params: ProviderAccountIdParams): void;
}

/**
 * The provider methods of the catalog over the registered adapters.
 */
export interface IProvidersService {
  /**
   * Lists the registered providers.
   * @returns Their descriptors.
   */
  list(): readonly ProviderDescriptor[];

  /**
   * Lists the models a provider reports, optionally through an account of that provider.
   * @param params The provider and the optional account id.
   * @returns The model names.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider is not registered or the
   * account does not exist, and `ErrorCode.InvalidParams` when the account belongs to another
   * provider.
   */
  listModels(params: ProviderListModelsParams): Promise<readonly string[]>;

  /**
   * Returns provider-discovered models and their reported capabilities.
   */
  modelCatalog(params: ProviderListModelsParams): Promise<readonly ProviderModel[]>;
}

/**
 * The message methods that involve a provider: `MessageSend`, `MessageCancel`, and
 * `ApprovalDecide`.
 */
export interface IConversationEngine {
  /**
   * Copies one bounded input into runtime-owned transient storage for a later send.
   */
  prepareAttachment(input: AttachmentInput): MessageAttachment;

  /**
   * Deletes only a transient preparation; never deletes a committed message attachment.
   */
  discardAttachment(attachment: MessageAttachment): void;

  /**
   * Stores the user message and all pending replies atomically, then executes replies in responder order.
   * Mentions override the selected responder and join non-members; unavailable named responders are skipped.
   * @param params The message, attachment inputs, resolved mentions and responder selection.
   * @returns The stored message and zero or more pending replies, updated through events.
   * @throws ServiceException named `ErrorCode.NotFound` when the conversation, its project, the
   * provider, or the account does not exist; `ErrorCode.Conflict` while the conversation has an
   * open reply; `ErrorCode.InvalidParams` when the account belongs to another provider.
   */
  send(params: MessageSendParams): Promise<MessageSendResult>;

  /**
   * Cancels the running and queued replies belonging to one user message.
   * @param params Any reply id in the active group, including an already completed sibling.
   * @returns The selected reply after the group has settled; completed siblings retain their status.
   * @throws ServiceException named `ErrorCode.NotFound` when the message does not exist, and
   * `ErrorCode.Conflict` when it belongs to no active send.
   */
  cancel(params: MessageIdParams): Promise<Message>;

  /**
   * Decides a pending approval by one of its options, records it, publishes `ApprovalUpdated`, and
   * lets the waiting turn continue.
   * @param params The approval and the option.
   * @returns The decided approval.
   * @throws ServiceException named `ErrorCode.NotFound` when the approval does not exist,
   * `ErrorCode.Conflict` when it is already decided, and `ErrorCode.InvalidParams` when the option
   * is not offered.
   */
  decide(params: ApprovalDecideParams): Approval;

  /**
   * Removes a message and everything after it, marks the conversation for a fresh provider session, and optionally
   * restores the project's files.
   * @param params Which message to cut from and whether to restore files.
   * @returns The conversation as marked, the ids removed, and how many files the restore changed.
   */
  rewind(params: ConversationRewindParams): Promise<ConversationRewindResult>;
}

/**
 * Every literal of the core package: the database file name, the migration id, the table names,
 * the column names that no model property provides, the SQL statements of the services, parameter
 * names, and the service messages.
 */
export declare class Resources {
  /**
   * recovery wake milliseconds used by update preparation and recovery.
   */
  public static readonly recoveryWakeMilliseconds: number;
  /**
   * database version unsupported used by update preparation and recovery.
   */
  public static readonly databaseVersionUnsupported: string;
  /**
   * recovery operation pattern used by update preparation and recovery.
   */
  public static readonly recoveryOperationPattern: RegExp;
  /**
   * recovery operation invalid used by update preparation and recovery.
   */
  public static readonly recoveryOperationInvalid: string;
  /**
   * recovery find history used by update preparation and recovery.
   */
  public static readonly recoveryFindHistory: string;
  /**
   * recovery read history used by update preparation and recovery.
   */
  public static readonly recoveryReadHistory: string;
  /**
   * recovery id column used by update preparation and recovery.
   */
  public static readonly recoveryIdColumn: string;
  /**
   * recovery directory name used by update preparation and recovery.
   */
  public static readonly recoveryDirectoryName: string;
  /**
   * recovery backup suffix used by update preparation and recovery.
   */
  public static readonly recoveryBackupSuffix: string;
  /**
   * recovery temporary suffix used by update preparation and recovery.
   */
  public static readonly recoveryTemporarySuffix: string;
  /**
   * recovery file mode used by update preparation and recovery.
   */
  public static readonly recoveryFileMode: number;
  /**
   * recovery integrity check used by update preparation and recovery.
   */
  public static readonly recoveryIntegrityCheck: string;
  /**
   * recovery integrity field used by update preparation and recovery.
   */
  public static readonly recoveryIntegrityField: string;
  /**
   * recovery integrity ok used by update preparation and recovery.
   */
  public static readonly recoveryIntegrityOk: string;
  /**
   * recovery backup failed used by update preparation and recovery.
   */
  public static readonly recoveryBackupFailed: string;
  /**
   * update conversation project used by update preparation and recovery.
   */
  public static readonly updateConversationProject: string;
  /**
   * select newest messages by conversation used by update preparation and recovery.
   */
  public static readonly selectNewestMessagesByConversation: string;
  /**
   * select messages before sequence used by update preparation and recovery.
   */
  public static readonly selectMessagesBeforeSequence: string;
  /**
   * select messages after sequence limited used by update preparation and recovery.
   */
  public static readonly selectMessagesAfterSequenceLimited: string;
  /**
   * select earlier message exists used by update preparation and recovery.
   */
  public static readonly selectEarlierMessageExists: string;
  /**
   * select later message exists used by update preparation and recovery.
   */
  public static readonly selectLaterMessageExists: string;
  public static readonly mentionsChanged: string;
  /**
   * Participant execution literal.
   */
  public static readonly instructionsParameterName: string;
  /**
   * Participant execution literal.
   */
  public static readonly freshPromptParameterName: string;
  /**
   * Participant execution literal.
   */
  public static readonly contextOmissionNote: string;
  /**
   * Participant execution literal.
   */
  public static readonly queuedReplyCancelled: string;
  /**
   * History cap, excluding the current user message.
   */
  public static readonly joinPreambleMaximumCharacters: number;
  /**
   * Size of history reads while preparing context.
   */
  public static readonly contextPageSize: number;
  /**
   * Teammate storage literal.
   */
  public static readonly teammatesMigrationId: string;
  /**
   * Teammate storage literal.
   */
  public static readonly teammatesTable: string;
  /**
   * Teammate storage literal.
   */
  public static readonly conversationTeammatesTable: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectTeammates: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectTeammateById: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectTeammateByName: string;
  /**
   * Teammate storage literal.
   */
  public static readonly insertTeammate: string;
  /**
   * Teammate storage literal.
   */
  public static readonly updateTeammate: string;
  /**
   * Teammate storage literal.
   */
  public static readonly deleteTeammate: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectMembersByConversation: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectMembersByTeammate: string;
  /**
   * Teammate storage literal.
   */
  public static readonly selectMember: string;
  /**
   * Teammate storage literal.
   */
  public static readonly insertMember: string;
  /**
   * Teammate storage literal.
   */
  public static readonly updateMember: string;
  /**
   * Teammate storage literal.
   */
  public static readonly deleteMember: string;
  /**
   * Directory containing durable composer attachments.
   */
  public static readonly attachmentsDirectoryName: string;
  /**
   * Creates a new file without overwriting an existing one.
   */
  public static readonly exclusiveWriteFlag: string;
  /**
   * Parent-directory path segment.
   */
  public static readonly parentDirectory: string;
  /**
   * Attachment count and size diagnostic.
   */
  public static readonly attachmentLimitExceeded: string;
  /**
   * Invalid attachment encoding diagnostic.
   */
  public static readonly attachmentInvalidBase64: string;
  /**
   * Invalid saved-file reference diagnostic.
   */
  public static readonly attachmentOutsideStore: string;
  /**
   * Largest base64 input allowed before decoding.
   */
  public static readonly maximumAttachmentEncodedLength: number;
  /**
   * Directory within attachments for transient file preparations.
   */
  public static readonly attachmentDraftsDirectoryName: string;
  /**
   * Safe extension pattern for generated attachment filenames.
   */
  public static readonly attachmentExtensionPattern: RegExp;
  /**
   * Native image MIME types mapped to file extensions.
   */
  public static readonly attachmentImageExtensions: Readonly<Record<string, string>>;
  /**
   * The exclusive upper sequence bound for an unpositioned reply page.
   */
  public static readonly maximumReplySequence: number;
  /**
   * The native session identifier result column.
   */
  public static readonly nativeSessionIdColumn: string;
  /**
   * Selects the latest compatible native session using the conversation sequence index.
   */
  public static readonly selectResumableSession: string;
  /**
   * Projects requested detail kinds in SQLite before transporting or decoding message JSON.
   */
  public static readonly selectMessageDigest: string;
  /**
   * Selects pending approvals across conversations.
   */
  public static readonly selectAllPendingApprovals: string;
  /**
   * Matches a parent-relative path outside a root.
   */
  public static readonly parentPathPattern: RegExp;
  /**
   * The Git directory or worktree marker name.
   */
  public static readonly gitDirectoryName: string;
  /**
   * Explains the limits of file evidence when a complete tree cannot be captured.
   */
  public static readonly incompleteWorkingTreeEvidence: string;
  /**
   * Git's added-file status.
   */
  public static readonly addedStatusCode: string;
  /**
   * Identifies Git's binary-file difference notice.
   */
  public static readonly binaryDiffMarker: string;
  /**
   * Resolves the index Git would otherwise use.
   */
  public static readonly gitIndexPathArguments: readonly string[];
  /**
   * The environment key controlling optional Git index refreshes.
   */
  public static readonly gitOptionalLocksVariable: string;
  /**
   * Disables optional index refreshes during inspection.
   */
  public static readonly gitOptionalLocksDisabled: string;
  /**
   * Maximum duration of one Git operation, in milliseconds.
   */
  public static readonly gitTimeout: number;
  /**
   * Parameter name of an approval identifier.
   */
  public static readonly approvalIdParameterName: string;
  /**
   * File name of the database inside a data directory: `teamrun.db`; the data source is named after it.
   */
  public static readonly databaseFileName: string;
  /**
   * Id of the migration that creates the initial schema.
   */
  public static readonly initialMigrationId: string;
  /**
   * Title of a conversation created without one.
   */
  public static readonly defaultConversationTitle: string;
  /**
   * Name of the projects table.
   */
  public static readonly projectsTable: string;
  /**
   * Name of the conversations table.
   */
  public static readonly conversationsTable: string;
  /**
   * Name of the messages table.
   */
  public static readonly messagesTable: string;
  /**
   * Name of the approvals table.
   */
  public static readonly approvalsTable: string;
  /**
   * Name of the provider accounts table.
   */
  public static readonly providerAccountsTable: string;
  /**
   * Name of the column a `COUNT(*)` statement returns.
   */
  public static readonly countColumn: string;
  /**
   * Name of the JSON column every record table has; the other columns are named after the model's properties.
   */
  public static readonly jsonColumn: string;
  /**
   * Name of the messages' sequence column, as a statement returns it.
   */
  public static readonly sequenceColumn: string;
  /**
   * Name of the last-writer-wins timestamp column every record table has.
   */
  public static readonly updatedAtColumn: string;
  /**
   * Deletes a project: `id`.
   */
  public static readonly deleteProject: string;
  /**
   * Inserts a project: `id`, `rootPath`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertProject: string;
  /**
   * Selects a project's JSON: `id`.
   */
  public static readonly selectProjectById: string;
  /**
   * Selects a project's JSON: `rootPath`.
   */
  public static readonly selectProjectByRootPath: string;
  /**
   * Selects every project's JSON, oldest first.
   */
  public static readonly selectProjects: string;
  /**
   * Deletes a conversation: `id`.
   */
  public static readonly deleteConversation: string;
  /**
   * Inserts a conversation: `id`, `projectId`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertConversation: string;
  /**
   * Selects a conversation's JSON: `id`.
   */
  public static readonly selectConversationById: string;
  /**
   * Selects a project's conversations' JSON, oldest first: `projectId`.
   */
  public static readonly selectConversationsByProject: string;
  /**
   * Replaces a conversation's JSON: `json`, `updatedAt`, `id`.
   */
  public static readonly updateConversation: string;
  /**
   * Selects the conversations whose title matches a LIKE pattern, the latest first.
   */
  public static readonly selectConversationsByTitle: string;
  /**
   * Selects the messages with a text detail matching a LIKE pattern, the latest first, each once.
   */
  public static readonly selectMessagesByText: string;
  /**
   * The characters a LIKE pattern escapes: the backslash, the percent sign, the underscore.
   */
  public static readonly likeEscapePattern: RegExp;
  /**
   * The LIKE escape character: a backslash.
   */
  public static readonly likeEscapePrefix: string;
  /**
   * The LIKE wildcard: a percent sign.
   */
  public static readonly likeWildcard: string;
  /**
   * Runs of whitespace, collapsed in snippets.
   */
  public static readonly whitespacePattern: RegExp;
  /**
   * A single space.
   */
  public static readonly space: string;
  /**
   * How many characters a snippet shows before the match: 40.
   */
  public static readonly snippetLead: number;
  /**
   * How long a snippet is at most: 120 characters.
   */
  public static readonly snippetLength: number;
  /**
   * Deletes a conversation's messages: `conversationId`.
   */
  public static readonly deleteMessagesByConversation: string;
  /**
   * Inserts a message: `id`, `conversationId`, `sequence`, `status`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertMessage: string;
  /**
   * Selects the last sequence of a conversation, when it has messages: `conversationId`.
   */
  public static readonly selectLastSequenceByConversation: string;
  /**
   * Selects a message's JSON: `id`.
   */
  public static readonly selectMessageById: string;
  /**
   * Selects a conversation's messages' JSON after a sequence, in sequence order: `conversationId`, `sequence`.
   */
  public static readonly selectMessagesByConversation: string;
  /**
   * Selects the JSON of a conversation's pending, running, or awaiting reply: `conversationId`.
   */
  /**
   * Deletes a conversation's messages from a sequence on: `conversationId`, `sequence`.
   */
  public static readonly deleteMessagesFromSequence: string;
  /**
   * Selects the approvals of a conversation's messages from a sequence on: `conversationId`, `sequence`.
   */
  public static readonly selectApprovalsFromSequence: string;
  /**
   * Deletes the approvals of a conversation's messages from a sequence on: `conversationId`, `sequence`.
   */
  public static readonly deleteApprovalsFromSequence: string;
  /**
   * Selects every reply still pending, running, or awaiting an approval, oldest first.
   */
  public static readonly selectOpenReplies: string;
  public static readonly selectOpenReplyByConversation: string;
  /**
   * Replaces a message's status and JSON: `status`, `json`, `updatedAt`, `id`.
   */
  public static readonly updateMessage: string;
  /**
   * Deletes the approvals of a conversation's messages: `conversationId`.
   */
  public static readonly deleteApprovalsByConversation: string;
  /**
   * Inserts an approval: `id`, `messageId`, `status`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertApproval: string;
  /**
   * Selects an approval's JSON: `id`.
   */
  public static readonly selectApprovalById: string;
  /**
   * Selects the JSON of every approval of a conversation's messages: `conversationId`.
   */
  public static readonly selectApprovalsByConversation: string;
  /**
   * Selects the JSON of the pending approvals of a conversation's messages: `conversationId`.
   */
  public static readonly selectPendingApprovalsByConversation: string;
  /**
   * Selects the JSON of a message's pending approvals: `messageId`.
   */
  public static readonly selectPendingApprovalsByMessage: string;
  /**
   * Replaces an approval's status and JSON: `status`, `json`, `updatedAt`, `id`.
   */
  public static readonly updateApproval: string;
  /**
   * Deletes a provider account: `id`.
   */
  public static readonly deleteProviderAccount: string;
  /**
   * Inserts a provider account: `id`, `provider`, `json`, `createdAt`, `updatedAt`.
   */
  public static readonly insertProviderAccount: string;
  /**
   * Selects a provider account's JSON: `id`.
   */
  public static readonly selectProviderAccountById: string;
  /**
   * Selects every provider account's JSON, oldest first.
   */
  public static readonly selectProviderAccounts: string;
  /**
   * Replaces a provider account's JSON: `json`, `updatedAt`, `id`.
   */
  public static readonly updateProviderAccount: string;
  /**
   * Parameter name of the adapter in `ProviderRegistry.register`.
   */
  public static readonly adapterParameterName: string;
  /**
   * Parameter name of the data directory in `DatabaseContext.open`.
   */
  public static readonly dataDirectoryParameterName: string;
  /**
   * Parameter name of the error in `TurnResult`.
   */
  public static readonly errorParameterName: string;
  /**
   * Parameter name of the message id in `ActiveRun`.
   */
  public static readonly messageIdParameterName: string;
  /**
   * Parameter name of the native kind in `ApprovalAsk`.
   */
  public static readonly nativeKindParameterName: string;
  /**
   * Parameter name of the native session id in `TurnStart` and `TurnResult`.
   */
  public static readonly nativeSessionIdParameterName: string;
  /**
   * Parameter name of the options in `ApprovalAsk`.
   */
  public static readonly optionsParameterName: string;
  /**
   * Parameter name of the prompt in `TurnRequest`.
   */
  public static readonly promptParameterName: string;
  /**
   * Parameter name of the provider item id in `TurnDetail`.
   */
  public static readonly providerItemIdParameterName: string;
  /**
   * Parameter name of the provider request id in `ApprovalAsk`.
   */
  public static readonly providerRequestIdParameterName: string;
  /**
   * Parameter name of the resumed flag in `TurnStart`.
   */
  public static readonly resumedNativeSessionParameterName: string;
  /**
   * Parameter name of the session to resume in `TurnRequest`.
   */
  public static readonly resumeNativeSessionIdParameterName: string;
  /**
   * Parameter name of the summary in `ApprovalAsk`.
   */
  public static readonly summaryParameterName: string;
  /**
   * Parameter name of the working directory in `TurnRequest`.
   */
  public static readonly workingDirectoryParameterName: string;
  /**
   * Message of the invariant that a failed turn carries its error and no other turn does.
   */
  public static readonly failureErrorMismatch: string;
  /**
   * Text of the note appended to a reply the user cancelled, and message of the rejected decision.
   */
  public static readonly replyCancelled: string;
  /**
   * The note appended to a reply an earlier runtime left open.
   */
  public static readonly replyInterruptedByStop: string;
  public static readonly listSeparator: string;
  public static readonly lineSeparator: string;
  public static readonly nullSeparator: string;
  public static readonly completedStatus: string;
  /**
   * The `source` of the details read from the working tree rather than reported by the provider: the file-change report
   * and the note that its evidence is incomplete.
   */
  public static readonly workingTreeSource: string;
  public static readonly addKind: string;
  public static readonly updateKind: string;
  public static readonly deleteKind: string;
  public static readonly gitExecutable: string;
  public static readonly gitTopLevelArguments: readonly string[];
  public static readonly gitStatusArguments: readonly string[];
  public static readonly gitHashArguments: readonly string[];
  public static readonly gitDirArguments: readonly string[];
  public static readonly gitAddAllArguments: readonly string[];
  /**
   * `git ls-files -z --cached --others --exclude-standard`: every file a snapshot would hold.
   */
  public static readonly gitListFilesArguments: readonly string[];
  /**
   * How many files a working tree may hold for a snapshot to be kept: 20 000.
   */
  public static readonly maximumSnapshotFiles: number;
  public static readonly gitWriteTreeArguments: readonly string[];
  public static readonly gitIndexVariable: string;
  /**
   * The temporary index file, inside the git directory, a snapshot is built with.
   */
  public static readonly snapshotIndexFileName: string;
  /**
   * The ref namespace snapshots are kept under: `refs/teamrun/snapshots/<reply id>`.
   */
  public static readonly snapshotRefPrefix: string;
  public static readonly snapshotAuthorName: string;
  public static readonly snapshotAuthorEmail: string;
  public static readonly transcriptUserPrefix: string;
  public static readonly transcriptAssistantPrefix: string;
  public static readonly transcriptSeparator: string;
  /**
   * Characters of transcript fed to a fresh provider session; the earlier part is dropped beyond it.
   */
  public static readonly maximumTranscriptLength: number;
  /**
   * Parameter name reported for a blank native turn id: `nativeTurnId`.
   */
  public static readonly nativeTurnIdParameterName: string;
  /**
   * Parameter name reported for a blank last turn id: `lastTurnId`.
   */
  public static readonly lastTurnIdParameterName: string;
  public static readonly ellipsis: string;
  public static readonly gitOutputLimit: number;
  public static readonly untrackedStatus: string;
  public static readonly deletedStatusCode: string;
  public static readonly renamedStatusCodes: readonly string[];
  /**
   * Lines kept of an added file's diff.
   */
  public static readonly maximumDiffLines: number;
  /**
   * Bytes above which an added file gets no diff.
   */
  public static readonly maximumDiffBytes: number;
  public static readonly utf8Encoding: BufferEncoding;
  public static readonly base64Encoding: BufferEncoding;
  /**
   * The directory under the data directory where generated images are stored.
   */
  public static readonly imagesDirectoryName: string;
  public static readonly imageDataField: string;
  public static readonly mediaTypeField: string;
  public static readonly storedPathField: string;
  public static readonly filesField: string;
  /**
   * File extension per media type of the images stored.
   */
  public static readonly imageExtensions: Readonly<Record<string, string>>;
  /**
   * Message of the invariant that a resumed native session has an id.
   */
  public static readonly resumedWithoutSession: string;

  /**
   * Historical named author label.
   */
  public static formatParticipantLabel(name: string): string;

  /**
   * Formats a join or continuation for the selected participant.
   */
  public static formatParticipantContext(name: string | null, joining: boolean, transcript: string): string;

  /**
   * Missing teammate diagnostic.
   */
  public static formatTeammateNotFound(id: string): string;

  /**
   * Duplicate name diagnostic.
   */
  public static formatTeammateNameTaken(name: string): string;

  /**
   * Missing membership diagnostic.
   */
  public static formatMemberNotFound(conversationId: string, teammateId: string): string;

  /**
   * Change-feed key for a membership pair.
   */
  public static memberEntityId(conversationId: string, teammateId: string): string;

  /**
   * Formats the user text and local attachment references.
   * @param text The user text, possibly empty.
   * @param files JSON-encoded name and path records.
   * @returns The prompt, including the data-only file references.
   */
  public static formatAttachmentPrompt(text: string, files: readonly string[]): string;

  /**
   * Builds the bounded query for a panel's matching replies, omitting text details in SQLite.
   * @param panel The panel whose replies to select.
   * @param ascending Whether to read toward newer replies from an after-sequence cursor.
   * @returns SQL accepting conversation id, exclusive before and after sequences, and limit as parameters.
   */
  public static formatReplyPageQuery(panel: ReplyPanel, ascending: boolean): string;

  /**
   * Composes the not-found message for an approval.
   */
  public static formatApprovalNotFound(approvalId: string): string;

  /**
   * Composes the conflict message for an approval that is already decided.
   */
  public static formatApprovalNotPending(approvalId: string): string;

  /**
   * Composes the not-found message for a conversation.
   */
  public static formatConversationNotFound(conversationId: string): string;

  /**
   * Composes the not-found message for a message.
   */
  public static formatMessageNotFound(messageId: string): string;

  /**
   * Composes the conflict message for a message that is not a running reply.
   */
  public static formatMessageNotOpen(messageId: string): string;

  /**
   * Composes the invalid-parameters message for a relative profile directory.
   */
  public static formatProfileDirNotAbsolute(profileDir: string): string;

  /**
   * Composes the not-found message for a project.
   */
  public static formatProjectNotFound(projectId: string): string;

  /**
   * Composes the invalid-parameters message for an account of another provider.
   */
  public static formatProviderAccountMismatch(providerAccountId: string, provider: string): string;

  /**
   * Composes the not-found message for a provider account.
   */
  public static formatProviderAccountNotFound(providerAccountId: string): string;

  /**
   * Composes the argument message for registering a provider twice.
   */
  public static formatProviderAlreadyRegistered(provider: string): string;

  /**
   * Composes the not-found message for a provider that is not registered.
   */
  public static formatProviderNotRegistered(provider: string): string;

  /**
   * Composes the conflict message for a conversation whose reply is still open.
   */
  public static formatReplyInProgress(conversationId: string): string;

  /**
   * Composes the invalid-parameters message for a relative root path.
   */
  public static formatRootPathNotAbsolute(rootPath: string): string;

  /**
   * Composes the text of the error detail appended to a failed reply.
   */
  public static formatTurnFailed(error: string): string;

  /**
   * Composes the not-found message for a message outside the conversation.
   */
  public static formatMessageNotInConversation(messageId: string, conversationId: string): string;

  /**
   * Composes a snapshot commit's message.
   */
  public static formatSnapshotMessage(name: string): string;

  /**
   * Composes a snapshot's ref name.
   */
  /**
   * Renders a query as a case-insensitive LIKE pattern with its wildcards escaped.
   * @param query The text to find.
   * @returns The pattern.
   */
  public static formatLikePattern(query: string): string;

  /**
   * Renders the part of a text around the first match of a query, whitespace collapsed, with an ellipsis where the text
   * goes on.
   * @param text The text.
   * @param query The text found in it.
   * @returns The snippet.
   */
  public static formatSnippet(text: string, query: string): string;

  public static formatSnapshotRef(name: string): string;

  /**
   * Composes the `git commit-tree` arguments with TeamRun as the author.
   */
  public static formatCommitTreeArguments(tree: string, message: string): readonly string[];

  /**
   * Composes the `git update-ref` arguments.
   */
  public static formatUpdateRefArguments(ref: string, commit: string): readonly string[];

  /**
   * Composes the `git update-ref -d` arguments.
   */
  public static formatDeleteRefArguments(ref: string): readonly string[];

  /**
   * Composes the `git rev-parse --verify` arguments.
   */
  public static formatVerifyRefArguments(ref: string): readonly string[];

  /**
   * Composes the `git read-tree -u --reset` arguments.
   */
  public static formatReadTreeArguments(ref: string): readonly string[];

  /**
   * Describes a project operation conflict.
   * @param root The occupied project root.
   * @returns The conflict message.
   */
  public static formatProjectBusy(root: string): string;

  /**
   * Names an isolated temporary Git index.
   * @param id The operation's unique identifier.
   * @returns The index filename.
   */
  public static formatSnapshotIndexFileName(id: string): string;

  /**
   * Lists changed paths and statuses between two trees, using NUL separators and no rename inference.
   * @param before The original tree or commit.
   * @param after The resulting tree or commit.
   * @returns Git argument values.
   */
  public static formatTreeChangesArguments(before: string, after: string): readonly string[];

  /**
   * Requests an attributed diff without external diff or text conversion commands.
   * @param before The original tree or commit.
   * @param after The resulting tree or commit.
   * @param path The repository-relative file path.
   * @returns Git argument values.
   */
  public static formatTreeDiffArguments(before: string, after: string, path: string): readonly string[];

  /**
   * Composes the prompt of the first message after a rewind: the kept transcript, then the message.
   */
  public static formatTranscriptPreamble(transcript: string, text: string): string;

  /**
   * Composes the text of the file-change detail read from the working tree.
   */
  public static formatWorkingTreeChanges(names: string): string;

  /**
   * Composes the unified diff of a file added whole.
   */
  public static formatAddedFileDiff(path: string, lines: readonly string[]): string;

  /**
   * Composes the file name of a stored image.
   */
  public static formatImageFileName(messageId: string, sequence: number, extension: string): string;

  /**
   * Composes the invalid-parameters message for a decision option the approval does not offer.
   */
  public static formatUnknownDecisionOption(approvalId: string, optionId: string): string;

  /**
   * Composes the message for a method the protocol does not define.
   */
  public static formatUnknownMethod(method: string): string;
}

/**
 * The migration that creates the initial schema: the record tables with an id, a JSON column, and
 * timestamps beside their indexed columns, declared against the protocol models so column names
 * follow property names. Projects also carry their unique `rootPath`. The change feed's table
 * belongs to the foundation Data packages.
 */
export declare class InitialMigration extends SqlMigration {
  /**
   * Initializes the migration with `Resources.initialMigrationId`.
   */
  public constructor();

  /**
   * Declares the tables, keys, and indexes.
   * @param builder The builder that collects them.
   */
  public override up(builder: MigrationBuilder): void;
}

/**
 * The migrations of this version of TeamRun, in id order.
 */
export declare class MigrationCatalog {
  /**
   * Every migration, oldest first.
   */
  public static readonly all: readonly SqlMigration[];
}

/**
 * The bookkeeping of one running reply: its abort signal, the cancellation flag, and the decision
 * the turn may be waiting for.
 */
export declare class ActiveRun {
  /**
   * Id of the reply message the run produces.
   */
  public readonly messageId: string;

  /**
   * Initializes the run.
   * @param messageId Id of the reply message; must not be blank.
   * @throws ArgumentException when the id is blank.
   */
  public constructor(messageId: string);

  /**
   * The signal the adapter watches; aborted by `cancel`.
   */
  public get signal(): AbortSignal;

  /**
   * True once `cancel` was called.
   */
  public get isCancelled(): boolean;

  /**
   * True while `awaitDecision` is pending.
   */
  public get isAwaitingDecision(): boolean;

  /**
   * Registers one independently addressable approval decision.
   * @param approvalId The nonblank approval id; must not already be pending.
   * @returns The pending decision.
   * @throws ArgumentException when the identifier is blank.
   * @throws ServiceException when the run is closed or the identifier is already pending.
   */
  public awaitDecision(approvalId: string): Promise<string>;

  /**
   * Checks whether this run is waiting for the named approval.
   * @param approvalId The approval identifier.
   * @returns Whether a live decision exists for the identifier.
   */
  public hasDecision(approvalId: string): boolean;

  /**
   * Resolves only the named pending decision.
   * @param approvalId The approval identifier.
   * @param optionId The chosen option's id.
   * @returns `true` when a decision was pending, `false` otherwise.
   */
  public decide(approvalId: string, optionId: string): boolean;

  /**
   * Marks the run cancelled, rejects a pending decision, and aborts the signal.
   */
  public cancel(): void;

  /**
   * Closes the run, rejects all pending decisions, and aborts the signal. Later approvals are
   * rejected. Does not mark a completed run as user-cancelled; safe to call repeatedly.
   */
  public close(): void;
}

/**
 * A provider's request for permission during a turn, as the adapter reports it: the provider's own
 * request id and kind, TeamRun's classification, a summary, the payload, and the options offered.
 */
export declare class ApprovalAsk {
  /**
   * The provider's id of the request.
   */
  public readonly providerRequestId: string;
  /**
   * TeamRun's classification for rendering.
   */
  public readonly kind: ApprovalKind;
  /**
   * The provider's own kind, verbatim.
   */
  public readonly nativeKind: string;
  /**
   * One line for the user.
   */
  public readonly summary: string;
  /**
   * The provider's payload, verbatim.
   */
  public readonly payload: JsonValue;
  /**
   * The options the provider offers; a copy.
   */
  public readonly options: readonly ApprovalOption[];

  /**
   * Initializes the ask.
   * @param providerRequestId The provider's request id; must not be blank.
   * @param kind TeamRun's classification.
   * @param nativeKind The provider's kind; must not be blank.
   * @param summary One line for the user; must not be blank.
   * @param payload The provider's payload.
   * @param options The offered options; at least one.
   * @throws ArgumentException when a text is blank or there are no options.
   */
  public constructor(
    providerRequestId: string,
    kind: ApprovalKind,
    nativeKind: string,
    summary: string,
    payload: JsonValue,
    options: readonly ApprovalOption[]);
}

/**
 * A listener's registration with an `EventHub`; disposing it stops the delivery.
 */
export declare class EventSubscription implements Disposable {
  /**
   * Initializes the subscription over the hub's listener set.
   * @param listeners The hub's listeners.
   * @param listener The registered listener.
   */
  public constructor(listeners: Set<IEventListener>, listener: IEventListener);

  /**
   * True until disposed.
   */
  public get isActive(): boolean;

  /**
   * Removes the listener.
   */
  public [Symbol.dispose](): void;
}

/**
 * What a sign-in check observed.
 */
export declare class SignInCheck {
  /**
   * The observed status.
   */
  public readonly authStatus: AuthStatus;
  /**
   * The observed identity, or `null` when none was reported.
   */
  public readonly identity: ProviderAccountIdentity | null;
  /**
   * The observed harness version, or `null`.
   */
  public readonly harnessVersion: string | null;
  /**
   * The check's error, or `null` when it succeeded.
   */
  public readonly error: string | null;

  /**
   * Initializes the check.
   * @param authStatus The observed status.
   * @param identity The observed identity, or `null`.
   * @param harnessVersion The observed harness version, or `null`.
   * @param error The check's error, or `null`.
   */
  public constructor(authStatus: AuthStatus, identity: ProviderAccountIdentity | null, harnessVersion: string | null, error: string | null);
}

/**
 * One detail of a reply as the adapter reports it.
 */
export declare class TurnDetail {
  /**
   * The detail's kind.
   */
  public readonly kind: DetailKind;
  /**
   * The detail's text.
   */
  public readonly text: string;
  /**
   * The detail's structured payload, or `null`.
   */
  public readonly payload: JsonValue;
  /**
   * The provider's id of the item, for deduplication, or `null`.
   */
  public readonly providerItemId: string | null;

  /**
   * Initializes the detail.
   * @param kind The kind.
   * @param text The text.
   * @param payload The payload, or `null`.
   * @param providerItemId The provider's item id, or `null`; a non-null id must not be blank.
   * @throws ArgumentException when a non-null item id is blank.
   */
  public constructor(kind: DetailKind, text: string, payload: JsonValue, providerItemId: string | null);
}

/**
 * What an adapter needs to run one turn.
 */
export declare class TurnRequest {
  /**
   * Saved files for this turn, copied on construction. Images are native provider inputs; other files are referenced in the prompt.
   */
  public readonly attachments: readonly MessageAttachment[];
  /**
   * Optional participant role captured for this user message.
   */
  public readonly instructions: string | null;
  /**
   * Full capped context if a native resume must start a fresh session.
   */
  public readonly freshPrompt: string | null;
  /**
   * The account whose profile runs the turn, or `null` for the provider's default profile.
   */
  public readonly account: ProviderAccount | null;
  /**
   * The project folder the turn works in.
   */
  public readonly workingDirectory: string;
  /**
   * The user's message.
   */
  public readonly prompt: string;
  /**
   * The requested provider, model, and effort.
   */
  public readonly requested: RequestedSettings;
  /**
   * The native session to resume, or `null` to start fresh.
   */
  public readonly resumeNativeSessionId: string | null;

  /**
   * Initializes the request.
   * @param account The account, or `null`.
   * @param workingDirectory The project folder; must not be blank.
   * @param prompt The user's message; must not be blank.
   * @param requested The requested settings.
   * @param resumeNativeSessionId The session to resume, or `null`; a non-null id must not be blank.
   * @param attachments Saved files for this turn; copied, and empty by default. The prompt already contains their file references.
   * @throws ArgumentException when a text is blank.
   */
  public constructor(
    account: ProviderAccount | null,
    workingDirectory: string,
    prompt: string,
    requested: RequestedSettings,
    resumeNativeSessionId: string | null,
    attachments?: readonly MessageAttachment[],
    instructions?: string | null,
    freshPrompt?: string | null);
}

/**
 * How a turn ended.
 */
export declare class TurnResult {
  /**
   * The outcome.
   */
  public readonly outcome: TurnOutcome;
  /**
   * The native session the turn ran in, or `null` when unknown.
   */
  public readonly nativeSessionId: string | null;
  /**
   * What the provider reported about itself.
   */
  public readonly observed: ObservedSettings;
  /**
   * The error of a failed turn; `null` otherwise.
   */
  public readonly error: string | null;
  /**
   * The provider's own id of the turn, or `null` when the provider has none.
   */
  public readonly nativeTurnId: string | null;

  /**
   * Initializes the result.
   * @param outcome The outcome.
   * @param nativeSessionId The native session id, or `null`; a non-null id must not be blank.
   * @param observed The observed settings.
   * @param error The error of a failed turn, or `null`.
   * @param nativeTurnId The provider's turn id, or `null` (the default); a non-null id must not be blank.
   * @throws ArgumentException when a failed turn has no error or another turn has one, or a
   * non-null session or turn id is blank.
   */
  public constructor(outcome: TurnOutcome, nativeSessionId: string | null, observed: ObservedSettings, error: string | null, nativeTurnId?: string | null);
}

/**
 * What to fork: a native session, the turn to fork through, and where the fork works.
 */
export declare class ForkRequest {
  /**
   * The account whose profile holds the session, or `null` for the provider's default profile.
   */
  public readonly account: ProviderAccount | null;
  /**
   * The project folder the forked session works in.
   */
  public readonly workingDirectory: string;
  /**
   * The native session to fork.
   */
  public readonly nativeSessionId: string;
  /**
   * The provider's id of the last turn to keep, inclusive.
   */
  public readonly lastTurnId: string;
  /**
   * The provider, model, and effort the kept reply asked for.
   */
  public readonly requested: RequestedSettings;

  /**
   * Initializes the request.
   * @param account The account, or `null`.
   * @param workingDirectory The project folder; must not be blank.
   * @param nativeSessionId The session to fork; must not be blank.
   * @param lastTurnId The last turn to keep; must not be blank.
   * @param requested The requested settings.
   * @throws ArgumentException when a text is blank.
   */
  public constructor(account: ProviderAccount | null, workingDirectory: string, nativeSessionId: string, lastTurnId: string, requested: RequestedSettings);
}

/**
 * The facts an adapter reports when the provider accepts a turn.
 */
export declare class TurnStart {
  /**
   * The native session the turn runs in, or `null` when the provider has none.
   */
  public readonly nativeSessionId: string | null;
  /**
   * Whether the session was resumed rather than started.
   */
  public readonly resumedNativeSession: boolean;
  /**
   * Adapter-reported placement of role instructions.
   */
  public readonly roleApplied: RoleApplication | null;

  /**
   * Initializes the start.
   * @param nativeSessionId The native session id, or `null`; a non-null id must not be blank.
   * @param resumedNativeSession Whether the session was resumed.
   * @throws ArgumentException when a resumed session has no id or a non-null id is blank.
   */
  public constructor(nativeSessionId: string | null, resumedNativeSession: boolean, roleApplied?: RoleApplication | null);
}

/**
 * TeamRun's record in one data directory: the EF Core-style context over the SQLite database
 * `teamrun.db`, reached through `database` with its migrations and the change feed
 * (`database.changeFeed`, over the framework-owned `__changes` table; payloads are the records'
 * JSON text). The services are the only code that reads and writes through it, and the runtime
 * keeps one context per data directory.
 * @remarks
 * Disposable: `using context = DatabaseContext.open(directory)` closes the connection at the end
 * of the block.
 */
export declare class DatabaseContext extends DbContext<SqlConnection, SqlMigration> {
  /**
   * Coordinates operations on overlapping projects in this runtime.
   */
  public readonly projectActivity: ProjectActivity;
  /**
   * The data directory the database lives in.
   */
  public readonly dataDirectory: string;

  private constructor(options: DbContextOptions<SqlConnection, SqlMigration>, dataDirectory: string);

  /**
   * Opens the data directory's database through `DbContextOptionsBuilder.useSQLite`, creating the
   * directory and file when absent, and applies pending migrations.
   * @param dataDirectory The data directory; must not be blank.
   * @returns The context.
   * @throws ArgumentException when the directory is blank.
   */
  public static open(dataDirectory: string): DatabaseContext;
}

/**
 * Allows concurrent provider turns while excluding rewinds and disruptive metadata operations on overlapping roots.
 * Nested folders of a Git working tree share one root. Coordination belongs to one runtime and does not lock external tools.
 */
export declare class ProjectActivity {
  /**
   * Registers a provider turn alongside any other turns on the same working files.
   * @param rootPath The project's filesystem path.
   * @returns A unique activity key to pass to `leave` when this turn ends.
   * @throws ServiceException when an overlapping root is being rewound.
   * @throws Error when resolving an existing filesystem path fails.
   */
  public enterTurn(rootPath: string): string;

  /**
   * Claims an idle root exclusively for a rewind.
   * @param rootPath The project's filesystem path.
   * @returns A unique activity key to pass to `leave`.
   * @throws ServiceException when an overlapping root is already active.
   * @throws Error when resolving an existing filesystem path fails.
   */
  public enter(rootPath: string): string;

  /**
   * Releases one turn or rewind without affecting any other activity. Safe to repeat.
   * @param id The key returned by `enter` or `enterTurn`.
   */
  public leave(id: string): void;

  /**
   * Rejects metadata operations that would disrupt an active turn or rewind.
   * @param rootPath The affected project path.
   * @throws ServiceException when an overlapping root is active.
   * @throws Error when resolving an existing filesystem path fails.
   */
  public requireIdle(rootPath: string): void;
}

/**
 * `IProjectsService` over a `DatabaseContext`: each write is the row and its change-feed entry in
 * one transaction. A project's id is a version 7 `Guid`, its name is the folder's name (the path
 * itself for a root folder), and its root path is stored resolved, so the same folder opens the
 * same project.
 */
export declare class ProjectsService implements IProjectsService {
  /**
   * Initializes the service over the context.
   * @param context The context of the data directory.
   * @param conversations The conversations, deleted with their project.
   */
  public constructor(context: DatabaseContext, conversations: IConversationsService);

  /**
   * Lists the projects, oldest first.
   * @returns The projects.
   */
  public list(): readonly Project[];

  /**
   * Finds a project by id.
   * @param projectId The project id.
   * @returns The project, or `null` when it does not exist.
   */
  public find(projectId: string): Project | null;

  /**
   * Opens a folder as a project, creating the project on first open.
   * @param params The absolute path of the folder.
   * @returns The existing or created project.
   * @throws ServiceException (foundation) named `ErrorCode.InvalidParams` when the path is not absolute.
   */
  public open(params: ProjectOpenParams): Project;

  /**
   * Forgets a project and deletes its conversations with their messages and approvals and logs the deletion with the project's last JSON; the folder is left
   * untouched.
   * @param params The project id.
   * @throws ServiceException (foundation) named `ErrorCode.NotFound` when the project does not exist, and
   * `ErrorCode.Conflict` while the project still has conversations.
   */
  public forget(params: ProjectIdParams): void;
}

/**
 * `IConversationsService` over a `DatabaseContext`; deletion removes approvals, messages, and the
 * conversation in one transaction, logging each row.
 */
export declare class ConversationsService implements IConversationsService {
  /**
   * Initializes the service over the context.
   * @param context The context of the data directory.
   */
  public constructor(context: DatabaseContext);

  /**
   * Lists memberships in join order; the conversation must exist.
   */
  public listMembers(params: ConversationIdParams): readonly ConversationMember[];

  /**
   * Adds a teammate once; repeated additions preserve join time and session state.
   */
  public addMember(params: ConversationMemberParams): ConversationMember;

  /**
   * Removes an existing membership while its conversation is idle; missing membership is a no-op.
   */
  public removeMember(params: ConversationMemberParams): void;

  /**
   * Finds a membership by both identities.
   */
  public findMember(params: ConversationMemberParams): ConversationMember | null;

  /**
   * Updates session state for an existing membership and records the change.
   */
  public setMemberSession(params: ConversationMemberParams, nativeSessionId: string | null, resumedNativeSession: boolean): ConversationMember;

  /**
   * Resets memberships for an account rebind; rejects when an affected conversation has an open reply.
   */
  public resetTeammateSessions(teammateId: string): void;

  /**
   * Removes memberships before deleting a teammate; rejects while an affected conversation has an open reply.
   */
  public removeTeammateMembers(teammateId: string): void;

  /**
   * @inheritdoc
   */
  public list(params: ProjectIdParams): readonly Conversation[];

  /**
   * @inheritdoc
   */
  public find(conversationId: string): Conversation | null;

  /**
   * @inheritdoc
   */
  public create(params: ConversationCreateParams): Conversation;

  /**
   * @inheritdoc
   */
  public rename(params: ConversationRenameParams): Conversation;

  public move(params: ConversationMoveParams): Conversation;

  /**
   * @inheritdoc
   */
  public delete(params: ConversationIdParams): void;

  /**
   * Removes a conversation's messages from a sequence on, with their approvals, logging every deletion.
   * @param conversationId The conversation id.
   * @param fromSequence The sequence of the first message to remove.
   * @returns The messages removed, in sequence order.
   * @throws ServiceException `NotFound` when the conversation does not exist.
   */
  public removeFrom(conversationId: string, fromSequence: number): readonly Message[];

  /**
   * Marks or clears the conversation's need for a fresh provider session, logging the update.
   * @param conversationId The conversation id.
   * @param sessionReset The mark.
   * @returns The conversation as stored.
   * @throws ServiceException `NotFound` when the conversation does not exist.
   */
  public setSessionReset(conversationId: string, sessionReset: boolean): Conversation;

  /**
   * Records the forked session a rewind made (clearing the reset mark), or forgets it, logging the update.
   * @param conversationId The conversation id.
   * @param forkedSession The forked session, or `null`.
   * @returns The conversation as stored.
   * @throws ServiceException `NotFound` when the conversation does not exist.
   */
  public setForkedSession(conversationId: string, forkedSession: ForkedSession | null): Conversation;

  /**
   * Finds the conversations whose title or message texts contain a text through SQLite's `LIKE` over the stored JSON
   * (`json_extract`, `json_each`): one hit per conversation, the title when it matches and else the latest matching
   * message with a snippet, the latest conversation first, at most the limit.
   * @param params The text and the most hits.
   * @returns The hits.
   */
  public search(params: ConversationSearchParams): ConversationSearchResult;
}

/**
 * `IMessagesService` over a `DatabaseContext`.
 */
export declare class MessagesService implements IMessagesService {
  /**
   * Initializes the service over the context.
   * @param context The context of the data directory.
   */
  public constructor(context: DatabaseContext);

  /**
   * @inheritdoc
   */
  public list(params: MessageListParams): readonly Message[];

  /**
   * @inheritdoc
   */
  public page(params: MessagePageParams): MessagePage;

  /**
   * Lists a bounded page of matching provider replies without output or diff bodies.
   * @param params Conversation, optional exclusive cursor, and page limit.
   * @param panel The panel whose replies to select.
   * @returns Matching summaries in descending sequence order and adjacent-page flags.
   */
  public replyPage(params: MessagePageParams, panel: ReplyPanel): ReplyPage;

  /**
   * @inheritdoc
   */
  public find(messageId: string): Message | null;

  /**
   * @inheritdoc
   */
  public findOpenReply(conversationId: string): Message | null;

  /**
   * Finds the newest recorded native session for the requested provider and account.
   * @param conversationId The conversation to search.
   * @param provider The provider identifier.
   * @param accountId The account identifier, or null for the default account.
   * @returns The native session identifier, or null when no compatible session is recorded.
   * @remarks Queries the database directly without loading transcript details.
   */
  public findResumableSession(conversationId: string, provider: string, accountId: string | null): string | null;

  /**
   * Lists every reply still pending, running, or awaiting an approval, across conversations, oldest first.
   * @returns The open replies.
   */
  public listOpen(): readonly Message[];

  /**
   * @inheritdoc
   */
  public nextSequence(conversationId: string): number;

  /**
   * @inheritdoc
   */
  public insert(message: Message): void;

  /**
   * @inheritdoc
   */
  public update(message: Message): void;
}

/**
 * `IApprovalsService` over a `DatabaseContext`.
 */
export declare class ApprovalsService implements IApprovalsService {
  /**
   * Initializes the service over the context.
   * @param context The context of the data directory.
   */
  public constructor(context: DatabaseContext);

  /**
   * Lists pending approvals across every conversation, ordered by identifier.
   * @returns The pending approvals.
   */
  public listPendingAll(): readonly Approval[];

  /**
   * @inheritdoc
   */
  public list(params: ConversationIdParams): readonly Approval[];

  /**
   * @inheritdoc
   */
  public find(approvalId: string): Approval | null;

  /**
   * @inheritdoc
   */
  public listPending(messageId: string): readonly Approval[];

  /**
   * @inheritdoc
   */
  public insert(approval: Approval): void;

  /**
   * @inheritdoc
   */
  public update(approval: Approval): void;
}

/**
 * The registered provider adapters, keyed by provider id.
 */
export declare class ProviderRegistry {
  /**
   * Registers an adapter under its descriptor's id.
   * @param adapter The adapter.
   * @throws ArgumentException when the provider is already registered.
   */
  public register(adapter: IProviderAdapter): void;

  /**
   * Returns whether a provider is registered.
   * @param provider The provider id.
   * @returns `true` when registered.
   */
  public has(provider: string): boolean;

  /**
   * Returns a provider's adapter.
   * @param provider The provider id.
   * @returns The adapter.
   * @throws ServiceException named `ErrorCode.NotFound` when the provider is not registered.
   */
  public get(provider: string): IProviderAdapter;

  /**
   * Returns every registered adapter, in registration order.
   * @returns The adapters.
   */
  public all(): readonly IProviderAdapter[];
}

/**
 * `IProvidersService` over the registry and the accounts.
 */
export declare class ProvidersService implements IProvidersService {
  /**
   * Initializes the service.
   * @param registry The registered adapters.
   * @param accounts The accounts, for `listModels` through an account.
   */
  public constructor(registry: ProviderRegistry, accounts: IProviderAccountsService);

  /**
   * @inheritdoc
   */
  public list(): readonly ProviderDescriptor[];

  /**
   * @inheritdoc
   */
  public listModels(params: ProviderListModelsParams): Promise<readonly string[]>;

  /**
   * Returns provider-discovered models and their reported capabilities.
   */
  public modelCatalog(params: ProviderListModelsParams): Promise<readonly ProviderModel[]>;
}

/**
 * `IProviderAccountsService` over a `DatabaseContext`, the registry, and the event sink.
 */
export declare class ProviderAccountsService implements IProviderAccountsService {
  /**
   * Initializes the service.
   * @param context The context of the data directory.
   * @param registry The registered adapters, for `create` and `check`.
   * @param events Where `ProviderAccountUpdated` is published.
   */
  public constructor(context: DatabaseContext, registry: ProviderRegistry, events: IEventSink);

  /**
   * @inheritdoc
   */
  public list(): readonly ProviderAccount[];

  /**
   * @inheritdoc
   */
  public find(providerAccountId: string): ProviderAccount | null;

  /**
   * @inheritdoc
   */
  public create(params: ProviderAccountCreateParams): ProviderAccount;

  /**
   * @inheritdoc
   */
  public check(params: ProviderAccountIdParams): Promise<ProviderAccount>;

  /**
   * @inheritdoc
   */
  public delete(params: ProviderAccountIdParams): void;
}

/**
 * The in-process event bus: the core publishes, the runtime subscribes. Listeners are called in
 * registration order, synchronously.
 */
export declare class EventHub implements IEventSink {
  /**
   * The number of active subscriptions.
   */
  public get listenerCount(): number;

  /**
   * Registers a listener.
   * @param listener The listener.
   * @returns The subscription; dispose it to stop the delivery.
   */
  public subscribe(listener: IEventListener): EventSubscription;

  /**
   * @inheritdoc
   */
  public publish(event: Event): void;
}

/**
 * The bookkeeping of one reply while its turn runs: it is the adapter's `ITurnListener`, persists
 * every change of the reply through the services, and publishes the events. Created by the engine
 * per `send`.
 */
/**
 * One file the working tree shows changed since a turn started.
 */
export declare class WorkingTreeChange {
  /**
   * The absolute path.
   */
  public readonly path: string;
  /**
   * `add`, `update`, or `delete`.
   */
  public readonly kind: string;
  /**
   * The bounded unified diff, or null for binary, oversized, or incomplete evidence.
   */
  public readonly diff: string | null;

  /**
   * Initializes the change.
   * @param path The absolute path.
   * @param kind `add`, `update`, or `delete`.
   * @param diff The unified diff, or `null`.
   */
  public constructor(path: string, kind: string, diff: string | null);
}

/**
 * Compares immutable Git trees of working files at the start and end of a turn, including pre-existing edits.
 * Temporary indices preserve the user's staging state. Concurrent turns and external tools can contribute to these changes;
 * the comparison does not identify which writer made them.
 */
export declare class WorkingTree {
  /**
   * The repository's top-level directory.
   */
  public readonly root: string;

  /**
   * Whether the latest comparison has complete before-and-after tree identities. False above
   * the snapshot file-count cap; fallback path observations then have no attributed diffs.
   */
  public get hasCompleteEvidence(): boolean;

  /**
   * Captures the files of the repository containing a directory using an isolated Git index.
   * @param directory The directory.
   * @param maximumSnapshotFiles How many files (tracked and untracked, ignored ones aside) a tree may hold for `snapshot` to
   * keep it; `Resources.maximumSnapshotFiles` by default.
   * @returns The snapshot, or `null` when the directory is not inside a git repository or git is unavailable.
   * @throws Error When Git finds the repository but cannot capture its files.
   */
  public static capture(directory: string, maximumSnapshotFiles?: number): Promise<WorkingTree | null>;

  /**
   * Compares working files against their starting content, independently of commits made during the turn.
   * @returns Added, updated, and deleted files, with bounded diffs when evidence is complete.
   * @throws Error When Git cannot read or compare the tree.
   */
  public changesSince(): Promise<readonly WorkingTreeChange[]>;

  /**
   * Keeps the whole tree (every file git does not ignore) as a commit under `refs/teamrun/snapshots/<name>`.
   * @param name The snapshot's name, a reply id.
   * @returns The ref, or `null` when git refused.
   */
  public snapshot(name: string): Promise<string | null>;

  /**
   * Tells whether a snapshot exists.
   * @param name The snapshot's name.
   * @returns `true` when the ref exists.
   */
  public hasSnapshot(name: string): Promise<boolean>;

  /**
   * Puts working files back to a snapshot using a temporary index; the real index remains byte-identical.
   * @param name The snapshot's name.
   * @returns How many files differ from before the restore, or `null` without a snapshot.
   * @throws Error When Git cannot restore files. Git may have restored some files before a filesystem error.
   */
  public restore(name: string): Promise<number | null>;

  /**
   * Removes a snapshot's ref; nothing happens without one.
   * @param name The snapshot's name.
   */
  public dropSnapshot(name: string): Promise<void>;
}

export declare class ReplyRun implements ITurnListener {
  /**
   * Initializes the run over the pending reply.
   * @param message The pending reply as persisted.
   * @param provenance The reply's provenance.
   * @param run The run's bookkeeping.
   * @param messages Where the reply is persisted.
   * @param approvals Where approvals are persisted.
   * @param events Where events are published.
   * @param dataDirectory The data directory, where generated images are stored as files.
   */
  public constructor(
    message: Message,
    provenance: Provenance,
    run: ActiveRun,
    messages: IMessagesService,
    approvals: IApprovalsService,
    events: IEventSink,
    dataDirectory: string,
    conversations?: IConversationsService | null);

  /**
   * Runs the turn to its end: marks the reply running, delegates to the adapter, records the
   * outcome as the reply's final status (`Completed`, `Failed` with an error detail, `Cancelled`
   * with a note when the user cancelled, `Interrupted` otherwise), and cancels approvals still
   * pending.
   * @param adapter The provider's adapter.
   * @param request What to run.
   */
  public execute(adapter: IProviderAdapter, request: TurnRequest): Promise<void>;

  /**
   * @inheritdoc
   */
  public onStarted(start: TurnStart): void;

  /**
   * @inheritdoc
   */
  public onDetail(detail: TurnDetail): void;

  /**
   * @inheritdoc
   */
  public onThinking(): void;

  /**
   * @inheritdoc
   */
  public onApprovalRequested(ask: ApprovalAsk): Promise<string>;

  /**
   * @inheritdoc
   */
  public onObserved(observed: ObservedSettings): void;
}

/**
 * `IConversationEngine` over the record, the registry, and the event sink: one open reply per
 * conversation, the provider's session resumed for the same provider and account, and every change
 * of a reply persisted and published as it happens.
 */
export declare class ConversationEngine implements IConversationEngine {
  /**
   * Initializes the engine.
   * @param context The context of the data directory, for the transaction that records a send.
   * @param projects The projects, for the working directory.
   * @param conversations The conversations.
   * @param messages The messages.
   * @param approvals The approvals.
   * @param accounts The provider accounts.
   * @param registry The registered adapters.
   * @param events Where events are published.
   */
  public constructor(
    context: DatabaseContext,
    projects: IProjectsService,
    conversations: IConversationsService,
    messages: IMessagesService,
    approvals: IApprovalsService,
    accounts: IProviderAccountsService,
    teammates: ITeammatesService,
    registry: ProviderRegistry,
    events: IEventSink);

  /**
   * The number of active sends, including their queued replies and finalization.
   */
  public get activeRunCount(): number;

  /**
   * @inheritdoc
   */
  public prepareAttachment(input: AttachmentInput): MessageAttachment;

  /**
   * @inheritdoc
   */
  public discardAttachment(attachment: MessageAttachment): void;

  /**
   * Marks every reply left pending, running, or awaiting an approval by an earlier runtime as interrupted, with a note,
   * and cancels its pending approvals. Call before the first send.
   * @returns The replies marked.
   */
  public reconcile(): readonly Message[];

  /**
   * @inheritdoc
   */
  public send(params: MessageSendParams): Promise<MessageSendResult>;

  /**
   * @inheritdoc
   */
  public cancel(params: MessageIdParams): Promise<Message>;

  /**
   * @inheritdoc
   */
  public decide(params: ApprovalDecideParams): Approval;

  /**
   * Removes a message and everything after it, marks the conversation so that its next reply starts a fresh provider
   * session fed with the kept transcript, restores the project's files to the snapshot taken before the removed reply
   * started when asked (git projects with a snapshot), and drops the removed replies' snapshots.
   * @param params Which message to cut from and whether to restore files.
   * @returns The conversation as marked, the ids removed, how many files the restore changed (`null` without one), and
   * whether the provider's session continues (forked through the last kept reply when the provider can and every removed
   * reply ran on that session; the transcript otherwise).
   * @throws ServiceException `NotFound` for an unknown conversation, project, or message, or a message of another
   * conversation; `Conflict` while a reply is open.
   */
  public rewind(params: ConversationRewindParams): Promise<ConversationRewindResult>;

  /**
   * Resolves once every running turn has ended.
   */
  public waitForIdle(): Promise<void>;

  /**
   * Cancels every running turn and resolves once they have ended.
   */
  public shutdown(): Promise<void>;
}

/**
 * The one boundary between wire requests and the services: reads the method's parameters,
 * calls the service, and answers with a success carrying the result as JSON or a failure carrying
 * the info: a `ServiceException`'s own info, `ErrorCode.InvalidParams` for a `JsonException` or an
 * `ArgumentException`, `ErrorCode.UnknownMethod` for a method outside the catalog, and
 * `ErrorCode.Internal` for anything else, with the error's message.
 */
export declare class RequestDispatcher {
  /**
   * Initializes the dispatcher over the services.
   * @param providers The provider methods.
   * @param accounts The provider account methods.
   * @param projects The project methods.
   * @param conversations The conversation methods.
   * @param messages The message listing.
   * @param approvals The approval listing.
   * @param engine The message methods that involve a provider.
   */
  public constructor(
    providers: IProvidersService,
    accounts: IProviderAccountsService,
    projects: IProjectsService,
    conversations: IConversationsService,
    messages: IMessagesService,
    approvals: IApprovalsService,
    engine: IConversationEngine,
    teammates: ITeammatesService,
    events?: IEventSink | null);

  /**
   * Answers one request; never throws.
   * @param request The request.
   * @returns The response with the request's id.
   */
  public dispatch(request: Request): Promise<Response>;

  /**
   * Describes a failure as the response info a failed request carries: a `ServiceException` keeps its own info, a
   * `JsonException` becomes `InvalidParams` naming the field's path, an `ArgumentException` becomes `InvalidParams`
   * naming the parameter when it has one, and anything else becomes `Internal` with its message.
   * @param error The caught failure.
   * @returns The info for `Response.failure`.
   */
  public static describe(error: unknown): ServiceResponseInfo;
}

/**
 * Persists bounded composer attachments beneath the runtime data directory.
 * Files remain available after rewind and history deletion, like generated image assets.
 */
export declare class AttachmentStore {
  /**
   * Selects the storage owner; performs no filesystem writes.
   * @param dataDirectory Runtime data directory.
   */
  public constructor(dataDirectory: string);

  /**
   * Saves one input in transient storage, enforcing the image/file byte limit.
   */
  public prepare(input: AttachmentInput): MessageAttachment;

  /**
   * Deletes a direct transient entry; rejects paths outside the transient directory.
   */
  public discardPrepared(attachment: MessageAttachment): void;

  /**
   * Copies attachments into uniquely named files, rolling back partial writes on failure.
   * @param inputs New base64 uploads or saved references from this store; at most 10.
   * @returns Saved metadata, with no retained byte buffers.
   * @throws ServiceException for malformed bytes, outside references, or limits above ten files / 100 MiB per file / 10 MiB per image.
   * @throws Error on filesystem failure.
   */
  public save(inputs: readonly AttachmentInput[]): readonly MessageAttachment[];

  /**
   * Removes copies whose containing message failed to persist.
   * @param attachments Only metadata returned by this store's current save operation.
   * @throws Error on filesystem failure.
   */
  public discard(attachments: readonly MessageAttachment[]): void;

  /**
   * Adds durable file references to a provider prompt or reconstructed transcript.
   * @param text User text, possibly empty.
   * @param attachments Saved file metadata.
   * @returns Original text for no attachments; otherwise text followed by JSON-encoded name/path records.
   */
  public static formatPrompt(text: string, attachments: readonly MessageAttachment[]): string;
}

/**
 * Catalog operations for named participants.
 */
export interface ITeammatesService {
  /**
   * Lists participants in creation order.
   */
  list(): readonly Teammate[];

  /**
   * Returns a participant or null.
   */
  find(teammateId: string): Teammate | null;

  /**
   * Creates a unique participant bound to an existing account.
   */
  create(params: TeammateCreateParams): Teammate;

  /**
   * Updates settings; an account change requires idle memberships and resets their sessions.
   */
  update(params: TeammateUpdateParams): Teammate;

  /**
   * Deletes memberships while retaining historical messages and mentions.
   */
  delete(params: TeammateIdParams): void;
}

/**
 * Persists participants and applies account/name constraints.
 */
export declare class TeammatesService implements ITeammatesService {
  /**
   * Creates the service with its database, account and membership owners.
   */
  public constructor(context: DatabaseContext, accounts: IProviderAccountsService, conversations: IConversationsService);

  /**
   * Lists participants in creation order.
   */
  public list(): readonly Teammate[];

  /**
   * Returns a participant or null.
   */
  public find(teammateId: string): Teammate | null;

  /**
   * Creates a unique participant bound to an existing account.
   */
  public create(params: TeammateCreateParams): Teammate;

  /**
   * Updates settings; an account change requires idle memberships and resets their sessions.
   */
  public update(params: TeammateUpdateParams): Teammate;

  /**
   * Deletes memberships while retaining historical messages and mentions.
   */
  public delete(params: TeammateIdParams): void;
}

/**
 * Additive schema for teammates and conversation memberships.
 */
export declare class TeammatesMigration extends SqlMigration {
  /**
   * Uses the fixed teammates migration id.
   */
  public constructor();

  /**
   * Creates both tables, membership foreign keys and lookup indexes.
   */
  public override up(builder: MigrationBuilder): void;
}

/**
 * One pending reply with the account/role snapshot and cancellation state for its user message.
 */
export declare class ReplyWork {
  /**
   * The pending reply whose identity is fixed before any participant runs.
   */
  public readonly message: Message;
  /**
   * The account captured at send time.
   */
  public readonly account: ProviderAccount | null;
  /**
   * The role captured at send time.
   */
  public readonly instructions: string | null;
  /**
   * Approval and cancellation ownership for this reply.
   */
  public readonly run: ActiveRun;

  /**
   * Captures the immutable inputs and creates reply cancellation state.
   */
  public constructor(message: Message, account: ProviderAccount | null, instructions: string | null);
}

/**
 * Builds capped participant context from existing message history without a stored read cursor.
 */
export declare class ParticipantContext {
  /**
   * Uses the existing message paging boundary.
   */
  public constructor(messages: IMessagesService);

  /**
   * Returns the current question with intervening context, or a first-join transcript when the session is fresh.
   */
  public create(reply: Message, sent: Message, nativeSessionId: string | null, forked?: boolean): string;
}

/**
 * Checks schema compatibility and creates immutable SQLite recovery copies; never restores or deletes existing backups.
 */
export declare class DatabaseRecovery {
  /**
   * Refuses an unknown or non-prefix migration history.
   * @param applied Applied ids in catalog order.
   * @throws ServiceException with versionMismatch for an incompatible history.
   */
  public static assertCompatible(applied: readonly string[]): void;

  /**
   * Checks existing data and makes a recovery copy before a pending upgrade migration.
   * @param dataDirectory Runtime-owned data directory; ownership must be acquired first.
   * @throws Error or ServiceException when compatibility or backup fails, before migrations run.
   */
  public static prepare(dataDirectory: string): Promise<void>;

  /**
   * Creates and integrity-checks an online SQLite backup; publishes it atomically without overwriting a previous copy.
   * @param dataDirectory Owned data directory.
   * @param operationId UUID used as the recovery filename.
   * @returns Recovery file path, or null for a data directory without a database.
   * @throws Error or ServiceException when backup fails or the operation id is invalid.
   */
  public static createBackup(dataDirectory: string, operationId: string): Promise<string | null>;
}
