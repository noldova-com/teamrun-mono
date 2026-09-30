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
import { AppServerClient, AppServerClientInfo, CodexAdapter, ProcessCommand, ProcessTerminator, ProviderTimings } from "@noldova/teamrun-providers";

import { RecordingProcessTracker } from "./recording-process-tracker.fixture.js";
import { IsolatedPath } from "./isolated-path.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class CodexTestHost implements Disposable {
  public static readonly FAKE_SERVER_PATH: string = fileURLToPath(new URL("./fake-codex-app-server.fixture.js", import.meta.url));

  public readonly directory: TemporaryDirectory = new TemporaryDirectory();
  public readonly environment: NodeJS.ProcessEnv = IsolatedPath.environment(this.directory.path);
  public readonly command: ProcessCommand = new ProcessCommand(process.execPath, [CodexTestHost.FAKE_SERVER_PATH]);
  public readonly terminator: ProcessTerminator = new ProcessTerminator(process.platform);
  public readonly timings: ProviderTimings = new ProviderTimings(5000, 5000, 5000, 5000, 1000, 300, 500, 200, 1, 20);
  public readonly clientInfo: AppServerClientInfo = new AppServerClientInfo("teamrun-tests", "TeamRun tests", "0.0.1");
  public readonly tracker: RecordingProcessTracker = new RecordingProcessTracker();

  public createAdapter(environment: NodeJS.ProcessEnv = this.environment, command: ProcessCommand | null = this.command): CodexAdapter {
    return new CodexAdapter(command, environment, this.clientInfo, this.terminator, this.timings, this.tracker);
  }

  public createClient(environment: NodeJS.ProcessEnv = this.environment, command: ProcessCommand = this.command.withArguments("app-server")): AppServerClient {
    return new AppServerClient(command, environment, this.clientInfo, this.terminator, this.timings, this.tracker);
  }

  public createAccount(id: string = "acc-1", directoryName: string = "profile"): ProviderAccount {
    return new ProviderAccount(id, "codex", "Work", this.directory.resolve(directoryName), AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
  }

  public createRequest(prompt: string, account: ProviderAccount | null = null, resume: string | null = null, model: string | null = null, effort: string | null = null): TurnRequest {
    return new TurnRequest(account, this.directory.path, prompt, new RequestedSettings("codex", model, effort), resume);
  }

  public [Symbol.dispose](): void {
    this.directory[Symbol.dispose]();
  }
}
