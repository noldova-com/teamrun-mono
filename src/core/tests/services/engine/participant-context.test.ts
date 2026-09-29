/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ParticipantContext, Resources } from "@noldova/teamrun-core";
import { DetailKind, Message, MessageAuthor, MessageDetail, MessageStatus, ObservedSettings, Provenance, RequestedSettings } from "@noldova/teamrun-protocol";
import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class ParticipantContextTests {
  @TestMethod
  public pagesTheTranscriptAndKeepsTheCurrentQuestionOutsideTheHistoryCap(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    for (let index = 0; index < 110; index++)
      host.messages.insert(ParticipantContextTests.user(conversation.id, index, `message ${index}`));
    const sent = ParticipantContextTests.user(conversation.id, 110, "current question");
    host.messages.insert(sent);
    const reply = ParticipantContextTests.reply(conversation.id, 111, sent.id);
    const context = new ParticipantContext(host.messages);
    const complete = context.create(reply, sent, null);
    Assert.isTrue(complete.includes("User: message 0"));
    Assert.isTrue(complete.includes("User: message 109"));
    Assert.isTrue(complete.endsWith("User: current question"));
    const large = ParticipantContextTests.user(conversation.id, 112, "x".repeat(30_000));
    host.messages.insert(large);
    const current = ParticipantContextTests.user(conversation.id, 113, "y".repeat(30_000));
    host.messages.insert(current);
    const bounded = context.create(ParticipantContextTests.reply(conversation.id, 114, current.id), current, null);
    Assert.isTrue(bounded.includes(Resources.contextOmissionNote));
    Assert.isFalse(bounded.includes("message 109"));
    Assert.isTrue(bounded.endsWith("User: " + "y".repeat(30_000)));
    Assert.isTrue(bounded.length < 55_000);
  }

  @TestMethod
  public omitsEmptyMessagesAndWholeOlderMessagesWhenTheBudgetIsConsumed(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.messages.insert(ParticipantContextTests.user(conversation.id, 0, "old"));
    const prefix = "User: ";
    host.messages.insert(ParticipantContextTests.user(conversation.id, 1,
      "x".repeat(Resources.joinPreambleMaximumCharacters - prefix.length - Resources.transcriptSeparator.length)));
    host.messages.insert(ParticipantContextTests.user(conversation.id, 2, ""));
    const sent = ParticipantContextTests.user(conversation.id, 3, "now");
    host.messages.insert(sent);
    const context = new ParticipantContext(host.messages).create(ParticipantContextTests.reply(conversation.id, 4, sent.id), sent, null);
    Assert.isTrue(context.includes(Resources.contextOmissionNote));
    Assert.isFalse(context.includes("User: old"));
  }

  private static user(conversationId: string, sequence: number, text: string): Message {
    return new Message(`u${sequence}`, conversationId, sequence, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, text, null, "t")], null, "t", null, "t");
  }

  private static reply(conversationId: string, sequence: number, sentId: string): Message {
    return new Message(`r${sequence}`, conversationId, sequence, MessageAuthor.Provider, sentId, MessageStatus.Pending, [],
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null, null), null, false),
      "t", null, null, [], "alice", "Alice");
  }
}
