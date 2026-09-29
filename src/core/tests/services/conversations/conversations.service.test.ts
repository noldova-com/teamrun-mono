/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeOperation } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ChangeEntity } from "@noldova/teamrun-core";
import { ConversationMemberParams, Harness, ObservedSettings, Provenance,
  TeammateCreateParams, TeammateIdParams, TeammateUpdateParams } from "@noldova/teamrun-protocol";
import {
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalStatus,
  Conversation,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMoveParams,
  ConversationRenameParams,
  ConversationSearchHit,
  ConversationSearchParams,
  DetailKind,
  ErrorCode,
  ForkedSession,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageListParams,
  MessageSendParams,
  MessageStatus,
  ProjectIdParams,
  RequestedSettings
} from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ConversationsServiceTests {
  @TestMethod
  public managesMembershipsIdempotentlyAndStartsFreshAfterRemoval(): void {
    using host = new CoreHost();
    const account = host.createAccount();
    const teammate = host.teammates.create(new TeammateCreateParams("Alice", null, account.id, Harness.Provider, null, null));
    const conversation = host.createConversation();
    const params = new ConversationMemberParams(conversation.id, teammate.id);
    const member = host.conversations.addMember(params);
    const feedCount = host.context.database.changeFeed.readAfter(0).length;
    Assert.areEqual(member.joinedAt, host.conversations.addMember(params).joinedAt);
    Assert.areEqual(feedCount, host.context.database.changeFeed.readAfter(0).length);
    host.conversations.setMemberSession(params, "session", true);
    Assert.areEqual("session", host.conversations.addMember(params).nativeSessionId);
    Assert.isTrue(host.conversations.findMember(params)?.resumedNativeSession ?? false);
    host.conversations.removeMember(params);
    host.conversations.removeMember(params);
    Assert.isNull(host.conversations.findMember(params));
    Assert.isNull(host.conversations.addMember(params).nativeSessionId);
    host.conversations.delete(new ConversationIdParams(conversation.id));
    Assert.isNull(host.conversations.findMember(params));
    Assert.isDefined(host.teammates.find(teammate.id));
    Assert.isTrue(host.context.database.changeFeed.readAfter(0).some(t =>
      t.entity === ChangeEntity.ConversationMember && t.entityId === JSON.stringify([conversation.id, teammate.id]) && t.operation === ChangeOperation.Delete));
    Assert.throws(() => host.conversations.listMembers(new ConversationIdParams("missing")), ServiceException);
    Assert.throws(() => host.conversations.addMember(params), ServiceException);
    Assert.throws(() => host.conversations.removeMember(params), ServiceException);
    Assert.throws(() => host.conversations.setMemberSession(params, "session", false), ServiceException);
    const another = host.createConversation();
    Assert.throws(() => host.conversations.addMember(new ConversationMemberParams(another.id, "missing")), ServiceException);
  }

  @TestMethod
  public rollsBackAccountChangesAndDeletionWhenAnyMembershipIsBusy(): void {
    using host = new CoreHost();
    const account = host.createAccount();
    const replacement = host.createAccount("fake", "Replacement");
    const first = host.createConversation();
    const second = host.createConversation();
    const teammate = host.teammates.create(new TeammateCreateParams("Alice", null, account.id, Harness.Provider, null, null));
    const firstMember = new ConversationMemberParams(first.id, teammate.id);
    const secondMember = new ConversationMemberParams(second.id, teammate.id);
    host.conversations.addMember(firstMember);
    host.conversations.addMember(secondMember);
    host.conversations.setMemberSession(firstMember, "first-session", false);
    host.conversations.setMemberSession(secondMember, "second-session", false);
    const provenance = new Provenance(account.id, new RequestedSettings("fake", null, null),
      new ObservedSettings(null, null, null, null, null), null, false);
    const reply = new Message("busy", second.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], provenance, "t", null, null);
    host.messages.insert(reply);
    const before = host.context.database.changeFeed.readAfter(0).length;
    Assert.throws(() => host.teammates.update(new TeammateUpdateParams(teammate.id, "Alice", null, replacement.id,
      Harness.Provider, null, null)), ServiceException);
    Assert.areEqual(account.id, host.teammates.find(teammate.id)?.providerAccountId);
    Assert.areEqual("first-session", host.conversations.findMember(firstMember)?.nativeSessionId);
    Assert.throws(() => host.teammates.delete(new TeammateIdParams(teammate.id)), ServiceException);
    Assert.isFalse(host.conversations.findMember(firstMember) === null);
    Assert.areEqual(before, host.context.database.changeFeed.readAfter(0).length);
    host.teammates.update(new TeammateUpdateParams(teammate.id, "Alice", "New role", account.id, Harness.Provider, "new-model", "low"));
    Assert.areEqual("second-session", host.conversations.findMember(secondMember)?.nativeSessionId);
    host.messages.update(reply.withStatus(MessageStatus.Cancelled, "end"));
    host.teammates.delete(new TeammateIdParams(teammate.id));
    Assert.isNull(host.conversations.findMember(firstMember));
    Assert.isNull(host.conversations.findMember(secondMember));
  }

  @TestMethod
  public preservesInsertionOrderWhenCreationTimesTie(): void {
    using host = new CoreHost();
    const project = host.openProject();
    const timestamp = "2026-09-14T00:00:00.000Z";
    const first = new Conversation("00000000-0000-7000-8000-000000000002", project.id, "first", timestamp, timestamp);
    const second = new Conversation("00000000-0000-7000-8000-000000000001", project.id, "second", timestamp, timestamp);
    for (const conversation of [first, second])
      host.context.database.connection.execute(new SqlQuery("INSERT INTO conversations (id, projectId, json, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        [conversation.id, project.id, JSON.stringify(conversation.toJson()), timestamp, timestamp]));

    Assert.areEqual([first.id, second.id].join(","), host.conversations.list(new ProjectIdParams(project.id)).map(t => t.id).join(","));
  }

  @TestMethod
  public refusesToDeleteAnUnreconciledOpenReply(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.messages.insert(new Message("orphan", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Running, [], null, "t", null, null));
    const failure = Assert.throws(() => host.conversations.delete(new ConversationIdParams(conversation.id)), ServiceException);
    Assert.areEqual(ErrorCode.Conflict, failure.info.name);
    Assert.isNotNull(host.conversations.find(conversation.id));
  }

  @TestMethod
  public createsListsAndFindsConversations(): void {
    using host = new CoreHost();
    const project = host.openProject();

    const untitled = host.conversations.create(new ConversationCreateParams(project.id, null));
    const titled = host.conversations.create(new ConversationCreateParams(project.id, "Login"));
    const listed = host.conversations.list(new ProjectIdParams(project.id));

    Assert.areEqual("New conversation", untitled.title);
    Assert.areEqual("Login", titled.title);
    Assert.areEqual(project.id, titled.projectId);
    Assert.areEqual([untitled.id, titled.id].join(","), listed.map(t => t.id).join(","));
    Assert.areEqual("Login", host.conversations.find(titled.id)?.title);
    Assert.isNull(host.conversations.find("nope"));
    Assert.areEqual(2, host.context.database.changeFeed.readAfter(0).filter(t => t.entity === ChangeEntity.Conversation).length);
  }

  @TestMethod
  public rejectsAnUnknownProject(): void {
    using host = new CoreHost();

    const failure = Assert.throws(() => host.conversations.create(new ConversationCreateParams("nope", null)), ServiceException);

    Assert.areEqual(ErrorCode.NotFound, failure.info.name);
  }

  @TestMethod
  public movesAConversationToAnotherProjectAndLogsTheUpdate(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const other = host.openProject("beta");

    const moved = host.conversations.move(new ConversationMoveParams(conversation.id, other.id));

    Assert.areEqual(other.id, moved.projectId);
    Assert.areEqual(other.id, host.conversations.find(conversation.id)?.projectId);
    Assert.areEqual(1, host.conversations.list(new ProjectIdParams(other.id)).length);
    Assert.areEqual(0, host.conversations.list(new ProjectIdParams(conversation.projectId)).length);
    Assert.areEqual(ChangeOperation.Update, host.context.database.changeFeed.readAfter(0).at(-1)?.operation);
    const missingConversation = Assert.throws(() => host.conversations.move(new ConversationMoveParams("nope", other.id)), ServiceException);
    Assert.areEqual(ErrorCode.NotFound, missingConversation.info.name);
    const missingProject = Assert.throws(() => host.conversations.move(new ConversationMoveParams(conversation.id, "nope")), ServiceException);
    Assert.areEqual(ErrorCode.NotFound, missingProject.info.name);
  }

  @TestMethod
  public renamesAConversationAndLogsTheUpdate(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();

    const renamed = host.conversations.rename(new ConversationRenameParams(conversation.id, "Renamed"));

    Assert.areEqual("Renamed", renamed.title);
    Assert.areEqual("Renamed", host.conversations.find(conversation.id)?.title);
    Assert.areEqual(ChangeOperation.Update, host.context.database.changeFeed.readAfter(0).at(-1)?.operation);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.conversations.rename(new ConversationRenameParams("nope", "x")), ServiceException).info.name);
  }

  @TestMethod
  public async removesMessagesFromASequenceAndMarksTheSessionReset(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    await host.engine.send(new MessageSendParams(conversation.id, "First", new RequestedSettings("fake", null, null), null));
    await host.engine.waitForIdle();
    await host.engine.send(new MessageSendParams(conversation.id, "Second", new RequestedSettings("fake", null, null), null));
    await host.engine.waitForIdle();
    const messages = host.messages.list(new MessageListParams(conversation.id, null));
    const options = [new ApprovalOption("ok", "Ok", ApprovalOutcome.Approved)];
    host.approvals.insert(new Approval("apr-2", messages[3]?.id ?? "", ApprovalKind.Tool, "Bash", "Run", null, options, ApprovalStatus.Pending, null, "t", null));
    const before = host.context.database.changeFeed.readAfter(0).length;

    const removed = host.conversations.removeFrom(conversation.id, 2);
    const marked = host.conversations.setSessionReset(conversation.id, true);

    Assert.areEqual("2,3", removed.map(t => t.sequence).join(","));
    Assert.areEqual("First,Working", host.messages.list(new MessageListParams(conversation.id, null)).map(t => t.details[0]?.text).join(","));
    Assert.isNull(host.approvals.find("apr-2"));
    Assert.isTrue(marked.sessionReset);
    Assert.isTrue(host.conversations.find(conversation.id)?.sessionReset ?? false);
    const changes = host.context.database.changeFeed.readAfter(0).slice(before);
    Assert.areEqual(1, changes.filter(t => t.entity === ChangeEntity.Approval && t.operation === ChangeOperation.Delete).length);
    Assert.areEqual(2, changes.filter(t => t.entity === ChangeEntity.Message && t.operation === ChangeOperation.Delete).length);
    Assert.areEqual(ChangeOperation.Update, changes.at(-1)?.operation);
    Assert.isFalse(host.conversations.setSessionReset(conversation.id, false).sessionReset);
    const forked = host.conversations.setForkedSession(conversation.id, new ForkedSession("fake", null, "thread-2"));
    Assert.areEqual("thread-2", forked.forkedSession?.nativeSessionId);
    Assert.areEqual("thread-2", host.conversations.find(conversation.id)?.forkedSession?.nativeSessionId);
    Assert.isNull(host.conversations.setSessionReset(conversation.id, true).forkedSession);
    Assert.isNull(host.conversations.setForkedSession(conversation.id, null).forkedSession);
    Assert.isFalse(host.conversations.find(conversation.id)?.sessionReset ?? true);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.conversations.removeFrom("nope", 0), ServiceException).info.name);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.conversations.setSessionReset("nope", true), ServiceException).info.name);
  }

  @TestMethod
  public async deletesAConversationWithItsMessagesAndApprovals(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    await host.engine.send(new MessageSendParams(conversation.id, "Hello", new RequestedSettings("fake", null, null), null));
    await host.engine.waitForIdle();
    const reply = host.messages.list(new MessageListParams(conversation.id, null))[1];
    host.approvals.insert(new Approval("apr-1", reply?.id ?? "", ApprovalKind.Tool, "Bash", "Run", null, [new ApprovalOption("ok", "Ok", ApprovalOutcome.Approved)], ApprovalStatus.Pending, null, "t", null));
    const before = host.context.database.changeFeed.readAfter(0).length;

    host.conversations.delete(new ConversationIdParams(conversation.id));

    const changes = host.context.database.changeFeed.readAfter(0);
    Assert.isNull(host.conversations.find(conversation.id));
    Assert.areEqual(0, host.messages.list(new MessageListParams(conversation.id, null)).length);
    Assert.areEqual(before + 4, changes.length);
    Assert.areEqual(1, changes.slice(before).filter(t => t.entity === ChangeEntity.Approval && t.operation === ChangeOperation.Delete).length);
    Assert.areEqual(2, changes.slice(before).filter(t => t.entity === ChangeEntity.Message && t.operation === ChangeOperation.Delete).length);
    Assert.areEqual(ChangeEntity.Conversation, changes.at(-1)?.entity);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.conversations.delete(new ConversationIdParams(conversation.id)), ServiceException).info.name);
  }

  @TestMethod
  public searchesTitlesAndMessageTexts(): void {
    using host = new CoreHost();
    const project = host.openProject();
    const login = host.createConversation(project, "Login flow");
    const tests = host.createConversation(project, "Tests");
    const notes = host.createConversation(project, "Notes 100%");
    const text = (id: string, conversationId: string, sequence: number, content: string, at: string): Message => {
      const detail = new MessageDetail(0, DetailKind.Text, content, null, at);
      return new Message(id, conversationId, sequence, MessageAuthor.User, null, MessageStatus.Completed, [detail], null, at, null, at);
    };
    const first = "Please fix the LOGIN page as we discussed earlier today.\nIt shows a blank form after the redirect and the tests fail.";
    host.messages.insert(text("m1", tests.id, 0, first, "t1"));
    host.messages.insert(text("m2", tests.id, 1, "The login test still fails; the second message about login is the latest.", "t2"));
    host.messages.insert(text("m3", notes.id, 0, "Coverage stays at 100% after the change.", "t3"));
    host.messages.insert(text("m4", login.id, 0, "x".repeat(200) + " login " + "y".repeat(200), "t4"));
    host.messages.insert(text("m5", notes.id, 1, "z".repeat(200) + " needle " + "w".repeat(200), "t5"));
    const search = (query: string, limit: number = 10): readonly ConversationSearchHit[] =>
      host.conversations.search(new ConversationSearchParams(query, limit)).hits;

    const byLogin = search("login");
    Assert.areEqual(2, byLogin.length);
    Assert.areEqual(1, byLogin.filter(t => t.conversationId === login.id).length);
    Assert.isNull(byLogin.find(t => t.conversationId === login.id)?.messageId);
    Assert.areEqual("Login flow", byLogin.find(t => t.conversationId === login.id)?.snippet);
    const inTests = byLogin.find(t => t.conversationId === tests.id);
    Assert.areEqual("m2", inTests?.messageId);
    Assert.areEqual("Tests", inTests?.title);
    Assert.areEqual(project.id, inTests?.projectId);
    Assert.isTrue(inTests?.snippet.startsWith("The login test still fails") ?? false);
    Assert.areEqual(1, search("login", 1).length);

    const tail = search("blank form");
    Assert.areEqual("m1", tail[0]?.messageId);
    Assert.isTrue(tail[0]?.snippet.startsWith("…") ?? false);
    Assert.isTrue(tail[0]?.snippet.includes("blank form after the redirect") ?? false);
    Assert.isFalse(tail[0]?.snippet.includes("\n") ?? true);

    const deep = search("needle");
    Assert.areEqual("m5", deep[0]?.messageId);
    Assert.isTrue(deep[0]?.snippet.startsWith("…") ?? false);
    Assert.isTrue(deep[0]?.snippet.endsWith("…") ?? false);
    Assert.isTrue(deep[0]?.snippet.includes(" needle ") ?? false);
    Assert.isTrue((deep[0]?.snippet.length ?? 0) <= 122);

    Assert.areEqual(1, search("100%").length);
    Assert.areEqual(notes.id, search("100%")[0]?.conversationId);
    Assert.areEqual(0, search("100_").length);
    Assert.areEqual(0, search("nothing here").length);
    Assert.areEqual(0, search("_").length);
  }
}
