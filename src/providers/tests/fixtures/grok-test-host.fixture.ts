/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";
import { TurnRequest } from "@noldova/teamrun-core";
import { RequestedSettings } from "@noldova/teamrun-protocol";
import { AppServerClientInfo, GrokAdapter, ProcessCommand, ProcessTerminator, ProviderTimings } from "@noldova/teamrun-providers";

import { RecordingProcessTracker } from "./recording-process-tracker.fixture.js";
import { IsolatedPath } from "./isolated-path.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class GrokTestHost implements AsyncDisposable {
  public readonly directory = new TemporaryDirectory();
  public readonly environment: NodeJS.ProcessEnv = IsolatedPath.environment(this.directory.path);
  public readonly command = new ProcessCommand(process.execPath, [fileURLToPath(new URL("./fake-grok-agent.fixture.js", import.meta.url))]);
  public readonly tracker = new RecordingProcessTracker();
  public readonly terminator = new ProcessTerminator(process.platform);
  public readonly timings = new ProviderTimings(2000, 2000, 2000, 2000, 100, 100, 100, 100, 1, 10);
  public readonly info = new AppServerClientInfo("teamrun-tests", "TeamRun tests", "test");
  private readonly adapters: GrokAdapter[] = [];

  public createAdapter(environment: NodeJS.ProcessEnv = this.environment, command: ProcessCommand | null = this.command, terminator: ProcessTerminator = this.terminator): GrokAdapter {
    const adapter = new GrokAdapter(command, environment, this.directory.resolve("profile"), this.info, terminator, this.timings, this.tracker);
    this.adapters.push(adapter);
    return adapter;
  }

  public request(prompt: string, resume: string | null = null, model: string | null = null, effort: string | null = null): TurnRequest {
    return new TurnRequest(null, this.directory.path, prompt, new RequestedSettings("grok", model, effort), resume);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(this.adapters.map(t => t.shutdown()));
    this.directory[Symbol.dispose]();
  }
}
