/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalStatus,
  AuthStatus,
  Conversation,
  DetailKind,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus,
  Project,
  ProviderAccount,
  ProviderAccountIdentity,
  ProviderDescriptor
} from "@noldova/teamrun-protocol";
import { EntityFormatter } from "@noldova/teamrun-cli";
import { ConversationMember, Harness, Teammate } from "@noldova/teamrun-protocol";

@TestClass
export class EntityFormatterTests {
  @TestMethod
  public formatsTeammatesAndMembershipSessions(): void {
    const formatter = new EntityFormatter();
    Assert.areEqual("id  Alice  account  Provider  model  high",
      formatter.formatTeammate(new Teammate("id", "Alice", null, "account", Harness.Provider, "model", "high", "t", "t")));
    Assert.areEqual("id  Alice  account  Provider    ",
      formatter.formatTeammate(new Teammate("id", "Alice", null, "account", Harness.Provider, null, null, "t", "t")));
    Assert.areEqual("id  t  session", formatter.formatMember(new ConversationMember("c", "id", "t", "session", true)));
    Assert.areEqual("id  t  ", formatter.formatMember(new ConversationMember("c", "id", "t", null, false)));
  }

  private static readonly formatter: EntityFormatter = new EntityFormatter();

  @TestMethod
  public formatsEveryEntity(): void {
    const now = "2026-09-10T00:00:00.000Z";
    const provider = new ProviderDescriptor("codex", "Codex", ["low", "high"], true, true);
    const signedIn = new ProviderAccount("a-1", "codex", "Work", "D:/p", AuthStatus.LoggedIn, new ProviderAccountIdentity("me@x.y"), "1", now, null, now);
    const anonymous = new ProviderAccount("a-2", "codex", "Home", "D:/q", AuthStatus.Unknown, new ProviderAccountIdentity(), null, null, null, now);
    const unchecked = new ProviderAccount("a-3", "codex", "Lab", "D:/r", AuthStatus.Unknown, null, null, null, null, now);
    const project = new Project("p-1", "repo", "D:/repo", now);
    const conversation = new Conversation("c-1", "p-1", "Chat", now, now);
    const message = new Message("m-1", "c-1", 1, MessageAuthor.User, null, MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, "hi", null, now)], null, now, null, now);
    const pending = new Approval("ap-1", "m-1", ApprovalKind.Command, "Bash", "Run ls", null, [new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved)], ApprovalStatus.Pending, null, now, null);
    const decided = new Approval("ap-2", "m-1", ApprovalKind.Command, "Bash", "Run ls", null, [new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved)], ApprovalStatus.Approved, "allow", now, now);

    Assert.areEqual("codex  Codex  low, high", EntityFormatterTests.formatter.formatProvider(provider));
    Assert.areEqual("a-1  codex  Work  LoggedIn  me@x.y  D:/p", EntityFormatterTests.formatter.formatAccount(signedIn));
    Assert.areEqual("a-2  codex  Home  Unknown    D:/q", EntityFormatterTests.formatter.formatAccount(anonymous));
    Assert.areEqual("a-3  codex  Lab  Unknown    D:/r", EntityFormatterTests.formatter.formatAccount(unchecked));
    Assert.areEqual("p-1  repo  D:/repo", EntityFormatterTests.formatter.formatProject(project));
    Assert.areEqual(`c-1  Chat  ${now}`, EntityFormatterTests.formatter.formatConversation(conversation));
    Assert.areEqual("1  User  Completed  m-1\n[Text] hi", EntityFormatterTests.formatter.formatMessage(message));
    Assert.areEqual("ap-1  Pending  Command  Run ls  ", EntityFormatterTests.formatter.formatApproval(pending));
    Assert.areEqual("ap-2  Approved  Command  Run ls  allow", EntityFormatterTests.formatter.formatApproval(decided));
  }
}
