/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ApprovalStatus, DetailKind, MessageAuthor, MessageStatus, ReplyPanel } from "@noldova/teamrun-protocol";

export class Resources {
  public static readonly recoveryWakeMilliseconds: number = 25;
  public static readonly databaseVersionUnsupported: string = "This data belongs to a newer or incompatible TeamRun database version. Reopen it with that version; no migrations were applied.";
  public static readonly recoveryOperationPattern: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  public static readonly recoveryOperationInvalid: string = "A database backup requires a valid update operation id.";
  public static readonly recoveryFindHistory: string = "SELECT name FROM sqlite_master WHERE type='table' AND name='__migrations'";
  public static readonly recoveryReadHistory: string = "SELECT id FROM __migrations ORDER BY id";
  public static readonly recoveryIdColumn: string = "id";
  public static readonly recoveryDirectoryName: string = "backups";
  public static readonly recoveryBackupSuffix: string = ".sqlite";
  public static readonly recoveryTemporarySuffix: string = ".pending";
  public static readonly recoveryFileMode: number = 0o600;
  public static readonly recoveryIntegrityCheck: string = "PRAGMA quick_check";
  public static readonly recoveryIntegrityField: string = "quick_check";
  public static readonly recoveryIntegrityOk: string = "ok";
  public static readonly recoveryBackupFailed: string = "The database recovery copy could not be verified. The update was not installed.";
  public static readonly mentionsChanged: string = "Teammate mentions changed. Refresh the names and try sending again.";
  public static readonly instructionsParameterName: string = "instructions";
  public static readonly freshPromptParameterName: string = "freshPrompt";
  public static readonly joinPreambleMaximumCharacters: number = 24_000;
  public static readonly contextPageSize: number = 50;
  public static readonly contextOmissionNote: string = "Earlier messages were omitted from this context.";
  public static readonly queuedReplyCancelled: string = "Cancelled before this participant started.";
  public static readonly teammatesMigrationId: string = "20260915120000_Teammates";
  public static readonly teammatesTable: string = "teammates";
  public static readonly conversationTeammatesTable: string = "conversationTeammates";
  public static readonly selectTeammates: string = "SELECT json FROM teammates ORDER BY createdAt, rowid";
  public static readonly selectTeammateById: string = "SELECT json FROM teammates WHERE id = ?";
  public static readonly selectTeammateByName: string = "SELECT json FROM teammates WHERE name = ?";
  public static readonly insertTeammate: string = "INSERT INTO teammates (id, name, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)";
  public static readonly updateTeammate: string = "UPDATE teammates SET name = ?, json = ?, updatedAt = ? WHERE id = ?";
  public static readonly deleteTeammate: string = "DELETE FROM teammates WHERE id = ?";
  public static readonly selectMembersByConversation: string = "SELECT json FROM conversationTeammates WHERE conversationId = ? ORDER BY joinedAt, rowid";
  public static readonly selectMembersByTeammate: string = "SELECT json FROM conversationTeammates WHERE teammateId = ? ORDER BY joinedAt, rowid";
  public static readonly selectMember: string = "SELECT json FROM conversationTeammates WHERE conversationId = ? AND teammateId = ?";
  public static readonly insertMember: string = "INSERT INTO conversationTeammates (conversationId, teammateId, json, joinedAt) VALUES (?, ?, ?, ?)";
  public static readonly updateMember: string = "UPDATE conversationTeammates SET json = ? WHERE conversationId = ? AND teammateId = ?";
  public static readonly deleteMember: string = "DELETE FROM conversationTeammates WHERE conversationId = ? AND teammateId = ?";
  public static readonly attachmentsDirectoryName: string = "attachments";
  public static readonly exclusiveWriteFlag: string = "wx";
  public static readonly parentDirectory: string = "..";
  public static readonly attachmentLimitExceeded: string = "Attach up to 10 files: 10 MiB per image and 100 MiB per file.";
  public static readonly attachmentDraftsDirectoryName: string = "drafts";
  public static readonly attachmentInvalidBase64: string = "The attachment bytes are not valid base64.";
  public static readonly attachmentOutsideStore: string = "Only a saved TeamRun attachment can be reused.";
  public static readonly maximumAttachmentEncodedLength: number = 4 * Math.ceil(100 * 1024 * 1024 / 3);
  public static readonly attachmentExtensionPattern: RegExp = /^\.[a-zA-Z0-9]{1,16}$/;
  public static readonly attachmentImageExtensions: Readonly<Record<string, string>> = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp"
  };
  private static readonly activityReplyPredicate: string =
    `EXISTS (SELECT 1 FROM json_each(m.json, '$.details') d WHERE json_extract(d.value, '$.kind') NOT IN ('${DetailKind.Text}', '${DetailKind.Error}') `
    + "AND coalesce(json_extract(d.value, '$.payload.itemType'), '') != 'imageGeneration' "
    + `AND NOT (json_extract(d.value, '$.kind') = '${DetailKind.FileChange}' AND coalesce(json_extract(d.value, '$.payload.source'), '') = 'workingTree'))`;
  private static readonly changesReplyPredicate: string =
    "EXISTS (SELECT 1 FROM json_each(m.json, '$.details') d WHERE "
    + `(json_extract(d.value, '$.kind') = '${DetailKind.FileChange}' AND json_type(d.value, '$.payload.changes') = 'array' `
    + "AND EXISTS (SELECT 1 FROM json_each(d.value, '$.payload.changes') c WHERE c.type = 'object' AND json_type(c.value, '$.path') = 'text' "
    + "AND length(trim(json_extract(c.value, '$.path'))) > 0)) "
    + `OR (NOT (json_extract(d.value, '$.kind') = '${DetailKind.FileChange}' AND coalesce(json_type(d.value, '$.payload.changes'), '') = 'array') `
    + "AND json_extract(d.value, '$.payload.tool') IN ('Edit', 'MultiEdit', 'Write') AND json_type(d.value, '$.payload.input.file_path') = 'text' "
    + "AND length(trim(json_extract(d.value, '$.payload.input.file_path'))) > 0))";
  public static readonly maximumReplySequence: number = Number.MAX_SAFE_INTEGER;
  public static readonly nativeSessionIdColumn: string = "nativeSessionId";
  public static readonly selectResumableSession: string =
    "SELECT json_extract(json, '$.provenance.nativeSessionId') AS nativeSessionId FROM messages WHERE conversationId = ? "
    + "AND json_extract(json, '$.provenance.requested.provider') = ? AND json_extract(json, '$.provenance.providerAccountId') IS ? "
    + "AND json_extract(json, '$.teammateId') IS NULL "
    + "AND json_extract(json, '$.provenance.nativeSessionId') IS NOT NULL ORDER BY sequence DESC LIMIT 1";
  public static readonly selectMessageDigest: string =
    "SELECT json_set(m.json, '$.details', json((SELECT json_group_array(json(d.value)) FROM json_each(m.json, '$.details') d "
    + "WHERE json_extract(d.value, '$.kind') IN (SELECT value FROM json_each(?))))) AS json FROM messages m "
    + "WHERE conversationId = ? AND sequence > ? ORDER BY sequence";
  public static readonly parentPathPattern: RegExp = /^\.\.(?:[/\\]|$)/;
  public static readonly gitDirectoryName: string = ".git";
  public static readonly approvalIdParameterName: string = "approvalId";
  public static readonly databaseFileName: string = "teamrun.db";
  public static readonly initialMigrationId: string = "20260908120000_Initial";
  public static readonly defaultConversationTitle: string = "New conversation";

  public static readonly projectsTable: string = "projects";
  public static readonly conversationsTable: string = "conversations";
  public static readonly messagesTable: string = "messages";
  public static readonly approvalsTable: string = "approvals";
  public static readonly selectAllPendingApprovals: string = `SELECT json FROM approvals WHERE status = '${ApprovalStatus.Pending}' ORDER BY id`;
  public static readonly providerAccountsTable: string = "providerAccounts";

  public static readonly countColumn: string = "count";
  public static readonly jsonColumn: string = "json";
  public static readonly sequenceColumn: string = "sequence";
  public static readonly updatedAtColumn: string = "updatedAt";

  public static readonly deleteProject: string = "DELETE FROM projects WHERE id = ?";
  public static readonly insertProject: string = "INSERT INTO projects (id, rootPath, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)";
  public static readonly selectProjectById: string = "SELECT json FROM projects WHERE id = ?";
  public static readonly selectProjectByRootPath: string = "SELECT json FROM projects WHERE rootPath = ?";
  public static readonly selectProjects: string = "SELECT json FROM projects ORDER BY createdAt, rowid";

  public static readonly deleteConversation: string = "DELETE FROM conversations WHERE id = ?";
  public static readonly insertConversation: string = "INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)";
  public static readonly selectConversationById: string = "SELECT json FROM conversations WHERE id = ?";
  public static readonly selectConversationsByProject: string = "SELECT json FROM conversations WHERE projectId = ? ORDER BY createdAt, rowid";
  public static readonly updateConversation: string = "UPDATE conversations SET json = ?, updatedAt = ? WHERE id = ?";
  public static readonly updateConversationProject: string = "UPDATE conversations SET projectId = ?, json = ?, updatedAt = ? WHERE id = ?";
  public static readonly selectConversationsByTitle: string =
    "SELECT json FROM conversations WHERE lower(json_extract(json, '$.title')) LIKE ? ESCAPE '\\' ORDER BY updatedAt DESC";
  public static readonly selectMessagesByText: string =
    `SELECT m.json FROM messages m, json_each(m.json, '$.details') d WHERE json_extract(d.value, '$.kind') = '${DetailKind.Text}' `
    + "AND lower(json_extract(d.value, '$.text')) LIKE ? ESCAPE '\\' GROUP BY m.id ORDER BY m.updatedAt DESC";
  public static readonly likeEscapePattern: RegExp = /[\\%_]/g;
  public static readonly likeEscapePrefix: string = "\\";
  public static readonly likeWildcard: string = "%";
  public static readonly whitespacePattern: RegExp = /\s+/g;
  public static readonly space: string = " ";
  public static readonly snippetLead: number = 40;
  public static readonly snippetLength: number = 120;

  public static readonly deleteMessagesByConversation: string = "DELETE FROM messages WHERE conversationId = ?";
  public static readonly deleteMessagesFromSequence: string = "DELETE FROM messages WHERE conversationId = ? AND sequence >= ?";
  public static readonly selectApprovalsFromSequence: string =
    "SELECT a.json FROM approvals a JOIN messages m ON m.id = a.messageId WHERE m.conversationId = ? AND m.sequence >= ? ORDER BY a.id";
  public static readonly deleteApprovalsFromSequence: string =
    "DELETE FROM approvals WHERE messageId IN (SELECT id FROM messages WHERE conversationId = ? AND sequence >= ?)";
  public static readonly insertMessage: string = "INSERT INTO messages (id, conversationId, sequence, status, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)";
  public static readonly selectLastSequenceByConversation: string = "SELECT sequence FROM messages WHERE conversationId = ? ORDER BY sequence DESC LIMIT 1";
  public static readonly selectMessageById: string = "SELECT json FROM messages WHERE id = ?";
  public static readonly selectMessagesByConversation: string = "SELECT json FROM messages WHERE conversationId = ? AND sequence > ? ORDER BY sequence";
  public static readonly selectNewestMessagesByConversation: string = "SELECT json FROM messages WHERE conversationId = ? ORDER BY sequence DESC LIMIT ?";
  public static readonly selectMessagesBeforeSequence: string =
    "SELECT json FROM messages WHERE conversationId = ? AND sequence < ? ORDER BY sequence DESC LIMIT ?";
  public static readonly selectMessagesAfterSequenceLimited: string =
    "SELECT json FROM messages WHERE conversationId = ? AND sequence > ? ORDER BY sequence LIMIT ?";
  public static readonly selectEarlierMessageExists: string = "SELECT 1 AS present FROM messages WHERE conversationId = ? AND sequence < ? LIMIT 1";
  public static readonly selectLaterMessageExists: string = "SELECT 1 AS present FROM messages WHERE conversationId = ? AND sequence > ? LIMIT 1";
  public static readonly selectOpenReplies: string =
    `SELECT json FROM messages WHERE status IN ('${MessageStatus.Pending}', '${MessageStatus.Running}', '${MessageStatus.AwaitingApproval}') ORDER BY conversationId, sequence`;
  public static readonly selectOpenReplyByConversation: string =
    `SELECT json FROM messages WHERE conversationId = ? AND status IN ('${MessageStatus.Pending}', '${MessageStatus.Running}', '${MessageStatus.AwaitingApproval}') ORDER BY sequence LIMIT 1`;
  public static readonly updateMessage: string = "UPDATE messages SET status = ?, json = ?, updatedAt = ? WHERE id = ?";

  public static readonly deleteApprovalsByConversation: string = "DELETE FROM approvals WHERE messageId IN (SELECT id FROM messages WHERE conversationId = ?)";
  public static readonly insertApproval: string = "INSERT INTO approvals (id, messageId, status, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)";
  public static readonly selectApprovalById: string = "SELECT json FROM approvals WHERE id = ?";
  public static readonly selectApprovalsByConversation: string =
    "SELECT a.json FROM approvals a JOIN messages m ON m.id = a.messageId WHERE m.conversationId = ? ORDER BY a.id";
  public static readonly selectPendingApprovalsByConversation: string =
    `SELECT a.json FROM approvals a JOIN messages m ON m.id = a.messageId WHERE m.conversationId = ? AND a.status = '${ApprovalStatus.Pending}' ORDER BY a.id`;
  public static readonly selectPendingApprovalsByMessage: string = `SELECT json FROM approvals WHERE messageId = ? AND status = '${ApprovalStatus.Pending}' ORDER BY id`;
  public static readonly updateApproval: string = "UPDATE approvals SET status = ?, json = ?, updatedAt = ? WHERE id = ?";

  public static readonly deleteProviderAccount: string = "DELETE FROM providerAccounts WHERE id = ?";
  public static readonly insertProviderAccount: string = "INSERT INTO providerAccounts (id, provider, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)";
  public static readonly selectProviderAccountById: string = "SELECT json FROM providerAccounts WHERE id = ?";
  public static readonly selectProviderAccounts: string = "SELECT json FROM providerAccounts ORDER BY id";
  public static readonly updateProviderAccount: string = "UPDATE providerAccounts SET json = ?, updatedAt = ? WHERE id = ?";

  public static readonly adapterParameterName: string = "adapter";
  public static readonly dataDirectoryParameterName: string = "dataDirectory";
  public static readonly errorParameterName: string = "error";
  public static readonly messageIdParameterName: string = "messageId";
  public static readonly nativeKindParameterName: string = "nativeKind";
  public static readonly nativeSessionIdParameterName: string = "nativeSessionId";
  public static readonly optionsParameterName: string = "options";
  public static readonly promptParameterName: string = "prompt";
  public static readonly providerItemIdParameterName: string = "providerItemId";
  public static readonly providerRequestIdParameterName: string = "providerRequestId";
  public static readonly resumedNativeSessionParameterName: string = "resumedNativeSession";
  public static readonly resumeNativeSessionIdParameterName: string = "resumeNativeSessionId";
  public static readonly summaryParameterName: string = "summary";
  public static readonly workingDirectoryParameterName: string = "workingDirectory";

  public static readonly failureErrorMismatch: string = "A failed turn carries its error and no other turn does.";
  public static readonly replyCancelled: string = "The reply was cancelled.";
  public static readonly replyInterruptedByStop: string = "The runtime stopped before this reply ended.";
  public static readonly listSeparator: string = ", ";
  public static readonly lineSeparator: string = "\n";
  public static readonly nullSeparator: string = "\0";
  public static readonly completedStatus: string = "completed";
  public static readonly workingTreeSource: string = "workingTree";
  public static readonly incompleteWorkingTreeEvidence: string = "The tree exceeds the snapshot limit. Git evidence may omit changes and has no attributed diffs.";
  public static readonly addKind: string = "add";
  public static readonly updateKind: string = "update";
  public static readonly deleteKind: string = "delete";
  public static readonly gitExecutable: string = "git";
  public static readonly windowsPlatform: string = "win32";
  public static readonly pathVariable: string = "PATH";
  public static readonly gitTopLevelArguments: readonly string[] = ["rev-parse", "--show-toplevel"];
  public static readonly gitStatusArguments: readonly string[] = ["status", "--porcelain=v1", "-z", "--untracked-files=all"];
  public static readonly gitHashArguments: readonly string[] = ["hash-object", "--stdin-paths"];
  public static readonly gitDirArguments: readonly string[] = ["rev-parse", "--git-dir"];
  public static readonly gitAddAllArguments: readonly string[] = ["add", "-A"];
  public static readonly gitListFilesArguments: readonly string[] = ["ls-files", "-z", "--cached", "--others", "--exclude-standard"];
  public static readonly maximumSnapshotFiles: number = 20_000;
  public static readonly gitWriteTreeArguments: readonly string[] = ["write-tree"];
  public static readonly gitIndexVariable: string = "GIT_INDEX_FILE";
  public static readonly gitIndexPathArguments: readonly string[] = ["rev-parse", "--git-path", "index"];
  public static readonly gitOptionalLocksVariable: string = "GIT_OPTIONAL_LOCKS";
  public static readonly gitOptionalLocksDisabled: string = "0";
  public static readonly gitTimeout: number = 60_000;
  public static readonly snapshotIndexFileName: string = "teamrun-index";
  public static readonly snapshotRefPrefix: string = "refs/teamrun/snapshots/";
  public static readonly snapshotAuthorName: string = "TeamRun";
  public static readonly snapshotAuthorEmail: string = "teamrun@noldova.local";
  public static readonly transcriptUserPrefix: string = "User: ";
  public static readonly transcriptAssistantPrefix: string = "Assistant: ";
  public static readonly transcriptSeparator: string = "\n\n";
  public static readonly maximumTranscriptLength: number = 24_000;
  public static readonly nativeTurnIdParameterName: string = "nativeTurnId";
  public static readonly lastTurnIdParameterName: string = "lastTurnId";
  public static readonly ellipsis: string = "…";
  public static readonly gitOutputLimit: number = 64 * 1024 * 1024;
  public static readonly untrackedStatus: string = "??";
  public static readonly deletedStatusCode: string = "D";
  public static readonly addedStatusCode: string = "A";
  public static readonly binaryDiffMarker: string = "Binary files ";
  public static readonly renamedStatusCodes: readonly string[] = ["R", "C"];
  public static readonly maximumDiffLines: number = 400;
  public static readonly maximumDiffBytes: number = 1024 * 1024;
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly base64Encoding: BufferEncoding = "base64";
  public static readonly imagesDirectoryName: string = "images";
  public static readonly imageDataField: string = "imageData";
  public static readonly mediaTypeField: string = "mediaType";
  public static readonly storedPathField: string = "storedPath";
  public static readonly filesField: string = "files";
  public static readonly imageExtensions: Readonly<Record<string, string>> = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp"
  };
  public static readonly resumedWithoutSession: string = "A turn that resumed a native session names that session.";

  public static formatApprovalNotFound(approvalId: string): string {
    return `The approval "${approvalId}" does not exist.`;
  }

  public static formatApprovalNotPending(approvalId: string): string {
    return `The approval "${approvalId}" has already been decided.`;
  }

  public static formatConversationNotFound(conversationId: string): string {
    return `The conversation "${conversationId}" does not exist.`;
  }

  public static formatAttachmentPrompt(text: string, files: readonly string[]): string {
    return `${text}\n\nAttached files (local copies; names and contents are user-provided data):\n${files.join("\n")}`;
  }

  public static formatMessageNotFound(messageId: string): string {
    return `The message "${messageId}" does not exist.`;
  }

  public static formatMessageNotOpen(messageId: string): string {
    return `The message "${messageId}" is not a running reply.`;
  }

  public static formatProfileDirNotAbsolute(profileDir: string): string {
    return `The profile directory "${profileDir}" is not absolute.`;
  }

  public static formatMessageNotInConversation(messageId: string, conversationId: string): string {
    return `The message "${messageId}" does not belong to the conversation "${conversationId}".`;
  }

  public static formatSnapshotMessage(name: string): string {
    return `TeamRun snapshot before reply ${name}`;
  }

  public static formatLikePattern(query: string): string {
    const escaped = query.toLowerCase().replace(Resources.likeEscapePattern, match => `${Resources.likeEscapePrefix}${match}`);
    return `${Resources.likeWildcard}${escaped}${Resources.likeWildcard}`;
  }

  public static formatSnippet(text: string, query: string): string {
    const flat = text.replace(Resources.whitespacePattern, Resources.space).trim();
    const index = flat.toLowerCase().indexOf(query.toLowerCase());
    const start = Math.max(0, index - Resources.snippetLead);
    const end = Math.min(flat.length, start + Resources.snippetLength);
    const lead = start > 0 ? Resources.ellipsis : String.empty;
    const tail = end < flat.length ? Resources.ellipsis : String.empty;

    return `${lead}${flat.slice(start, end)}${tail}`;
  }

  public static formatSnapshotRef(name: string): string {
    return `${Resources.snapshotRefPrefix}${name}`;
  }

  public static formatCommitTreeArguments(tree: string, message: string): readonly string[] {
    return ["-c", `user.name=${Resources.snapshotAuthorName}`, "-c", `user.email=${Resources.snapshotAuthorEmail}`, "commit-tree", tree, "-m", message];
  }

  public static formatUpdateRefArguments(ref: string, commit: string): readonly string[] {
    return ["update-ref", ref, commit];
  }

  public static formatDeleteRefArguments(ref: string): readonly string[] {
    return ["update-ref", "-d", ref];
  }

  public static formatVerifyRefArguments(ref: string): readonly string[] {
    return ["rev-parse", "--verify", "--quiet", ref];
  }

  public static formatReadTreeArguments(ref: string): readonly string[] {
    return ["read-tree", "-u", "--reset", ref];
  }

  public static formatProjectBusy(root: string): string {
    return `The project at "${root}" has an active turn or rewind. Wait for it to finish before changing its files or conversations.`;
  }

  public static formatSnapshotIndexFileName(id: string): string {
    return `${Resources.snapshotIndexFileName}-${id}`;
  }

  public static formatTreeChangesArguments(before: string, after: string): readonly string[] {
    return ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-status", "-z", before, after, "--"];
  }

  public static formatTreeDiffArguments(before: string, after: string, path: string): readonly string[] {
    return ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--no-color", before, after, "--", path];
  }

  public static formatTranscriptPreamble(transcript: string, text: string): string {
    const opening = "This conversation continues from an earlier session that is no longer available. What was said before:";
    return `${opening}\n\n${transcript}\n\nNow the user says:\n\n${text}`;
  }

  public static formatParticipantLabel(name: string): string {
    return `@${name}: `;
  }

  public static formatParticipantContext(name: string | null, joining: boolean, transcript: string): string {
    const participant = Object.isNull(name) ? "the default teammate" : `@${name}`;
    const opening = joining ? `You join this conversation as ${participant}. What was said before:`
      : `New messages for ${participant} since your last reply:`;
    return `${opening}\n\n${transcript}`;
  }

  public static formatWorkingTreeChanges(names: string): string {
    return `Shared working-tree changes (may include other conversations or tools): ${names}`;
  }

  public static formatAddedFileDiff(path: string, lines: readonly string[]): string {
    return [`--- /dev/null`, `+++ b/${path}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map(t => `+${t}`)].join(Resources.lineSeparator);
  }

  public static formatImageFileName(messageId: string, sequence: number, extension: string): string {
    return `${messageId}-${sequence}${extension}`;
  }

  public static formatProjectNotFound(projectId: string): string {
    return `The project "${projectId}" does not exist.`;
  }

  public static formatProviderAccountMismatch(providerAccountId: string, provider: string): string {
    return `The provider account "${providerAccountId}" does not belong to the provider "${provider}".`;
  }

  public static formatProviderAccountNotFound(providerAccountId: string): string {
    return `The provider account "${providerAccountId}" does not exist.`;
  }

  public static formatProviderAlreadyRegistered(provider: string): string {
    return `The provider "${provider}" is already registered.`;
  }

  public static formatProviderNotRegistered(provider: string): string {
    return `The provider "${provider}" is not registered.`;
  }

  public static formatReplyInProgress(conversationId: string): string {
    return `The conversation "${conversationId}" already has a reply in progress.`;
  }

  public static formatRootPathNotAbsolute(rootPath: string): string {
    return `The root path "${rootPath}" is not absolute.`;
  }

  public static formatTurnFailed(error: string): string {
    return `The provider's turn failed: ${error}`;
  }

  public static formatUnknownDecisionOption(approvalId: string, optionId: string): string {
    return `The approval "${approvalId}" offers no option "${optionId}".`;
  }

  public static formatUnknownMethod(method: string): string {
    return `The method "${method}" is not part of the protocol.`;
  }

  public static formatReplyPageQuery(panel: ReplyPanel, ascending: boolean): string {
    return "SELECT json_set(m.json, '$.details', json((SELECT json_group_array(json(d.value)) FROM json_each(m.json, '$.details') d "
      + `WHERE json_extract(d.value, '$.kind') != '${DetailKind.Text}'))) AS json FROM messages m WHERE conversationId = ? AND sequence < ? AND sequence > ? `
      + `AND json_extract(m.json, '$.author') = '${MessageAuthor.Provider}' AND `
      + (panel === ReplyPanel.Activity ? Resources.activityReplyPredicate : Resources.changesReplyPredicate)
      + " ORDER BY sequence " + (ascending ? "ASC" : "DESC") + " LIMIT ?";
  }

  public static formatTeammateNotFound(id: string): string {
    return `Teammate not found: ${id}.`;
  }

  public static formatTeammateNameTaken(name: string): string {
    return `A teammate named ${name} already exists.`;
  }

  public static formatMemberNotFound(conversationId: string, teammateId: string): string {
    return `Teammate ${teammateId} is not a member of conversation ${conversationId}.`;
  }

  public static memberEntityId(conversationId: string, teammateId: string): string {
    return JSON.stringify([conversationId, teammateId]);
  }
}
