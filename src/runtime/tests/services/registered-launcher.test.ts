/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Assert, CoverageEnvironment, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MethodName } from "@noldova/teamrun-protocol";
import { InstallationRegistry, InstallationRole, ProcessProbe, RuntimeClient, RuntimeTimings } from "@noldova/teamrun-runtime";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";
import { RecordingClientListener } from "../fixtures/recording-client-listener.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class RegisteredLauncherTests {
  @TestMethod
  public async registersTheRealEntryAndAcknowledgesItsExitAcrossProcesses(): Promise<void> {
    using directory = new TemporaryDirectory();
    const registry = new InstallationRegistry(directory.resolve(".noldova", "teamrun-installations", "a".repeat(64), "instances.db"));
    const data = directory.resolve("data");
    registry.linkDataDirectory(data);
    const child = spawn(process.execPath, [fileURLToPath(new URL("../fixtures/registered-launcher-child.fixture.js", import.meta.url)), data], {
      env: { ...CoverageEnvironment.forChild(process.env), HOME: directory.path, USERPROFILE: directory.path, APPIMAGE: process.execPath },
      stdio: ["pipe", "pipe", "pipe"], windowsHide: true
    });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    const exited = new Promise<void>(resolve => child.once("exit", () => resolve()));
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Launcher timed out: ${stderr}`)), 20_000);
        child.once("error", error => { clearTimeout(timer); reject(error); });
        child.once("exit", () => { clearTimeout(timer); reject(new Error(stderr)); });
        child.stdout.on("data", chunk => { if (String(chunk).includes("ready")) { clearTimeout(timer); resolve(); } });
      });
      const member = registry.members().find(t => t.role === InstallationRole.Runtime);
      Assert.isDefined(member);
      Assert.isNotNull(member.endpoint);
      Assert.isNotNull(member.token);
      const client = await RuntimeClient.connect(member.endpoint, member.token, "updater", new RecordingClientListener(), new RuntimeTimings(2000, 5000, 15000, 50));
      try {
        Assert.isFalse((await client.call(MethodName.RuntimePause, null)).hasErrors);
        Assert.isFalse((await client.call(MethodName.RuntimeStopForUpdate, null)).hasErrors);
        await Wait.until(() => !new ProcessProbe().isAlive(member.processId));
        Assert.areEqual(0, registry.members().length);
      }
      finally { client.close(); }
    }
    finally {
      child.stdin.end();
      await exited;
    }
  }
}
