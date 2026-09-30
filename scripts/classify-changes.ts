/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync } from "node:fs";

import ChangeClassifier from "./workflows/change-classifier.ts";
import VerifiedRevisions from "./workflows/verified-revisions.ts";

export default class ClassifyChanges {
  private static readonly OUTPUT_VARIABLE: string = "GITHUB_OUTPUT";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly REPOSITORY_VARIABLE: string = "GITHUB_REPOSITORY";
  private static readonly TOKEN_VARIABLE: string = "GH_TOKEN";
  private static readonly EVENT_VARIABLE: string = "EVENT_NAME";
  private static readonly BASE_VARIABLE: string = "BASE_SHA";
  private static readonly HEAD_VARIABLE: string = "HEAD_SHA";
  private static readonly OUTPUT_REQUIRED: string = "GITHUB_OUTPUT and GITHUB_STEP_SUMMARY are required.";

  public async runAsync(environment: NodeJS.ProcessEnv = process.env, directory: string = process.cwd()): Promise<void> {
    const output = environment[ClassifyChanges.OUTPUT_VARIABLE];
    const summary = environment[ClassifyChanges.SUMMARY_VARIABLE];
    if (!output || !summary)
      throw new Error(ClassifyChanges.OUTPUT_REQUIRED);

    const verifiedRevisions = new VerifiedRevisions(environment[ClassifyChanges.REPOSITORY_VARIABLE] ?? "", environment[ClassifyChanges.TOKEN_VARIABLE] ?? "");
    const scope = await new ChangeClassifier(directory, verifiedRevisions).classifyAsync(environment[ClassifyChanges.EVENT_VARIABLE] ?? "",
      environment[ClassifyChanges.BASE_VARIABLE] ?? "", environment[ClassifyChanges.HEAD_VARIABLE] ?? "");
    appendFileSync(output, `run-code=${scope.runCode}\n`);
    appendFileSync(summary, `${scope.summary}\n`);
    process.stdout.write(`${scope.summary}\n`);
  }
}

if (import.meta.main)
  await new ClassifyChanges().runAsync();
