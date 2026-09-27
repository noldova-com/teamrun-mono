/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, computed, effect, inject, signal } from "@angular/core";
import { ComposerDraftsService } from "./composer-drafts.service";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  Approval,
  AuthStatus,
  ConversationMember,
  ConversationMemberParams,
  Teammate,
  TeammateCreateParams,
  TeammateUpdateParams,
  TeammateIdParams,
  ApprovalDecideParams,
  ApprovalOutcome,
  ApprovalStatus,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMoveParams,
  ConversationRenameParams,
  ConversationRewindParams,
  ConversationRewindResult,
  ConversationRewoundPayload,
  ConversationSearchHit,
  ConversationSearchParams,
  ConversationSearchResult,
  DetailEventPayload,
  type Event,
  EventName,
  Message,
  type MessageDetail,
  MessageIdParams,
  MessagePage,
  MessagePageParams,
  MessageSendParams,
  type AttachmentInput,
  MessageAttachment,
  MessageSendResult,
  MessageStatus,
  MethodName,
  Project,
  ProjectIdParams,
  ProjectOpenParams,
  ProviderAccount,
  ProviderAccountCreateParams,
  ProviderAccountIdParams,
  ProviderDescriptor,
  ProviderModel,
  ProviderListModelsParams
} from "@noldova/teamrun-protocol";

import { AccessMode } from "../enums/access-mode";
import type { ComposerSettings } from "../models/composer-settings";
import { ReadingPosition } from "../models/reading-position";
import { MessageIndex } from "../models/message-index";
import type { MessageIndexEntry } from "../models/message-index-entry";
import type { MessageControlState } from "../models/message-control-state";
import { Resources } from "../resources";
import { BridgeService } from "./bridge.service";
import { Formatter } from "./formatter.service";
import { PreferencesService } from "./preferences.service";

@Injectable({ providedIn: "root" })
export class ChatStore {
  private readonly composerDrafts: ComposerDraftsService = inject(ComposerDraftsService);
  public async prepareAttachment(input: AttachmentInput): Promise<MessageAttachment> {
    return MessageAttachment.fromJson(await this.bridge.call(MethodName.AttachmentPrepare, input.toJson()));
  }

  public async discardAttachment(attachment: MessageAttachment): Promise<void> {
    try {
      await this.bridge.call(MethodName.AttachmentDiscard, attachment.toJson());
    }
    catch {
    }
  }
  private static readonly activeStatuses: readonly MessageStatus[] = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval];

  private readonly bridge: BridgeService = inject(BridgeService);
  private readonly formatter: Formatter = inject(Formatter);
  private readonly providersSignal: WritableSignal<readonly ProviderDescriptor[]> = signal([]);
  private readonly accountsSignal: WritableSignal<readonly ProviderAccount[]> = signal([]);
  private readonly teammatesSignal = signal<readonly Teammate[]>([]);
  private readonly membersSignal = signal<readonly ConversationMember[]>([]);
  private membersGeneration: number = 0;
  private readonly projectsSignal: WritableSignal<readonly Project[]> = signal([]);
  private readonly conversationsByProjectSignal: WritableSignal<ReadonlyMap<string, readonly Conversation[]>> = signal(new Map());
  private readonly messagesSignal: WritableSignal<readonly Message[]> = signal([]);
  private readonly messageIndexes = new Map<string, MessageIndex>();
  private readonly messageIndexSignal = signal<readonly MessageIndexEntry[]>([]);
  private readonly hasEarlierMessagesSignal: WritableSignal<boolean> = signal(false);
  private readonly hasLaterMessagesSignal: WritableSignal<boolean> = signal(false);
  private readonly loadingPageSignal: WritableSignal<boolean> = signal(false);
  private readonly positions: Map<string, ReadingPosition> = new Map();
  private readonly pendingPositionSignal: WritableSignal<ReadingPosition | null> = signal(null);
  private readonly approvalsSignal: WritableSignal<readonly Approval[]> = signal([]);
  private readonly selectedProjectIdSignal: WritableSignal<string | null> = signal(null);
  private readonly selectedConversationIdSignal: WritableSignal<string | null> = signal(null);
  private readonly errorSignal: WritableSignal<string | null> = signal(null);
  private readonly focusMessageIdSignal: WritableSignal<string | null> = signal(null);
  private readonly workingSignal: WritableSignal<ReadonlyMap<string, Message>> = signal(new Map());
  private selectionGeneration: number = 0;
  private pageGeneration: number = 0;
  private requestedConversationId: string | null = null;
  private readonly snapshots: Set<Map<string, Event>> = new Set();
  private catalogReload: Promise<boolean> | null = null;
  private catalogDirty: boolean = false;
  private resyncRequested: boolean = false;
  private disposed: boolean = false;
  private readonly busySignal: WritableSignal<number> = signal(0);
  private readonly loadedSignal: WritableSignal<boolean> = signal(false);
  private readonly preferences: PreferencesService = inject(PreferencesService);
  private readonly granted: Set<string> = new Set();
  private unsubscribe: (() => void) | null = null;

  public readonly providers: Signal<readonly ProviderDescriptor[]> = this.providersSignal.asReadonly();
  public readonly accounts: Signal<readonly ProviderAccount[]> = this.accountsSignal.asReadonly();
  public readonly teammates = this.teammatesSignal.asReadonly();
  public readonly projects: Signal<readonly Project[]> = this.projectsSignal.asReadonly();
  public readonly conversations: Signal<readonly Conversation[]> = computed(() => this.conversationsOf(this.selectedProjectId()));
  public readonly messages: Signal<readonly Message[]> = this.messagesSignal.asReadonly();
  public readonly messageIndex = this.messageIndexSignal.asReadonly();
  public readonly hasEarlierMessages: Signal<boolean> = this.hasEarlierMessagesSignal.asReadonly();
  public readonly hasLaterMessages: Signal<boolean> = this.hasLaterMessagesSignal.asReadonly();
  public readonly loadingPage: Signal<boolean> = this.loadingPageSignal.asReadonly();
  public readonly pendingPosition: Signal<ReadingPosition | null> = this.pendingPositionSignal.asReadonly();
  public readonly selectedProjectId: Signal<string | null> = this.selectedProjectIdSignal.asReadonly();
  public readonly selectedConversationId: Signal<string | null> = this.selectedConversationIdSignal.asReadonly();
  public readonly error: Signal<string | null> = this.errorSignal.asReadonly();
  public readonly loaded: Signal<boolean> = this.loadedSignal.asReadonly();
  public readonly focusMessageId: Signal<string | null> = this.focusMessageIdSignal.asReadonly();
  public readonly isBusy: Signal<boolean> = computed(() => this.busySignal() > 0);
  public readonly isAvailable: boolean = this.bridge.isAvailable;

  public readonly selectedProject: Signal<Project | null> = computed(() => this.projects().find(t => t.id === this.selectedProjectId()) ?? null);
  public readonly selectedConversation: Signal<Conversation | null> = computed(() => this.findConversation(this.selectedConversationId()));
  public readonly recentConversations: Signal<readonly Conversation[]> = computed(() =>
    ChatStore.newestFirst([...this.conversationsByProjectSignal().values()].flat()).slice(0, Resources.recentCount));
  public readonly pendingApprovals: Signal<readonly Approval[]> = computed(() => this.approvalsSignal().filter(t => t.status === ApprovalStatus.Pending));
  public readonly workingReplies: Signal<readonly Message[]> = computed(() => [...this.workingSignal().values()]);
  public readonly runningReply: Signal<Message | null> = computed(() => {
    const replies = [...this.workingSignal().values()].filter(t => t.conversationId === this.selectedConversationId())
      .sort((a, b) => a.sequence - b.sequence);
    return replies.find(t => t.status !== MessageStatus.Pending) ?? replies[0] ?? null;
  });

  public constructor() {
    effect(() => {
      if (this.preferences.accessMode() !== AccessMode.Full)
        return;
      for (const approval of this.pendingApprovals())
        this.grant(approval);
    });
  }

  public async initialize(): Promise<void> {
    this.disposed = false;
    this.unsubscribe ??= this.bridge.subscribe(event => this.apply(event));
    await this.perform(async () => {
      this.providersSignal.set(ChatStore.readArray(await this.bridge.call(MethodName.ProviderList, null), ProviderDescriptor.fromJson));
      await this.reloadCatalog();
    });
    const first = this.projects()[0];
    if (!Object.isUndefined(first) && Object.isNull(this.selectedProjectId()))
      this.selectedProjectIdSignal.set(first.id);
  }

  public hasConversation(conversationId: string): boolean {
    return !Object.isNull(this.findConversation(conversationId));
  }

  public conversation(conversationId: string): Conversation | null {
    return this.findConversation(conversationId);
  }

  public conversationsOf(projectId: string | null): readonly Conversation[] {
    return Object.isNull(projectId) ? [] : this.conversationsByProjectSignal().get(projectId) ?? [];
  }

  public newestConversationsOf(projectId: string | null): readonly Conversation[] {
    return ChatStore.newestFirst(this.conversationsOf(projectId));
  }

  private static newestFirst(conversations: readonly Conversation[]): readonly Conversation[] {
    return conversations.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public dispose(): void {
    this.disposed = true;
    this.selectionGeneration += 1;
    this.snapshots.clear();
    this.messageIndexes.clear();
    this.messageIndexSignal.set([]);
    this.messagesSignal.set([]);
    if (!Object.isNull(this.unsubscribe))
      this.unsubscribe();
    this.unsubscribe = null;
  }

  public isWorking(conversationId: string): boolean {
    return [...this.workingSignal().values()].some(t => t.conversationId === conversationId);
  }

  public focusMessage(messageId: string | null): void {
    this.focusMessageIdSignal.set(messageId);
  }

  public async loadEarlierMessages(): Promise<void> {
    const conversationId = this.selectedConversationId();
    const first = this.messages()[0];
    if (Object.isNull(conversationId) || Object.isUndefined(first) || !this.hasEarlierMessages() || this.loadingPage())
      return;

    await this.loadPage(conversationId, () => this.fetchPage(conversationId, first.sequence, null), page => {
      this.rememberPage(page);
      const messages = ChatStore.merge(page.messages, this.messages());
      this.messagesSignal.set(messages.slice(0, Resources.messageHistoryLimit));
      if (messages.length > Resources.messageHistoryLimit)
        this.hasLaterMessagesSignal.set(true);
      this.hasEarlierMessagesSignal.set(page.hasEarlier);
    });
  }

  public async loadLaterMessages(): Promise<void> {
    const conversationId = this.selectedConversationId();
    const last = this.messages().at(-1);
    if (Object.isNull(conversationId) || Object.isUndefined(last) || !this.hasLaterMessages() || this.loadingPage())
      return;

    await this.loadPage(conversationId, () => this.fetchPage(conversationId, null, last.sequence), page => {
      this.rememberPage(page);
      const messages = ChatStore.merge(this.messages(), page.messages);
      this.messagesSignal.set(messages.slice(-Resources.messageHistoryLimit));
      if (messages.length > Resources.messageHistoryLimit)
        this.hasEarlierMessagesSignal.set(true);
      this.hasLaterMessagesSignal.set(page.hasLater);
    });
  }

  public async loadNewestMessages(): Promise<void> {
    const conversationId = this.selectedConversationId();
    if (Object.isNull(conversationId))
      return;

    await this.loadPage(conversationId, () => this.fetchPage(conversationId, null, null), page => this.setWindow(page));
  }

  public async loadMessagesAt(sequence: number): Promise<void> {
    const conversationId = this.selectedConversationId();
    if (!Object.isNull(conversationId) && !this.loadingPage())
      await this.loadPage(conversationId, () => this.fetchAround(conversationId, sequence), page => this.setWindow(page));
  }

  public rememberMessageControls(messageId: string, controls: MessageControlState): void {
    const conversationId = this.selectedConversationId();
    const entry = Object.isNull(conversationId) ? null : this.messageIndexes.get(conversationId)?.find(messageId) ?? null;
    if (!Object.isNull(entry))
      entry.controls = controls.hasChanges ? controls : null;
  }

  public async showMessage(hit: ConversationSearchHit): Promise<void> {
    await this.selectConversation(hit.conversationId);
    const sequence = hit.sequence;
    if (Object.isNull(hit.messageId) || hit.conversationId !== this.selectedConversationId())
      return;
    if (!this.messages().some(t => t.id === hit.messageId) && !Object.isNull(sequence))
      await this.loadPage(hit.conversationId, () => this.fetchAround(hit.conversationId, sequence), page => this.setWindow(page));
    this.focusMessage(hit.messageId);
  }

  public rememberPosition(conversationId: string, position: ReadingPosition | null): void {
    if (Object.isNull(position))
      this.positions.delete(conversationId);
    else
      this.positions.set(conversationId, position);
  }

  public forgetPosition(conversationId: string): void {
    this.positions.delete(conversationId);
    this.messageIndexes.delete(conversationId);
  }

  public consumePosition(): void {
    this.pendingPositionSignal.set(null);
  }

  private async fetchAround(conversationId: string, sequence: number): Promise<MessagePage> {
    const before = await this.fetchPage(conversationId, sequence + 1, null);
    const after = await this.fetchPage(conversationId, null, sequence);
    return new MessagePage(ChatStore.merge(before.messages, after.messages), before.hasEarlier, after.hasLater);
  }

  public dismissError(): void {
    this.errorSignal.set(null);
  }

  public apply(event: Event): void {
    switch (event.name) {
      case EventName.MessageCreated:
      case EventName.MessageUpdated: {
        const message = Message.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.MessageUpdated, message.id]));
        this.trackWorking(message);
        this.upsertMessage(message);
        break;
      }
      case EventName.DetailAppended:
      case EventName.DetailUpdated: {
        const payload = DetailEventPayload.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.DetailUpdated, payload.messageId, payload.detail.sequence]));
        this.applyDetail(payload);
        break;
      }
      case EventName.ApprovalCreated:
      case EventName.ApprovalUpdated: {
        const approval = Approval.fromJson(event.payload);
        this.captureEvent(event, JSON.stringify([EventName.ApprovalUpdated, approval.id]));
        this.upsertApproval(approval);
        break;
      }
      case EventName.ProviderAccountUpdated:
        this.captureEvent(event, JSON.stringify([EventName.ProviderAccountUpdated, ProviderAccount.fromJson(event.payload).id]));
        this.accountsSignal.update(accounts => ChatStore.upsert(accounts, ProviderAccount.fromJson(event.payload)));
        break;
      case EventName.ConversationRewound:
        this.captureEvent(event, JSON.stringify([EventName.ConversationRewound, event.payload]));
        this.applyRewound(ConversationRewoundPayload.fromJson(event.payload));
        break;
      case EventName.StateInvalidated:
      case EventName.StateResyncRequested:
        if (!this.disposed) {
          this.resyncRequested ||= event.name === EventName.StateResyncRequested;
          void this.reloadCatalog();
        }
        break;
      default:
        break;
    }
  }

  public async openProject(rootPath: string): Promise<void> {
    await this.perform(async () => {
      const project = Project.fromJson(await this.bridge.call(MethodName.ProjectOpen, new ProjectOpenParams(rootPath).toJson()));
      this.projectsSignal.update(projects => ChatStore.upsert(projects, project));
      await this.loadConversations(project.id);
      await this.showProject(project.id);
    });
  }

  public async selectProject(projectId: string): Promise<void> {
    if (projectId === this.selectedProjectId())
      return;
    await this.perform(() => this.showProject(projectId));
  }

  public async forgetProject(projectId: string): Promise<void> {
    const removedConversations = this.conversationsOf(projectId).map(t => t.id);
    await this.perform(async () => {
      await this.bridge.call(MethodName.ProjectForget, new ProjectIdParams(projectId).toJson());
      for (const id of removedConversations)
        await this.composerDrafts.forget(id);
      this.projectsSignal.update(projects => projects.filter(t => t.id !== projectId));
      this.conversationsByProjectSignal.update(map => {
        const next = new Map(map);
        next.delete(projectId);
        return next;
      });
      if (this.selectedProjectId() === projectId) {
        this.selectedProjectIdSignal.set(null);
        this.deselectConversation();
      }
    });
  }

  public async createConversation(title: string | null, projectId: string | null = this.selectedProjectId()): Promise<Conversation | null> {
    if (Object.isNull(projectId))
      return null;

    let created: Conversation | null = null;
    await this.perform(async () => {
      const params = new ConversationCreateParams(projectId, title);
      const conversation = Conversation.fromJson(await this.bridge.call(MethodName.ConversationCreate, params.toJson()));
      this.storeConversation(conversation);
      this.selectedProjectIdSignal.set(projectId);
      await this.loadMessages(conversation.id);
      created = conversation;
    });
    return created;
  }

  public teammate(id: string | null): Teammate | null {
    return this.teammates().find(t => t.id === id) ?? null;
  }

  public membersOf(conversationId: string | null): readonly ConversationMember[] {
    return this.membersSignal().filter(t => t.conversationId === conversationId);
  }

  public isTeammateUnavailable(id: string): boolean {
    const teammate = this.teammate(id);
    const account = this.accounts().find(t => t.id === teammate?.providerAccountId);
    return Object.isUndefined(account) || account.authStatus === AuthStatus.LoggedOut || !this.providers().some(t => t.id === account.provider);
  }

  public async saveTeammate(params: TeammateCreateParams | TeammateUpdateParams): Promise<boolean> {
    const succeeded = await this.perform(async () => {
      const method = params instanceof TeammateUpdateParams ? MethodName.TeammateUpdate : MethodName.TeammateCreate;
      const teammate = Teammate.fromJson(await this.bridge.call(method, params.toJson()));
      this.teammatesSignal.update(items => ChatStore.upsert(items, teammate));
    });
    if (!succeeded)
      this.errorSignal.set(Resources.formatTeammateError(params.name, this.error() ?? String.empty));
    return succeeded;
  }

  public async deleteTeammate(teammate: Teammate): Promise<boolean> {
    const succeeded = await this.perform(async () => {
      await this.bridge.call(MethodName.TeammateDelete, new TeammateIdParams(teammate.id).toJson());
      this.teammatesSignal.update(items => items.filter(t => t.id !== teammate.id));
      this.membersSignal.update(items => items.filter(t => t.teammateId !== teammate.id));
    });
    if (!succeeded)
      this.errorSignal.set(Resources.formatTeammateError(teammate.name, this.error() ?? String.empty));
    return succeeded;
  }

  public async addMember(conversationId: string, teammateId: string): Promise<boolean> {
    return this.perform(async () => {
      await this.bridge.call(MethodName.ConversationAddMember, new ConversationMemberParams(conversationId, teammateId).toJson());
      await this.loadMembers(conversationId);
    });
  }

  public async removeMember(conversationId: string, teammateId: string): Promise<boolean> {
    return this.perform(async () => {
      await this.bridge.call(MethodName.ConversationRemoveMember, new ConversationMemberParams(conversationId, teammateId).toJson());
      await this.loadMembers(conversationId);
    });
  }

  private async loadMembers(conversationId: string): Promise<void> {
    if (conversationId !== this.requestedConversationId)
      return;
    const generation = this.selectionGeneration;
    const ticket = ++this.membersGeneration;
    const result = await this.bridge.call(MethodName.ConversationListMembers, new ConversationIdParams(conversationId).toJson());
    if (!this.disposed && generation === this.selectionGeneration && ticket === this.membersGeneration && conversationId === this.requestedConversationId)
      this.membersSignal.set(ChatStore.readArray(result, ConversationMember.fromJson));
  }

  public async selectConversation(conversationId: string): Promise<void> {
    const conversation = this.findConversation(conversationId);
    if (Object.isNull(conversation) || (conversationId === this.selectedConversationId() && conversationId === this.requestedConversationId))
      return;

    await this.perform(async () => {
      this.selectedProjectIdSignal.set(conversation.projectId);
      await this.loadMessages(conversationId);
    });
  }

  public async moveConversation(conversationId: string, projectId: string): Promise<void> {
    await this.perform(async () => {
      const params = new ConversationMoveParams(conversationId, projectId);
      const conversation = Conversation.fromJson(await this.bridge.call(MethodName.ConversationMove, params.toJson()));
      this.storeConversation(conversation);
    });
  }

  public async renameConversation(conversationId: string, title: string): Promise<void> {
    await this.perform(async () => {
      const params = new ConversationRenameParams(conversationId, title);
      const conversation = Conversation.fromJson(await this.bridge.call(MethodName.ConversationRename, params.toJson()));
      this.storeConversation(conversation);
    });
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    await this.perform(async () => {
      await this.bridge.call(MethodName.ConversationDelete, new ConversationIdParams(conversationId).toJson());
      await this.composerDrafts.forget(conversationId);
      this.conversationsByProjectSignal.update(map => {
        const next = new Map(map);
        for (const [projectId, conversations] of map)
          next.set(projectId, conversations.filter(t => t.id !== conversationId));
        return next;
      });
      if (this.selectedConversationId() === conversationId)
        this.deselectConversation();
    });
  }

  public async send(text: string, settings: ComposerSettings, conversationId: string | null = this.selectedConversationId(),
    attachments: readonly AttachmentInput[] = [], mentionedTeammateIds: readonly string[] = [],
    responderTeammateId: string | null = null): Promise<boolean> {
    if (Object.isNull(conversationId))
      return false;

    if (this.hasLaterMessages())
      await this.loadNewestMessages();
    const isFirst = this.messages().length === 0;
    const succeeded = await this.perform(async () => {
      const events = this.beginSnapshot();
      try {
        const named = mentionedTeammateIds.length > 0 || !Object.isNull(responderTeammateId);
        const params = new MessageSendParams(conversationId, text, named ? null : settings.toRequested(),
          named ? null : settings.providerAccountId, attachments, mentionedTeammateIds, responderTeammateId);
        const result = MessageSendResult.fromJson(await this.bridge.call(MethodName.MessageSend, params.toJson()));
        this.upsertMessage(result.sent);
        for (const reply of result.replies) {
          this.trackWorking(reply);
          this.upsertMessage(reply);
        }
        this.replaySnapshot(events);
      }
      finally {
        this.snapshots.delete(events);
      }
    });
    if (succeeded && mentionedTeammateIds.length > 0)
      await this.perform(() => this.loadMembers(conversationId));
    if (succeeded && isFirst && this.findConversation(conversationId)?.title === Resources.newConversationTitle)
      await this.renameConversation(conversationId, this.formatter.conversationTitle(text || attachments[0]?.name || Resources.newConversationTitle));
    return succeeded;
  }

  public async search(query: string): Promise<readonly ConversationSearchHit[]> {
    if (String.isNullOrWhitespace(query))
      return [];
    const params = new ConversationSearchParams(query.trim(), Resources.searchLimit);

    return ConversationSearchResult.fromJson(await this.bridge.call(MethodName.ConversationSearch, params.toJson())).hits;
  }

  public async rewind(messageId: string, restoreFiles: boolean): Promise<ConversationRewindResult | null> {
    const conversationId = this.selectedConversationId();
    if (Object.isNull(conversationId))
      return null;
    const fromSequence = this.messageIndexes.get(conversationId)?.find(messageId)?.sequence;
    let result: ConversationRewindResult | null = null;
    await this.perform(async () => {
      const params = new ConversationRewindParams(conversationId, messageId, restoreFiles);
      result = ConversationRewindResult.fromJson(await this.bridge.call(MethodName.ConversationRewind, params.toJson()));
      this.storeConversation(result.conversation);
      if (!Object.isUndefined(fromSequence))
        this.applyRewound(new ConversationRewoundPayload(conversationId, fromSequence));
      const removed = new Set(result.removedMessageIds);
      this.messagesSignal.update(messages => messages.filter(t => !removed.has(t.id)));
      this.approvalsSignal.update(approvals => approvals.filter(t => !removed.has(t.messageId)));
    });

    return result;
  }

  public async cancel(messageId: string): Promise<void> {
    await this.perform(async () => {
      const message = Message.fromJson(await this.bridge.call(MethodName.MessageCancel, new MessageIdParams(messageId).toJson()));
      this.trackWorking(message);
      this.upsertMessage(message);
    });
  }

  private grant(approval: Approval): void {
    const option = approval.options.find(t => t.outcome === ApprovalOutcome.Approved);
    if (Object.isUndefined(option) || this.granted.has(approval.id))
      return;
    this.granted.add(approval.id);
    void this.decide(approval.id, option.id).finally(() => this.granted.delete(approval.id));
  }

  public async decide(approvalId: string, optionId: string): Promise<void> {
    await this.perform(async () => {
      this.upsertApproval(Approval.fromJson(await this.bridge.call(MethodName.ApprovalDecide, new ApprovalDecideParams(approvalId, optionId).toJson())));
    });
  }

  public async addAccount(provider: string, label: string, profileDir: string): Promise<boolean> {
    return this.perform(async () => {
      const params = new ProviderAccountCreateParams(provider, label, profileDir);
      const account = ProviderAccount.fromJson(await this.bridge.call(MethodName.ProviderAccountCreate, params.toJson()));
      this.accountsSignal.update(accounts => ChatStore.upsert(accounts, account));
    });
  }

  public async checkAccount(providerAccountId: string): Promise<void> {
    await this.perform(async () => {
      const params = new ProviderAccountIdParams(providerAccountId);
      const account = ProviderAccount.fromJson(await this.bridge.call(MethodName.ProviderAccountCheck, params.toJson()));
      this.accountsSignal.update(accounts => ChatStore.upsert(accounts, account));
    });
  }

  public async removeAccount(providerAccountId: string): Promise<void> {
    await this.perform(async () => {
      await this.bridge.call(MethodName.ProviderAccountDelete, new ProviderAccountIdParams(providerAccountId).toJson());
      this.accountsSignal.update(accounts => accounts.filter(t => t.id !== providerAccountId));
    });
  }

  public async listModels(provider: string, providerAccountId: string | null): Promise<readonly ProviderModel[]> {
    const payload = await this.bridge.call(MethodName.ProviderModelCatalog, new ProviderListModelsParams(provider, providerAccountId).toJson());
    if (!Array.isArray(payload))
      throw new TypeError(Resources.modelCatalogUnavailable);
    return payload.map(value => ProviderModel.fromJson(value));
  }

  public pickDirectory(): Promise<string | null> {
    return this.bridge.pickDirectory();
  }

  public async openFolder(): Promise<void> {
    const path = await this.pickDirectory();
    if (!Object.isNull(path))
      await this.openProject(path);
  }

  public async startConversation(): Promise<void> {
    if (Object.isNull(this.selectedProjectId())) {
      await this.openFolder();
      if (Object.isNull(this.selectedProjectId()))
        return;
    }
    await this.createConversation(null);
  }

  public async stepConversation(offset: number): Promise<void> {
    const recents = this.recentConversations();
    const index = recents.findIndex(t => t.id === this.selectedConversationId());
    const target = recents[index < 0 ? 0 : Math.min(recents.length - 1, Math.max(0, index + offset))];
    if (!Object.isUndefined(target) && target.id !== this.selectedConversationId())
      await this.selectConversation(target.id);
  }

  private async loadConversations(projectId: string): Promise<void> {
    const listed = await this.bridge.call(MethodName.ConversationList, new ProjectIdParams(projectId).toJson());
    const conversations = ChatStore.readArray(listed, Conversation.fromJson);
    this.conversationsByProjectSignal.update(map => new Map(map).set(projectId, conversations));
  }

  private reloadCatalog(): Promise<boolean> {
    this.catalogDirty = true;
    if (!Object.isNull(this.catalogReload))
      return this.catalogReload;
    const reload = this.perform(async () => {
      do {
        this.catalogDirty = false;
        await this.readCatalog();
        if (!this.catalogDirty && this.resyncRequested && !this.disposed) {
          this.resyncRequested = false;
          const selected = this.selectedConversationId();
          if (!Object.isNull(selected) && this.requestedConversationId === selected)
            await this.loadMessages(selected);
        }
      } while (this.catalogDirty && !this.disposed);
    });
    this.catalogReload = reload;
    void reload.finally(() => this.catalogReload = null);
    return reload;
  }

  private async readCatalog(): Promise<void> {
    const events = this.beginSnapshot();
    try {
      const accounts = ChatStore.readArray(await this.bridge.call(MethodName.ProviderAccountList, null), ProviderAccount.fromJson);
      const teammates = ChatStore.readArray(await this.bridge.call(MethodName.TeammateList, null), Teammate.fromJson);
      const projects = ChatStore.readArray(await this.bridge.call(MethodName.ProjectList, null), Project.fromJson);
      const conversations = new Map<string, readonly Conversation[]>();
      await Promise.all(projects.map(async t => {
        const listed = await this.bridge.call(MethodName.ConversationList, new ProjectIdParams(t.id).toJson());
        conversations.set(t.id, ChatStore.readArray(listed, Conversation.fromJson));
      }));
      const open = ChatStore.readArray(await this.bridge.call(MethodName.MessageListOpen, null), Message.fromJson);
      const approvals = ChatStore.readArray(await this.bridge.call(MethodName.ApprovalListPending, null), Approval.fromJson);
      if (this.disposed)
        return;
      this.accountsSignal.set(accounts);
      this.teammatesSignal.set(teammates);
      this.projectsSignal.set(projects);
      this.conversationsByProjectSignal.set(conversations);
      this.workingSignal.set(new Map(open.map(t => [t.id, t])));
      this.approvalsSignal.set(approvals);
      this.replaySnapshot(events);
      this.loadedSignal.set(true);
      const selected = this.findConversation(this.selectedConversationId());
      if (!Object.isNull(selected) && this.requestedConversationId === selected.id)
        this.selectedProjectIdSignal.set(selected.projectId);
      else if (Object.isNull(selected) && !Object.isNull(this.selectedConversationId()))
        this.deselectConversation();
      if (!projects.some(t => t.id === this.selectedProjectId()))
        this.selectedProjectIdSignal.set(null);
      const existing = new Set([...conversations.values()].flat().map(t => t.id));
      for (const id of this.positions.keys())
        if (!existing.has(id))
          this.positions.delete(id);
      for (const id of this.messageIndexes.keys())
        if (!existing.has(id))
          this.messageIndexes.delete(id);
      if (!Object.isNull(selected))
        await this.loadMembers(selected.id);
    }
    finally {
      this.snapshots.delete(events);
    }
  }

  private beginSnapshot(): Map<string, Event> {
    const events = new Map<string, Event>();
    this.snapshots.add(events);
    return events;
  }

  private captureEvent(event: Event, key: string): void {
    for (const snapshot of this.snapshots) {
      snapshot.delete(key);
      snapshot.set(key, event);
    }
  }

  private replaySnapshot(events: Map<string, Event>): void {
    this.snapshots.delete(events);
    for (const event of events.values())
      this.apply(event);
  }

  private async showProject(projectId: string): Promise<void> {
    this.selectedProjectIdSignal.set(projectId);
    this.deselectConversation();
    const first = this.conversationsOf(projectId)[0];
    if (!Object.isUndefined(first))
      await this.loadMessages(first.id);
  }

  private trackWorking(message: Message): void {
    const active = ChatStore.activeStatuses.includes(message.status);
    if (!active && !this.workingSignal().has(message.id))
      return;
    this.workingSignal.update(map => {
      const next = new Map(map);
      if (active)
        next.set(message.id, message);
      else
        next.delete(message.id);
      return next;
    });
  }

  private storeConversation(conversation: Conversation): void {
    this.conversationsByProjectSignal.update(map => {
      const next = new Map(map);
      for (const [projectId, listed] of next)
        if (projectId !== conversation.projectId && listed.some(t => t.id === conversation.id))
          next.set(projectId, listed.filter(t => t.id !== conversation.id));
      next.set(conversation.projectId, ChatStore.upsert(next.get(conversation.projectId) ?? [], conversation));
      return next;
    });
    if (this.selectedConversationId() === conversation.id)
      this.selectedProjectIdSignal.set(conversation.projectId);
  }

  private findConversation(conversationId: string | null): Conversation | null {
    if (Object.isNull(conversationId))
      return null;
    for (const conversations of this.conversationsByProjectSignal().values()) {
      const found = conversations.find(t => t.id === conversationId);
      if (!Object.isUndefined(found))
        return found;
    }
    return null;
  }

  private async loadMessages(conversationId: string): Promise<void> {
    const generation = ++this.selectionGeneration;
    this.pageGeneration += 1;
    this.loadingPageSignal.set(false);
    this.requestedConversationId = conversationId;
    const events = this.beginSnapshot();
    try {
      const position = this.positions.get(conversationId);
      const page = Object.isUndefined(position) ? await this.fetchPage(conversationId, null, null) : await this.fetchAround(conversationId, position.sequence);
      if (generation !== this.selectionGeneration)
        return;
      const listedApprovals = await this.bridge.call(MethodName.ApprovalList, new ConversationIdParams(conversationId).toJson());
      if (generation !== this.selectionGeneration)
        return;
      const approvals = ChatStore.readArray(listedApprovals, Approval.fromJson);
      await this.loadMembers(conversationId);
      if (generation !== this.selectionGeneration)
        return;
      this.pendingPositionSignal.set(!Object.isUndefined(position) && page.messages.some(t => t.id === position.messageId) ? position : null);
      this.selectedConversationIdSignal.set(conversationId);
      const conversation = this.findConversation(conversationId);
      if (!Object.isNull(conversation))
        this.selectedProjectIdSignal.set(conversation.projectId);
      this.setWindow(page);
      for (const approval of approvals)
        this.upsertApproval(approval);
      for (const message of page.messages)
        this.trackWorking(message);
      this.replaySnapshot(events);
    }
    finally {
      this.snapshots.delete(events);
    }
  }

  private async fetchPage(conversationId: string, beforeSequence: number | null, afterSequence: number | null): Promise<MessagePage> {
    const params = new MessagePageParams(conversationId, beforeSequence, afterSequence, Resources.messagePageSize);
    return MessagePage.fromJson(await this.bridge.call(MethodName.MessagePage, params.toJson()));
  }

  private async loadPage(conversationId: string, fetch: () => Promise<MessagePage>, apply: (page: MessagePage) => void): Promise<void> {
    const generation = this.selectionGeneration;
    const pageGeneration = ++this.pageGeneration;
    const events = this.beginSnapshot();
    this.loadingPageSignal.set(true);
    try {
      await this.perform(async () => {
        const page = await fetch();
        if (this.selectedConversationId() === conversationId && generation === this.selectionGeneration && pageGeneration === this.pageGeneration) {
          apply(page);
          this.replaySnapshot(events);
        }
      });
    }
    finally {
      this.snapshots.delete(events);
      if (generation === this.selectionGeneration && pageGeneration === this.pageGeneration)
        this.loadingPageSignal.set(false);
    }
  }

  private setWindow(page: MessagePage): void {
    this.rememberPage(page);
    this.messagesSignal.set(page.messages.slice(-Resources.messageHistoryLimit));
    this.hasEarlierMessagesSignal.set(page.hasEarlier);
    this.hasLaterMessagesSignal.set(page.hasLater);
  }

  public deselectConversation(): void {
    this.selectionGeneration += 1;
    this.loadingPageSignal.set(false);
    this.requestedConversationId = null;
    this.selectedConversationIdSignal.set(null);
    this.setWindow(new MessagePage([], false, false));
  }

  private upsertMessage(message: Message): void {
    if (message.conversationId !== this.selectedConversationId())
      return;

    const index = this.indexFor(message.conversationId);
    const messages = this.messages();
    const last = messages.at(-1);
    const held = messages.some(t => t.id === message.id);
    const beyond = !this.hasLaterMessages() && (Object.isUndefined(last) || message.sequence > last.sequence);
    if (held || beyond || !Object.isNull(index.find(message.id)) || message.sequence === (index.entries.at(-1)?.sequence ?? -1) + 1) {
      index.rememberMessage(message);
      this.messageIndexSignal.set(index.entries);
    }
    if (!held && !beyond)
      return;
    if (!held && messages.length >= Resources.messageHistoryLimit && this.positions.has(message.conversationId)) {
      this.hasLaterMessagesSignal.set(true);
      return;
    }

    const next = ChatStore.upsert(messages, message).toSorted((a, b) => a.sequence - b.sequence);
    this.messagesSignal.set(next.slice(-Resources.messageHistoryLimit));
    if (next.length > Resources.messageHistoryLimit)
      this.hasEarlierMessagesSignal.set(true);
  }

  private static merge(first: readonly Message[], second: readonly Message[]): readonly Message[] {
    const byId = new Map<string, Message>();
    for (const message of [...first, ...second])
      byId.set(message.id, message);
    return [...byId.values()].toSorted((a, b) => a.sequence - b.sequence);
  }

  private applyRewound(payload: ConversationRewoundPayload): void {
    const index = this.messageIndexes.get(payload.conversationId);
    index?.removeFrom(payload.fromSequence);
    const position = this.positions.get(payload.conversationId);
    if (!Object.isUndefined(position) && position.sequence >= payload.fromSequence)
      this.positions.delete(payload.conversationId);
    if (payload.conversationId !== this.selectedConversationId())
      return;
    this.messageIndexSignal.set(index?.entries ?? []);
    const pending = this.pendingPosition();
    if (!Object.isNull(pending) && pending.sequence >= payload.fromSequence)
      this.pendingPositionSignal.set(null);
    const kept = this.messages().filter(t => t.sequence < payload.fromSequence);
    const removedIds = new Set(this.messages().filter(t => t.sequence >= payload.fromSequence).map(t => t.id));
    this.messagesSignal.set(kept);
    this.hasLaterMessagesSignal.set(false);
    this.approvalsSignal.update(approvals => approvals.filter(t => !removedIds.has(t.messageId)));
  }

  private applyDetail(payload: DetailEventPayload): void {
    const held = this.messages().find(t => t.id === payload.messageId);
    if (!Object.isUndefined(held))
      this.messagesSignal.update(list => ChatStore.upsert(list, ChatStore.withAppliedDetail(held, payload.detail)));
  }

  private static withAppliedDetail(message: Message, detail: MessageDetail): Message {
    return message.withDetails(message.details.filter(t => t.sequence !== detail.sequence).concat(detail).toSorted((a, b) => a.sequence - b.sequence));
  }

  private indexFor(conversationId: string): MessageIndex {
    let index = this.messageIndexes.get(conversationId);
    if (Object.isUndefined(index)) {
      index = new MessageIndex();
      this.messageIndexes.set(conversationId, index);
    }
    return index;
  }

  private rememberPage(page: MessagePage): void {
    const conversationId = this.selectedConversationId();
    if (Object.isNull(conversationId)) {
      this.messageIndexSignal.set([]);
      return;
    }
    const index = this.indexFor(conversationId);
    index.rememberPage(page);
    this.messageIndexSignal.set(index.entries);
  }

  private upsertApproval(approval: Approval): void {
    this.approvalsSignal.update(approvals => approval.status === ApprovalStatus.Pending
      ? ChatStore.upsert(approvals, approval) : approvals.filter(t => t.id !== approval.id));
    if (approval.status !== ApprovalStatus.Pending)
      this.granted.delete(approval.id);
  }

  private async perform(action: () => Promise<void>): Promise<boolean> {
    this.busySignal.update(t => t + 1);
    try {
      await action();
      return true;
    }
    catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : String(error));
      return false;
    }
    finally {
      this.busySignal.update(t => t - 1);
    }
  }

  private static upsert<T extends { readonly id: string }>(items: readonly T[], item: T): readonly T[] {
    const index = items.findIndex(t => t.id === item.id);
    return index < 0 ? [...items, item] : items.map((t, i) => i === index ? item : t);
  }

  private static readArray<T>(value: JsonValue, read: (item: unknown) => T): readonly T[] {
    if (!Array.isArray(value))
      throw new TypeError(String(value));

    return value.map(t => read(t));
  }
}
