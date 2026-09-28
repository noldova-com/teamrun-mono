/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { Guid } from "@noldova/teamrun-foundation-core";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import { ConversationMemberParams,
  Approval,
  ApprovalStatus,
  DetailEventPayload,
  DetailKind,
  Event,
  EventName,
  Message,
  MessageDetail,
  MessageStatus,
  type ObservedSettings,
  type Provenance
} from "@noldova/teamrun-protocol";

import { TurnOutcome } from "../../enums/turn-outcome.js";
import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IProviderAdapter } from "../../interfaces/i-provider-adapter.js";
import type { ITurnListener } from "../../interfaces/i-turn-listener.js";
import type { ActiveRun } from "../../models/active-run.js";
import type { ApprovalAsk } from "../../models/approval-ask.js";
import { TurnDetail } from "../../models/turn-detail.js";
import type { TurnRequest } from "../../models/turn-request.js";
import { TurnResult } from "../../models/turn-result.js";
import type { TurnStart } from "../../models/turn-start.js";
import { Resources } from "../../resources.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import { WorkingTree } from "./working-tree.js";

export class ReplyRun implements ITurnListener {
  private readonly detailsByItem: Map<string, MessageDetail> = new Map();
  private message: Message;
  private provenance: Provenance;
  private readonly run: ActiveRun;
  private readonly messages: IMessagesService;
  private readonly approvals: IApprovalsService;
  private readonly events: IEventSink;
  private readonly imagesDirectory: string;
  private finished: boolean = false;
  private readonly conversations: IConversationsService | null;

  public constructor(
    message: Message,
    provenance: Provenance,
    run: ActiveRun,
    messages: IMessagesService,
    approvals: IApprovalsService,
    events: IEventSink,
    dataDirectory: string,
    conversations: IConversationsService | null = null) {
    this.message = message;
    this.provenance = provenance;
    this.run = run;
    this.messages = messages;
    this.approvals = approvals;
    this.events = events;
    this.imagesDirectory = join(dataDirectory, Resources.imagesDirectoryName);
    this.conversations = conversations;
  }

  public async execute(adapter: IProviderAdapter, request: TurnRequest): Promise<void> {
    try {
      this.update(this.message.withStatus(MessageStatus.Running, null));
      const tree = await WorkingTree.capture(request.workingDirectory);
      if (!Object.isNull(tree))
        await tree.snapshot(this.message.id);
      const result = await adapter.runTurn(request, this, this.run.signal);
      await this.reportWorkingTree(tree);
      this.complete(result);
    }
    catch (error) {
      if (this.run.isCancelled)
        this.complete(new TurnResult(TurnOutcome.Interrupted, null, this.provenance.observed, null));
      else
        this.fail(ReplyRun.describe(error));
    }
    finally {
      this.finished = true;
      this.run.close();
      this.cancelPendingApprovals();
    }
  }

  public onStarted(start: TurnStart): void {
    if (this.finished)
      return;
    this.provenance = this.provenance.withNativeSession(start.nativeSessionId, start.resumedNativeSession).withRoleApplied(start.roleApplied);
    this.saveMemberSession();
    this.update(this.message.withProvenance(this.provenance));
  }

  public onDetail(reported: TurnDetail): void {
    if (this.finished)
      return;
    const detail = this.storeImage(reported);
    const id = detail.providerItemId;
    const known = Object.isNull(id) ? undefined : this.detailsByItem.get(id);
    if (!Object.isUndefined(known)) {
      this.replaceDetail(known, detail);
      return;
    }
    const appended = this.appendDetail(detail.kind, detail.text, detail.payload);
    if (!Object.isNull(id))
      this.detailsByItem.set(id, appended);
  }

  public async onApprovalRequested(ask: ApprovalAsk): Promise<string> {
    const now = ReplyRun.now();
    const id = Guid.createVersion7().toString();
    const approval = new Approval(id, this.message.id, ask.kind, ask.nativeKind, ask.summary, ask.payload, ask.options, ApprovalStatus.Pending, null, now, null);
    if (this.finished || this.run.signal.aborted)
      return this.run.awaitDecision(id);
    this.approvals.insert(approval);
    const decision = this.run.awaitDecision(id);
    void decision.catch(() => undefined);
    this.update(this.message.withStatus(MessageStatus.AwaitingApproval, null));
    this.events.publish(new Event(EventName.ApprovalCreated, approval.toJson()));
    const optionId = await decision;
    if (!this.finished && !this.run.isAwaitingDecision)
      this.update(this.message.withStatus(MessageStatus.Running, null));
    return optionId;
  }

  public onObserved(observed: ObservedSettings): void {
    if (this.finished)
      return;
    this.provenance = this.provenance.withObserved(observed);
    this.update(this.message.withProvenance(this.provenance));
  }

  private storeImage(detail: TurnDetail): TurnDetail {
    const payload = detail.payload;
    if (!ReplyRun.isJsonObject(payload))
      return detail;
    const data = payload[Resources.imageDataField];
    const mediaType = payload[Resources.mediaTypeField];
    if (!Object.isString(data) || !Object.isString(mediaType))
      return detail;
    const extension = Resources.imageExtensions[mediaType];
    if (Object.isUndefined(extension))
      return detail;
    mkdirSync(this.imagesDirectory, { recursive: true });
    const path = join(this.imagesDirectory, Resources.formatImageFileName(this.message.id, this.message.details.length, extension));
    writeFileSync(path, Buffer.from(data, Resources.base64Encoding));

    return new TurnDetail(detail.kind, detail.text, { ...payload, [Resources.imageDataField]: null, [Resources.storedPathField]: path }, detail.providerItemId);
  }

  private async reportWorkingTree(tree: WorkingTree | null): Promise<void> {
    if (Object.isNull(tree))
      return;
    const reported = new Set(this.reportedFiles().map(t => ReplyRun.pathKey(t)));
    const changes = (await tree.changesSince()).filter(t => !reported.has(ReplyRun.pathKey(t.path)));
    if (!tree.hasCompleteEvidence)
      this.appendDetail(DetailKind.Note, Resources.incompleteWorkingTreeEvidence, { source: Resources.workingTreeSource });
    if (changes.length === 0)
      return;
    const names = changes.map(t => relative(tree.root, t.path)).join(Resources.listSeparator);
    const payload = {
      [Resources.filesField]: changes.map(t => t.path),
      status: Resources.completedStatus,
      changes: changes.map(t => ({ path: t.path, kind: t.kind, diff: t.diff })),
      source: Resources.workingTreeSource
    };
    this.appendDetail(DetailKind.FileChange, Resources.formatWorkingTreeChanges(names), payload);
  }

  private reportedFiles(): readonly string[] {
    const files: string[] = [];
    for (const detail of this.message.details) {
      if (detail.kind !== DetailKind.FileChange || !ReplyRun.isJsonObject(detail.payload))
        continue;
      const listed = detail.payload[Resources.filesField];
      if (Array.isArray(listed))
        for (const file of listed)
          if (Object.isString(file))
            files.push(file);
    }

    return files;
  }

  private static pathKey(path: string): string {
    const absolute = resolve(path);
    const directory = dirname(absolute);
    const parent = existsSync(directory) ? realpathSync.native(directory) : directory;
    return join(parent, basename(absolute)).toLowerCase();
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private complete(result: TurnResult): void {
    const nativeSessionId = Object.isNull(result.nativeSessionId) ? this.provenance.nativeSessionId : result.nativeSessionId;
    const nativeTurnId = Object.isNull(result.nativeTurnId) ? this.provenance.nativeTurnId : result.nativeTurnId;
    this.provenance = this.provenance.withObserved(result.observed).withNativeSession(nativeSessionId, this.provenance.resumedNativeSession, nativeTurnId);
    this.message = this.message.withProvenance(this.provenance);
    this.saveMemberSession();
    if (result.outcome === TurnOutcome.Failed) {
      this.fail(String(result.error));
      return;
    }
    if (result.outcome === TurnOutcome.Interrupted && this.run.isCancelled)
      this.appendDetail(DetailKind.Note, Resources.replyCancelled, null);

    const interrupted = this.run.isCancelled ? MessageStatus.Cancelled : MessageStatus.Interrupted;
    const status = result.outcome === TurnOutcome.Completed ? MessageStatus.Completed : interrupted;
    this.update(this.message.withStatus(status, ReplyRun.now()));
  }

  private fail(error: string): void {
    this.appendDetail(DetailKind.Error, Resources.formatTurnFailed(error), null);
    this.update(this.message.withStatus(MessageStatus.Failed, ReplyRun.now()));
  }

  private saveMemberSession(): void {
    if (Object.isNull(this.conversations) || Object.isNull(this.message.teammateId))
      return;
    const params = new ConversationMemberParams(this.message.conversationId, this.message.teammateId);
    const current = this.conversations.findMember(params);
    if (current?.nativeSessionId === this.provenance.nativeSessionId && current.resumedNativeSession === this.provenance.resumedNativeSession)
      return;
    this.conversations.setMemberSession(params, this.provenance.nativeSessionId, this.provenance.resumedNativeSession);
  }

  private cancelPendingApprovals(): void {
    const now = ReplyRun.now();
    for (const approval of this.approvals.listPending(this.message.id)) {
      const cancelled = approval.withCancellation(now);
      this.approvals.update(cancelled);
      this.events.publish(new Event(EventName.ApprovalUpdated, cancelled.toJson()));
    }
  }

  private appendDetail(kind: DetailKind, text: string, payload: JsonValue): MessageDetail {
    const detail = new MessageDetail(this.message.details.length, kind, text, payload, ReplyRun.now());
    this.message = this.message.withDetail(detail);
    this.messages.update(this.message);
    this.events.publish(new Event(EventName.DetailAppended, new DetailEventPayload(this.message.id, detail).toJson()));

    return detail;
  }

  private replaceDetail(previous: MessageDetail, detail: TurnDetail): void {
    const replaced = new MessageDetail(previous.sequence, detail.kind, detail.text, detail.payload, previous.createdAt);
    const details = this.message.details.map(t => t.sequence === previous.sequence ? replaced : t);
    this.message = this.message.withDetails(details);
    this.messages.update(this.message);
    if (!Object.isNull(detail.providerItemId))
      this.detailsByItem.set(detail.providerItemId, replaced);
    this.events.publish(new Event(EventName.DetailUpdated, new DetailEventPayload(this.message.id, replaced).toJson()));
  }

  private update(message: Message): void {
    this.message = message;
    this.messages.update(message);
    this.events.publish(new Event(EventName.MessageUpdated, message.toJson()));
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private static now(): string {
    return new Date().toISOString();
  }
}
