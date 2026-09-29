/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SignInCheck, TurnOutcome } from "@noldova/teamrun-core";
import { AuthStatus, ConversationIdParams, ConversationMemberParams, ConversationRewindParams, EventName, Harness,
  MessageIdParams, MessageSendParams, MessageStatus, ProviderAccountIdParams, RequestedSettings, RoleApplication,
  TeammateCreateParams, TeammateIdParams, TeammateUpdateParams } from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class TeammateTurnsTests {
  @TestMethod
  public async retainsAFreshSessionRequirementAfterAnAttemptFailsBeforeStarting(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const settings = new RequestedSettings("fake", null, null);
    await host.engine.send(new MessageSendParams(conversation.id, "kept", settings, null));
    await host.engine.waitForIdle();
    const removed = await host.engine.send(new MessageSendParams(conversation.id, "remove", settings, null));
    await host.engine.waitForIdle();
    await host.engine.rewind(new ConversationRewindParams(conversation.id, removed.sent.id, false));
    host.adapter.failBeforeStart = true;
    await host.engine.send(new MessageSendParams(conversation.id, "failed attempt", settings, null));
    await host.engine.waitForIdle();
    Assert.isTrue(host.conversations.find(conversation.id)!.sessionReset);
    host.adapter.failBeforeStart = false;
    await host.engine.send(new MessageSendParams(conversation.id, "retry", settings, null));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[3]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[3]!.prompt.includes("User: kept"));
    Assert.isFalse(host.conversations.find(conversation.id)!.sessionReset);
  }

  @TestMethod
  public async exchangesInMentionOrderWithIndependentSessionsAndInterveningContext(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const account = host.createAccount();
    const alice = host.teammates.create(new TeammateCreateParams("Alice", "Review carefully", account.id, Harness.Provider, "model-a", "high"));
    const bob = host.teammates.create(new TeammateCreateParams("Bob", "Implement carefully", account.id, Harness.Provider, "model-b", "low"));
    host.adapter.detailTexts = ["First answer"];
    const sent = await host.engine.send(new MessageSendParams(conversation.id, "@Bob @Alice discuss", null, null, [], [bob.id, alice.id, bob.id]));
    Assert.areEqual("Bob,Alice", sent.replies.map(t => t.teammateName).join(","));
    Assert.areEqual("Bob,Alice", sent.sent.mentions.map(t => t.name).join(","));
    Assert.isTrue(sent.replies.every(t => t.status === MessageStatus.Pending && t.inReplyTo === sent.sent.id && Object.isNull(t.startedAt)));
    await host.engine.waitForIdle();
    const first = host.messages.find(sent.replies[0]!.id)!;
    const second = host.messages.find(sent.replies[1]!.id)!;
    Assert.isTrue(first.startedAt! >= sent.sent.createdAt);
    Assert.isTrue(second.startedAt! >= first.endedAt!);
    Assert.areEqual(sent.sent.createdAt, second.createdAt);
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isTrue(host.adapter.requests[0]!.prompt.includes("You join this conversation as @Bob"));
    Assert.isTrue(host.adapter.requests[1]!.prompt.includes("@Bob: First answer"));
    Assert.areEqual("Implement carefully", host.adapter.requests[0]!.instructions);
    Assert.areEqual("Review carefully", host.adapter.requests[1]!.instructions);
    Assert.areEqual(RoleApplication.Instructions, host.messages.find(sent.replies[1]!.id)?.provenance?.roleApplied);
    Assert.areEqual(2, host.conversations.listMembers(new ConversationIdParams(conversation.id)).length);
    Assert.areEqual(1, host.listener.count(EventName.StateInvalidated));
    Assert.areEqual("session-1", host.conversations.findMember(new ConversationMemberParams(conversation.id, bob.id))?.nativeSessionId);
    Assert.areEqual("session-2", host.conversations.findMember(new ConversationMemberParams(conversation.id, alice.id))?.nativeSessionId);
    const again = await host.engine.send(new MessageSendParams(conversation.id, "Continue", null, null, [], [], bob.id));
    await host.engine.waitForIdle();
    Assert.areEqual("session-1", host.adapter.requests[2]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[2]!.prompt.includes("@Alice: First answer"));
    Assert.isFalse(host.adapter.requests[2]!.prompt.includes("@Bob: First answer"));
    Assert.areEqual(MessageStatus.Completed, host.messages.find(again.replies[0]!.id)?.status);
    Assert.areEqual(1, host.listener.count(EventName.StateInvalidated));
    Assert.isTrue(host.conversations.findMember(new ConversationMemberParams(conversation.id, bob.id))!.resumedNativeSession);
    await host.engine.send(new MessageSendParams(conversation.id, "Default speaks", new RequestedSettings("fake", null, null), account.id));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[3]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[3]!.prompt.includes("@Alice: First answer"));
    await host.engine.send(new MessageSendParams(conversation.id, "@Alice follow up", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    await host.engine.send(new MessageSendParams(conversation.id, "Default returns", new RequestedSettings("fake", null, null), account.id));
    await host.engine.waitForIdle();
    Assert.areEqual("session-4", host.adapter.requests[5]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[5]!.prompt.includes("@Alice: First answer"));
  }

  @TestMethod
  public async freezesQueuedSettingsAndStopsTheWholeSend(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const account = host.createAccount();
    const alice = host.teammates.create(new TeammateCreateParams("Alice", "old role", account.id, Harness.Provider, "old", null));
    const bob = host.teammates.create(new TeammateCreateParams("Bob", null, account.id, Harness.Provider, null, null));
    const charlie = host.teammates.create(new TeammateCreateParams("Charlie", null, account.id, Harness.Provider, null, null));
    host.adapter.afterDetails = () => {
      host.teammates.update(new TeammateUpdateParams(alice.id, "Renamed", "new role", account.id, Harness.Provider, "new", null));
      host.conversations.addMember(new ConversationMemberParams(conversation.id, charlie.id));
    };
    const sent = await host.engine.send(new MessageSendParams(conversation.id, "@Bob @Alice go", null, null, [], [bob.id, alice.id]));
    await host.engine.waitForIdle();
    Assert.areEqual("old role", host.adapter.requests[1]!.instructions);
    Assert.areEqual("old", host.adapter.requests[1]!.requested.model);
    Assert.areEqual("Alice", host.messages.find(sent.replies[1]!.id)?.teammateName);
    host.adapter.afterDetails = null;
    host.adapter.holdUntilAbort = true;
    const held = await host.engine.send(new MessageSendParams(conversation.id, "@Bob @Renamed again", null, null, [], [bob.id, alice.id]));
    await host.until(() => host.adapter.requests.length === 3);
    await Assert.throwsAsync(() => host.engine.send(new MessageSendParams(conversation.id, "busy", null, null, [], [], bob.id)), ServiceException);
    await host.engine.cancel(new MessageIdParams(held.replies[1]!.id));
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.isTrue(held.replies.every(t => host.messages.find(t.id)?.status === MessageStatus.Cancelled));
    Assert.isNotNull(host.messages.find(held.replies[0]!.id)!.startedAt);
    Assert.isNull(host.messages.find(held.replies[1]!.id)!.startedAt);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async continuesAfterAFailedReplyAndCancelsViaACompletedSibling(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const account = host.createAccount();
    const alice = host.teammates.create(new TeammateCreateParams("Alice", null, account.id, Harness.Provider, null, null));
    const bob = host.teammates.create(new TeammateCreateParams("Bob", null, account.id, Harness.Provider, null, null));
    host.adapter.outcome = TurnOutcome.Failed;
    const failed = await host.engine.send(new MessageSendParams(conversation.id, "@Alice @Bob go", null, null, [], [alice.id, bob.id]));
    await host.engine.waitForIdle();
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isTrue(failed.replies.every(t => host.messages.find(t.id)?.status === MessageStatus.Failed));
    host.adapter.outcome = TurnOutcome.Completed;
    host.adapter.afterDetails = () => { host.adapter.holdUntilAbort = host.adapter.requests.length === 4; };
    const held = await host.engine.send(new MessageSendParams(conversation.id, "@Alice @Bob retry", null, null, [], [alice.id, bob.id]));
    await host.until(() => host.adapter.requests.length === 4);
    await host.engine.cancel(new MessageIdParams(held.replies[0]!.id));
    Assert.areEqual(MessageStatus.Completed, host.messages.find(held.replies[0]!.id)?.status);
    Assert.areEqual(MessageStatus.Cancelled, host.messages.find(held.replies[1]!.id)?.status);
  }

  @TestMethod
  public async storesZeroReplyMessagesForUnavailableMentionsAndRejectsStaleSelections(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const account = host.createAccount();
    const alice = host.teammates.create(new TeammateCreateParams("Alice", null, account.id, Harness.Provider, null, null));
    await Assert.throwsAsync(() => host.engine.send(new MessageSendParams(conversation.id, "go", null, null, [], [], alice.id)), ServiceException);
    await Assert.throwsAsync(() => host.engine.send(new MessageSendParams(conversation.id, "@missing", null, null, [], ["missing"])), ServiceException);
    await Assert.throwsAsync(() => host.engine.send(new MessageSendParams(conversation.id, "stale name", null, null, [], [alice.id])), ServiceException);
    host.adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, null, null);
    await host.accounts.check(new ProviderAccountIdParams(account.id));
    const signedOut = await host.engine.send(new MessageSendParams(conversation.id, "@Alice go", null, null, [], [alice.id]));
    Assert.areEqual(0, signedOut.replies.length);
    Assert.areEqual(alice.id, host.messages.find(signedOut.sent.id)?.mentions[0]?.teammateId);
    host.accounts.delete(new ProviderAccountIdParams(account.id));
    const missing = await host.engine.send(new MessageSendParams(conversation.id, "@Alice retry", null, null, [], [alice.id]));
    Assert.areEqual(0, missing.replies.length);
    await Assert.throwsAsync(() => host.engine.cancel(new MessageIdParams(missing.sent.id)), ServiceException);
    Assert.areEqual(0, host.adapter.requests.length);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async resetsAffectedMembershipsOnRewindRebindAndRejoin(): Promise<void> {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const account = host.createAccount();
    const alice = host.teammates.create(new TeammateCreateParams("Alice", null, account.id, Harness.Provider, null, null));
    const bob = host.teammates.create(new TeammateCreateParams("Bob", null, account.id, Harness.Provider, null, null));
    const member = new ConversationMemberParams(conversation.id, alice.id);
    const first = await host.engine.send(new MessageSendParams(conversation.id, "@Alice @Bob first", null, null, [], [alice.id, bob.id]));
    await host.engine.waitForIdle();
    const second = await host.engine.send(new MessageSendParams(conversation.id, "Second", null, null, [], [], alice.id));
    await host.engine.waitForIdle();
    await host.engine.rewind(new ConversationRewindParams(conversation.id, second.sent.id, false));
    Assert.isNull(host.conversations.findMember(member)?.nativeSessionId);
    Assert.areEqual("session-2", host.conversations.findMember(new ConversationMemberParams(conversation.id, bob.id))?.nativeSessionId);
    await host.engine.send(new MessageSendParams(conversation.id, "After rewind", null, null, [], [], alice.id));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[3]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[3]!.prompt.includes("User: @Alice @Bob first"));
    host.conversations.removeMember(member);
    await host.engine.send(new MessageSendParams(conversation.id, "@Alice rejoin", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[4]!.resumeNativeSessionId);
    const other = host.createAccount("fake", "Other");
    host.teammates.update(new TeammateUpdateParams(alice.id, "Alice", null, other.id, Harness.Provider, null, null));
    await host.engine.send(new MessageSendParams(conversation.id, "New account", null, null, [], [], alice.id));
    await host.engine.waitForIdle();
    Assert.isNull(host.adapter.requests[5]!.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[5]!.prompt.includes("User: @Alice @Bob first"));
    host.teammates.delete(new TeammateIdParams(alice.id));
    await host.engine.rewind(new ConversationRewindParams(conversation.id, first.sent.id, false));
  }
}
