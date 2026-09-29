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
  DetailKind,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageListParams,
  MessagePageParams,
  MessageStatus,
  ObservedSettings,
  Provenance,
  RequestedSettings,
  ReplyPanel
} from "@noldova/teamrun-protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";

@TestClass
export class MessagesServiceTests {
  @TestMethod
  public pagesMatchingRepliesWithSmallSummariesAndExclusiveCursors(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const activity: number[] = [];
    const changes: number[] = [];
    for (let i = 0; i < 180; i++) {
      const details = [new MessageDetail(0, DetailKind.Text, "answer".repeat(100), null, "t")];
      if (i % 3 === 0) {
        details.push(new MessageDetail(1, DetailKind.Command, "$ run\n" + "output".repeat(1000), null, "t"));
        activity.push(i);
      }
      if (i % 10 === 0) {
        details.push(new MessageDetail(2, DetailKind.FileChange, "changes", { source: "workingTree", changes: [{ path: "a.ts", diff: "-old\n+new" }] }, "t"));
        changes.push(i);
      }
      host.messages.insert(MessagesServiceTests.reply(conversation.id, i, MessageStatus.Running).withDetails(details).withStatus(MessageStatus.Completed, "t2"));
    }
    for (const [panel, sequences] of [[ReplyPanel.Activity, activity], [ReplyPanel.Changes, changes]] as const) {
      const newest = host.messages.replyPage(new MessagePageParams(conversation.id, null, null, 5), panel);
      Assert.areEqual(sequences.slice(-5).toReversed().join(","), newest.replies.map(t => t.preview.sequence).join(","));
      Assert.isTrue(newest.hasEarlier);
      Assert.isFalse(newest.hasLater);
      const cursor = newest.replies.at(-1)?.preview.sequence ?? 0;
      const older = host.messages.replyPage(new MessagePageParams(conversation.id, cursor, null, 5), panel);
      Assert.areEqual(sequences.slice(-10, -5).toReversed().join(","), older.replies.map(t => t.preview.sequence).join(","));
      Assert.isTrue(older.hasLater);
      const newer = host.messages.replyPage(new MessagePageParams(conversation.id, null, older.replies[0]?.preview.sequence ?? 0, 2), panel);
      Assert.areEqual(sequences.slice(-5, -3).toReversed().join(","), newer.replies.map(t => t.preview.sequence).join(","));
      Assert.isTrue(newer.hasEarlier);
      Assert.isTrue(newer.hasLater);
      const earliest = host.messages.replyPage(new MessagePageParams(conversation.id, 1, null, 50), panel);
      Assert.areEqual(1, earliest.replies.length);
      Assert.isFalse(earliest.hasEarlier);
      const empty = host.messages.replyPage(new MessagePageParams(conversation.id, 0, null, 50), panel);
      Assert.areEqual(0, empty.replies.length);
      Assert.isFalse(empty.hasLater);
      Assert.isFalse(JSON.stringify(newest.toJson()).includes("outputoutput"));
      Assert.isFalse(JSON.stringify(newest.toJson()).includes("-old"));
    }
  }

  @TestMethod
  public matchesClaudeEditsAndExcludesOtherConversationsImagesAndMalformedChanges(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const details = [new MessageDetail(0, DetailKind.FileChange, "Bad changes", { changes: ["junk", 5, {}, { path: " " }] }, "t"),
      new MessageDetail(1, DetailKind.Note, "Image", { itemType: "imageGeneration" }, "t"),
      new MessageDetail(2, DetailKind.Error, "failed", null, "t"),
      new MessageDetail(3, DetailKind.FileChange, "Write", { tool: "Write", input: { file_path: "x", content: "a\nb" } }, "t")];
    host.messages.insert(MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Running).withDetails(details));
    host.messages.insert(MessagesServiceTests.reply(conversation.id, 2, MessageStatus.Running).withDetails(details.slice(1, 2)).withStatus(MessageStatus.Completed, "t2"));
    host.messages.insert(MessagesServiceTests.userMessage(conversation.id, 3, "text"));
    const page = host.messages.replyPage(new MessagePageParams(conversation.id, null, null, 50), ReplyPanel.Changes);
    Assert.areEqual(1, page.replies.length);
    Assert.areEqual(2, page.replies[0]?.files[0]?.additions);
    Assert.areEqual(1, host.messages.replyPage(new MessagePageParams(conversation.id, null, null, 50), ReplyPanel.Activity).replies.length);
    Assert.areEqual(0, host.messages.replyPage(new MessagePageParams("different", null, null, 50), ReplyPanel.Changes).replies.length);
  }

  @TestMethod
  public persistsStreamProgressWithoutKeepingEveryGrowingCopyInTheFeed(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.messages.insert(MessagesServiceTests.userMessage(conversation.id, 0, "Hi"));
    let reply = MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Running);
    host.messages.insert(reply);
    for (let i = 0; i < 100; i++) {
      reply = reply.withDetails([new MessageDetail(0, DetailKind.Text, "x".repeat(i + 1), null, "t")]);
      host.messages.update(reply);
    }
    Assert.areEqual(100, host.messages.find(reply.id)?.details[0]?.text.length);
    host.messages.update(reply.withStatus(MessageStatus.Completed, "t2"));
    const changes = host.context.database.changeFeed.readAfter(0).filter(t => t.entity === ChangeEntity.Message);
    Assert.areEqual(3, changes.length);
    Assert.areEqual(MessageStatus.Completed, host.messages.find(reply.id)?.status);
  }

  @TestMethod
  public insertsListsAndFindsMessagesInSequenceOrder(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const first = MessagesServiceTests.userMessage(conversation.id, 0, "First");
    const second = MessagesServiceTests.userMessage(conversation.id, 1, "Second");

    Assert.areEqual(0, host.messages.nextSequence(conversation.id));
    host.messages.insert(second);
    host.messages.insert(first);

    Assert.areEqual(2, host.messages.nextSequence(conversation.id));
    Assert.areEqual("First,Second", host.messages.list(new MessageListParams(conversation.id, null)).map(t => t.details[0]?.text).join(","));
    Assert.areEqual("Second", host.messages.list(new MessageListParams(conversation.id, 0))[0]?.details[0]?.text);
    Assert.areEqual("First", host.messages.find(first.id)?.details[0]?.text);
    Assert.isNull(host.messages.find("nope"));
    Assert.areEqual(2, host.context.database.changeFeed.readAfter(0).filter(t => t.entity === ChangeEntity.Message && t.operation === ChangeOperation.Insert).length);
  }

  @TestMethod
  public listsOnlyTheDetailsOfTheKindsAsked(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    host.messages.insert(MessagesServiceTests.userMessage(conversation.id, 0, "Hi"));

    const texts = host.messages.list(new MessageListParams(conversation.id, null, [DetailKind.Text]));
    const notes = host.messages.list(new MessageListParams(conversation.id, null, [DetailKind.Note]));

    Assert.areEqual(1, texts[0]?.details.length);
    Assert.areEqual(0, notes[0]?.details.length);
  }

  @TestMethod
  public pagesTheNewestMessagesAndAroundACursor(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    for (let i = 0; i < 5; i++)
      host.messages.insert(MessagesServiceTests.userMessage(conversation.id, i, `M${i}`));
    const texts = (page: { messages: readonly { details: readonly { text: string }[] }[] }): string => page.messages.map(t => t.details[0]?.text).join(",");

    const newest = host.messages.page(new MessagePageParams(conversation.id, null, null, 2));
    const before = host.messages.page(new MessagePageParams(conversation.id, 3, null, 2));
    const after = host.messages.page(new MessagePageParams(conversation.id, null, 1, 10));
    const all = host.messages.page(new MessagePageParams(conversation.id, null, null, 10));
    const none = host.messages.page(new MessagePageParams(conversation.id, 0, null, 10));

    Assert.areEqual("M3,M4", texts(newest));
    Assert.isTrue(newest.hasEarlier);
    Assert.isFalse(newest.hasLater);
    Assert.areEqual("M1,M2", texts(before));
    Assert.isTrue(before.hasEarlier);
    Assert.isTrue(before.hasLater);
    Assert.areEqual("M2,M3,M4", texts(after));
    Assert.isTrue(after.hasEarlier);
    Assert.isFalse(after.hasLater);
    Assert.areEqual(5, all.messages.length);
    Assert.isFalse(all.hasEarlier);
    Assert.areEqual(0, none.messages.length);
    Assert.isFalse(none.hasEarlier);
    Assert.isFalse(none.hasLater);
  }

  @TestMethod
  public findsTheOpenReplyAndUpdatesMessages(): void {
    using host = new CoreHost();
    const conversation = host.createConversation();
    const reply = MessagesServiceTests.reply(conversation.id, 1, MessageStatus.Pending);
    host.messages.insert(MessagesServiceTests.userMessage(conversation.id, 0, "Hi"));
    host.messages.insert(reply);

    Assert.areEqual(reply.id, host.messages.findOpenReply(conversation.id)?.id);
    host.messages.update(reply.withStatus(MessageStatus.Completed, "t2"));

    Assert.isNull(host.messages.findOpenReply(conversation.id));
    Assert.areEqual(MessageStatus.Completed, host.messages.find(reply.id)?.status);
    Assert.areEqual(ChangeOperation.Update, host.context.database.changeFeed.readAfter(0).at(-1)?.operation);
  }

  private static userMessage(conversationId: string, sequence: number, text: string): Message {
    const detail = new MessageDetail(0, DetailKind.Text, text, null, "t");
    return new Message(`msg-${sequence}`, conversationId, sequence, MessageAuthor.User, null, MessageStatus.Completed, [detail], null, "t", null, "t");
  }

  private static reply(conversationId: string, sequence: number, status: MessageStatus): Message {
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null, null), null, false);
    return new Message(`reply-${sequence}`, conversationId, sequence, MessageAuthor.Provider, "msg-0", status, [], provenance, "t",
      status === MessageStatus.Pending ? null : "t", null);
  }
}
