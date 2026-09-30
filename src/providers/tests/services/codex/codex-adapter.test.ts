/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ForkRequest, TurnOutcome, TurnRequest } from "@noldova/teamrun-core";
import { ApprovalKind, AuthStatus, DetailKind, MessageAttachment, RequestedSettings, RoleApplication } from "@noldova/teamrun-protocol";
import { AppServerException, ExecutableNotFoundException, ProcessCommand } from "@noldova/teamrun-providers";

import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class CodexAdapterTests {
  @TestMethod
  public async appliesCurrentRoleInstructionsAndUsesFullContextAfterResumeFailure(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    try {
      for (const resume of [null, "resumable", "missing"]) {
        const listener = new RecordingTurnListener();
        const request = new TurnRequest(null, host.directory.path, "role-payload incremental", new RequestedSettings("codex", null, null),
          resume, [], "Review carefully", "role-payload full transcript");
        const result = await adapter.runTurn(request, listener, new AbortController().signal);
        Assert.areEqual(TurnOutcome.Completed, result.outcome);
        const payload = JSON.parse(listener.details.find(t => t.kind === DetailKind.Text)!.text);
        Assert.areEqual("Review carefully", payload.thread.developerInstructions);
        Assert.areEqual(resume === "resumable" ? request.prompt : request.freshPrompt, payload.input[0].text);
        Assert.areEqual(RoleApplication.Instructions, listener.starts[0]?.roleApplied);
      }
      const cleared = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null),
        "resumable"), cleared, new AbortController().signal);
      Assert.areEqual("", JSON.parse(cleared.details.find(t => t.kind === DetailKind.Text)!.text).thread.developerInstructions);
      Assert.isNull(cleared.starts[0]?.roleApplied);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async deliversImagesAsLocalImageInputsAlongsideText(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const request = new TurnRequest(null, host.directory.path, "attachments", new RequestedSettings("codex", null, null), null,
      [new MessageAttachment("image.png", "image/png", 1, host.directory.resolve("image.png")),
        new MessageAttachment("notes.txt", "text/plain", 1, host.directory.resolve("notes.txt"))]);
    try {
      const result = await adapter.runTurn(request, listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      const expected = [{ type: "text", text: "attachments", text_elements: [] }, { type: "localImage", path: request.attachments[0]!.path }];
      Assert.areEqual(JSON.stringify(expected), listener.details.find(t => t.kind === DetailKind.Text)?.text);
    }
    finally {
      await adapter.shutdown();
    }
  }
  @TestMethod
  public async describesItselfAndChecksSignIn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const loggedOut = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none" });
    const apiKey = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "apikey" });
    const failing = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "error" });
    const missing = host.createAdapter(host.environment, null);

    const signedIn = await adapter.checkSignIn(host.createAccount());
    const signedOut = await loggedOut.checkSignIn(host.createAccount());
    const keyed = await apiKey.checkSignIn(host.createAccount());
    const failed = await failing.checkSignIn(host.createAccount());
    const notFound = await missing.checkSignIn(host.createAccount());
    await Promise.all([adapter.shutdown(), loggedOut.shutdown(), apiKey.shutdown(), failing.shutdown()]);

    Assert.areEqual("codex", adapter.descriptor.id);
    Assert.areEqual("Codex", adapter.descriptor.displayName);
    Assert.areEqual("low,medium,high,xhigh,max,ultra", adapter.descriptor.effortLevels.join(","));
    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.areEqual("dev@example.com", signedIn.identity?.email);
    Assert.areEqual("plus", signedIn.identity?.plan);
    Assert.areEqual("9.9.9", signedIn.harnessVersion);
    Assert.areEqual(AuthStatus.LoggedOut, signedOut.authStatus);
    Assert.areEqual("apiKey", keyed.identity?.authMethod);
    Assert.areEqual(AuthStatus.Error, failed.authStatus);
    Assert.areEqual("account/read: account unavailable (code -32000)", failed.error);
    Assert.areEqual(AuthStatus.Error, notFound.authStatus);
    Assert.isTrue(notFound.error?.includes("Codex CLI was not found") ?? false);
    Assert.isTrue(existsSync(host.directory.resolve("profile")));
  }

  @TestMethod
  public async listsModelsThroughOneProcessPerProfile(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const missing = host.createAdapter(host.environment, null);

    const [first, second] = await Promise.all([adapter.listModels(null), adapter.listModels(null)]);
    const forAccount = await adapter.listModels(host.createAccount());
    const notFound = await Assert.throwsAsync(() => missing.listModels(null), ExecutableNotFoundException);
    const clientCount = adapter.clientCount;
    await adapter.shutdown();

    Assert.areEqual("gpt-5.6-sol", first.map(t => t.id).join(","));
    Assert.areEqual("gpt-5.6-sol", second.map(t => t.id).join(","));
    Assert.areEqual("gpt-5.6-sol", forAccount.map(t => t.id).join(","));
    Assert.areEqual(2, clientCount);
    Assert.areEqual(0, adapter.clientCount);
    Assert.isTrue(notFound.message.includes("npm install -g @openai/codex"));
  }

  @TestMethod
  public async streamsAgentMessageDeltasUnderTheItemId(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("stream"), listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    const streamed = listener.details.filter(t => t.providerItemId === "s1");
    Assert.isTrue(streamed.length >= 2, String(streamed.length));
    Assert.areEqual("Hello stream", streamed[streamed.length - 1]?.text);
    Assert.isTrue(streamed.every(t => "Hello stream".startsWith(t.text)));
    Assert.isFalse(listener.details.some(t => t.providerItemId === "s2"));
  }

  @TestMethod
  public async streamsACompleteTurn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("complete"), listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("thread-1", result.nativeSessionId);
    Assert.areEqual("gpt-5.6-mini", result.observed.model);
    Assert.areEqual("9.9.9", result.observed.harnessVersion);
    Assert.areEqual("dev@example.com", result.observed.identity?.email);
    Assert.areEqual("thread-1", listener.starts[0]?.nativeSessionId);
    Assert.isFalse(listener.starts[0]?.resumedNativeSession ?? true);
    Assert.areEqual("gpt-5.6-sol", listener.observations[0]?.model);
    Assert.isNull(listener.observations[0]?.effort);
    const expectedTexts = [
      "Running: npm test", "Working on it", "Think\nMore", "Plan:\nStep 1", "$ ls\n",
      "File changes (completed): update a.ts, {\"move\":{\"from\":\"c.ts\"}} b.ts, null d.ts", "Generated image (completed): D:/work/out.png",
      "Codex item plugin", "MCP tool srv/tool (completed)", "Tool dyn (completed)",
      "Web search: cats", "Codex compacted its context.", "Codex rerouted the model from gpt-5.6-sol to gpt-5.6-mini (capacity).",
      "Retryable error: rate limited", "Error: fatal", "Done"
    ];
    Assert.areEqual(expectedTexts.join("|"), listener.texts.filter(t => !t.startsWith("$ npm test")).join("|"));
    Assert.isTrue(listener.texts.some(t => t.startsWith("$ npm test\n…") && t.endsWith("(exit 0)")));
    Assert.areEqual(DetailKind.Error, listener.details.find(t => t.text === "Error: fatal")?.kind);
  }

  @TestMethod
  public async startsThreadsWithTheIsolatedConfigurationAndProfile(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, OPENAI_API_KEY: "secret" });
    const account = host.createAccount("acc-2", "work-profile");
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo", account, null, "gpt-x", "high"), listener, new AbortController().signal);
    await adapter.shutdown();

    const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown>; codexHome: string | null; apiKey: string | null };
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("workspace-write", echoed.thread["sandbox"]);
    Assert.areEqual("on-request", echoed.thread["approvalPolicy"]);
    Assert.areEqual(host.directory.path, echoed.thread["cwd"]);
    Assert.areEqual("gpt-x", echoed.thread["model"]);
    Assert.areEqual("{\"mcp_servers\":{},\"plugins\":{},\"features\":{\"plugins\":false},\"model_reasoning_effort\":\"high\"}", JSON.stringify(echoed.thread["config"]));
    Assert.areEqual(host.directory.resolve("work-profile"), echoed.codexHome);
    Assert.isNull(echoed.apiKey);
    Assert.areEqual("high", result.observed.effort);
    Assert.areEqual("gpt-x", result.observed.model);
    Assert.isTrue(existsSync(host.directory.resolve("work-profile")));
  }

  @TestMethod
  public async forksThreadsThroughATurn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none" });
    const fork = (threadId: string): Promise<string> =>
      adapter.forkSession(new ForkRequest(null, host.directory.path, threadId, "turn-7", new RequestedSettings("codex", null, "low")));

    Assert.isTrue(adapter.descriptor.supportsFork);
    Assert.areEqual("fork-resumable-turn-7", await fork("resumable"));
    Assert.areEqual("fork-archived-turn-7", await fork("archived"));
    await Assert.throwsAsync(() => fork("gone"), AppServerException);
    await adapter.shutdown();
  }

  @TestMethod
  public async resumesOrRestartsNativeSessions(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none" });
    const resumed = new RecordingTurnListener();
    const restarted = new RecordingTurnListener();

    const unarchived = new RecordingTurnListener();
    const stuck = new RecordingTurnListener();

    const resumedResult = await adapter.runTurn(host.createRequest("fail", null, "resumable"), resumed, new AbortController().signal);
    const restartedResult = await adapter.runTurn(host.createRequest("fail", null, "gone"), restarted, new AbortController().signal);
    const unarchivedResult = await adapter.runTurn(host.createRequest("fail", null, "archived"), unarchived, new AbortController().signal);
    const stuckResult = await adapter.runTurn(host.createRequest("fail", null, "stuck"), stuck, new AbortController().signal);
    const busy = new RecordingTurnListener();
    const jammed = new RecordingTurnListener();
    const busyResult = await adapter.runTurn(host.createRequest("fail", null, "busy"), busy, new AbortController().signal);
    const jammedResult = await adapter.runTurn(host.createRequest("fail", null, "jammed"), jammed, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual("busy", busyResult.nativeSessionId);
    Assert.isTrue(busy.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(0, busy.texts.filter(t => t.includes("could not be resumed")).length);
    Assert.areEqual("thread-3", jammedResult.nativeSessionId);
    Assert.isFalse(jammed.starts[0]?.resumedNativeSession ?? true);
    Assert.isTrue(jammed.texts[0]?.includes("active writer") ?? false);
    Assert.areEqual(1, host.tracker.tracked.length);
    Assert.isTrue((host.tracker.tracked[0]?.processId ?? 0) > 0);
    Assert.areEqual(process.execPath, host.tracker.tracked[0]?.executable);
    Assert.areEqual(host.tracker.tracked[0]?.processId, host.tracker.untracked[0]);

    Assert.areEqual("archived", unarchivedResult.nativeSessionId);
    Assert.isTrue(unarchived.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(0, unarchived.texts.filter(t => t.includes("could not be resumed")).length);
    Assert.areEqual("thread-2", stuckResult.nativeSessionId);
    Assert.isTrue(stuck.texts[0]?.includes("cannot unarchive") ?? false);

    Assert.areEqual("resumable", resumedResult.nativeSessionId);
    Assert.isNull(resumedResult.observed.identity);
    Assert.isTrue(resumed.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(TurnOutcome.Failed, resumedResult.outcome);
    Assert.areEqual("boom", resumedResult.error);
    Assert.areEqual("thread-1", restartedResult.nativeSessionId);
    Assert.isFalse(restarted.starts[0]?.resumedNativeSession ?? true);
    Assert.areEqual("The native session could not be resumed, so a fresh one was started: thread/resume: thread not found (code -32602)", restarted.texts[0]);
  }

  @TestMethod
  public async routesApprovalsToTheListener(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    listener.decisions.push("accept", "decline", "acceptForSession");
    listener.defaultDecision = "accept";

    const result = await adapter.runTurn(host.createRequest("approve"), listener, new AbortController().signal);
    await adapter.shutdown();

    const answers = JSON.parse(String(listener.texts.at(-1))) as { result: unknown; error: { message: string } | null }[];
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(4, listener.asks.length);
    Assert.areEqual(ApprovalKind.Command, listener.asks[0]?.kind);
    Assert.areEqual("item/commandExecution/requestApproval", listener.asks[0]?.nativeKind);
    Assert.areEqual("thread-1:cmd-1:1", listener.asks[0]?.providerRequestId);
    Assert.areEqual("Run command: rm -rf build", listener.asks[0]?.summary);
    Assert.areEqual("Run command: (unknown command)", listener.asks[1]?.summary);
    Assert.areEqual("Apply file changes: apply (grant root D:/work)", listener.asks[2]?.summary);
    Assert.areEqual("Apply file changes", listener.asks[3]?.summary);
    Assert.areEqual("{\"decision\":\"accept\"}", JSON.stringify(answers[0]?.result));
    Assert.areEqual("{\"decision\":\"decline\"}", JSON.stringify(answers[1]?.result));
    Assert.areEqual("{\"decision\":\"acceptForSession\"}", JSON.stringify(answers[2]?.result));
    Assert.areEqual("{\"decision\":\"accept\"}", JSON.stringify(answers[3]?.result));
    Assert.areEqual("{\"answers\":{}}", JSON.stringify(answers[4]?.result));
    Assert.areEqual("TeamRun does not handle the server request item/permissions/requestApproval.", answers[5]?.error?.message);
    Assert.areEqual("TeamRun does not handle the server request item/commandExecution/requestApproval.", answers[6]?.error?.message);
    Assert.areEqual("TeamRun does not handle the server request item/commandExecution/requestApproval.", answers[7]?.error?.message);
  }

  @TestMethod
  public async reportsListenerRefusalsAsDeclinedRequests(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    listener.decisionFailure = new Error("cancelled by the user");

    const result = await adapter.runTurn(host.createRequest("approve"), listener, new AbortController().signal);
    await adapter.shutdown();

    const answers = JSON.parse(String(listener.texts.at(-1))) as { error: { message: string } | null }[];
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("cancelled by the user", answers[0]?.error?.message);
  }

  @TestMethod
  public async interruptsOnAbort(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_SLOW_TURN_START: "1" });
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.createRequest("hold"), listener, controller.signal);
    await Wait.until(() => listener.starts.length === 1);
    controller.abort();
    const result = await running;
    const preAborted = await adapter.runTurn(host.createRequest("hold"), new RecordingTurnListener(), AbortSignal.abort());
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isNull(result.error);
    Assert.areEqual(TurnOutcome.Interrupted, preAborted.outcome);
  }

  @TestMethod
  public async givesUpAfterTheInterruptGrace(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_INTERRUPT: "fail" });
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.createRequest("hold"), listener, controller.signal);
    await Wait.until(() => listener.starts.length === 1);
    await Wait.delay(50);
    controller.abort();
    const result = await running;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
  }

  @TestMethod
  public async failsWhenTheServerDiesOrRefuses(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "error" });
    const listener = new RecordingTurnListener();

    const exited = await adapter.runTurn(host.createRequest("exit"), listener, new AbortController().signal);
    await Wait.until(() => adapter.clientCount === 0);
    const refusedThread = await adapter.runTurn(host.createRequest("complete", null, null, "explode"), new RecordingTurnListener(), new AbortController().signal);
    const refusedTurn = await adapter.runTurn(host.createRequest("reject"), new RecordingTurnListener(), new AbortController().signal);
    const failedNoError = await adapter.runTurn(host.createRequest("failNoError"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Failed, exited.outcome);
    Assert.areEqual("The Codex app-server exited during the turn.", exited.error);
    Assert.areEqual("The account could not be read: account/read: account unavailable (code -32000)", listener.texts[0]);
    Assert.isNull(exited.observed.identity);
    Assert.areEqual(TurnOutcome.Failed, refusedThread.outcome);
    Assert.areEqual("thread/start: thread refused (code -32000)", refusedThread.error);
    Assert.areEqual("9.9.9", refusedThread.observed.harnessVersion);
    Assert.areEqual(TurnOutcome.Failed, refusedTurn.outcome);
    Assert.areEqual("turn/start: turn refused (code -32000)", refusedTurn.error);
    Assert.areEqual("The turn ended with status \"failed\".", failedNoError.error);
  }

  @TestMethod
  public async rejectsUnavailableExecutablesAndUnsupportedModelEffort(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const missing = host.createAdapter(host.environment, null);
    const unspawnable = host.createAdapter(host.environment, new ProcessCommand("teamrun-no-such-executable", []));

    const badEffort = await adapter.runTurn(host.createRequest("complete", null, null, null, "extreme"), new RecordingTurnListener(), new AbortController().signal);
    const notFound = await missing.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    const listing = unspawnable.listModels(null);
    await unspawnable.shutdown();
    await Assert.throwsAsync(() => listing, Error);
    const failedStart = await unspawnable.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Failed, badEffort.outcome);
    Assert.areEqual("The effort \"extreme\" is not one Sol accepts.", badEffort.error);
    Assert.areEqual(0, adapter.clientCount);
    Assert.areEqual(TurnOutcome.Failed, notFound.outcome);
    Assert.isTrue(notFound.error?.includes("Codex CLI was not found") ?? false);
    Assert.areEqual(TurnOutcome.Failed, failedStart.outcome);
    Assert.isTrue(failedStart.error?.includes("ENOENT") ?? false);
    Assert.areEqual(0, unspawnable.clientCount);
  }
}
