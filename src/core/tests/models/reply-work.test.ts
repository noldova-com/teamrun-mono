/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ReplyWork } from "@noldova/teamrun-core";
import { Message, MessageAuthor, MessageStatus } from "@noldova/teamrun-protocol";

@TestClass
export class ReplyWorkTests {
  @TestMethod
  public ownsTheCapturedReplyAndItsCancellation(): void {
    const message = new Message("m", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t");
    const work = new ReplyWork(message, null, "role");
    Assert.areEqual(message, work.message);
    Assert.isNull(work.account);
    Assert.areEqual("role", work.instructions);
    Assert.isFalse(work.run.isCancelled);
    work.run.cancel();
    Assert.isTrue(work.run.isCancelled);
    work.run.close();
  }
}
