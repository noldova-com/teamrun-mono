/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ForkRequest, TurnOutcome, TurnRequest } from "@noldova/teamrun-core";
import { AuthStatus, DetailKind, MessageAttachment, ProviderAccount, RequestedSettings } from "@noldova/teamrun-protocol";
import { ProcessCommand } from "@noldova/teamrun-providers";

import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { ControlledProcessTerminator } from "../../fixtures/controlled-process-terminator.fixture.js";

@TestClass
export class GrokAdapterTests {
  @TestMethod
  public async recordsThePromptFallbackAndReplacesTheRoleOnEveryTurn(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    for (const role of ["Review carefully", null]) {
      const listener = new RecordingTurnListener();
      const base = host.request("role-payload", "grok-session");
      await adapter.runTurn(new TurnRequest(base.account, base.workingDirectory, base.prompt, base.requested,
        base.resumeNativeSessionId, [], role), listener, new AbortController().signal);
      const payload = listener.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join("\n");
      Assert.isTrue(payload.includes(role ?? "No additional teammate role instructions."), payload);
      Assert.areEqual(role === null ? null : "Prompt", listener.starts[0]?.roleApplied);
    }
  }

  @TestMethod
  public async retriesCancellationCleanupAndReportsCleanupFailures(): Promise<void> {
    await using host = new GrokTestHost();
    const terminator = new ControlledProcessTerminator(process.platform);
    const environment = { ...host.environment, TEAMRUN_FAKE_GROK_STAY_OPEN: "1", TEAMRUN_FAKE_GROK_IGNORE_CANCEL: "1" };
    const adapter = host.createAdapter(environment, host.command, terminator);
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    terminator.failures = 1;
    const run = adapter.runTurn(host.request("cancel"), listener, controller.signal);
    await Wait.until(() => listener.details.some(t => t.text === "working"));
    controller.abort();
    Assert.areEqual(TurnOutcome.Interrupted, (await run).outcome);
    Assert.areEqual(0, terminator.failures);

    const failed = host.createAdapter(environment, host.command, terminator);
    const account = new ProviderAccount("a", "grok", "Dedicated", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "t");
    terminator.failures = 1;
    await Assert.throwsAsync(() => failed.checkSignIn(account), Error);
    await failed.shutdown();
    terminator.failures = 1;
    await Assert.throwsAsync(() => failed.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal), Error);
    await failed.shutdown();
    Assert.areEqual(host.tracker.tracked.length, host.tracker.untracked.length);
  }

  @TestMethod
  public async supportsUnknownSessionMetadataAndShutdownDuringWork(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_GROK_NO_METADATA: "1" });
    const result = await adapter.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isNull(result.observed.model);
    Assert.isNull(result.observed.effort);
    const listener = new RecordingTurnListener();
    const running = adapter.runTurn(host.request("cancel"), listener, new AbortController().signal);
    await Wait.until(() => listener.details.some(t => t.text === "working"));
    await adapter.shutdown();
    Assert.areEqual(TurnOutcome.Failed, (await running).outcome);
    const controller = new AbortController();
    const cancelled = new RecordingTurnListener();
    cancelled.onStarted = () => controller.abort();
    Assert.areEqual(TurnOutcome.Interrupted, (await adapter.runTurn(host.request("complete"), cancelled, controller.signal)).outcome);
    const account = new ProviderAccount("a", "grok", "Dedicated", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "t");
    const loggedOut = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_GROK_INIT: "loggedOut" });
    const request = new TurnRequest(account, host.directory.path, "complete", new RequestedSettings("grok", null, null), null);
    Assert.areEqual(TurnOutcome.Failed, (await loggedOut.runTurn(request, new RecordingTurnListener(), new AbortController().signal)).outcome);
  }

  @TestMethod
  public async discoversModelsChecksCachedAuthenticationAndClosesProcesses(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const models = await adapter.listModels(null);
    Assert.areEqual("grok-test,grok-other", models.map(t => t.id).join(","));
    Assert.areEqual("high,low", models[0]?.effortLevels?.join(","));
    Assert.isFalse(models[0]?.supportsImages ?? true);
    const account = new ProviderAccount("a", "grok", "Dedicated", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "t");
    Assert.areEqual(AuthStatus.LoggedIn, (await adapter.checkSignIn(account)).authStatus);
    Assert.areEqual(AuthStatus.LoggedOut,
      (await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_GROK_INIT: "loggedOut" }).checkSignIn(account)).authStatus);
    Assert.areEqual(AuthStatus.Error, (await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_GROK_SIGNIN_FAIL: "1" }).checkSignIn(account)).authStatus);
    Assert.areEqual(AuthStatus.Error, (await host.createAdapter(host.environment, null).checkSignIn(account)).authStatus);
    await Assert.throwsAsync(() => adapter.forkSession(new ForkRequest(null, host.directory.path, "s", "t", new RequestedSettings("grok", null, null))), Error);
    Assert.isFalse(adapter.descriptor.supportsFork);
    Assert.areEqual(host.tracker.tracked.length, host.tracker.untracked.length);
  }

  @TestMethod
  public async streamsDetailsAndResumesWithoutReplayingOldOrLateText(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const result = await adapter.runTurn(host.request("complete", "old-session", "grok-test", "high"), listener, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("old-session", result.nativeSessionId);
    Assert.areEqual("grok-test", result.observed.model);
    Assert.areEqual("low", result.observed.effort);
    Assert.areEqual("1.0.30-fixture", result.observed.harnessVersion);
    Assert.isNull(result.observed.identity);
    Assert.isTrue(listener.details.some(t => t.kind === DetailKind.Reasoning && t.text === "Reasoning"));
    Assert.isTrue(listener.details.some(t => t.kind === DetailKind.Text && t.text === "Hello world"));
    Assert.isTrue(listener.details.some(t => t.kind === DetailKind.Command));
    Assert.isTrue(listener.details.some(t => t.kind === DetailKind.FileChange));
    Assert.isFalse(listener.details.some(t => t.text.includes("replayed history") || t.text.includes("late after response")));
    const switched = await adapter.runTurn(host.request("complete", "old-session", "grok-other"), new RecordingTurnListener(), new AbortController().signal);
    Assert.isNull(switched.observed.model);
  }

  @TestMethod
  @TestData("yes")
  @TestData("no")
  public async routesPermissionChoicesWithoutOfferingPersistentGrants(choice: string): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    listener.decisions.push(choice);
    const result = await host.createAdapter().runTurn(host.request("approve"), listener, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isTrue(listener.details.some(t => t.text.includes(`"optionId":"${choice}"`)));
    Assert.areEqual("yes,no", listener.asks[0]?.options.map(t => t.id).join(","));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async cancelsAndStopsEvenWhenTheAgentIgnoresCancellation(ignore: boolean): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_GROK_IGNORE_CANCEL: ignore ? "1" : "0" });
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    const run = adapter.runTurn(host.request("cancel"), listener, controller.signal);
    await Wait.until(() => listener.details.some(t => t.text === "working"));
    controller.abort();
    Assert.areEqual(TurnOutcome.Interrupted, (await run).outcome);
    Assert.areEqual(host.tracker.tracked.length, host.tracker.untracked.length);
    Assert.areEqual(TurnOutcome.Interrupted, (await adapter.runTurn(host.request("complete"), listener, controller.signal)).outcome);
  }

  @TestMethod
  public async reportsStartupTurnAndSelectionFailuresWithoutSubstitutingModels(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    for (const request of [host.request("exit"), host.request("reject"), host.request("limit"), host.request("complete", "missing"),
      host.request("complete", null, "unavailable"), host.request("complete", null, "grok-test", "unsupported")])
      Assert.areEqual(TurnOutcome.Failed, (await adapter.runTurn(request, new RecordingTurnListener(), new AbortController().signal)).outcome);
    const loggedOut = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_GROK_INIT: "loggedOut" });
    Assert.areEqual(TurnOutcome.Failed, (await loggedOut.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal)).outcome);
    const missing = host.createAdapter(host.environment, new ProcessCommand("teamrun-missing-grok", []));
    await Assert.throwsAsync(() => missing.listModels(null), Error);
  }

  @TestMethod
  public async rejectsUnsupportedImagesAndEncodesThemOnlyWhenAdvertised(): Promise<void> {
    await using host = new GrokTestHost();
    const path = host.directory.resolve("image.png");
    writeFileSync(path, "fixture-image");
    const request = new TurnRequest(null, host.directory.path, "images", new RequestedSettings("grok", null, null), null,
      [new MessageAttachment("image.png", "image/png", 13, path)]);
    Assert.areEqual(TurnOutcome.Failed, (await host.createAdapter().runTurn(request, new RecordingTurnListener(), new AbortController().signal)).outcome);
    const listener = new RecordingTurnListener();
    const result = await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_GROK_INIT: "images" }).runTurn(request, listener, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isTrue(listener.details.some(t => t.text.includes(Buffer.from("fixture-image").toString("base64"))));
  }
}
