/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PassThrough } from "node:stream";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalStatus,
  DetailEventPayload,
  DetailKind,
  Event,
  EventName,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus
} from "@noldova/teamrun-protocol";
import { DecisionPolicy, ReplyFollower, RuntimeSession, TerminalConsole } from "@noldova/teamrun-cli";

import { CliTestHost } from "../fixtures/cli-test-host.fixture.js";
import { FakeConsole } from "../fixtures/fake-console.fixture.js";

@TestClass
export class ReplyFollowerTests {
  @TestMethod
  public async closesPendingApprovalInputWhenTheReplyEndsAndIgnoresLateEvents(): Promise<void> {
    await using host = await CliTestHost.create();
    using session = await RuntimeSession.open(host.connections);
    const input = new PassThrough();
    using console = new TerminalConsole(input, new PassThrough(), new PassThrough());
    const follower = new ReplyFollower(session, console, DecisionPolicy.Ask, true);
    const pending = follower.follow("reply");
    const approval = new Approval("a", "reply", ApprovalKind.Tool, "Read", "Read", null,
      [new ApprovalOption("no", "No", ApprovalOutcome.Denied)], ApprovalStatus.Pending, null, "t", null);
    follower.handleEvent(new Event(EventName.ApprovalCreated, approval.toJson()));
    await Promise.resolve();
    follower.handleEvent(new Event(EventName.ApprovalCreated, approval.toJson()));
    const ended = new Message("reply", "c", 1, MessageAuthor.User, null, MessageStatus.Cancelled, [], null, "t", null, "t");
    follower.handleEvent(new Event(EventName.MessageUpdated, ended.toJson()));
    follower.handleEvent(new Event(EventName.ApprovalCreated, approval.toJson()));
    Assert.areEqual(MessageStatus.Cancelled, (await pending).reply.status);
    input.write("next question\n");
    Assert.areEqual("next question", await console.ask("next"));
    input.end();
    const failed = new ReplyFollower(session, new FakeConsole(), DecisionPolicy.Deny, false);
    const failure = failed.follow("reply");
    failed.handleEvent(new Event(EventName.ApprovalCreated, approval.toJson()));
    await Assert.throwsAsync(() => failure, Error);
  }

  @TestMethod
  public async buffersEventsUntilTheReplyIsKnownAndIgnoresOtherMessages(): Promise<void> {
    await using host = await CliTestHost.create();
    const session = await RuntimeSession.open(host.connections);
    const console = new FakeConsole();
    const follower = new ReplyFollower(session, console, DecisionPolicy.Deny, true);
    const now = "2026-09-10T00:00:00.000Z";
    const detail = new MessageDetail(0, DetailKind.Text, "early", null, now);
    const other = new Message("m-other", "c", 1, MessageAuthor.User, null, MessageStatus.Completed, [], null, now, null, now);
    const reply = new Message("m-1", "c", 2, MessageAuthor.User, null, MessageStatus.Completed, [detail], null, now, null, now);
    const running = new Message("m-1", "c", 2, MessageAuthor.User, null, MessageStatus.Running, [], null, now, null, null);

    follower.handleEvent(new Event(EventName.DetailAppended, new DetailEventPayload("m-1", detail).toJson()));
    follower.handleEvent(new Event(EventName.DetailAppended, new DetailEventPayload("m-other", detail).toJson()));
    follower.handleEvent(new Event(EventName.MessageUpdated, running.toJson()));
    follower.handleEvent(new Event(EventName.MessageUpdated, other.toJson()));
    follower.handleEvent(new Event(EventName.ProviderAccountUpdated, null));
    const foreign = new Approval("ap-1", "m-other", ApprovalKind.Tool, "Read", "Read", null, [new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved)], ApprovalStatus.Pending, null, now, null);
    follower.handleEvent(new Event(EventName.ApprovalCreated, foreign.toJson()));
    const outcome = follower.follow("m-1");
    follower.handleEvent(new Event(EventName.MessageUpdated, reply.toJson()));
    const result = await outcome;
    session[Symbol.dispose]();

    Assert.areEqual("[Text] early,-- reply Completed", console.lines.join(","));
    Assert.areEqual(1, result.detailCount);
    Assert.areEqual("m-1", result.reply.id);
    Assert.areEqual(0, result.decisions.length);
  }
}
