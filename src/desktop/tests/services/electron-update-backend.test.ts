/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Assert, Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources } from "@noldova/teamrun-desktop";

import { Authenticode } from "../fixtures/authenticode.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

interface IUpdateCase {
  readonly dataDirectory: string;
  readonly feedUrl: string;
  readonly publisher: string;
}

@TestClass
export class ElectronUpdateBackendTests {
  private static readonly CHILD: string = fileURLToPath(new URL("../fixtures/update-backend-child.fixture.js", import.meta.url));
  private static readonly BINARY: string = resolve("_build", "electron-dev", "TeamRun.exe");
  private static readonly INSTALLER: string = "TeamRun-99.0.0.exe";

  @TestMethod
  public async refusesAnInstallerFromAnotherPublisherOrWithoutSignatureAndKeepsNothing(): Promise<void> {
    await ElectronUpdateBackendTests.withFeed(async (directory, feed) => {
      const otherPublisher = directory.resolve("other-publisher");
      const unsigned = directory.resolve("unsigned");
      Assert.areEqual([Resources.updateSignatureRejected, Resources.updateSignatureRejected].join("|"), (await ElectronUpdateBackendTests.run(directory, [
        { dataDirectory: otherPublisher, feedUrl: feed("signed"), publisher: Resources.windowsPublisher },
        { dataDirectory: unsigned, feedUrl: feed("unsigned"), publisher: Authenticode.smallSigner }])).join("|"));
      Assert.areEqual("", (await ElectronUpdateBackendTests.pendingInstallers(directory, otherPublisher)).join());
      Assert.areEqual("", (await ElectronUpdateBackendTests.pendingInstallers(directory, unsigned)).join());
    });
  }

  @TestMethod
  public async keepsAnInstallerThePublisherSignedAndChecksItAgainWhenReused(): Promise<void> {
    await ElectronUpdateBackendTests.withFeed(async (directory, feed) => {
      const data = directory.resolve("data");
      Assert.areEqual("", (await ElectronUpdateBackendTests.run(directory, [
        { dataDirectory: data, feedUrl: feed("signed"), publisher: Authenticode.smallSigner }])).join("|"));
      Assert.areEqual(ElectronUpdateBackendTests.INSTALLER, (await ElectronUpdateBackendTests.pendingInstallers(directory, data)).join());
      Assert.areEqual(Resources.updateSignatureRejected, (await ElectronUpdateBackendTests.run(directory, [
        { dataDirectory: data, feedUrl: feed("signed"), publisher: Resources.windowsPublisher }])).join("|"));
      Assert.areEqual("", (await ElectronUpdateBackendTests.pendingInstallers(directory, data)).join());
    });
  }

  private static async withFeed(body: (directory: TemporaryDirectory, feed: (name: string) => string) => Promise<void>): Promise<void> {
    Assert.isTrue(existsSync(ElectronUpdateBackendTests.BINARY), "Prepare the development binary with npm run desktop -- --prepare-only.");
    using directory = new TemporaryDirectory();
    const server = await ElectronUpdateBackendTests.serve(new Map([["signed", await readFile(Authenticode.smallSignedFile)], ["unsigned", Buffer.from("not signed")]]));
    try {
      await body(directory, name => `http://127.0.0.1:${(server.address() as AddressInfo).port}/${name}/`);
    }
    finally {
      server.close();
    }
  }

  private static async serve(installers: ReadonlyMap<string, Buffer>): Promise<Server> {
    const information = Resources.formatUpdateInfoName(Resources.formatUpdateTarget(process.platform, process.arch));
    const server = createServer((request, response) => {
      const [, feed, name] = (request.url ?? "").split("/");
      const installer = installers.get(feed ?? "");
      if (installer !== undefined && name === information)
        response.end(JSON.stringify({ version: "99.0.0", releaseDate: "2026-09-30T00:00:00.000Z", files: [{ url: ElectronUpdateBackendTests.INSTALLER,
          sha512: createHash("sha512").update(installer).digest("base64"), size: installer.length }] }));
      else if (installer !== undefined && name === ElectronUpdateBackendTests.INSTALLER)
        response.end(installer);
      else {
        response.statusCode = 404;
        response.end();
      }
    });
    await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
    return server;
  }

  private static async run(directory: TemporaryDirectory, cases: readonly IUpdateCase[]): Promise<readonly (string | null)[]> {
    const started = performance.now();
    const environment: NodeJS.ProcessEnv = { ...process.env, LOCALAPPDATA: directory.resolve("local"), TEAMRUN_TEST_USER_DATA: directory.resolve("user-data"),
      TEAMRUN_TEST_CASES: JSON.stringify(cases) };
    delete environment["ELECTRON_RUN_AS_NODE"];
    const application = directory.resolve("application");
    await mkdir(application, { recursive: true });
    await writeFile(join(application, "package.json"), JSON.stringify({ name: "teamrun-update-test", version: "1.0.0", main: ElectronUpdateBackendTests.CHILD }));
    const child = spawn(ElectronUpdateBackendTests.BINARY, [application], { env: environment, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "";
    let errors = "";
    child.stdout.on("data", chunk => { output += String(chunk); });
    child.stderr.on("data", chunk => { errors += String(chunk); });
    const code = await new Promise<number | null>((done, fail) => {
      const timer = setTimeout(() => { child.kill(); fail(new Error(`The update backend child timed out: ${errors}`)); }, 120_000);
      child.once("error", error => { clearTimeout(timer); fail(error); });
      child.once("exit", exitCode => { clearTimeout(timer); done(exitCode); });
    });
    Assert.areEqual(0, code, errors);
    console.error(`[timing #235] electron run of ${cases.length} case(s): ${Math.round(performance.now() - started)} ms; ${output.trim().split(/\r?\n/).filter(t => t.startsWith("{")).join(" ")}`);
    return output.split(/\r?\n/).filter(t => t.startsWith("{")).map(t => (JSON.parse(t) as { refusal: string | null }).refusal);
  }

  private static async pendingInstallers(directory: TemporaryDirectory, dataDirectory: string): Promise<readonly string[]> {
    const cache = `${Resources.updateCachePrefix}${createHash(Resources.updateHashAlgorithm).update(dataDirectory).digest(Resources.updateHashEncoding)}`;
    const pending = join(directory.resolve("local"), cache, "pending");
    return existsSync(pending) ? (await readdir(pending)).filter(t => t.endsWith(".exe")) : [];
  }
}

if (process.platform !== "win32")
  for (const test of [ElectronUpdateBackendTests.prototype.refusesAnInstallerFromAnotherPublisherOrWithoutSignatureAndKeepsNothing,
    ElectronUpdateBackendTests.prototype.keepsAnInstallerThePublisherSignedAndChecksItAgainWhenReused])
    Skip("Authenticode signatures and the Windows installer updater exist only on Windows.")(test);
