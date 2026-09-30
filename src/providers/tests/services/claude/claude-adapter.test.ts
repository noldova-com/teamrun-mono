/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, writeFileSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ForkRequest, TurnOutcome, TurnRequest } from "@noldova/teamrun-core";
import { AuthStatus, MessageAttachment, RequestedSettings } from "@noldova/teamrun-protocol";
import { ClaudeAdapter, InvalidOperationException, ProcessCommand, ProviderTimings, ProjectInstructions } from "@noldova/teamrun-providers";

import { ClaudeTestHost } from "../../fixtures/claude-test-host.fixture.js";
import { FakeClaudeQuery } from "../../fixtures/fake-claude-query.fixture.js";
import { FailureStep } from "../../fixtures/failure-step.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { SdkMessages } from "../../fixtures/sdk-messages.fixture.js";
import { ToolAskStep } from "../../fixtures/tool-ask-step.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { WaitForInterruptStep } from "../../fixtures/wait-for-interrupt-step.fixture.js";

@TestClass
export class ClaudeAdapterTests {
  @TestMethod
  public async suppliesAndClearsTheTeammateRoleInSystemInstructions(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    try {
      for (const role of ["Review carefully", null]) {
        host.factory.next = new FakeClaudeQuery([SdkMessages.init("role-session", "none", null, []), SdkMessages.success("role-session", "ok")]);
        const listener = new RecordingTurnListener();
        const request = host.createRequest("task", null, "role-session");
        await adapter.runTurn(new TurnRequest(request.account, request.workingDirectory, request.prompt, request.requested,
          request.resumeNativeSessionId, [], role), listener, new AbortController().signal);
        const prompt = host.factory.lastOptions?.systemPrompt;
        Assert.areEqual(role ?? undefined, typeof prompt === "object" && !Array.isArray(prompt) && prompt.type === "preset" ? prompt.append : undefined);
        Assert.areEqual(role === null ? null : "Instructions", listener.starts[0]?.roleApplied);
      }
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async discoversModelsWithoutSendingAPromptAndClosesTheQuery(): Promise<void> {
    using host = new ClaudeTestHost();
    const query = host.factory.next;
    query.models = [
      { value: "default", displayName: "Default", description: "Current", resolvedModel: "future-model", supportedEffortLevels: ["high"] },
      { value: "small", displayName: "Small", description: "No effort", supportsEffort: false },
      { value: "unknown", displayName: "Unknown", description: "Legacy" }
    ];
    const adapter = host.createAdapter();
    const models = await adapter.listModels(host.createAccount());
    Assert.areEqual("future-model", models[0]?.resolvedModel);
    Assert.isTrue(models[0]?.isDefault ?? false);
    Assert.areEqual("high", models[0]?.effortLevels?.join(","));
    Assert.areEqual(0, models[1]?.effortLevels?.length);
    Assert.isNull(models[2]?.effortLevels);
    Assert.isFalse(host.factory.lastOptions?.persistSession ?? true);
    Assert.areEqual("{}", JSON.stringify(host.factory.lastOptions?.mcpServers));
    Assert.areEqual("[]", JSON.stringify(host.factory.lastOptions?.tools));
    Assert.areEqual(1, query.closeCount);
    Assert.areEqual(0, adapter.activeRunCount);
    const prompt = host.factory.prompts[0];
    Assert.isDefined(prompt);
    Assert.isFalse(typeof prompt === "string");
    if (typeof prompt !== "string") {
      let messages = 0;
      for await (const _message of prompt)
        messages++;
      Assert.areEqual(0, messages);
    }
    host.factory.next.modelsFailure = new Error("Discovery refused");
    await Assert.throwsAsync(() => adapter.listModels(null), Error);
    await Assert.throwsAsync(() => host.createAdapter(host.environment, null).listModels(null), Error);
    host.factory.next.modelsHang = true;
    const hanging = new ClaudeAdapter(host.command, host.environment, "test", host.factory, host.runner, host.versionReader,
      new ProviderTimings(5000, 5000, 5000, 1, 1000, 300, 500, 200, 1, 20));
    const error = await Assert.throwsAsync(() => hanging.listModels(null), Error);
    Assert.isTrue(error.message.includes("in time"));
    Assert.areEqual(0, hanging.activeRunCount);
  }
  @TestMethod
  public async passesNativeImagesThroughTheStructuredInputFactory(): Promise<void> {
    using host = new ClaudeTestHost();
    const path = host.directory.resolve("image.png");
    writeFileSync(path, "image bytes");
    await host.createAdapter().runTurn(new TurnRequest(null, host.directory.path, "Inspect", new RequestedSettings("claude", null, null), null,
      [new MessageAttachment("image.png", "image/png", 11, path)]), new RecordingTurnListener(), new AbortController().signal);
    const prompt = host.factory.prompts[0];
    Assert.isDefined(prompt);
    Assert.isFalse(typeof prompt === "string");
    if (typeof prompt === "string" || prompt === undefined)
      throw new Error("Expected structured input");
    const messages = [];
    for await (const message of prompt)
      messages.push(message);
    Assert.areEqual(1, messages.length);
    Assert.isTrue(JSON.stringify(messages).includes(Buffer.from("image bytes").toString("base64")));
  }
  @TestMethod
  public async describesItselfAndListsModels(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();

    Assert.areEqual("claude", adapter.descriptor.id);
    Assert.areEqual("Claude Code", adapter.descriptor.displayName);
    Assert.areEqual("low,medium,high,xhigh,max", adapter.descriptor.effortLevels.join(","));
    Assert.areEqual("fable,opus,sonnet,haiku", (await adapter.listModels(null)).map(t => t.id).join(","));
    Assert.isFalse(adapter.descriptor.supportsFork);
    const request = new ForkRequest(null, host.directory.path, "session-1", "turn-1", new RequestedSettings("claude", null, null));
    await Assert.throwsAsync(() => adapter.forkSession(request), InvalidOperationException);
  }

  @TestMethod
  public async checksSignInWithACleanedEnvironment(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter({
      ...host.environment, TEAMRUN_FAKE_CLAUDE_OUTPUT: "env", ANTHROPIC_API_KEY: "secret", CLAUDE_CODE_USE_BEDROCK: "routed"
    });
    const missing = host.createAdapter(host.environment, null);
    const unspawnable = host.createAdapter(host.environment, new ProcessCommand("teamrun-no-such-executable", []));
    const hanging = new ClaudeAdapter(host.command, { ...host.environment, TEAMRUN_FAKE_CLAUDE_HANG: "1" }, "0.0.1-test",
      host.factory, host.runner, host.versionReader, new ProviderTimings(5000, 100, 1, 1, 1, 1, 1, 1, 1, 20));
    const account = host.createAccount("acc-1", "claude-profile");

    const signedIn = await adapter.checkSignIn(account);
    const notFound = await missing.checkSignIn(account);
    const failed = await unspawnable.checkSignIn(account);
    const timedOut = await hanging.checkSignIn(account);

    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.areEqual(host.directory.resolve("claude-profile"), signedIn.identity?.email);
    Assert.areEqual("no-key", signedIn.identity?.organization);
    Assert.areEqual("teamrun/0.0.1-test", signedIn.identity?.plan);
    Assert.areEqual("routed", signedIn.identity?.authMethod);
    Assert.areEqual("9.9.9", signedIn.harnessVersion);
    Assert.isTrue(existsSync(host.directory.resolve("claude-profile")));
    Assert.areEqual(AuthStatus.Error, notFound.authStatus);
    Assert.isTrue(notFound.error?.includes("Claude Code executable was not found") ?? false);
    Assert.areEqual(AuthStatus.Error, failed.authStatus);
    Assert.isNull(failed.harnessVersion);
    Assert.isTrue(failed.error?.includes("ENOENT") ?? false);
    Assert.areEqual(AuthStatus.Error, timedOut.authStatus);
    Assert.areEqual("Unexpected output from the sign-in check: ", timedOut.error);
  }

  @TestMethod
  public async runsATurnWithIsolatedOptions(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter({ ...host.environment, ANTHROPIC_API_KEY: "secret" });
    const account = host.createAccount("acc-2", "turn-profile");
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow", "deny");
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", "high", []),
      new ToolAskStep("Bash", { command: "npm test" }),
      new ToolAskStep("WebFetch", { url: "https://example.com" }),
      SdkMessages.success("s-1", "done")
    ]);
    host.factory.next = query;
    writeFileSync(host.directory.resolve("CLAUDE.md"), "Rules.\n@AGENTS.md\n@../outside.md\n@missing.md\n@ spaced\n");
    writeFileSync(host.directory.resolve("AGENTS.md"), "Agent rules.");
    writeFileSync(host.directory.resolve("outside.md"), "never");

    const result = await adapter.runTurn(host.createRequest("Fix the bug", account, "s-1", "opus", "high"), listener, new AbortController().signal);

    const options = host.factory.lastOptions;
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("s-1", result.nativeSessionId);
    Assert.areEqual("Fix the bug", host.factory.prompts[0]);
    Assert.areEqual(host.directory.path, options?.cwd);
    Assert.areEqual(host.directory.resolve("turn-profile"), options?.env?.["CLAUDE_CONFIG_DIR"]);
    Assert.isUndefined(options?.env?.["ANTHROPIC_API_KEY"]);
    Assert.areEqual(process.execPath, options?.pathToClaudeCodeExecutable);
    Assert.areEqual(0, options?.settingSources?.length);
    Assert.isTrue(options?.strictMcpConfig ?? false);
    Assert.areEqual("{}", JSON.stringify(options?.mcpServers));
    Assert.areEqual("acceptEdits", options?.permissionMode);
    Assert.areEqual("mcp__*", options?.disallowedTools?.join(","));
    Assert.areEqual("opus", options?.model);
    Assert.areEqual("high", options?.effort);
    Assert.areEqual("s-1", options?.resume);
    const prompt = options?.systemPrompt;
    const append = typeof prompt === "object" && !Array.isArray(prompt) && "append" in prompt ? prompt.append : undefined;
    Assert.isTrue(append?.startsWith("The project's CLAUDE.md") ?? false);
    Assert.isTrue(append?.includes("Rules.\nAgent rules.\n@../outside.md\n@missing.md\n@ spaced") ?? false);
    Assert.areEqual(400, options?.maxTurns);
    Assert.isTrue(existsSync(host.directory.resolve("turn-profile")));
    Assert.areEqual("allow", (query.steps[1] as ToolAskStep).result?.behavior);
    Assert.areEqual("deny", (query.steps[2] as ToolAskStep).result?.behavior);
    Assert.areEqual("s-1:1,s-1:2", listener.asks.map(t => t.providerRequestId).join(","));
    Assert.areEqual(1, query.closeCount);
    Assert.areEqual(0, adapter.activeRunCount);
  }

  @TestMethod
  public async leavesOptionalSettingsOutWhenNotRequested(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-2", "none", null, []), SdkMessages.success("s-2", "ok")]);

    const result = await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    const options = host.factory.lastOptions;
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isUndefined(options?.model);
    Assert.isUndefined(options?.effort);
    Assert.isUndefined(options?.resume);
    Assert.isUndefined(options?.env?.["CLAUDE_CONFIG_DIR"]);
    Assert.areEqual(JSON.stringify({ type: "preset", preset: "claude_code" }), JSON.stringify(options?.systemPrompt));
  }

  @TestMethod
  public capsTheProjectInstructions(): void {
    using host = new ClaudeTestHost();
    writeFileSync(host.directory.resolve("CLAUDE.md"), "x".repeat(70_000));

    const instructions = ProjectInstructions.read(host.directory.path);

    const preamble = "The project's CLAUDE.md, loaded by TeamRun (the project's settings, MCP servers, plugins, and hooks stay off):\n\n";
    Assert.areEqual(65_536, (instructions ?? "").length - preamble.length);
    Assert.isNull(ProjectInstructions.read(host.directory.resolve("nowhere")));
  }

  @TestMethod
  public async failsWithoutStartingWhenTheRequestCannotBeServed(): Promise<void> {
    using host = new ClaudeTestHost();
    const missing = host.createAdapter(host.environment, null);
    const adapter = host.createAdapter();

    const notFound = await missing.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);
    const badEffort = await adapter.runTurn(host.createRequest("Hi", null, null, null, "ultra"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, notFound.outcome);
    Assert.isTrue(notFound.error?.includes("Claude Code executable was not found") ?? false);
    Assert.areEqual(TurnOutcome.Failed, badEffort.outcome);
    Assert.areEqual("The effort \"ultra\" is not one Claude Code accepts.", badEffort.error);
    Assert.areEqual(0, host.factory.queries.length);
  }

  @TestMethod
  public async reportsStreamFailuresWithTheStderrTail(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-3", "none", null, []), new FailureStep(new Error("stream broke"))]);
    query.stderrLines.push("first line\n", "second line\n");
    query.closeFailure = new Error("already closed");
    host.factory.next = query;

    const result = await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual("stream broke\n[stderr]\nfirst line\nsecond line\n", result.error);
    Assert.areEqual("s-3", result.nativeSessionId);
  }

  @TestMethod
  public async interruptsOnAbortAndTreatsLaterFailuresAsInterruptions(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-4", "none", null, []), new WaitForInterruptStep(), SdkMessages.failure("s-4", "error_during_execution", ["killed"])]);
    host.factory.next = query;
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.createRequest("Hi"), listener, controller.signal);
    await Wait.until(() => listener.starts.length === 1);
    controller.abort();
    const result = await running;

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isNull(result.error);
    Assert.areEqual(1, query.interruptCount);
    Assert.areEqual("error_during_execution: killed", listener.texts.at(-1));
  }

  @TestMethod
  public async abortsTheProcessWhenTheInterruptIsRefused(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-6", "none", null, []), new WaitForInterruptStep(), SdkMessages.success("s-6", "never")]);
    query.interruptFailure = new Error("no interrupt");
    host.factory.next = query;

    const result = await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), AbortSignal.abort());

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isTrue(query.options?.abortController?.signal.aborted ?? false);
    Assert.areEqual(0, query.interruptCount);
  }

  @TestMethod
  public async shutsDownActiveRuns(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-5", "none", null, []), new WaitForInterruptStep(), SdkMessages.success("s-5", "late")]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.createRequest("Hi"), listener, new AbortController().signal);
    await Wait.until(() => adapter.activeRunCount === 1);
    await adapter.shutdown();
    const result = await running;

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(1, query.interruptCount);
    Assert.areEqual(0, adapter.activeRunCount);
  }
}
