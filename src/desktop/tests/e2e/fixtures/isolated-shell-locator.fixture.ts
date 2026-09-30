/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect } from "@playwright/test";
import { TerminalShellKind } from "@noldova/teamrun-protocol";
import { type IShellLocator, Shell, type ShellEnvironment, ShellLocator } from "@noldova/teamrun-runtime";

export class IsolatedShellLocator implements IShellLocator {
  private static readonly HISTORY_NAME: string = "command-history";
  private static readonly BASH_PROFILE: string = `HISTFILE="$HOME/${IsolatedShellLocator.HISTORY_NAME}"\nHISTSIZE=1000\nHISTFILESIZE=1000\nHISTCONTROL=\nHISTIGNORE=\nPROMPT_COMMAND="history -w"\n`;
  private static readonly ZSH_PROFILE: string = `HISTFILE="$HOME/${IsolatedShellLocator.HISTORY_NAME}"\nHISTSIZE=1000\nSAVEHIST=1000\nsetopt INC_APPEND_HISTORY\n`;

  private static readonly FIXTURE_SHELL: Shell = new Shell("teamrun-fixture-shell", "Fixture shell", TerminalShellKind.Other, process.execPath,
    ["-e", "process.stdout.write('teamrun-fixture-shell-ready\\r\\n'); setInterval(() => undefined, 60_000);"]);

  private readonly directory: string;
  private readonly locator: IShellLocator;
  private historyPath: string | null = null;

  public constructor(directory: string, locator: IShellLocator = ShellLocator.fromPlatform(process.platform)) {
    this.directory = directory;
    this.locator = locator;
    mkdirSync(directory, { recursive: true });
  }

  public findAll(environment: ShellEnvironment): readonly Shell[] {
    return [this.findDefault(environment), IsolatedShellLocator.FIXTURE_SHELL];
  }

  public findDefault(environment: ShellEnvironment): Shell {
    const shell = this.locator.findDefault(environment);
    const name = path.basename(shell.executable).toLowerCase().replace(/\.exe$/, "");
    this.historyPath = path.join(this.directory, IsolatedShellLocator.HISTORY_NAME);
    if (name === "pwsh" || name === "powershell")
      return this.createPowerShell(shell);

    let args: readonly string[];
    switch (name) {
      case "bash": {
        const profile = path.join(this.directory, ".bashrc");
        writeFileSync(profile, IsolatedShellLocator.BASH_PROFILE);
        args = ["--noprofile", "--rcfile", profile, "-i"];
        break;
      }
      case "zsh":
        writeFileSync(path.join(this.directory, ".zshrc"), IsolatedShellLocator.ZSH_PROFILE);
        args = ["-d", "-i"];
        break;
      case "fish":
        this.historyPath = path.join(this.directory, "data", "fish", "teamrun_ui_history");
        args = ["--no-config", "--interactive"];
        break;
      default:
        throw new Error(`UI tests cannot isolate the history of the default shell "${shell.name}".`);
    }

    return new Shell(shell.id, shell.name, shell.kind, "/usr/bin/env", [
      "-u", "BASH_ENV", "-u", "ENV", "-u", "SHELLOPTS", "-u", "BASHOPTS", "-u", "PROMPT_COMMAND",
      `HOME=${this.directory}`, `ZDOTDIR=${this.directory}`, `HISTFILE=${this.historyPath}`,
      `XDG_CONFIG_HOME=${path.join(this.directory, "config")}`, `XDG_DATA_HOME=${path.join(this.directory, "data")}`,
      "fish_history=teamrun_ui", shell.executable, ...args
    ]);
  }

  public async expectHistory(...commands: readonly string[]): Promise<void> {
    const history = this.historyPath;
    if (history === null)
      throw new Error("The fixture shell has not been selected.");
    await expect.poll(() => {
      try {
        const text = readFileSync(history, "utf8");
        return commands.every(t => text.includes(t));
      }
      catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT")
          return false;
        throw error;
      }
    }, { message: "Terminal commands must be saved in the disposable shell history" }).toBe(true);
  }

  private createPowerShell(shell: Shell): Shell {
    const directory = this.directory.replace(/'/g, "''");
    const script = `$ErrorActionPreference = 'Stop'\ntry {\n` +
      `$env:APPDATA = '${directory}'\n$env:LOCALAPPDATA = '${directory}'\n$env:USERPROFILE = '${directory}'\n$env:HOME = '${directory}'\n` +
      `Import-Module PSReadLine\nSet-PSReadLineOption -HistorySavePath '${directory}/${IsolatedShellLocator.HISTORY_NAME}' -HistorySaveStyle SaveIncrementally\n` +
      `} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }\n`;
    return new Shell(shell.id, shell.name, shell.kind, shell.executable,
      ["-NoLogo", "-NoProfile", "-NoExit", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")]);
  }
}
