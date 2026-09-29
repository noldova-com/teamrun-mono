/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeOperation } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ChangeEntity } from "@noldova/teamrun-core";
import {
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalStatus,
  ConversationIdParams,
  DetailKind,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus
} from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ApprovalsServiceTests {
  private static readonly accept: ApprovalOption = new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved);

  @TestMethod
  public insertsListsFindsAndUpdatesApprovals(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const other = host.createConversation();
    host.messages.insert(ApprovalsServiceTests.message(conversation.id, "m1"));
    host.messages.insert(ApprovalsServiceTests.message(other.id, "m2"));
    const first = ApprovalsServiceTests.approval("a1", "m1");
    const second = ApprovalsServiceTests.approval("a2", "m1");
    const elsewhere = ApprovalsServiceTests.approval("a3", "m2");

    host.approvals.insert(first);
    host.approvals.insert(second);
    host.approvals.insert(elsewhere);
    host.approvals.update(second.withDecision("accept", "t2"));

    Assert.areEqual("a1", host.approvals.list(new ConversationIdParams(conversation.id)).map(t => t.id).join(","));
    Assert.areEqual("a3", host.approvals.list(new ConversationIdParams(other.id)).map(t => t.id).join(","));
    Assert.areEqual("a1", host.approvals.listPending("m1").map(t => t.id).join(","));
    Assert.areEqual(ApprovalStatus.Approved, host.approvals.find("a2")?.status);
    Assert.isNull(host.approvals.find("nope"));
    const changes = host.context.database.changeFeed.readAfter(0).filter(t => t.entity === ChangeEntity.Approval);
    Assert.areEqual(4, changes.length);
    Assert.areEqual(ChangeOperation.Update, changes.at(-1)?.operation);
  }

  private static message(conversationId: string, id: string): Message {
    return new Message(id, conversationId, 0, MessageAuthor.User, null, MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, "Hi", null, "t")], null, "t", null, "t");
  }

  private static approval(id: string, messageId: string): Approval {
    return new Approval(id, messageId, ApprovalKind.Command, "commandExecution", "Run", null, [ApprovalsServiceTests.accept], ApprovalStatus.Pending, null, "t", null);
  }
}
