/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TurnOutcome } from "@noldova/teamrun-core";
import { ApprovalKind, DetailKind } from "@noldova/teamrun-protocol";
import { ClaudeTurn, DeltaStream } from "@noldova/teamrun-providers";

import { FakeClaudeQuery } from "../../fixtures/fake-claude-query.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { SdkMessages } from "../../fixtures/sdk-messages.fixture.js";

@TestClass
export class ClaudeTurnTests {
  @TestMethod
  public async replacesEachStreamedBlockWhenTheBlocksArriveOneMessageAtATime(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const first = "33333333-3333-3333-3333-333333333333";
    const second = "44444444-4444-4444-4444-444444444444";
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-3", "none", null, []),
      SdkMessages.messageStart("s-3", first),
      SdkMessages.thinkingDelta("s-3", first, 0, "Pond"),
      SdkMessages.blockStop("s-3", first, 0),
      SdkMessages.assistant("55555555-5555-5555-5555-555555555555", [SdkMessages.thinking("Pondering")], "claude-opus-5"),
      SdkMessages.textDelta("s-3", first, 1, "Hel"),
      SdkMessages.textDelta("s-3", first, 1, "lo"),
      SdkMessages.blockStop("s-3", first, 1),
      SdkMessages.assistant("66666666-6666-6666-6666-666666666666", [SdkMessages.text("Hello!")], "claude-opus-5"),
      SdkMessages.assistant("77777777-7777-7777-7777-777777777777", [SdkMessages.toolUse("tool-1", "Bash", { command: "ls" })], "claude-opus-5"),
      SdkMessages.messageStart("s-3", second),
      SdkMessages.textDelta("s-3", second, 0, "Do"),
      SdkMessages.assistant("88888888-8888-8888-8888-888888888888", [SdkMessages.text("Done.")], "claude-opus-5"),
      SdkMessages.success("s-3", "Done.")
    ]);

    await turn.consume(query);

    const texts = listener.details.filter(t => t.kind === DetailKind.Text);
    Assert.areEqual(JSON.stringify(["s-3:stream1:1", "s-3:stream2:0"]), JSON.stringify([...new Set(texts.map(t => t.providerItemId))]));
    Assert.areEqual("Hello!", texts.filter(t => t.providerItemId === "s-3:stream1:1").at(-1)?.text);
    Assert.areEqual("Done.", texts.at(-1)?.text);
    Assert.areEqual("Pondering", listener.details.filter(t => t.providerItemId === "s-3:stream1:0").at(-1)?.text);
  }

  @TestMethod
  public async growsStreamedBlocksThenReusesTheirIdsForTheCompleteMessage(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const uuid = "22222222-2222-2222-2222-222222222222";
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-2", "none", null, []),
      SdkMessages.messageStart("s-2", uuid),
      SdkMessages.thinkingDelta("s-2", uuid, 0, "Pond"),
      SdkMessages.textDelta("s-2", uuid, 1, "Hel"),
      SdkMessages.textDelta("s-2", uuid, 1, "lo"),
      SdkMessages.otherDelta("s-2", uuid, 2),
      SdkMessages.blockStop("s-2", uuid, 1),
      SdkMessages.textDelta("s-2", uuid, 1, " ignored", "parent-tool"),
      SdkMessages.assistant(uuid, [SdkMessages.thinking("Pondering"), SdkMessages.text("Hello!")], "claude-opus-5"),
      SdkMessages.success("s-2", "Hello!")
    ]);

    await turn.consume(query);

    const texts = listener.details.filter(t => t.providerItemId === "s-2:stream1:1");
    Assert.isTrue(texts.length >= 2, String(texts.length));
    Assert.areEqual("Hello!", texts[texts.length - 1]?.text);
    Assert.areEqual("Hello", texts[texts.length - 2]?.text);
    const reasoning = listener.details.filter(t => t.providerItemId === "s-2:stream1:0");
    Assert.areEqual("Pondering", reasoning[reasoning.length - 1]?.text);
    Assert.isFalse(listener.details.some(t => t.text.includes("ignored")));
    Assert.areEqual(TurnOutcome.Completed, turn.toResult().outcome);
  }

  @TestMethod
  public async reportsTheSessionBlocksAndResult(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, "s-1", new DeltaStream(listener, 1));
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", "high", []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [
        SdkMessages.text("Hello"),
        SdkMessages.text("  "),
        SdkMessages.thinking("Pondering"),
        SdkMessages.thinking(""),
        SdkMessages.toolUse("tu-1", "Bash", { command: "ls -la" }),
        SdkMessages.toolUse("tu-2", "Edit", { file_path: "a.ts", old: "x" }),
        SdkMessages.toolUse("tu-3", "Read", { a: 1, b: 2, c: 3, d: 4, e: 5 }),
        SdkMessages.toolUse("tu-4", "Glob", {}),
        SdkMessages.toolUse("tu-5", "Custom", "raw")
      ], "claude-sonnet-5"),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.text("child")], "claude-sonnet-5", "tu-1"),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("switched")], "claude-opus-5"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [
        SdkMessages.toolResult("tu-1", "listing"),
        SdkMessages.toolResult("tu-2", [SdkMessages.textParam("part one"), SdkMessages.imageParam(), SdkMessages.textParam("part two")], true),
        SdkMessages.toolResult("tu-3", undefined),
        SdkMessages.toolResult("tu-4", "   "),
        SdkMessages.textParam("plain user text")
      ]),
      SdkMessages.user("55555555-5555-5555-5555-555555555555", "typed by hand"),
      SdkMessages.user("66666666-6666-6666-6666-666666666666", [SdkMessages.toolResult("tu-9", "child result")], "tu-1"),
      SdkMessages.status("s-1"),
      SdkMessages.success("s-1", "All done")
    ]);
    query.accountInfoResult = { email: "a@b.c", organization: "Org", subscriptionType: "max" };

    await turn.consume(query);
    const result = turn.toResult();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("s-1", result.nativeSessionId);
    Assert.areEqual("claude-opus-5", turn.observed.model);
    Assert.areEqual("claude-opus-5", result.observed.model);
    Assert.areEqual("high", result.observed.effort);
    Assert.areEqual("2.1.263", result.observed.harnessVersion);
    Assert.areEqual("a@b.c", result.observed.identity?.email);
    Assert.areEqual("claude.ai login", result.observed.identity?.authMethod);
    Assert.areEqual("s-1", listener.starts[0]?.nativeSessionId);
    Assert.isTrue(listener.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(3, listener.observations.length);
    const expectedTexts = [
      "Session tools: Read, Bash. MCP servers: none. Permission mode: acceptEdits.", "Hello", "Pondering", "Bash: ls -la", "Edit: a.ts", "Read (a, b, c, d)",
      "Glob", "Custom", "switched", "listing", "part one\n\npart two"
    ];
    Assert.areEqual(expectedTexts.join("|"), listener.texts.join("|"));
    Assert.areEqual("s-1:init", listener.details[0]?.providerItemId);
    Assert.areEqual(DetailKind.Reasoning, listener.details[2]?.kind);
    Assert.areEqual(DetailKind.Command, listener.details[3]?.kind);
    Assert.areEqual("11111111-1111-1111-1111-111111111111:4", listener.details[3]?.providerItemId);
    Assert.areEqual("{\"tool\":\"Bash\",\"input\":{\"command\":\"ls -la\"},\"toolUseId\":\"tu-1\"}", JSON.stringify(listener.details[3]?.payload));
    Assert.areEqual(DetailKind.FileChange, listener.details[4]?.kind);
    Assert.areEqual(DetailKind.Note, listener.details[5]?.kind);
    Assert.areEqual("{\"toolUseId\":\"tu-1\",\"isError\":false}", JSON.stringify(listener.details[9]?.payload));
    Assert.areEqual("{\"toolUseId\":\"tu-2\",\"isError\":true}", JSON.stringify(listener.details[10]?.payload));
    Assert.areEqual("44444444-4444-4444-4444-444444444444:1", listener.details[10]?.providerItemId);
  }

  @TestMethod
  public async describesApiKeysServersAndMissingAccountDetails(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-2", "user", null, [{ name: "srv", status: "connected" }, { name: "other", status: "failed" }]),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tu-1", "no uuid")]),
      SdkMessages.failure("s-2", "error_max_turns", ["a", "b"])
    ]);
    query.accountInfoFailure = new Error("nope");

    await turn.consume(query);
    const result = turn.toResult();

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual("error_max_turns: a; b", result.error);
    Assert.isNull(result.observed.effort);
    Assert.areEqual("api key (user)", result.observed.identity?.authMethod);
    Assert.isUndefined(result.observed.identity?.email);
    Assert.isFalse(listener.starts[0]?.resumedNativeSession ?? true);
    Assert.areEqual("Session tools: Read, Bash. MCP servers: srv (connected), other (failed). Permission mode: acceptEdits.", listener.texts[0]);
    Assert.areEqual("The account details could not be read: nope", listener.texts[1]);
    Assert.isNull(listener.details[2]?.providerItemId);
  }

  @TestMethod
  public async handlesInterruptionsAndMissingResults(): Promise<void> {
    const silentListener = new RecordingTurnListener();
    const silent = new ClaudeTurn(silentListener, null, new DeltaStream(silentListener, 1));
    const interruptedListener = new RecordingTurnListener();
    const interrupted = new ClaudeTurn(interruptedListener, null, new DeltaStream(interruptedListener, 1));
    const explicitListener = new RecordingTurnListener();
    const explicit = new ClaudeTurn(explicitListener, null, new DeltaStream(explicitListener, 1));
    const untouchedListener = new RecordingTurnListener();
    const untouched = new ClaudeTurn(untouchedListener, null, new DeltaStream(untouchedListener, 1));

    await silent.consume(new FakeClaudeQuery([SdkMessages.init("s-3", "none", null, [])]));
    interrupted.markInterrupted();
    await interrupted.consume(new FakeClaudeQuery([SdkMessages.failure("s-4", "error_during_execution", [])]));
    interrupted.fail("ignored");
    explicit.fail("exploded");

    Assert.areEqual(TurnOutcome.Failed, silent.outcome);
    Assert.areEqual("Claude Code ended without a result message.", silent.toResult().error);
    Assert.areEqual(TurnOutcome.Interrupted, interrupted.outcome);
    Assert.isTrue(interrupted.isInterrupted);
    Assert.isNull(interrupted.toResult().error);
    Assert.areEqual("error_during_execution", interruptedListener.texts[0]);
    Assert.areEqual("exploded", explicit.toResult().error);
    Assert.areEqual(TurnOutcome.Failed, untouched.toResult().outcome);
    Assert.areEqual("Claude Code ended without a result message.", untouched.toResult().error);
    Assert.isNull(untouched.sessionId);
  }

  @TestMethod
  public async decidesToolUseThroughTheListener(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow", "deny");
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));

    const allowed = await turn.decide("Bash", { command: "ls" });
    const denied = await turn.decide("Write", { file_path: "a.ts" });
    const tool = await turn.decide("WebFetch", {});

    Assert.areEqual("allow", allowed.behavior);
    Assert.areEqual("{\"command\":\"ls\"}", JSON.stringify(allowed.behavior === "allow" ? allowed.updatedInput : null));
    Assert.areEqual("deny", denied.behavior);
    Assert.areEqual("Denied by the TeamRun user.", denied.behavior === "deny" ? denied.message : null);
    Assert.areEqual("deny", tool.behavior);
    Assert.areEqual("pending:1,pending:2,pending:3", listener.asks.map(t => t.providerRequestId).join(","));
    Assert.areEqual(ApprovalKind.Command, listener.asks[0]?.kind);
    Assert.areEqual("Bash", listener.asks[0]?.nativeKind);
    Assert.areEqual("Bash: ls", listener.asks[0]?.summary);
    Assert.areEqual("{\"tool\":\"Bash\",\"input\":{\"command\":\"ls\"}}", JSON.stringify(listener.asks[0]?.payload));
    Assert.areEqual(ApprovalKind.FileChange, listener.asks[1]?.kind);
    Assert.areEqual(ApprovalKind.Tool, listener.asks[2]?.kind);
    Assert.areEqual("WebFetch", listener.asks[2]?.summary);
    Assert.areEqual("allow,deny", listener.asks[0]?.options.map(t => t.id).join(","));
  }
}
