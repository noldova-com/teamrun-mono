/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Guid } from "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import {
  AuthStatus, ConversationMemberParams, RequestedSettings, Teammate, TeammateMention, MentionResolver,
  type AttachmentInput,
  type Approval,
  type ApprovalDecideParams,
  ApprovalStatus,
  type ConversationRewindParams,
  ConversationRewindResult,
  ConversationRewoundPayload,
  DetailKind,
  ErrorCode,
  Event,
  EventName,
  ForkedSession,
  Message,
  type MessageAttachment,
  MessageAuthor,
  MessageDetail,
  type MessageIdParams,
  MessageListParams,
  type MessageSendParams,
  MessageSendResult,
  MessageStatus,
  ObservedSettings,
  Provenance,
  type ProviderAccount
} from "@noldova/teamrun-protocol";

import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import type { IConversationEngine } from "../../interfaces/i-conversation-engine.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IProjectsService } from "../../interfaces/i-projects.service.js";
import type { IProviderAccountsService } from "../../interfaces/i-provider-accounts.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import { ReplyWork } from "../../models/reply-work.js";
import { ParticipantContext } from "./participant-context.js";
import { ActiveRun } from "../../models/active-run.js";
import { AttachmentStore } from "./attachment-store.js";
import { ForkRequest } from "../../models/fork-request.js";
import { TurnRequest } from "../../models/turn-request.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderRegistry } from "../providers/provider-registry.js";
import { ReplyRun } from "./reply-run.js";
import { WorkingTree } from "./working-tree.js";

export class ConversationEngine implements IConversationEngine {
  private readonly groups: Map<string, readonly ReplyWork[]> = new Map();
  private readonly teammates: ITeammatesService;
  private readonly runs: Map<string, ActiveRun> = new Map();
  private readonly completions: Map<string, Promise<void>> = new Map();
  private readonly context: DatabaseContext;
  private readonly projects: IProjectsService;
  private readonly conversations: IConversationsService;
  private readonly messages: IMessagesService;
  private readonly approvals: IApprovalsService;
  private readonly accounts: IProviderAccountsService;
  private readonly registry: ProviderRegistry;
  private readonly events: IEventSink;
  private readonly attachments: AttachmentStore;

  public constructor(
    context: DatabaseContext,
    projects: IProjectsService,
    conversations: IConversationsService,
    messages: IMessagesService,
    approvals: IApprovalsService,
    accounts: IProviderAccountsService,
    teammates: ITeammatesService,
    registry: ProviderRegistry,
    events: IEventSink) {
    this.context = context;
    this.projects = projects;
    this.conversations = conversations;
    this.messages = messages;
    this.approvals = approvals;
    this.accounts = accounts;
    this.teammates = teammates;
    this.registry = registry;
    this.events = events;
    this.attachments = new AttachmentStore(context.dataDirectory);
  }

  public get activeRunCount(): number {
    return this.groups.size;
  }

  public prepareAttachment(input: AttachmentInput): MessageAttachment {
    return this.attachments.prepare(input);
  }

  public discardAttachment(attachment: MessageAttachment): void {
    this.attachments.discardPrepared(attachment);
  }

  public async send(params: MessageSendParams): Promise<MessageSendResult> {
    const conversation = this.conversations.find(params.conversationId);
    if (Object.isNull(conversation))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatConversationNotFound(params.conversationId), [params.conversationId]);
    const project = this.projects.find(conversation.projectId);
    if (Object.isNull(project))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProjectNotFound(conversation.projectId), [conversation.projectId]);
    if (!Object.isNull(this.messages.findOpenReply(conversation.id)) || this.hasActiveSend(conversation.id))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatReplyInProgress(conversation.id), [conversation.id]);

    const mentions = [...new Set(params.mentionedTeammateIds)].map(id => this.requireTeammate(id));
    const resolved = MentionResolver.resolve(params.text, mentions.map(t => new TeammateMention(t.id, t.name)));
    if (resolved.length !== mentions.length || resolved.some((t, index) => t.teammateId !== mentions[index]?.id))
      throw new ServiceException(ErrorCode.Conflict, Resources.mentionsChanged, []);
    const responder = mentions.length > 0 || Object.isNull(params.responderTeammateId) ? null : this.requireTeammate(params.responderTeammateId);
    if (mentions.length === 0 && !Object.isNull(responder)
      && Object.isNull(this.conversations.findMember(new ConversationMemberParams(conversation.id, responder.id))))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatMemberNotFound(conversation.id, responder.id), [conversation.id, responder.id]);
    const participants = mentions.length > 0 ? mentions : [responder];
    const projectLease = this.context.projectActivity.enterTurn(project.rootPath);
    let attachments: readonly MessageAttachment[] = [];
    let sent: Message | null = null;
    let work: readonly ReplyWork[] = [];
    const completion = Promise.withResolvers<void>();
    void completion.promise.catch(() => undefined);
    try {
      const now = new Date().toISOString();
      const sequence = this.messages.nextSequence(conversation.id);
      attachments = this.attachments.save(params.attachments);
      const question = new MessageDetail(0, DetailKind.Text, params.text, null, now);
      const message = new Message(Guid.createVersion7().toString(), conversation.id, sequence, MessageAuthor.User, null,
        MessageStatus.Completed, String.isNullOrEmpty(params.text) ? [] : [question], null, now, null, now, attachments,
        null, null, mentions.map(t => new TeammateMention(t.id, t.name)));
      const pending: ReplyWork[] = [];
      for (const participant of participants) {
        const item = this.prepareReply(participant, params, message, sequence + pending.length + 1);
        if (!Object.isNull(item))
          pending.push(item);
      }
      let joined = false;
      this.context.database.transaction(() => {
        for (const participant of mentions) {
          const member = new ConversationMemberParams(conversation.id, participant.id);
          if (Object.isNull(this.conversations.findMember(member))) {
            this.conversations.addMember(member);
            joined = true;
          }
        }
        this.messages.insert(message);
        for (const item of pending)
          this.messages.insert(item.message);
      });
      sent = message;
      work = pending;
      if (pending.length > 0) {
        this.groups.set(message.id, pending);
        this.completions.set(message.id, completion.promise);
        for (const item of pending)
          this.runs.set(item.message.id, item.run);
      }
      this.events.publish(new Event(EventName.MessageCreated, message.toJson()));
      for (const item of pending)
        this.events.publish(new Event(EventName.MessageCreated, item.message.toJson()));
      if (joined)
        this.events.publish(new Event(EventName.StateInvalidated, null));
      if (pending.length === 0) {
        this.context.projectActivity.leave(projectLease);
        return new MessageSendResult(message, []);
      }
      const execution = this.executeReplies(message, pending, project.rootPath).finally(() => {
        for (const item of pending) {
          item.run.close();
          this.runs.delete(item.message.id);
        }
        this.groups.delete(message.id);
        this.completions.delete(message.id);
        this.context.projectActivity.leave(projectLease);
      });
      void execution.then(() => completion.resolve(), error => completion.reject(error));
      return new MessageSendResult(message, pending.map(t => t.message));
    }
    catch (error) {
      try {
        if (Object.isNull(sent))
          this.attachments.discard(attachments);
        else
          this.failPendingReplies(work, error);
      }
      finally {
        if (!Object.isNull(sent)) {
          this.groups.delete(sent.id);
          this.completions.delete(sent.id);
        }
        for (const item of work) {
          item.run.close();
          this.runs.delete(item.message.id);
        }
        this.context.projectActivity.leave(projectLease);
        completion.resolve();
      }
      throw error;
    }
  }

  public reconcile(): readonly Message[] {
    const now = new Date().toISOString();
    const interrupted: Message[] = [];
    for (const open of this.messages.listOpen()) {
      const note = new MessageDetail(open.details.length, DetailKind.Note, Resources.replyInterruptedByStop, null, now);
      const message = open.withDetail(note).withStatus(MessageStatus.Interrupted, now);
      const cancelled = this.approvals.listPending(open.id).map(t => t.withCancellation(now));
      this.context.database.transaction(() => {
        this.messages.update(message);
        for (const approval of cancelled)
          this.approvals.update(approval);
      });
      this.events.publish(new Event(EventName.MessageUpdated, message.toJson()));
      for (const approval of cancelled)
        this.events.publish(new Event(EventName.ApprovalUpdated, approval.toJson()));
      interrupted.push(message);
    }

    return interrupted;
  }

  public async rewind(params: ConversationRewindParams): Promise<ConversationRewindResult> {
    const conversation = this.conversations.find(params.conversationId);
    if (Object.isNull(conversation))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatConversationNotFound(params.conversationId), [params.conversationId]);
    const project = this.projects.find(conversation.projectId);
    if (Object.isNull(project))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProjectNotFound(conversation.projectId), [conversation.projectId]);
    if (!Object.isNull(this.messages.findOpenReply(conversation.id)))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatReplyInProgress(conversation.id), [conversation.id]);
    const target = this.messages.find(params.messageId);
    if (Object.isNull(target))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatMessageNotFound(params.messageId), [params.messageId]);
    if (target.conversationId !== conversation.id)
      throw new ServiceException(ErrorCode.NotFound, Resources.formatMessageNotInConversation(target.id, conversation.id), [target.id, conversation.id]);

    const projectLease = this.context.projectActivity.enter(project.rootPath);
    try {
      const tree = await WorkingTree.capture(project.rootPath);
      const going = this.messages.list(new MessageListParams(conversation.id, target.sequence === 0 ? null : target.sequence - 1));
      const firstReply = going.find(t => t.author === MessageAuthor.Provider);
      const restoredFiles = params.restoreFiles && !Object.isNull(tree) && !Object.isUndefined(firstReply) ? await tree.restore(firstReply.id) : null;
      const history = this.messages.list(new MessageListParams(conversation.id, null));
      const kept = history.filter(t => t.sequence < target.sequence && t.author === MessageAuthor.Provider && Object.isNull(t.teammateId));
      const forked = await this.tryFork(project.rootPath, kept[kept.length - 1],
        going.filter(t => t.author === MessageAuthor.Provider && Object.isNull(t.teammateId)));
      let removed: readonly Message[] = [];
      let marked = conversation;
      this.context.database.transaction(() => {
        for (const teammateId of new Set(going.map(t => t.teammateId).filter((id): id is string => !Object.isNull(id)))) {
          const member = new ConversationMemberParams(conversation.id, teammateId);
          if (!Object.isNull(this.conversations.findMember(member)))
            this.conversations.setMemberSession(member, null, false);
        }
        removed = this.conversations.removeFrom(conversation.id, target.sequence);
        marked = Object.isNull(forked)
          ? this.conversations.setSessionReset(conversation.id, true)
          : this.conversations.setForkedSession(conversation.id, forked);
      });
      if (!Object.isNull(tree))
        for (const message of removed.filter(t => t.author === MessageAuthor.Provider))
          await tree.dropSnapshot(message.id);
      this.events.publish(new Event(EventName.ConversationRewound, new ConversationRewoundPayload(conversation.id, target.sequence).toJson()));
      this.events.publish(new Event(EventName.StateInvalidated, null));

      return new ConversationRewindResult(marked, removed.map(t => t.id), restoredFiles, !Object.isNull(forked));
    }
    finally {
      this.context.projectActivity.leave(projectLease);
    }
  }

  private async tryFork(workingDirectory: string, kept: Message | undefined, removed: readonly Message[]): Promise<ForkedSession | null> {
    const provenance = kept?.provenance;
    if (Object.isNullOrUndefined(provenance) || Object.isNull(provenance.nativeSessionId) || Object.isNull(provenance.nativeTurnId))
      return null;
    if (!this.registry.has(provenance.requested.provider) || !this.registry.get(provenance.requested.provider).descriptor.supportsFork)
      return null;
    if (removed.some(t => t.provenance?.nativeSessionId !== provenance.nativeSessionId))
      return null;
    const account = Object.isNull(provenance.providerAccountId) ? null : this.accounts.find(provenance.providerAccountId);
    if (!Object.isNull(provenance.providerAccountId) && Object.isNull(account))
      return null;
    try {
      const request = new ForkRequest(account, workingDirectory, provenance.nativeSessionId, provenance.nativeTurnId, provenance.requested);
      const forked = await this.registry.get(provenance.requested.provider).forkSession(request);
      return new ForkedSession(provenance.requested.provider, provenance.providerAccountId, forked);
    }
    catch {
      return null;
    }
  }

  public async cancel(params: MessageIdParams): Promise<Message> {
    const message = this.requireMessage(params.messageId);
    const group = this.groups.get(message.inReplyTo ?? String.empty);
    const completion = this.completions.get(message.inReplyTo ?? String.empty);
    if (Object.isUndefined(group) || Object.isUndefined(completion))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatMessageNotOpen(message.id), [message.id]);

    for (const item of group)
      item.run.cancel();
    await completion;
    return this.requireMessage(message.id);
  }

  public decide(params: ApprovalDecideParams): Approval {
    const approval = this.approvals.find(params.approvalId);
    if (Object.isNull(approval))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatApprovalNotFound(params.approvalId), [params.approvalId]);
    if (approval.status !== ApprovalStatus.Pending)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatApprovalNotPending(approval.id), [approval.id]);
    if (!approval.options.some(t => t.id === params.optionId))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatUnknownDecisionOption(approval.id, params.optionId), [approval.id, params.optionId]);

    const run = this.runs.get(approval.messageId);
    if (Object.isUndefined(run) || !run.hasDecision(approval.id))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatMessageNotOpen(approval.messageId), [approval.messageId]);

    const decided = approval.withDecision(params.optionId, new Date().toISOString());
    this.approvals.update(decided);
    this.events.publish(new Event(EventName.ApprovalUpdated, decided.toJson()));
    run.decide(decided.id, params.optionId);
    return decided;
  }

  public async waitForIdle(): Promise<void> {
    await Promise.all([...this.completions.values()]);
  }

  public async shutdown(): Promise<void> {
    for (const run of this.runs.values())
      run.cancel();
    await this.waitForIdle();
  }

  private requireTeammate(id: string): Teammate {
    const teammate = this.teammates.find(id);
    if (Object.isNull(teammate))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(id), [id]);
    return teammate;
  }

  private prepareReply(teammate: Teammate | null, params: MessageSendParams, sent: Message, sequence: number): ReplyWork | null {
    const account = Object.isNull(teammate) ? this.resolveAccount(params) : this.accounts.find(teammate.providerAccountId);
    if (!Object.isNull(teammate) && (Object.isNull(account) || account.authStatus === AuthStatus.LoggedOut || !this.registry.has(account.provider)))
      return null;
    const requested = Object.isNull(teammate) ? params.requested! : new RequestedSettings(account!.provider, teammate.model, teammate.effort);
    this.registry.get(requested.provider);
    const provenance = new Provenance(account?.id ?? null, requested, new ObservedSettings(null, null, null, null, null), null, false);
    const reply = new Message(Guid.createVersion7().toString(), sent.conversationId, sequence, MessageAuthor.Provider, sent.id,
      MessageStatus.Pending, [], provenance, sent.createdAt, null, null, [], teammate?.id ?? null, teammate?.name ?? null);
    return new ReplyWork(reply, account, teammate?.role ?? null);
  }

  private hasActiveSend(conversationId: string): boolean {
    return [...this.groups.values()].some(t => t[0]?.message.conversationId === conversationId);
  }

  private async executeReplies(sent: Message, work: readonly ReplyWork[], workingDirectory: string): Promise<void> {
    const context = new ParticipantContext(this.messages);
    try {
      for (const item of work) {
        const reply = item.message;
        if (item.run.isCancelled) {
          const now = new Date().toISOString();
          const note = new MessageDetail(0, DetailKind.Note, Resources.queuedReplyCancelled, null, now);
          const cancelled = reply.withDetail(note).withStatus(MessageStatus.Cancelled, now);
          this.messages.update(cancelled);
          this.events.publish(new Event(EventName.MessageUpdated, cancelled.toJson()));
          continue;
        }
        const conversation = this.conversations.find(reply.conversationId)!;
        const requested = reply.provenance!.requested;
        const member = Object.isNull(reply.teammateId) ? null
          : this.conversations.findMember(new ConversationMemberParams(reply.conversationId, reply.teammateId));
        const fork = Object.isNull(reply.teammateId) ? conversation.forkedSession : null;
        const useFork = !Object.isNull(fork) && fork.matches(requested.provider, item.account?.id ?? null);
        const resume = Object.isNull(reply.teammateId)
          ? (conversation.sessionReset ? null : useFork ? fork.nativeSessionId
            : this.messages.findResumableSession(reply.conversationId, requested.provider, item.account?.id ?? null))
          : member?.nativeSessionId ?? null;
        const freshPrompt = context.create(reply, sent, null);
        const prompt = Object.isNull(resume) ? freshPrompt : context.create(reply, sent, resume, useFork);
        const request = new TurnRequest(item.account, workingDirectory, prompt, requested, resume, sent.attachments, item.instructions, freshPrompt);
        const run = new ReplyRun(reply, reply.provenance!, item.run, this.messages, this.approvals,
          this.events, this.context.dataDirectory, this.conversations);
        await run.execute(this.registry.get(requested.provider), request);
        if (Object.isNull(reply.teammateId) && !Object.isNullOrUndefined(this.messages.find(reply.id)?.provenance?.nativeSessionId)) {
          if (conversation.sessionReset)
            this.conversations.setSessionReset(conversation.id, false);
          if (useFork)
            this.conversations.setForkedSession(conversation.id, null);
        }
      }
    }
    catch (error) {
      this.failPendingReplies(work, error);
      throw error;
    }
  }

  private failPendingReplies(work: readonly ReplyWork[], error: unknown): void {
    for (const item of work) {
      const current = this.messages.find(item.message.id);
      if (Object.isNull(current) || !Object.isNull(current.endedAt))
        continue;
      const now = new Date().toISOString();
      const note = new MessageDetail(current.details.length, DetailKind.Error, String(error), null, now);
      const failed = current.withDetail(note).withStatus(MessageStatus.Failed, now);
      this.messages.update(failed);
      this.events.publish(new Event(EventName.MessageUpdated, failed.toJson()));
    }
  }

  private resolveAccount(params: MessageSendParams): ProviderAccount | null {
    if (Object.isNull(params.providerAccountId))
      return null;

    const account = this.accounts.find(params.providerAccountId);
    if (Object.isNull(account))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderAccountNotFound(params.providerAccountId), [params.providerAccountId]);
    if (account.provider !== params.requested!.provider)
      throw new ServiceException(
        ErrorCode.InvalidParams,
        Resources.formatProviderAccountMismatch(account.id, params.requested!.provider),
        [account.id, params.requested!.provider]);

    return account;
  }

  private requireMessage(messageId: string): Message {
    const message = this.messages.find(messageId);
    if (Object.isNull(message))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatMessageNotFound(messageId), [messageId]);

    return message;
  }

}
