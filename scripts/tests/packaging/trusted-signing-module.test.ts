/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, test } from "node:test";

import PackageException from "../../packaging/package.exception.ts";
import PowerShellGalleryFixture from "./fixtures/power-shell-gallery.fixture.ts";
import TrustedSigningModule from "../../packaging/trusted-signing-module.ts";

class TrustedSigningModuleTests {
  private static root: string = "";
  private static readonly PATH_VARIABLE: string = "PATH";
  private static readonly MODULE_PATH_VARIABLE: string = "PSModulePath";
  private static readonly USER_PROFILE_VARIABLE: string = "USERPROFILE";

  public static register(): void {
    beforeEach(async t => {
      if (!("after" in t))
        throw new Error("The signing module fixture requires an individual test context.");
      const originalDirectory = process.cwd();
      const originalModulePath = process.env[TrustedSigningModuleTests.MODULE_PATH_VARIABLE];
      const originalPath = process.env[TrustedSigningModuleTests.PATH_VARIABLE];
      const originalUserProfile = process.env[TrustedSigningModuleTests.USER_PROFILE_VARIABLE];
      TrustedSigningModuleTests.root = await mkdtemp(path.join(tmpdir(), "teamrun-signing-module-"));
      t.after(async () => {
        process.chdir(originalDirectory);
        if (originalModulePath === undefined) delete process.env[TrustedSigningModuleTests.MODULE_PATH_VARIABLE];
        else process.env[TrustedSigningModuleTests.MODULE_PATH_VARIABLE] = originalModulePath;
        if (originalPath === undefined) delete process.env[TrustedSigningModuleTests.PATH_VARIABLE];
        else process.env[TrustedSigningModuleTests.PATH_VARIABLE] = originalPath;
        if (originalUserProfile === undefined) delete process.env[TrustedSigningModuleTests.USER_PROFILE_VARIABLE];
        else process.env[TrustedSigningModuleTests.USER_PROFILE_VARIABLE] = originalUserProfile;
        await rm(TrustedSigningModuleTests.root, { recursive: true, force: true });
      });
      process.chdir(TrustedSigningModuleTests.root);
      process.env[TrustedSigningModuleTests.USER_PROFILE_VARIABLE] = TrustedSigningModuleTests.root;
    });

    test("prepare saves exactly the recorded version into a fresh directory and checks that it loads", async () => {
      await TrustedSigningModuleTests.useGalleryAsync("0.5.8");
      const directory = path.join(TrustedSigningModuleTests.root, "signing");
      const stale = path.join(directory, "TrustedSigning", "0.5.0", "TrustedSigning.psd1");
      await mkdir(path.dirname(stale), { recursive: true });
      await writeFile(stale, "stale");
      const module = new TrustedSigningModule(directory);
      await module.prepareAsync();
      const record: unknown = JSON.parse(await readFile(path.join(directory, PowerShellGalleryFixture.saveRecordName), "utf8"));
      assert.deepEqual(record, { Name: "TrustedSigning", RequiredVersion: "0.5.8", Repository: "PSGallery", Path: directory, Force: true });
      assert.equal(module.manifestPath, path.join(directory, "TrustedSigning", "0.5.8", "TrustedSigning.psd1"));
      await access(module.manifestPath);
      await assert.rejects(access(stale));
      await access(path.join(TrustedSigningModuleTests.root, "AppData", "Local", "Microsoft", "PowerShell", "StartupProfileData-NonInteractive"));
    });

    test("prepare fails when the saved module reports another version", async () => {
      await TrustedSigningModuleTests.useGalleryAsync("0.5.7");
      const module = new TrustedSigningModule(path.join(TrustedSigningModuleTests.root, "signing"));
      await assert.rejects(module.prepareAsync(), (error: unknown) =>
        error instanceof PackageException && /pwsh exited with code 1 and signal null while running the TrustedSigning module/.test(error.message));
      await access(module.manifestPath);
    });

    test("sign passes the endpoint, account, profile, digests, timestamp server and the absolute file path to the saved module, in a hidden pwsh that skips its taskbar jump list", async () => {
      await TrustedSigningModuleTests.useGalleryAsync("0.5.8");
      const module = new TrustedSigningModule(path.join(TrustedSigningModuleTests.root, "signing"));
      await module.prepareAsync();
      await mkdir("win-unpacked");
      await module.signFileAsync(path.join("win-unpacked", "TeamRun.exe"));
      const file = path.resolve("win-unpacked", "TeamRun.exe");
      const record: unknown = JSON.parse(await readFile(file + PowerShellGalleryFixture.signingRecordExtension, "utf8"));
      assert.deepEqual(record, {
        Endpoint: "https://wus3.codesigning.azure.net/",
        CodeSigningAccountName: "noldova-signing",
        CertificateProfileName: "TeamRun",
        FileDigest: "SHA256",
        TimestampRfc3161: "http://timestamp.acs.microsoft.com",
        TimestampDigest: "SHA256",
        Files: file,
        ShowWindow: 0
      });
    });

    test("sign refuses a path the module would split at a comma without running PowerShell", async () => {
      await TrustedSigningModuleTests.useGalleryAsync("0.5.8");
      const module = new TrustedSigningModule(path.join(TrustedSigningModuleTests.root, "signing"));
      await module.prepareAsync();
      const file = path.join(TrustedSigningModuleTests.root, "a,b", "TeamRun.exe");
      await assert.rejects(module.signFileAsync(file), (error: unknown) => error instanceof PackageException && error.message.includes("cannot sign " + file));
      await assert.rejects(access(file + PowerShellGalleryFixture.signingRecordExtension));
    });

    test("a missing PowerShell fails preparation with the process error", async () => {
      await TrustedSigningModuleTests.useGalleryAsync("0.5.8");
      process.env[TrustedSigningModuleTests.PATH_VARIABLE] = path.join(TrustedSigningModuleTests.root, "empty");
      const module = new TrustedSigningModule(path.join(TrustedSigningModuleTests.root, "signing"));
      await assert.rejects(module.prepareAsync(), /ENOENT/);
      await assert.rejects(access(module.manifestPath));
    });
  }

  private static async useGalleryAsync(manifestVersion: string): Promise<void> {
    const modules = await PowerShellGalleryFixture.writeAsync(path.join(TrustedSigningModuleTests.root, "gallery-fixture"), manifestVersion);
    process.env[TrustedSigningModuleTests.MODULE_PATH_VARIABLE] = PowerShellGalleryFixture.modulePath(modules);
  }
}

TrustedSigningModuleTests.register();
