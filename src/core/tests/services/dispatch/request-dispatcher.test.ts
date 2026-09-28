/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalAsk, RequestDispatcher } from "@noldova/teamrun-core";
import { ConversationMember, ConversationMemberParams, EventName, Harness,
  Teammate, TeammateCreateParams, TeammateUpdateParams, TeammateIdParams } from "@noldova/teamrun-protocol";
import {
  AttachmentInput,
  MessageAttachment,
  Approval,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalStatus,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMoveParams,
  ConversationRenameParams,
  ConversationRewindParams,
  ConversationRewindResult,
  ConversationSearchParams,
  ConversationSearchResult,
  ErrorCode,
  Message,
  MessageIdParams,
  MessageListParams,
  ReplyPage,
  ReplySummary,
  MessagePage,
  MessagePageParams,
  MessageSendParams,
  MessageSendResult,
  MethodName,
  Project,
  ProjectIdParams,
  ProjectOpenParams,
  ProviderAccount,
  ProviderAccountCreateParams,
  ProviderAccountIdParams,
  ProviderDescriptor,
  ProviderModel,
  ProviderListModelsParams,
  Request,
  RequestedSettings,
  type Response
} from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class RequestDispatcherTests {
  @TestMethod
  public async routesTeammateAndMembershipOperationsAndInvalidatesOnlyMutations(): Promise<void> {
    using host = new CoreHost();
    const account = host.createAccount();
    const conversation = host.createConversation();
    const created = Teammate.fromJson(await RequestDispatcherTests.succeed(host, MethodName.TeammateCreate,
      new TeammateCreateParams("Alice", null, account.id, Harness.Provider, null, null).toJson()));
    const changed = Teammate.fromJson(await RequestDispatcherTests.succeed(host, MethodName.TeammateUpdate,
      new TeammateUpdateParams(created.id, "Bob", null, account.id, Harness.Provider, null, null).toJson()));
    Assert.areEqual("Bob", changed.name);
    Assert.areEqual(1, RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.TeammateList, null)).length);
    const params = new ConversationMemberParams(conversation.id, created.id).toJson();
    const member = ConversationMember.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationAddMember, params));
    Assert.areEqual(created.id, member.teammateId);
    Assert.areEqual(1, RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ConversationListMembers,
      new ConversationIdParams(conversation.id).toJson())).length);
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.ConversationRemoveMember, params));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.TeammateDelete, new TeammateIdParams(created.id).toJson()));
    Assert.areEqual(5, host.listener.count(EventName.StateInvalidated));
    const invalid = await host.dispatcher.dispatch(new Request("bad", MethodName.TeammateCreate,
      { name: "bad name", providerAccountId: account.id, harness: "provider", role: null, model: null, effort: null }));
    Assert.isTrue(invalid.hasErrors);
    Assert.areEqual(5, host.listener.count(EventName.StateInvalidated));
  }

  @TestMethod
  public async returnsModelMetadataWhileKeepingTheNamesOnlyEndpoint(): Promise<void> {
    using host = new CoreHost();
    const params = new ProviderListModelsParams("fake", null).toJson();
    const response = await host.dispatcher.dispatch(new Request("catalog", MethodName.ProviderModelCatalog, params));
    const models = JsonReader.fromValue({ models: response.payload }).readObjectArray("models").map(t => ProviderModel.fromJson(t.toJson()));
    Assert.areEqual("fake-small,fake-large", models.map(t => t.id).join(","));
    Assert.areEqual("medium,high", models[0]?.effortLevels?.join(","));
    const names = await host.dispatcher.dispatch(new Request("names", MethodName.ProviderListModels, params));
    Assert.areEqual('["fake-small","fake-large"]', JSON.stringify(names.payload));
  }
  @TestMethod
  public async answersEveryMethodOfTheCatalog(): Promise<void> {
    using host = new CoreHost();
    host.adapter.approvalAsk = new ApprovalAsk("req-1", ApprovalKind.Command, "commandExecution", "Run", null, [new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved)]);

    const providers = await RequestDispatcherTests.succeed(host, MethodName.ProviderList, null);
    const prepared = MessageAttachment.fromJson(await RequestDispatcherTests.succeed(host, MethodName.AttachmentPrepare,
      new AttachmentInput("notes.txt", "text/plain", "YQ==", null).toJson()));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.AttachmentDiscard, prepared.toJson()));
    const models = await RequestDispatcherTests.succeed(host, MethodName.ProviderListModels, new ProviderListModelsParams("fake", null).toJson());
    const account = ProviderAccount.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderAccountCreate, new ProviderAccountCreateParams("fake", "Work", join(host.directory.path, "p")).toJson()));
    const checked = ProviderAccount.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProviderAccountCheck, new ProviderAccountIdParams(account.id).toJson()));
    const accounts = await RequestDispatcherTests.succeed(host, MethodName.ProviderAccountList, null);
    const project = Project.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ProjectOpen, new ProjectOpenParams(join(host.directory.path, "alpha")).toJson()));
    const projects = await RequestDispatcherTests.succeed(host, MethodName.ProjectList, null);
    const conversation = Conversation.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationCreate, new ConversationCreateParams(project.id, "Chat").toJson()));
    const renamed = Conversation.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationRename, new ConversationRenameParams(conversation.id, "Renamed").toJson()));
    const moveParams = new ConversationMoveParams(conversation.id, project.id);
    const moved = Conversation.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ConversationMove, moveParams.toJson()));
    Assert.areEqual(project.id, moved.projectId);
    const conversations = await RequestDispatcherTests.succeed(host, MethodName.ConversationList, new ProjectIdParams(project.id).toJson());
    const sendParams = new MessageSendParams(conversation.id, "Hello", new RequestedSettings("fake", null, null), null);
    const sent = MessageSendResult.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageSend, sendParams.toJson()));
    const pageParams = new MessagePageParams(conversation.id, null, null, 1);
    const page = MessagePage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessagePage, pageParams.toJson()));
    Assert.areEqual(1, page.messages.length);
    Assert.isTrue(page.hasEarlier);
    await host.until(() => host.approvals.list(new ConversationIdParams(conversation.id)).length === 1);
    const open = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.MessageListOpen, null));
    const pending = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ApprovalListPending, null));
    Assert.areEqual(sent.replies[0]!.id, Message.fromJson(open[0]?.toJson()).id);
    Assert.areEqual(1, pending.length);
    const approvals = RequestDispatcherTests.objects(await RequestDispatcherTests.succeed(host, MethodName.ApprovalList, new ConversationIdParams(conversation.id).toJson()));
    const decided = Approval.fromJson(await RequestDispatcherTests.succeed(host, MethodName.ApprovalDecide, new ApprovalDecideParams(Approval.fromJson(approvals[0]?.toJson()).id, "accept").toJson()));
    await host.engine.waitForIdle();
    const activityPage = ReplyPage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageActivityPage, pageParams.toJson()));
    const changesPage = ReplyPage.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageChangesPage, pageParams.toJson()));
    Assert.isTrue(activityPage.replies.length <= 1);
    Assert.isTrue(changesPage.replies.length <= 1);
    const summary = ReplySummary.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageSummary,
      new MessageIdParams(sent.replies[0]!.id).toJson()));
    const details = Message.fromJson(await RequestDispatcherTests.succeed(host, MethodName.MessageDetails, new MessageIdParams(sent.replies[0]!.id).toJson()));
    Assert.areEqual(sent.replies[0]!.id, summary.preview.id);
    Assert.areEqual(sent.replies[0]!.id, details.id);
    Assert.isFalse(details.details.some(t => t.kind === "Text"));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.MessageSummary, new MessageIdParams("missing").toJson()));
    Assert.isNull(await RequestDispatcherTests.succeed(host, MethodName.MessageDetails, new MessageIdParams("missing").toJson()));
    const messages = await RequestDispatcherTests.succeed(host, MethodName.MessageList, new MessageListParams(conversation.id, null).toJson());
    const found = ConversationSearchResult.fromJson(
      await RequestDispatcherTests.succeed(host, MethodName.ConversationSearch, new ConversationSearchParams(renamed.title, 5).toJson()));
    Assert.areEqual(conversation.id, found.hits[0]?.conversationId);
    const rewound = ConversationRewindResult.fromJson(
      await RequestDispatcherTests.succeed(host, MethodName.ConversationRewind, new ConversationRewindParams(conversation.id, sent.sent.id, false).toJson()));
    const deleted = await RequestDispatcherTests.succeed(host, MethodName.ConversationDelete, new ConversationIdParams(conversation.id).toJson());
    const forgotten = await RequestDispatcherTests.succeed(host, MethodName.ProjectForget, new ProjectIdParams(project.id).toJson());
    const removed = await RequestDispatcherTests.succeed(host, MethodName.ProviderAccountDelete, new ProviderAccountIdParams(account.id).toJson());

    Assert.areEqual("fake", RequestDispatcherTests.objects(providers).map(t => ProviderDescriptor.fromJson(t.toJson()).id).join(","));
    Assert.areEqual("[\"fake-small\",\"fake-large\"]", JSON.stringify(models));
    Assert.areEqual("LoggedIn", checked.authStatus);
    Assert.areEqual(1, RequestDispatcherTests.objects(accounts).length);
    Assert.areEqual(1, RequestDispatcherTests.objects(projects).length);
    Assert.areEqual("Renamed", renamed.title);
    Assert.areEqual(1, RequestDispatcherTests.objects(conversations).length);
    Assert.areEqual("Hello", sent.sent.details[0]?.text);
    Assert.areEqual("Working", RequestDispatcherTests.objects(messages).map(t => Message.fromJson(t.toJson()))[1]?.details[0]?.text);
    Assert.areEqual(1, approvals.length);
    Assert.areEqual(ApprovalStatus.Approved, decided.status);
    Assert.areEqual(2, rewound.removedMessageIds.length);
    Assert.isTrue(rewound.conversation.sessionReset);
    Assert.isNull(rewound.restoredFiles);
    Assert.isNull(deleted);
    Assert.isNull(forgotten);
    Assert.isNull(removed);
  }

  @TestMethod
  public async cancelsAndDecidesThroughTheCatalog(): Promise<void> {
    using host = new CoreHost();
    host.adapter.holdUntilAbort = true;
    const conversation = host.createConversation();
    const sent = await host.engine.send(new MessageSendParams(conversation.id, "Wait", new RequestedSettings("fake", null, null), null));

    const cancelled = await host.dispatcher.dispatch(new Request("r1", MethodName.MessageCancel, new MessageIdParams(sent.replies[0]!.id).toJson()));
    const decided = await host.dispatcher.dispatch(new Request("r2", MethodName.ApprovalDecide, new ApprovalDecideParams("nope", "accept").toJson()));

    Assert.isFalse(cancelled.hasErrors);
    Assert.areEqual("Cancelled", Message.fromJson(cancelled.payload).status);
    Assert.isTrue(decided.hasErrors);
    Assert.areEqual(ErrorCode.NotFound, decided.info?.name);
  }

  @TestMethod
  public async describesEveryKindOfFailure(): Promise<void> {
    using host = new CoreHost();

    const unknown = await host.dispatcher.dispatch(new Request("r1", "project/explode", null));
    const invalidJson = await host.dispatcher.dispatch(new Request("r2", MethodName.ProjectOpen, { rootPath: 42 }));
    const invalidArgument = await host.dispatcher.dispatch(new Request("r3", MethodName.MessageList, { conversationId: "c", afterSequence: -5, kinds: [] }));
    const notFound = await host.dispatcher.dispatch(new Request("r4", MethodName.ProjectForget, new ProjectIdParams("nope").toJson()));
    host.adapter.listModelsFailure = new Error("boom");
    const internal = await host.dispatcher.dispatch(new Request("r5", MethodName.ProviderListModels, new ProviderListModelsParams("fake", null).toJson()));
    host.adapter.listModelsFailure = "plain text";
    const plain = await host.dispatcher.dispatch(new Request("r6", MethodName.ProviderListModels, new ProviderListModelsParams("fake", null).toJson()));

    Assert.areEqual(ErrorCode.UnknownMethod, unknown.info?.name);
    Assert.areEqual("project/explode", unknown.info?.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, invalidJson.info?.name);
    Assert.areEqual("$.rootPath", invalidJson.info?.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, invalidArgument.info?.name);
    Assert.areEqual("afterSequence", invalidArgument.info?.arguments[0]);
    Assert.areEqual(ErrorCode.NotFound, notFound.info?.name);
    Assert.areEqual(ErrorCode.Internal, internal.info?.name);
    Assert.areEqual("boom", internal.info?.message);
    Assert.areEqual("plain text", plain.info?.message);
    Assert.areEqual("r6", plain.id);
  }

  @TestMethod
  public describesFailuresForOtherDispatchers(): void {
    const service = RequestDispatcher.describe(new ServiceException(ErrorCode.Conflict, "Busy.", ["t1"]));
    const json = RequestDispatcher.describe(new JsonException("Not a string.", "$.data"));
    const named = RequestDispatcher.describe(new ArgumentException("Blank.", "terminalId"));
    const unnamed = RequestDispatcher.describe(new ArgumentException("Blank."));
    const other = RequestDispatcher.describe(new Error("Broken."));

    Assert.areEqual(ErrorCode.Conflict, service.name);
    Assert.areEqual("t1", service.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, json.name);
    Assert.areEqual("$.data", json.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, named.name);
    Assert.areEqual("terminalId", named.arguments[0]);
    Assert.areEqual(ErrorCode.InvalidParams, unnamed.name);
    Assert.areEqual(0, unnamed.arguments.length);
    Assert.areEqual(ErrorCode.Internal, other.name);
    Assert.areEqual("Broken.", other.message);
  }

  private static async succeed(host: CoreHost, method: MethodName, payload: unknown): Promise<unknown> {
    const response: Response = await host.dispatcher.dispatch(new Request("r", method, JsonReader.toJsonValue(payload)));
    Assert.isFalse(response.hasErrors);
    return response.payload;
  }

  private static objects(value: unknown): readonly JsonReader[] {
    return JsonReader.fromValue({ items: value }).readObjectArray("items");
  }
}
