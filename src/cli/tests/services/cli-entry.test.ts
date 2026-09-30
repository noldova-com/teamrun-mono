/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";

import { Assert, CoverageEnvironment, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CliEntry } from "@noldova/teamrun-cli";
import { MethodName } from "@noldova/teamrun-protocol";
import { LockFile, ProcessProbe, RuntimeClient, RuntimeSettings, RuntimeTimings } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class CliEntryTests {
  private static readonly PROCESS_TIMEOUT_MILLISECONDS: number = 25_000;
  private static readonly DIAGNOSTIC_LIMIT: number = 4000;

  @TestMethod
  public async runsTheClientAsAProcess(): Promise<void> {
    using directory = new TemporaryDirectory();
    const dataDirectory = directory.resolve("data");
    const probe = new ProcessProbe();
    const lock = new LockFile(RuntimeSettings.forPlatform(process.platform, dataDirectory, "0.0.0", null).lockPath, probe);
    const common = ["--data-dir", dataDirectory, "--runtime-providers", "none"];

    try {
      const status = await CliEntryTests.execute(["status", "--data-dir", dataDirectory], "");
      Assert.areEqual(1, status.code, status.stderr);
      Assert.areEqual("No runtime is running for this data directory.", status.stdout.trim());

      const providers = await CliEntryTests.execute(["providers", "--json", ...common], "");
      Assert.areEqual(0, providers.code, providers.stderr);
      Assert.areEqual("[]", providers.stdout.trim());

      const chat = await CliEntryTests.execute(["chat", "missing", "--provider", "fake", ...common], "hello\n");
      const diagnostics = `Chat exited with ${chat.code}. stdout: ${chat.stdout}\nstderr: ${chat.stderr}`;
      Assert.areEqual(1, chat.code, diagnostics);
      Assert.isTrue(chat.stdout.includes("Type a message"), diagnostics);
      Assert.isTrue(chat.stderr.includes("Error (NotFound)"), diagnostics);
      Assert.isTrue(CliEntry.entryPath.endsWith("cli-entry.js"));
    }
    finally {
      await CliEntryTests.stopRuntime(lock, probe);
    }
  }

  private static async stopRuntime(lock: LockFile, probe: ProcessProbe): Promise<void> {
    const running = lock.readLive();
    if (running === null)
      return;
    const client = await RuntimeClient.connect(running.endpoint, running.token, "cli-test-cleanup",
      { onEvent: () => undefined, onDisconnected: () => undefined }, RuntimeTimings.createDefault());
    try {
      Assert.isFalse((await client.call(MethodName.RuntimePause, null)).hasErrors);
      Assert.isFalse((await client.call(MethodName.RuntimeStopForUpdate, null)).hasErrors);
    }
    finally {
      client.close();
    }
    await Wait.until(() => !probe.isAlive(running.processId));
    Assert.isNull(lock.readLive());
  }

  private static execute(args: readonly string[], input: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [CliEntry.entryPath, ...args],
        { env: CoverageEnvironment.forChild(process.env), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, CliEntryTests.PROCESS_TIMEOUT_MILLISECONDS);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => stdout = (stdout + chunk).slice(-CliEntryTests.DIAGNOSTIC_LIMIT));
      child.stderr.on("data", (chunk: string) => stderr = (stderr + chunk).slice(-CliEntryTests.DIAGNOSTIC_LIMIT));
      child.on("error", error => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", code => {
        clearTimeout(timer);
        if (timedOut)
          reject(new Error(`CLI ${args[0]} did not exit in time. stdout: ${stdout}\nstderr: ${stderr}`));
        else
          resolve({ code, stdout, stderr });
      });
      child.stdin.end(input);
    });
  }
}
