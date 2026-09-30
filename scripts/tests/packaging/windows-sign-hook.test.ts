/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import PowerShellGalleryFixture from "./fixtures/power-shell-gallery.fixture.ts";
import TrustedSigningModule from "../../packaging/trusted-signing-module.ts";
import windowsSignHook from "../../packaging/windows-sign-hook.ts";

class WindowsSignHookTests {
  private static readonly LOADER_PROBE: string = [
    "const { resolveFunction } = require('app-builder-lib/out/util/resolve.js');",
    "resolveFunction('sign', './scripts/packaging/windows-sign-hook.ts', 'sign', process.cwd())",
    "  .then(hook => { process.stdout.write(typeof hook); })",
    "  .catch(error => { process.stderr.write(String(error)); process.exit(1); });"
  ].join("\n");

  public static register(): void {
    test("electron-builder's hook loader resolves the repository's sign hook to a function", () => {
      const result = spawnSync(process.execPath, ["-e", WindowsSignHookTests.LOADER_PROBE], { encoding: "utf8", timeout: 30_000 });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "function");
    });

    test("the hook signs the given file with the module saved under the working directory", async t => {
      const originalDirectory = process.cwd();
      const originalModulePath = process.env["PSModulePath"];
      const root = await mkdtemp(path.join(tmpdir(), "teamrun-sign-hook-"));
      t.after(async () => {
        process.chdir(originalDirectory);
        if (originalModulePath === undefined) delete process.env["PSModulePath"]; else process.env["PSModulePath"] = originalModulePath;
        await rm(root, { recursive: true, force: true });
      });
      process.chdir(root);
      const modules = await PowerShellGalleryFixture.writeAsync(path.join(root, "gallery-fixture"), "0.5.8");
      process.env["PSModulePath"] = PowerShellGalleryFixture.modulePath(modules);
      await new TrustedSigningModule().prepareAsync();
      const file = path.join(root, "TeamRun-windows-x64.exe");
      await windowsSignHook({ path: file });
      const record: unknown = JSON.parse(await readFile(file + PowerShellGalleryFixture.signingRecordExtension, "utf8"));
      assert.ok(typeof record === "object" && record !== null && "Files" in record);
      assert.equal(record.Files, file);
      await readFile(path.join(root, "_build", "signing", "TrustedSigning", "0.5.8", "TrustedSigning.psd1"), "utf8");
    });
  }
}

WindowsSignHookTests.register();
