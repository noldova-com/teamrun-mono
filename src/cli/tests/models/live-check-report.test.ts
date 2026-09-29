/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Message, MessageAuthor, MessageStatus } from "@noldova/teamrun-protocol";
import { LiveCheckReport, ReplyOutcome } from "@noldova/teamrun-cli";

@TestClass
export class LiveCheckReportTests {
  @TestMethod
  public serializesTheRun(): void {
    const reply = new Message("m-1", "c-1", 2, MessageAuthor.User, null, MessageStatus.Completed, [], null, "2026-09-10T00:00:00.000Z", null, "2026-09-10T00:00:01.000Z");
    const report = new LiveCheckReport("fake", "PONG?", "D:/tmp/project", [new ReplyOutcome(reply, 1, ["deny"])], 42);

    const json = report.toJson();

    Assert.areEqual("fake", json["provider"]);
    Assert.areEqual("PONG?", json["prompt"]);
    Assert.areEqual("D:/tmp/project", json["projectPath"]);
    Assert.areEqual(1, json["detailCount"]);
    Assert.areEqual("[\"deny\"]", JSON.stringify(json["decisions"]));
    Assert.areEqual(42, json["durationMs"]);
    Assert.areEqual("m-1", Message.fromJson((json["replies"] as unknown[])[0]).id);
  }
}
