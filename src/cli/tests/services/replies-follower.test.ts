/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DecisionPolicy, RepliesFollower, RuntimeSession } from "@noldova/teamrun-cli";
import { Event, EventName, Message, MessageAuthor, MessageStatus } from "@noldova/teamrun-protocol";
import { CliTestHost } from "../fixtures/cli-test-host.fixture.js";

@TestClass
export class RepliesFollowerTests {
  @TestMethod
  public async replaysEarlyEventsAndReturnsRepliesInTheirOriginalOrder(): Promise<void> {
    await using host = await CliTestHost.create();
    using session = await RuntimeSession.open(host.connections);
    const first = new Message("a", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t");
    const second = new Message("b", "c", 1, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t");
    const follower = new RepliesFollower(session, host.console, DecisionPolicy.Deny, false);
    follower.handleEvent(new Event(EventName.MessageUpdated, second.toJson()));
    const pending = follower.follow([first, second]);
    follower.handleEvent(new Event(EventName.MessageUpdated, first.toJson()));
    const result = await pending;
    Assert.areEqual("a,b", result.map(t => t.reply.id).join(","));
    const empty = new RepliesFollower(session, host.console, DecisionPolicy.Ask, true);
    Assert.areEqual(0, (await empty.follow([])).length);
  }
}
