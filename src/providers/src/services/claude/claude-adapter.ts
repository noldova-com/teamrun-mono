/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";

import type { EffortLevel, Options, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/teamrun-foundation-core";
import { type ForkRequest, type IProviderAdapter, type ITurnListener, SignInCheck, type TurnRequest, TurnOutcome, TurnResult } from "@noldova/teamrun-core";
import { RoleApplication, AuthStatus, ObservedSettings, type ProviderAccount, ProviderDescriptor, ProviderModel } from "@noldova/teamrun-protocol";

import type { IClaudeQueryFactory } from "../../interfaces/i-claude-query-factory.js";
import { InvalidOperationException } from "../../exceptions/invalid-operation.exception.js";
import { ClaudeRun } from "../../models/claude-run.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { TailBuffer } from "../../models/tail-buffer.js";
import { Resources } from "../../resources.js";
import { ProjectInstructions } from "./project-instructions.js";
import type { ExecutableVersionReader } from "../executables/executable-version.reader.js";
import { FailureDescriber } from "../failure-describer.js";
import type { CommandRunner } from "../process/command-runner.js";
import { ClaudeEnvironment } from "./claude-environment.js";
import { ClaudeSignInReader } from "./claude-sign-in.reader.js";
import { DeltaStream } from "../delta-stream.js";
import { ClaudeTurn } from "./claude-turn.js";
import { ClaudePrompt } from "./claude-prompt.js";

export class ClaudeAdapter implements IProviderAdapter {
  public readonly descriptor: ProviderDescriptor;
  private readonly command: ProcessCommand | null;
  private readonly baseEnvironment: NodeJS.ProcessEnv;
  private readonly appVersion: string;
  private readonly queryFactory: IClaudeQueryFactory;
  private readonly runner: CommandRunner;
  private readonly versionReader: ExecutableVersionReader;
  private readonly timings: ProviderTimings;
  private readonly signInReader: ClaudeSignInReader = new ClaudeSignInReader();
  private readonly runs: Set<ClaudeRun> = new Set();

  public constructor(
    command: ProcessCommand | null,
    baseEnvironment: NodeJS.ProcessEnv,
    appVersion: string,
    queryFactory: IClaudeQueryFactory,
    runner: CommandRunner,
    versionReader: ExecutableVersionReader,
    timings: ProviderTimings) {
    this.descriptor = new ProviderDescriptor(Resources.claudeProviderId, Resources.claudeDisplayName, Resources.claudeEffortLevels, true, true);
    this.command = command;
    this.baseEnvironment = baseEnvironment;
    this.appVersion = appVersion;
    this.queryFactory = queryFactory;
    this.runner = runner;
    this.versionReader = versionReader;
    this.timings = timings;
  }

  public get activeRunCount(): number {
    return this.runs.size;
  }

  public async checkSignIn(account: ProviderAccount): Promise<SignInCheck> {
    if (Object.isNull(this.command))
      return new SignInCheck(AuthStatus.Error, null, null, Resources.claudeNotFound);

    mkdirSync(account.profileDir, { recursive: true });
    const environment = ClaudeEnvironment.build(this.baseEnvironment, account.profileDir, this.appVersion);
    const version = await this.versionReader.read(this.command, environment);
    try {
      const command = this.command.withArguments(Resources.authArgument, Resources.statusArgument, Resources.jsonArgument);
      const result = await this.runner.run(command, environment, this.timings.signInCheckTimeout);
      return this.signInReader.read(result.output, version);
    }
    catch (error) {
      return new SignInCheck(AuthStatus.Error, null, version, FailureDescriber.describe(error));
    }
  }

  public async listModels(account: ProviderAccount | null): Promise<readonly ProviderModel[]> {
    if (Object.isNull(this.command))
      throw new Error(Resources.claudeNotFound);
    const abort = new AbortController();
    const query = this.queryFactory.start(ClaudeAdapter.emptyPrompt(), {
      pathToClaudeCodeExecutable: this.command.executable,
      env: ClaudeEnvironment.build(this.baseEnvironment, account?.profileDir ?? null, this.appVersion),
      settingSources: [], strictMcpConfig: true, mcpServers: {}, plugins: [], tools: [], persistSession: false, abortController: abort
    });
    const run = new ClaudeRun(query, abort);
    this.runs.add(run);
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(Resources.modelDiscoveryTimedOut)), this.timings.requestTimeout);
      });
      const models = await Promise.race([query.supportedModels(), timeout]);
      return models.map(t => new ProviderModel(t.value, t.displayName, t.description,
        t.supportedEffortLevels ?? (t.supportsEffort === false ? [] : null), t.value === Resources.claudeDefaultModel, t.resolvedModel ?? null, null));
    }
    finally {
      clearTimeout(timer);
      this.runs.delete(run);
      run.close();
    }
  }

  private static async *emptyPrompt(): AsyncGenerator<SDKUserMessage> {}

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    if (Object.isNull(this.command))
      return ClaudeAdapter.fail(Resources.claudeNotFound);

    const effort = request.requested.effort;
    if (!Object.isNull(effort) && !ClaudeAdapter.isEffortLevel(effort))
      return ClaudeAdapter.fail(Resources.formatUnknownEffort(effort, this.descriptor.displayName));

    const profileDir = Object.isNull(request.account) ? null : request.account.profileDir;
    if (!Object.isNull(profileDir))
      mkdirSync(profileDir, { recursive: true });

    const turn = new ClaudeTurn(listener, request.resumeNativeSessionId, new DeltaStream(listener, this.timings.streamInterval),
      Object.isNull(request.instructions) ? null : RoleApplication.Instructions);
    const abort = new AbortController();
    const stderr = new TailBuffer(Resources.maximumStderrChunks);
    const prompt = request.attachments.some(t => t.isImage) ? new ClaudePrompt(request) : request.prompt;
    const query = this.queryFactory.start(prompt, this.createOptions(this.command, request, effort, profileDir, abort, stderr, turn));
    const run = new ClaudeRun(query, abort);
    this.runs.add(run);
    let graceTimer: NodeJS.Timeout | null = null;
    const onAbort = (): void => {
      turn.markInterrupted();
      void query.interrupt().catch(() => undefined);
      graceTimer = setTimeout(() => abort.abort(), this.timings.abortGrace);
    };
    if (signal.aborted)
      onAbort();
    else
      signal.addEventListener(Resources.abortEvent, onAbort, { once: true });

    try {
      await turn.consume(query);
    }
    catch (error) {
      turn.fail(ClaudeAdapter.describeFailure(error, stderr));
    }
    finally {
      signal.removeEventListener(Resources.abortEvent, onAbort);
      if (!Object.isNull(graceTimer))
        clearTimeout(graceTimer);
      this.runs.delete(run);
      run.close();
    }

    return turn.toResult();
  }

  public forkSession(_request: ForkRequest): Promise<string> {
    return Promise.reject(new InvalidOperationException(Resources.forkNotSupported));
  }

  public async shutdown(): Promise<void> {
    const runs = [...this.runs];
    this.runs.clear();
    for (const run of runs)
      await run.stop();
  }

  private createOptions(
    command: ProcessCommand,
    request: TurnRequest,
    effort: EffortLevel | null,
    profileDir: string | null,
    abort: AbortController,
    stderr: TailBuffer,
    turn: ClaudeTurn): Options {
    const options: Options = {
      cwd: request.workingDirectory,
      env: ClaudeEnvironment.build(this.baseEnvironment, profileDir, this.appVersion),
      pathToClaudeCodeExecutable: command.executable,
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: {},
      systemPrompt: ClaudeAdapter.createSystemPrompt(request.workingDirectory, request.instructions),
      abortController: abort,
      includePartialMessages: true,
      extraArgs: { [Resources.claudeThinkingDisplayArgument]: Resources.claudeSummarizedThinkingDisplay },
      maxTurns: Resources.claudeMaximumTurns,
      stderr: (data: string) => stderr.push(data),
      canUseTool: (toolName, input) => turn.decide(toolName, input),
      permissionMode: Resources.acceptEditsPermissionMode,
      disallowedTools: [Resources.claudeMcpToolPattern]
    };
    if (!Object.isNull(request.requested.model))
      options.model = request.requested.model;
    if (!Object.isNull(effort))
      options.effort = effort;
    if (!Object.isNull(request.resumeNativeSessionId))
      options.resume = request.resumeNativeSessionId;

    return options;
  }


  private static createSystemPrompt(workingDirectory: string, role: string | null): { type: "preset"; preset: "claude_code"; append?: string } {
    const instructions = [ProjectInstructions.read(workingDirectory), role].filter((t): t is string => !Object.isNull(t))
      .join(Resources.lineSeparator + Resources.lineSeparator);
    if (instructions.length === 0)
      return { type: Resources.presetSystemPromptType, preset: Resources.claudeCodePreset };

    return { type: Resources.presetSystemPromptType, preset: Resources.claudeCodePreset, append: instructions };
  }

  private static isEffortLevel(value: string): value is EffortLevel {
    return Resources.claudeEffortLevels.includes(value);
  }

  private static describeFailure(error: unknown, stderr: TailBuffer): string {
    const description = FailureDescriber.describe(error);
    return stderr.isEmpty ? description : `${description}${Resources.lineSeparator}${Resources.stderrHeading}${Resources.lineSeparator}${stderr.toString()}`;
  }

  private static fail(error: string): TurnResult {
    return new TurnResult(TurnOutcome.Failed, null, new ObservedSettings(Resources.claudeProviderId, null, null, null, null), error);
  }
}
