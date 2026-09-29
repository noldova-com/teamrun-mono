/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MessageSendResult } from "@noldova/teamrun-protocol";

@TestClass
export class MessageSendResultTests {
  private static readonly userMessage: object = {
    id: "msg-1",
    conversationId: "conv-1",
    sequence: 0,
    author: "User",
    inReplyTo: null,
    status: "Completed",
    details: [],
    provenance: null,
    createdAt: "t",
    startedAt: null,
    endedAt: "t"
  };
  private static readonly replyMessage: object = {
    id: "msg-2", conversationId: "conv-1", sequence: 1, author: "Provider", inReplyTo: "msg-1", status: "Pending", details: [],
    provenance: {
      providerAccountId: null,
      requested: { provider: "codex", model: null, effort: null },
      observed: { provider: null, model: null, effort: null, harnessVersion: null, identity: null },
      nativeSessionId: null,
      resumedNativeSession: false,
      nativeTurnId: null
    },
    createdAt: "t", startedAt: null, endedAt: null
  };
  private static readonly json: object = { sent: MessageSendResultTests.userMessage, replies: [MessageSendResultTests.replyMessage] };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = MessageSendResult.fromJson(MessageSendResultTests.json);

    Assert.areEqual(JSON.stringify(MessageSendResultTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public representsASendWithNoReplies(): void {
    const result = MessageSendResult.fromJson({ sent: MessageSendResultTests.userMessage, replies: [] });

    Assert.areEqual(0, result.replies.length);
    Assert.isFalse(Object.hasOwn(result.toJson(), "reply"));
    Assert.areEqual(0, MessageSendResult.fromJson(result.toJson()).replies.length);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => MessageSendResult.fromJson({ ...MessageSendResultTests.json, replies: [{ id: "msg-2" }] }), JsonException);

    Assert.areEqual("$.replies.0.conversationId", exception.path);
  }
}
