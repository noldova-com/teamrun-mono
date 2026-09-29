/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import BuildEvidence from "./build/build-evidence.ts";
import DevelopmentBinary from "./desktop/development-binary.ts";

export default class Desktop {
  private static readonly MAIN: string = "node_modules/@noldova/teamrun-desktop/main.js";
  private static readonly RENDERER: string = "_build/renderer/browser/index.html";
  private static readonly PREPARE_OPTION: string = "--prepare-only";
  private static readonly DATA_DIRECTORY_VARIABLE: string = "TEAMRUN_DATA_DIR";
  private static readonly DATA_DIRECTORY_SEGMENTS: readonly string[] = [".noldova", "teamrun-dev"];

  public async runAsync(): Promise<void> {
    await BuildEvidence.requireCurrent();
    await access(Desktop.RENDERER);
    const executable = await new DevelopmentBinary().prepare();
    if (process.argv.length === 3 && process.argv[2] === Desktop.PREPARE_OPTION)
      return;

    const environment = { ...process.env };
    delete environment["ELECTRON_RUN_AS_NODE"];
    environment[Desktop.DATA_DIRECTORY_VARIABLE] ??= path.join(homedir(), ...Desktop.DATA_DIRECTORY_SEGMENTS);
    const child = spawn(executable, [path.resolve(Desktop.MAIN), ...process.argv.slice(2)], { cwd: process.cwd(), env: environment, stdio: "inherit" });
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0)
          resolve();
        else
          reject(new Error(`The desktop exited with ${code === null ? `signal ${signal}` : `code ${code}`}.`));
      });
    });
  }
}

if (import.meta.main)
  await new Desktop().runAsync();
