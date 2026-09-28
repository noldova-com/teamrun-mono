/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, type JsonValue } from "@noldova/teamrun-foundation-json";
import { ServiceException, ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import {
  AttachmentInput,
  ConversationMemberParams,
  TeammateCreateParams,
  TeammateUpdateParams,
  TeammateIdParams,
  MessageAttachment,
  ApprovalDecideParams,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMoveParams,
  ConversationRenameParams,
  ConversationRewindParams,
  ConversationSearchParams,
  ErrorCode,
  DetailKind,
  Event,
  EventName,
  MessageIdParams,
  MessageListParams,
  MessagePageParams,
  MessageSendParams,
  MethodName,
  ProjectIdParams,
  ProjectOpenParams,
  ProviderAccountCreateParams,
  ProviderAccountIdParams,
  ProviderListModelsParams,
  type Request,
  Response,
  ReplyPanel,
  ReplySummary
} from "@noldova/teamrun-protocol";

import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import type { IConversationEngine } from "../../interfaces/i-conversation-engine.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IProjectsService } from "../../interfaces/i-projects.service.js";
import type { IProviderAccountsService } from "../../interfaces/i-provider-accounts.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import { Resources } from "../../resources.js";

export class RequestDispatcher {
  private static readonly catalogMutations: ReadonlySet<string> = new Set([
    MethodName.TeammateCreate, MethodName.TeammateUpdate, MethodName.TeammateDelete, MethodName.ConversationAddMember,
    MethodName.ConversationRemoveMember,
    MethodName.ProjectOpen, MethodName.ProjectForget, MethodName.ConversationCreate, MethodName.ConversationRename,
    MethodName.ConversationMove, MethodName.ConversationDelete, MethodName.ProviderAccountCreate, MethodName.ProviderAccountDelete
  ]);
  private readonly events: IEventSink | null;
  private readonly providers: IProvidersService;
  private readonly accounts: IProviderAccountsService;
  private readonly projects: IProjectsService;
  private readonly conversations: IConversationsService;
  private readonly messages: IMessagesService;
  private readonly approvals: IApprovalsService;
  private readonly engine: IConversationEngine;
  private readonly teammates: ITeammatesService;

  public constructor(
    providers: IProvidersService,
    accounts: IProviderAccountsService,
    projects: IProjectsService,
    conversations: IConversationsService,
    messages: IMessagesService,
    approvals: IApprovalsService,
    engine: IConversationEngine,
    teammates: ITeammatesService,
    events: IEventSink | null = null) {
    this.events = events;
    this.providers = providers;
    this.accounts = accounts;
    this.projects = projects;
    this.conversations = conversations;
    this.messages = messages;
    this.approvals = approvals;
    this.engine = engine;
    this.teammates = teammates;
  }

  public async dispatch(request: Request): Promise<Response> {
    try {
      const payload = await this.invoke(request.method, request.payload);
      if (RequestDispatcher.catalogMutations.has(request.method))
        this.events?.publish(new Event(EventName.StateInvalidated, null));
      return Response.success(request.id, payload);
    }
    catch (error) {
      return Response.failure(request.id, RequestDispatcher.describe(error));
    }
  }

  public static describe(error: unknown): ServiceResponseInfo {
    if (error instanceof ServiceException)
      return error.info;
    if (error instanceof JsonException)
      return new ServiceResponseInfo(ErrorCode.InvalidParams, error.message, [error.path]);
    if (error instanceof ArgumentException)
      return new ServiceResponseInfo(ErrorCode.InvalidParams, error.message, [error.parameterName].filter((t): t is string => !Object.isUndefined(t)));

    return new ServiceResponseInfo(ErrorCode.Internal, error instanceof Error ? error.message : String(error));
  }

  private async invoke(method: string, payload: JsonValue): Promise<JsonValue> {
    switch (method) {
      case MethodName.TeammateList:
        return this.teammates.list().map(t => t.toJson());
      case MethodName.TeammateCreate:
        return this.teammates.create(TeammateCreateParams.fromJson(payload)).toJson();
      case MethodName.TeammateUpdate:
        return this.teammates.update(TeammateUpdateParams.fromJson(payload)).toJson();
      case MethodName.TeammateDelete:
        this.teammates.delete(TeammateIdParams.fromJson(payload));
        return null;
      case MethodName.ConversationListMembers:
        return this.conversations.listMembers(ConversationIdParams.fromJson(payload)).map(t => t.toJson());
      case MethodName.ConversationAddMember:
        return this.conversations.addMember(ConversationMemberParams.fromJson(payload)).toJson();
      case MethodName.ConversationRemoveMember:
        this.conversations.removeMember(ConversationMemberParams.fromJson(payload));
        return null;
      case MethodName.AttachmentPrepare:
        return this.engine.prepareAttachment(AttachmentInput.fromJson(payload)).toJson();
      case MethodName.AttachmentDiscard:
        this.engine.discardAttachment(MessageAttachment.fromJson(payload));
        return null;
      case MethodName.ProviderList:
        return this.providers.list().map(t => t.toJson());
      case MethodName.ProviderListModels:
        return [...await this.providers.listModels(ProviderListModelsParams.fromJson(payload))];
      case MethodName.ProviderModelCatalog:
        return (await this.providers.modelCatalog(ProviderListModelsParams.fromJson(payload))).map(t => t.toJson());
      case MethodName.ProviderAccountList:
        return this.accounts.list().map(t => t.toJson());
      case MethodName.ProviderAccountCreate:
        return this.accounts.create(ProviderAccountCreateParams.fromJson(payload)).toJson();
      case MethodName.ProviderAccountCheck:
        return (await this.accounts.check(ProviderAccountIdParams.fromJson(payload))).toJson();
      case MethodName.ProviderAccountDelete:
        this.accounts.delete(ProviderAccountIdParams.fromJson(payload));
        return null;
      case MethodName.ProjectList:
        return this.projects.list().map(t => t.toJson());
      case MethodName.ProjectOpen:
        return this.projects.open(ProjectOpenParams.fromJson(payload)).toJson();
      case MethodName.ProjectForget:
        this.projects.forget(ProjectIdParams.fromJson(payload));
        return null;
      case MethodName.ConversationList:
        return this.conversations.list(ProjectIdParams.fromJson(payload)).map(t => t.toJson());
      case MethodName.ConversationCreate:
        return this.conversations.create(ConversationCreateParams.fromJson(payload)).toJson();
      case MethodName.ConversationRename:
        return this.conversations.rename(ConversationRenameParams.fromJson(payload)).toJson();
      case MethodName.ConversationMove:
        return this.conversations.move(ConversationMoveParams.fromJson(payload)).toJson();
      case MethodName.ConversationDelete:
        this.conversations.delete(ConversationIdParams.fromJson(payload));
        return null;
      case MethodName.ConversationRewind:
        return (await this.engine.rewind(ConversationRewindParams.fromJson(payload))).toJson();
      case MethodName.ConversationSearch:
        return this.conversations.search(ConversationSearchParams.fromJson(payload)).toJson();
      case MethodName.MessageList:
        return this.messages.list(MessageListParams.fromJson(payload)).map(t => t.toJson());
      case MethodName.MessageListOpen:
        return this.messages.listOpen().map(t => t.toJson());
      case MethodName.MessagePage:
        return this.messages.page(MessagePageParams.fromJson(payload)).toJson();
      case MethodName.MessageActivityPage:
        return this.messages.replyPage(MessagePageParams.fromJson(payload), ReplyPanel.Activity).toJson();
      case MethodName.MessageChangesPage:
        return this.messages.replyPage(MessagePageParams.fromJson(payload), ReplyPanel.Changes).toJson();
      case MethodName.MessageSummary: {
        const message = this.messages.find(MessageIdParams.fromJson(payload).messageId);
        return Object.isNull(message) ? null : ReplySummary.fromMessage(message).toJson();
      }
      case MethodName.MessageDetails: {
        const message = this.messages.find(MessageIdParams.fromJson(payload).messageId);
        return Object.isNull(message) ? null : message.withDetails(message.details.filter(t => t.kind !== DetailKind.Text)).toJson();
      }
      case MethodName.MessageSend:
        return (await this.engine.send(MessageSendParams.fromJson(payload))).toJson();
      case MethodName.MessageCancel:
        return (await this.engine.cancel(MessageIdParams.fromJson(payload))).toJson();
      case MethodName.ApprovalList:
        return this.approvals.list(ConversationIdParams.fromJson(payload)).map(t => t.toJson());
      case MethodName.ApprovalListPending:
        return this.approvals.listPendingAll().map(t => t.toJson());
      case MethodName.ApprovalDecide:
        return this.engine.decide(ApprovalDecideParams.fromJson(payload)).toJson();
      default:
        throw new ServiceException(ErrorCode.UnknownMethod, Resources.formatUnknownMethod(method), [method]);
    }
  }
}
