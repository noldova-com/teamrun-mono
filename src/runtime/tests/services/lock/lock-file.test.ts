/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProtocolVersion } from "@noldova/teamrun-protocol";
import { Endpoint, LockFile, ProcessProbe, RuntimeAlreadyRunningException, RuntimeLock } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class LockFileTests {
  @TestMethod
  public refusesALiveLegacyDescriptorWithoutAnOwnershipDatabase(): void {
    using directory = new TemporaryDirectory();
    using file = new LockFile(directory.resolve("runtime.lock"), new ProcessProbe());
    writeFileSync(file.path, JSON.stringify(LockFileTests.createLock(process.pid).toJson()));
    Assert.throws(() => file.claim(), RuntimeAlreadyRunningException);
  }

  @TestMethod
  public acquiresReadsAndReleases(): void {
    using directory = new TemporaryDirectory();
    using file = new LockFile(directory.resolve("nested", "runtime.lock"), new ProcessProbe());
    const lock = LockFileTests.createLock(process.pid);

    Assert.isNull(file.read());
    file.acquire(lock);
    file.acquire(lock);
    const read = file.readLive();
    file.release(process.pid + 1);
    const stillThere = existsSync(file.path);
    file.release(process.pid);

    Assert.areEqual(lock.token, read?.token);
    Assert.isTrue(stillThere);
    Assert.isFalse(existsSync(file.path));
    Assert.throws(() => new LockFile("", new ProcessProbe()), ArgumentException);
  }

  @TestMethod
  public async replacesStaleLocksAndRefusesLiveOnes(): Promise<void> {
    using directory = new TemporaryDirectory();
    using file = new LockFile(directory.resolve("runtime.lock"), new ProcessProbe());
    const child = spawn(process.execPath, ["-e", "0"], { windowsHide: true, stdio: "ignore" });
    const deadProcessId = Number(child.pid);
    await new Promise(resolve => child.on("exit", resolve));
    writeFileSync(file.path, "not json");
    const unreadable = file.read();
    file.acquire(LockFileTests.createLock(deadProcessId));
    const stale = file.readLive();

    file.acquire(LockFileTests.createLock(process.pid));
    const refused = Assert.throws(() => file.acquire(LockFileTests.createLock(process.pid + 1)), RuntimeAlreadyRunningException);

    Assert.isNull(unreadable);
    Assert.isNull(stale);
    Assert.areEqual(process.pid, refused.lock.processId);
    Assert.areEqual(process.pid, file.read()?.processId);
  }

  @TestMethod
  public tellsWhetherARuntimeHoldsOwnershipWithoutKeepingIt(): void {
    using directory = new TemporaryDirectory();
    using owner = new LockFile(directory.resolve("runtime.lock"), new ProcessProbe());
    using observer = new LockFile(owner.path, new ProcessProbe());

    const before = observer.isHeld();
    owner.claim();
    const during = observer.isHeld();
    owner[Symbol.dispose]();
    const after = observer.isHeld();

    Assert.isFalse(before);
    Assert.isTrue(during);
    Assert.isFalse(after);
    Assert.doesNotThrow(() => observer.claim());
  }

  @TestMethod
  public reportsAnOwnershipDatabaseItCannotRead(): void {
    using directory = new TemporaryDirectory();
    using file = new LockFile(directory.resolve("runtime.lock"), new ProcessProbe());
    writeFileSync(`${file.path}.sqlite`, "not a database".repeat(40));

    Assert.areEqual("file is not a database", Assert.throws(() => file.isHeld(), Error).message);
  }

  private static createLock(processId: number): RuntimeLock {
    return new RuntimeLock(processId, Endpoint.tcp(4000), `token-${processId}`, new ProtocolVersion(0, 1), "1.0.0", "2026-09-10T00:00:00.000Z");
  }

  @TestMethod
  public excludesAnUnpublishedOwnerAndReleasesOwnership(): void {
    using directory = new TemporaryDirectory();
    using owner = new LockFile(directory.resolve("runtime.lock"), new ProcessProbe());
    using contender = new LockFile(owner.path, new ProcessProbe());
    owner.claim();
    Assert.throws(() => contender.claim(), Error);
    Assert.isNull(owner.read());
    owner[Symbol.dispose]();
    contender.claim();
    contender.acquire(LockFileTests.createLock(process.pid));
    Assert.areEqual(process.pid, contender.readLive()?.processId);
    contender.release(process.pid);
  }

  @TestMethod
  public async releasesOwnershipWhenTheOwningProcessDies(): Promise<void> {
    using directory = new TemporaryDirectory();
    using contender = new LockFile(directory.resolve("runtime.lock"), new ProcessProbe());
    const source = "import { LockFile, ProcessProbe } from '@noldova/teamrun-runtime'; " +
      "const owner = new LockFile(process.argv[1], new ProcessProbe()); owner.claim(); " +
      "process.stdin.on('data', () => owner.read()); process.stdout.write('owned'); process.stdin.resume();";
    const child = spawn(process.execPath, ["--input-type=module", "-e", source, contender.path], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
    const ended = new Promise<void>(resolve => child.once("close", () => resolve()));
    try {
      await new Promise<void>((resolve, reject) => {
        child.stdout.once("data", () => resolve());
        child.once("error", reject);
        child.once("exit", code => { if (code !== null) reject(new Error(`Owner exited early: ${code}`)); });
      });
      Assert.throws(() => contender.claim(), Error);
    }
    finally {
      child.kill();
      await ended;
    }
    contender.claim();
    Assert.isNull(contender.read());
  }
}
