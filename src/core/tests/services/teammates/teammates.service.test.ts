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
import { ConversationIdParams, ConversationMemberParams, ErrorCode, Harness, Message, MessageAuthor, MessageStatus,
  ObservedSettings, Provenance, ProviderAccountIdParams, RequestedSettings, TeammateCreateParams, TeammateIdParams,
  TeammateMention, TeammateUpdateParams } from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class TeammatesServiceTests {
  @TestMethod
  public persistsUniqueNamesAndAllowsUnavailableAccountsToRemainReferenced(): void {
    using host = new CoreHost();
    const account = host.createAccount();
    const created = host.teammates.create(new TeammateCreateParams("Équipe", "Review", account.id, Harness.Provider, "model", "high"));
    Assert.areEqual(created.id, host.teammates.list()[0]?.id);
    Assert.areEqual("Équipe", host.teammates.find(created.id)?.name);
    Assert.isNull(host.teammates.find("missing"));
    Assert.areEqual(ErrorCode.Conflict, Assert.throws(() => host.teammates.create(
      new TeammateCreateParams("ÉQUIPE".normalize("NFD"), null, account.id, Harness.Provider, null, null)), ServiceException).info.name);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => host.teammates.create(
      new TeammateCreateParams("Bob", null, "missing", Harness.Provider, null, null)), ServiceException).info.name);
    const bob = host.teammates.create(new TeammateCreateParams("Bob", null, account.id, Harness.Provider, null, null));
    Assert.throws(() => host.teammates.update(
      new TeammateUpdateParams(bob.id, "équipe", null, account.id, Harness.Provider, null, null)), ServiceException);
    const edited = host.teammates.update(new TeammateUpdateParams(created.id, "ÉQUIPE", null, account.id, Harness.Provider, null, null));
    Assert.areEqual(created.id, edited.id);
    Assert.areEqual(created.createdAt, edited.createdAt);
    host.accounts.delete(new ProviderAccountIdParams(account.id));
    Assert.areEqual(account.id, host.teammates.find(created.id)?.providerAccountId);
    host.teammates.update(new TeammateUpdateParams(created.id, "Renamed", null, account.id, Harness.Provider, null, null));
    Assert.throws(() => host.teammates.update(
      new TeammateUpdateParams(created.id, "Renamed", null, "missing", Harness.Provider, null, null)), ServiceException);
    Assert.throws(() => host.teammates.update(
      new TeammateUpdateParams("missing", "Nobody", null, account.id, Harness.Provider, null, null)), ServiceException);
    const record = host.context.database.connection.query(new SqlQuery("SELECT name FROM teammates WHERE id = ?", [created.id]))[0];
    Assert.areEqual("renamed", record?.readString("name"));
  }

  @TestMethod
  public resetsSessionsOnRebindingAndPreservesMessageIdentityAfterDeletion(): void {
    using host = new CoreHost();
    const first = host.createAccount();
    const second = host.createAccount("fake", "Second");
    const conversation = host.createConversation();
    const teammate = host.teammates.create(new TeammateCreateParams("Alice", null, first.id, Harness.Provider, null, null));
    const member = new ConversationMemberParams(conversation.id, teammate.id);
    host.conversations.addMember(member);
    host.conversations.setMemberSession(member, "native-1", true);
    host.teammates.update(new TeammateUpdateParams(teammate.id, "Renamed", "role", second.id, Harness.Provider, "m", "low"));
    Assert.isNull(host.conversations.findMember(member)?.nativeSessionId);
    const provenance = new Provenance(first.id, new RequestedSettings("fake", null, null),
      new ObservedSettings(null, null, null, null, null), null, false);
    const user = new Message("user", conversation.id, 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t",
      [], null, null, [new TeammateMention(teammate.id, "Alice")]);
    const reply = new Message("reply", conversation.id, 1, MessageAuthor.Provider, user.id, MessageStatus.Completed, [],
      provenance, "t", "t", "t", [], teammate.id, "Alice");
    host.messages.insert(user);
    host.messages.insert(reply);
    host.teammates.delete(new TeammateIdParams(teammate.id));
    Assert.isNull(host.teammates.find(teammate.id));
    Assert.areEqual(0, host.conversations.listMembers(new ConversationIdParams(conversation.id)).length);
    Assert.areEqual("Alice", host.messages.find(reply.id)?.teammateName);
    Assert.areEqual(teammate.id, host.messages.find(reply.id)?.teammateId);
    Assert.areEqual("Alice", host.messages.find(user.id)?.mentions[0]?.name);
    const changes = host.context.database.changeFeed.readAfter(0);
    Assert.isTrue(changes.some(t => t.entity === ChangeEntity.ConversationMember && t.operation === ChangeOperation.Update));
    Assert.isTrue(changes.some(t => t.entity === ChangeEntity.ConversationMember && t.operation === ChangeOperation.Delete));
    Assert.areEqual(ChangeEntity.Teammate, changes.at(-1)?.entity);
    Assert.areEqual(ChangeOperation.Delete, changes.at(-1)?.operation);
    Assert.throws(() => host.teammates.delete(new TeammateIdParams(teammate.id)), ServiceException);
  }
}
