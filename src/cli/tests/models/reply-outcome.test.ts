/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Message, MessageAuthor, MessageStatus } from "@noldova/teamrun-protocol";
import { ReplyOutcome } from "@noldova/teamrun-cli";

@TestClass
export class ReplyOutcomeTests {
  @TestMethod
  public copiesTheDecisions(): void {
    const reply = new Message("m-1", "c-1", 2, MessageAuthor.User, null, MessageStatus.Completed, [], null, "2026-09-10T00:00:00.000Z", null, "2026-09-10T00:00:01.000Z");
    const decisions = ["allow"];

    const outcome = new ReplyOutcome(reply, 3, decisions);
    decisions.push("deny");

    Assert.areEqual(reply, outcome.reply);
    Assert.areEqual(3, outcome.detailCount);
    Assert.areEqual("allow", outcome.decisions.join(","));
  }
}
