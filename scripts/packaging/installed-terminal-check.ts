/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import path from "node:path";

import PackageException from "./package.exception.ts";

export default class InstalledTerminalCheck {
  private static readonly MODULE_SEGMENTS: readonly string[] = ["app.asar", "node_modules", "node-pty"];
  private static readonly RUN_AS_NODE_VARIABLE: string = "ELECTRON_RUN_AS_NODE";
  private static readonly PROBE_VARIABLE: string = "TEAMRUN_TERMINAL_PROBE";
  private static readonly PROBE_VALUE: string = "answered";
  private static readonly ANSWER: string = "teamrun-terminal-answered";
  private static readonly TIMEOUT_MILLISECONDS: number = 60_000;
  private static readonly PROBE: string = [
    "const os = require('node:os');",
    "const pty = require(process.argv[1]);",
    "const windows = process.platform === 'win32';",
    "const shell = windows ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';",
    "const terminal = pty.spawn(shell, [], { cols: 80, rows: 24, cwd: os.tmpdir(), env: process.env, useConptyDll: true });",
    "let output = '';",
    "const finish = code => { clearTimeout(timer); try { terminal.kill(); } catch {} process.stdout.write(output + '\\n'); process.exit(code); };",
    "const timer = setTimeout(() => finish(2), 30000);",
    "terminal.onData(data => { output += data; if (output.includes('teamrun-terminal-' + 'answered')) finish(0); });",
    "terminal.write((windows ? 'echo teamrun-terminal-%TEAMRUN_TERMINAL_PROBE%' : 'echo teamrun-terminal-$TEAMRUN_TERMINAL_PROBE') + '\\r');"
  ].join("\n");

  private readonly executable: string;
  private readonly resourcesDirectory: string;

  public constructor(executable: string, resourcesDirectory: string) {
    this.executable = executable;
    this.resourcesDirectory = resourcesDirectory;
  }

  public run(): Promise<void> {
    const module = path.resolve(this.resourcesDirectory, ...InstalledTerminalCheck.MODULE_SEGMENTS);
    return new Promise<void>((resolve, reject) => {
      const child = spawn(this.executable, ["-e", InstalledTerminalCheck.PROBE, module], {
        env: { ...process.env, [InstalledTerminalCheck.RUN_AS_NODE_VARIABLE]: "1", [InstalledTerminalCheck.PROBE_VARIABLE]: InstalledTerminalCheck.PROBE_VALUE },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
      let output = "";
      child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      const timer = setTimeout(() => child.kill(), InstalledTerminalCheck.TIMEOUT_MILLISECONDS);
      child.on("error", error => {
        clearTimeout(timer);
        reject(new PackageException(InstalledTerminalCheck.formatFailure(this.executable, error.message)));
      });
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        if (code === 0 && output.includes(InstalledTerminalCheck.ANSWER))
          resolve();
        else
          reject(new PackageException(InstalledTerminalCheck.formatFailure(this.executable, `exit ${code} signal ${signal}: ${output.slice(-2000)}`)));
      });
    });
  }

  private static formatFailure(executable: string, detail: string): string {
    return `The installed TeamRun at ${executable} could not run a command in a terminal (${detail}).`;
  }
}
