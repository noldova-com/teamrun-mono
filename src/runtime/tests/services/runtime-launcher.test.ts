/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode, MethodName, ProtocolVersion } from "@noldova/teamrun-protocol";
import { ConnectionException, Endpoint, LaunchException, LockFile, ProcessLaunchException, ProcessProbe, RuntimeBuildMismatchException, RuntimeEntry,
  RuntimeLauncher, RuntimeLock, RuntimeSettings, RuntimeTimings } from "@noldova/teamrun-runtime";

import { RecordingClientListener } from "../fixtures/recording-client-listener.fixture.js";
import { RawServer } from "../fixtures/raw-server.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class RuntimeLauncherTests {
  private static readonly timings: RuntimeTimings = new RuntimeTimings(2000, 5000, 15000, 50);

  @TestMethod
  public async refusesAnotherBuildWithoutConnectingOrReplacingItsLock(): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = new RawServer();
    const endpoint = await server.start();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-test", null);
    using owner = new LockFile(settings.lockPath, new ProcessProbe());
    owner.claim();
    const lock = new RuntimeLock(process.pid, endpoint, "fixture-token", ProtocolVersion.current, "0.0.7", "2026-09-28T13:52:00.000Z", "another-build",
      "C:\\Other\\TeamRun.exe");
    RuntimeLauncherTests.writeLock(settings, lock);
    const original = readFileSync(settings.lockPath, "utf8");
    const launcher = new RuntimeLauncher(settings, process.execPath, directory.resolve("must-not-launch.js"), [], process.env, RuntimeLauncherTests.timings);

    const checked = Assert.throws(() => launcher.assertSameBuild(), RuntimeBuildMismatchException);
    const refused = await Assert.throwsAsync(() => launcher.attach("test", new RecordingClientListener()), RuntimeBuildMismatchException);

    Assert.isTrue(refused.message.startsWith("Another TeamRun, built from different code, is using this data folder:\n" +
      `${settings.dataDirectory}\n\nIt runs from C:\\Other\\TeamRun.exe (version 0.0.7) and started on `), refused.message);
    Assert.areEqual(checked.message, refused.message);
    Assert.areEqual("fixture-token", refused.lock.token);
    Assert.areEqual(0, server.sockets.length);
    Assert.areEqual(original, readFileSync(settings.lockPath, "utf8"));
  }

  @TestMethod
  public async leavesARuntimeOfAnotherBuildServingItsClients(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", 400);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      RuntimeLauncherTests.timings);
    const client = await launcher.attach("original", new RecordingClientListener());
    const lock = launcher.readLiveLock();
    try {
      if (lock === null)
        throw new Error("Expected a live lock.");
      Assert.doesNotThrow(() => launcher.assertSameBuild());
      RuntimeLauncherTests.writeLock(settings, new RuntimeLock(lock.processId, lock.endpoint, lock.token, lock.protocolVersion, lock.productVersion,
        lock.startedAt, "another-build", lock.executablePath));
      Assert.throws(() => launcher.assertSameBuild(), RuntimeBuildMismatchException);
      await Assert.throwsAsync(() => launcher.attach("newer", new RecordingClientListener()), RuntimeBuildMismatchException);
      Assert.areEqual(lock.processId, launcher.readLiveLock()?.processId);
      Assert.isFalse((await client.call(MethodName.ProviderList, null)).hasErrors);
    }
    finally {
      if (lock !== null)
        RuntimeLauncherTests.writeLock(settings, lock);
      client.close();
      await Wait.until(() => launcher.readLiveLock() === null);
    }
  }

  @TestMethod
  public async startsARuntimeProcessThenAttachesToIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", 400);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      RuntimeLauncherTests.timings);
    const first = new RecordingClientListener();
    const second = new RecordingClientListener();

    Assert.doesNotThrow(() => launcher.assertSameBuild());
    const starter = await launcher.attach("starter", first);
    const lock = launcher.readLiveLock();
    const attacher = await launcher.attach("attacher", second);
    const providers = await starter.call(MethodName.ProviderList, null);
    const project = await attacher.call(MethodName.ProjectOpen, { rootPath: directory.resolve("repo") });
    starter.close();
    attacher.close();
    await Wait.until(() => launcher.readLiveLock() === null);

    Assert.isNotNull(lock);
    Assert.areNotEqual(process.pid, lock?.processId);
    Assert.areEqual("0.0.1-launch", lock?.productVersion);
    Assert.isTrue(lock?.protocolVersion.equals(ProtocolVersion.current) ?? false);
    Assert.isTrue(/^[0-9a-f]{64}$/.test(lock?.build ?? ""), lock?.build);
    Assert.areEqual(process.execPath, lock?.executablePath);
    Assert.areEqual("[]", JSON.stringify(providers.payload));
    Assert.isFalse(project.hasErrors);
    Assert.areEqual(1, first.disconnections);
  }

  @TestMethod
  public async replacesAStaleLockOfAnotherBuildWhoseProcessIdIsAliveButThatNoRuntimeHolds(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", 400);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      RuntimeLauncherTests.timings);
    const staleLock = new RuntimeLock(process.pid, Endpoint.tcp(1), "token", ProtocolVersion.current, "0.0.1", "2026-09-10T00:00:00.000Z", "another-build");
    RuntimeLauncherTests.writeLock(settings, staleLock);

    Assert.doesNotThrow(() => launcher.assertSameBuild());
    const client = await launcher.attach("client", new RecordingClientListener());
    const lock = launcher.readLiveLock();
    client.close();
    await Wait.until(() => launcher.readLiveLock() === null);

    Assert.isNotNull(lock);
    Assert.areNotEqual(process.pid, lock?.processId);
    Assert.areNotEqual("token", lock?.token);
  }

  @TestMethod
  public async givesUpWhenNoRuntimeBecomesReachable(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", null);
    const exiting = directory.resolve("exit.js");
    mkdirSync(directory.path, { recursive: true });
    writeFileSync(exiting, "process.exit(0);\n");
    const launcher = new RuntimeLauncher(settings, process.execPath, exiting, [], process.env, new RuntimeTimings(500, 500, 1500, 50));

    const failure = await Assert.throwsAsync(() => launcher.attach("client", new RecordingClientListener()), LaunchException);

    Assert.areEqual("The runtime could not be started: The runtime did not publish its endpoint in time.", failure.message);
    Assert.throws(() => new RuntimeLauncher(settings, " ", RuntimeEntry.entryPath, [], process.env, RuntimeLauncherTests.timings), ArgumentException);
    Assert.throws(() => new RuntimeLauncher(settings, process.execPath, "", [], process.env, RuntimeLauncherTests.timings), ArgumentException);
  }

  @TestMethod
  public async reportsARefusedHelloInsteadOfStartingAnotherRuntime(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-launch", 400);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      RuntimeLauncherTests.timings);
    const client = await launcher.attach("starter", new RecordingClientListener());
    const lock = launcher.readLiveLock();
    try {
      if (lock === null)
        throw new Error("Expected a live lock.");
      RuntimeLauncherTests.writeLock(settings, new RuntimeLock(lock.processId, lock.endpoint, "wrong-token", lock.protocolVersion, lock.productVersion,
        lock.startedAt, lock.build, lock.executablePath));

      const refused = await Assert.throwsAsync(() => launcher.attach("intruder", new RecordingClientListener()), ConnectionException);

      Assert.areEqual(ErrorCode.Unauthorized, refused.info?.name);
    }
    finally {
      if (lock !== null)
        RuntimeLauncherTests.writeLock(settings, lock);
      client.close();
      await Wait.until(() => launcher.readLiveLock() === null);
    }
  }

  @TestMethod
  public async reportsAProcessCreationFailureInsteadOfAnUnhandledError(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-test", 400);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["invalid\0argument"], process.env,
      RuntimeLauncherTests.timings);

    const error = await Assert.throwsAsync(async () => {
      const client = await launcher.attach("test", new RecordingClientListener());
      client.close();
      await Wait.until(() => launcher.readLiveLock() === null);
    }, LaunchException);

    Assert.isFalse(error.message.includes("did not publish its endpoint in time"), error.message);
    Assert.isTrue(error.cause instanceof TypeError && "code" in error.cause && error.cause.code === "ERR_INVALID_ARG_VALUE");
    Assert.isNull(launcher.readLiveLock());
  }

  @TestMethod
  public async reportsMissingLinuxPrerequisitesBeforeWaitingForAnEndpoint(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = RuntimeSettings.forPlatform(process.platform, directory.resolve("data"), "0.0.1-test", null);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      RuntimeLauncherTests.timings);
    const originalAccess = fs.accessSync;
    try {
      for (const path of ["/bin/bash", "/proc/self/fd"]) {
        const cause = Object.assign(new Error("Fixture prerequisite is missing"), { code: "ENOENT" });
        fs.accessSync = (candidate, mode) => {
          if (candidate === path)
            throw cause;
          originalAccess(candidate, mode);
        };
        syncBuiltinESMExports();

        const error = await Assert.throwsAsync(() => launcher.attach("test", new RecordingClientListener()), ProcessLaunchException);

        Assert.isTrue(error.message.includes(path), error.message);
        Assert.areEqual(cause, error.cause);
        Assert.isNull(launcher.readLiveLock());
      }
    }
    finally {
      fs.accessSync = originalAccess;
      syncBuiltinESMExports();
    }
  }

  private static writeLock(settings: RuntimeSettings, lock: RuntimeLock): void {
    mkdirSync(settings.dataDirectory, { recursive: true });
    writeFileSync(settings.lockPath, `${JSON.stringify(lock.toJson())}\n`);
  }
}

if (process.platform !== "linux")
  Skip("Linux runtime prerequisites are checked before spawning.")(RuntimeLauncherTests.prototype.reportsMissingLinuxPrerequisitesBeforeWaitingForAnEndpoint);
