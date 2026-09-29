/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Message, MessageAuthor, MessagePage, MessageStatus } from "@noldova/teamrun-protocol";

@TestClass
export class MessagePageTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const message = new Message("msg-1", "conv-1", 3, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t1", null, "t1");
    const page = new MessagePage([message], true, false);

    const read = MessagePage.fromJson(JSON.parse(JSON.stringify(page.toJson())));

    Assert.areEqual(JSON.stringify(page.toJson()), JSON.stringify(read.toJson()));
    Assert.areEqual(1, read.messages.length);
    Assert.areEqual("msg-1", read.messages[0]?.id);
    Assert.isTrue(read.hasEarlier);
    Assert.isFalse(read.hasLater);
    Assert.areEqual(0, new MessagePage([], false, false).messages.length);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const badMessages = Assert.throws(() => MessagePage.fromJson({ messages: "x", hasEarlier: false, hasLater: false }), JsonException);
    const badFlag = Assert.throws(() => MessagePage.fromJson({ messages: [], hasEarlier: "no", hasLater: false }), JsonException);

    Assert.areEqual("$.messages", badMessages.path);
    Assert.areEqual("$.hasEarlier", badFlag.path);
  }
}
