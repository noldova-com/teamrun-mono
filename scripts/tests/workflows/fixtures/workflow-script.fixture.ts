/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Script from "../../../script.ts";

export default class WorkflowScriptFixture extends Script {
  public static readonly calls: (readonly string[])[] = [];
  public static failCompilation: boolean = false;

  public override async runAsync(): Promise<void> {
    throw new Error("Invoke the workflow test command.");
  }

  protected override async executeTypeScriptCompilerAsync(args: readonly string[]): Promise<void> {
    WorkflowScriptFixture.calls.push(args);
    if (WorkflowScriptFixture.failCompilation)
      throw new Error("Compilation failed");
  }

  protected override async executeProcessAsync(command: string, args: readonly string[], directory: string): Promise<void> {
    WorkflowScriptFixture.calls.push([command, directory, ...args]);
  }
}
