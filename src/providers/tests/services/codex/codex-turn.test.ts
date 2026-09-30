/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TurnOutcome } from "@noldova/teamrun-core";
import { ApprovalKind, DetailKind, ObservedSettings } from "@noldova/teamrun-protocol";
import { CodexItemReader, CodexTurn, DeltaStream, InvalidOperationException, UnsupportedServerRequestException } from "@noldova/teamrun-providers";

import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class CodexTurnTests {
  @TestMethod
  public reportsItemsReroutesAndErrorsForItsThread(): void {
    const listener = new RecordingTurnListener();
    const turn = CodexTurnTests.createTurn(listener);

    turn.handleNotification("item/completed", JsonReader.fromValue({ threadId: "other", item: { id: "x", type: "agentMessage", text: "elsewhere" } }));
    turn.handleNotification("item/completed", JsonReader.fromValue({ item: { id: "x", type: "agentMessage", text: "nowhere" } }));
    turn.handleNotification("item/started", JsonReader.fromValue({ threadId: "t-1", item: { id: "c", type: "commandExecution", command: "ls" } }));
    turn.handleNotification("item/started", JsonReader.fromValue({ threadId: "t-1", item: { id: "r", type: "reasoning" } }));
    turn.handleNotification("item/completed", JsonReader.fromValue({ threadId: "t-1", item: { id: "a", type: "agentMessage", text: "hi" } }));
    turn.handleNotification("item/completed", JsonReader.fromValue({ threadId: "t-1", item: { id: "u", type: "userMessage" } }));
    turn.handleNotification("model/rerouted", JsonReader.fromValue({ threadId: "t-1", fromModel: "a", toModel: "b", reason: "load" }));
    turn.handleNotification("error", JsonReader.fromValue({ threadId: "t-1", error: { message: "again" }, willRetry: true }));
    turn.handleNotification("error", JsonReader.fromValue({ threadId: "t-1", error: { message: "dead" }, willRetry: false }));
    turn.handleNotification("thread/tokenUsage/updated", JsonReader.fromValue({ threadId: "t-1" }));

    Assert.areEqual("Running: ls,hi,Codex rerouted the model from a to b (load).,Retryable error: again,Error: dead", listener.texts.join(","));
    Assert.areEqual(DetailKind.Note, listener.details[3]?.kind);
    Assert.areEqual(DetailKind.Error, listener.details[4]?.kind);
    Assert.areEqual("b", turn.observed.model);
    Assert.areEqual("b", listener.lastObserved?.model);
    Assert.areEqual(1, listener.thinking);
    Assert.isFalse(turn.isComplete);
  }

  @TestMethod
  public settlesOnceFromTheTurnCompletion(): void {
    const completed = CodexTurnTests.createTurn(new RecordingTurnListener());
    const interrupted = CodexTurnTests.createTurn(new RecordingTurnListener());
    const failed = CodexTurnTests.createTurn(new RecordingTurnListener());
    const failedWithoutError = CodexTurnTests.createTurn(new RecordingTurnListener());
    completed.begin("turn-1");

    completed.handleNotification("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-other", status: "failed" } }));
    completed.handleNotification("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-1", status: "completed" } }));
    completed.fail("late");
    interrupted.handleNotification("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-1", status: "interrupted" } }));
    failed.handleNotification("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-1", status: "failed", error: { message: "boom" } } }));
    failedWithoutError.handleNotification("turn/completed", JsonReader.fromValue({ threadId: "t-1", turn: { id: "turn-1", status: "cancelled", error: null } }));

    Assert.areEqual(TurnOutcome.Completed, completed.outcome);
    Assert.areEqual("turn-1", completed.turnId);
    Assert.isNull(completed.error);
    Assert.areEqual(TurnOutcome.Interrupted, interrupted.outcome);
    Assert.areEqual(TurnOutcome.Failed, failed.outcome);
    Assert.areEqual("boom", failed.error);
    Assert.areEqual("The turn ended with status \"cancelled\".", failedWithoutError.error);
    Assert.areEqual(TurnOutcome.Completed, completed.toResult(false).outcome);
    Assert.areEqual("turn-1", completed.toResult(false).nativeTurnId);
  }

  @TestMethod
  public async buildsResultsAndRejectsEarlyReads(): Promise<void> {
    const pending = CodexTurnTests.createTurn(new RecordingTurnListener());
    const failed = CodexTurnTests.createTurn(new RecordingTurnListener());
    const interrupted = CodexTurnTests.createTurn(new RecordingTurnListener());
    const completion = failed.waitForCompletion();

    Assert.throws(() => pending.toResult(false), InvalidOperationException);
    failed.fail("broken");
    interrupted.interrupt();
    await completion;

    Assert.areEqual("broken", failed.toResult(false).error);
    Assert.areEqual(TurnOutcome.Interrupted, failed.toResult(true).outcome);
    Assert.isNull(failed.toResult(true).error);
    Assert.areEqual("t-1", interrupted.toResult(false).nativeSessionId);
    Assert.areEqual(TurnOutcome.Interrupted, interrupted.toResult(false).outcome);
    Assert.areEqual("threadId", Assert.throws(() => CodexTurnTests.createTurn(new RecordingTurnListener(), " "), ArgumentException).parameterName);
    Assert.areEqual("turnId", Assert.throws(() => pending.begin(""), ArgumentException).parameterName);
  }

  @TestMethod
  public async answersApprovalRequestsWithTheListenerDecision(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("acceptForSession", "decline");
    const turn = CodexTurnTests.createTurn(listener);

    const command = await turn.handleServerRequest("item/commandExecution/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "c1", command: "rm x", cwd: "D:/w", reason: "clean" }));
    const bareCommand = await turn.handleServerRequest("item/commandExecution/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "c2" }));
    const change = await turn.handleServerRequest("item/fileChange/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "f1", reason: "apply", grantRoot: "D:/w" }));
    const bareChange = await turn.handleServerRequest("item/fileChange/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "f2" }));
    const input = await turn.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({ threadId: "t-1", itemId: "q" }));
    const unsupported = await Assert.throwsAsync(() => turn.handleServerRequest("item/permissions/requestApproval", JsonReader.fromValue({ threadId: "t-1" })), UnsupportedServerRequestException);

    Assert.areEqual("{\"decision\":\"acceptForSession\"}", JSON.stringify(command));
    Assert.areEqual("{\"decision\":\"decline\"}", JSON.stringify(bareCommand));
    Assert.areEqual("{\"decision\":\"accept\"}", JSON.stringify(change));
    Assert.areEqual("{\"decision\":\"accept\"}", JSON.stringify(bareChange));
    Assert.areEqual("{\"answers\":{}}", JSON.stringify(input));
    Assert.areEqual("item/permissions/requestApproval", unsupported.method);
    Assert.areEqual("t-1:c1:1,t-1:c2:2,t-1:f1:3,t-1:f2:4", listener.asks.map(t => t.providerRequestId).join(","));
    Assert.areEqual("Run command: rm x", listener.asks[0]?.summary);
    Assert.areEqual(ApprovalKind.Command, listener.asks[0]?.kind);
    Assert.areEqual("{\"command\":\"rm x\",\"cwd\":\"D:/w\",\"reason\":\"clean\"}", JSON.stringify(listener.asks[0]?.payload));
    Assert.areEqual("Run command: (unknown command)", listener.asks[1]?.summary);
    Assert.areEqual("Apply file changes: apply (grant root D:/w)", listener.asks[2]?.summary);
    Assert.areEqual(ApprovalKind.FileChange, listener.asks[2]?.kind);
    Assert.areEqual("Apply file changes", listener.asks[3]?.summary);
    Assert.areEqual("accept,acceptForSession,decline", listener.asks[0]?.options.map(t => t.id).join(","));
  }

  private static createTurn(listener: RecordingTurnListener, threadId: string = "t-1"): CodexTurn {
    return new CodexTurn(threadId, listener, new ObservedSettings("codex", "a", "high", "1.0.0", null), new CodexItemReader(), new DeltaStream(listener, 1));
  }
}
