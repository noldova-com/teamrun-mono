/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";

import { TurnRequest } from "@noldova/teamrun-core";
import { AuthStatus, ProviderAccount, RequestedSettings } from "@noldova/teamrun-protocol";
import { ClaudeAdapter, CommandRunner, ExecutableVersionReader, ProcessCommand, ProcessTerminator, ProviderTimings } from "@noldova/teamrun-providers";

import { FakeClaudeQueryFactory } from "./fake-claude-query-factory.fixture.js";
import { IsolatedPath } from "./isolated-path.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class ClaudeTestHost implements Disposable {
  public static readonly FAKE_CLAUDE_PATH: string = fileURLToPath(new URL("./fake-claude.fixture.js", import.meta.url));

  public readonly directory: TemporaryDirectory = new TemporaryDirectory();
  public readonly environment: NodeJS.ProcessEnv = IsolatedPath.environment(this.directory.path);
  public readonly command: ProcessCommand = new ProcessCommand(process.execPath, [ClaudeTestHost.FAKE_CLAUDE_PATH]);
  public readonly terminator: ProcessTerminator = new ProcessTerminator(process.platform);
  public readonly runner: CommandRunner = new CommandRunner(this.terminator);
  public readonly timings: ProviderTimings = new ProviderTimings(5000, 5000, 5000, 5000, 1000, 300, 500, 200, 1, 20);
  public readonly versionReader: ExecutableVersionReader = new ExecutableVersionReader(this.runner, this.timings.versionTimeout);
  public readonly factory: FakeClaudeQueryFactory = new FakeClaudeQueryFactory();

  public createAdapter(environment: NodeJS.ProcessEnv = this.environment, command: ProcessCommand | null = this.command): ClaudeAdapter {
    return new ClaudeAdapter(command, environment, "0.0.1-test", this.factory, this.runner, this.versionReader, this.timings);
  }

  public createAccount(id: string = "acc-1", directoryName: string = "profile"): ProviderAccount {
    return new ProviderAccount(id, "claude", "Home", this.directory.resolve(directoryName), AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
  }

  public createRequest(prompt: string, account: ProviderAccount | null = null, resume: string | null = null, model: string | null = null, effort: string | null = null): TurnRequest {
    return new TurnRequest(account, this.directory.path, prompt, new RequestedSettings("claude", model, effort), resume);
  }

  public [Symbol.dispose](): void {
    this.directory[Symbol.dispose]();
  }
}
