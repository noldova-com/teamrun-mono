/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, mock, test } from "node:test";

import BuildEvidence from "../build/build-evidence.ts";
import Config from "../config.ts";
import PackageOptionsFixture from "./packaging/fixtures/package-options.fixture.ts";
import PackageScriptFixture from "./fixtures/package-script.fixture.ts";

mock.module("../script.ts", { exports: { default: PackageScriptFixture } });
mock.module("../packaging/package-options.ts", { exports: { default: PackageOptionsFixture } });
const { default: Package } = await import("../package.ts");

class PackageOrchestrationTests {
  public static register(): void {
    beforeEach(async t => {
      if (!("after" in t) || !("mock" in t))
        throw new Error("The packaging fixture requires an individual test context.");
      const originalDirectory = process.cwd();
      const originalArguments = process.argv;
      const releaseRevision = process.env["RELEASE_REVISION"];
      const githubRevision = process.env["GITHUB_SHA"];
      const directory = await mkdtemp(path.join(tmpdir(), "teamrun-package-command-"));
      t.after(async () => {
        process.chdir(originalDirectory);
        process.argv = originalArguments;
        if (releaseRevision === undefined) delete process.env["RELEASE_REVISION"]; else process.env["RELEASE_REVISION"] = releaseRevision;
        if (githubRevision === undefined) delete process.env["GITHUB_SHA"]; else process.env["GITHUB_SHA"] = githubRevision;
        await rm(directory, { recursive: true, force: true });
      });
      process.chdir(directory);
      process.argv = [process.execPath, "package.ts"];
      delete process.env["RELEASE_REVISION"];
      delete process.env["GITHUB_SHA"];
      PackageOptionsFixture.host = "win32";
      PackageScriptFixture.rendererAvailable = true;
      PackageScriptFixture.dependencyVersion = null;
      PackageScriptFixture.npmCommands.length = 0;
      PackageScriptFixture.processCommands.length = 0;
      PackageScriptFixture.compilerCommands.length = 0;
      PackageScriptFixture.messages.length = 0;
      t.mock.method(BuildEvidence, "requireCurrent", async (): Promise<void> => {});
      for (const name of ["package.json", "package-lock.json", "LICENSE"])
        await writeFile(name, name === "LICENSE" ? "fixture license" : "{}");
    });

    test("stages production packages, preserves target options and writes reports", async () => {
      for (const [host, platform] of [["win32", "windows"], ["darwin", "mac"], ["linux", "linux"]] as const) {
        PackageOptionsFixture.host = host;
        if (host === "win32") process.env["RELEASE_REVISION"] = "release-revision";
        else {
          delete process.env["RELEASE_REVISION"];
          if (host === "darwin") process.env["GITHUB_SHA"] = "github-revision";
          else delete process.env["GITHUB_SHA"];
        }
        await new Package().runAsync();
        const target = platform + "-x64";
        const app = path.join("_build/app", target);
        const manifest: unknown = JSON.parse(await readFile(path.join(app, "package.json"), "utf8"));
        assert.ok(typeof manifest === "object" && manifest !== null && "dependencies" in manifest);
        assert.ok(!JSON.stringify(manifest).includes("teamrun-foundation-testing"));
        assert.ok(!JSON.stringify(manifest).includes("file:"));
        assert.ok(!("devDependencies" in manifest));
        assert.equal(await readFile(path.join(app, "_build/renderer/browser/index.html"), "utf8"), "fixture renderer");
        await assert.rejects(access(path.join(app, "package-lock.json")));
        const launcher = path.join("_build/appimage/x64/AppRun");
        if (host === "linux")
          assert.match(await readFile(launcher, "utf8"), /exec "\$APPDIR\/teamrun" "\$@"/);
        else
          await assert.rejects(access(launcher));
        const command = PackageScriptFixture.processCommands.at(-1);
        assert.ok(command);
        assert.equal(command[command.indexOf("--publish") + 1], "never");
        assert.ok(command.includes("--x64"));
        const install = PackageScriptFixture.npmCommands.at(-1);
        assert.ok(install);
        assert.ok(install.includes("--no-save"));
        assert.equal(install.filter(value => value.endsWith(".tgz")).length, Config.PACKAGES.length - 1);
        const report: unknown = JSON.parse(await readFile(path.join("_build/package", target, "package-report-" + target + ".json"), "utf8"));
        assert.ok(typeof report === "object" && report !== null && "sourceRevision" in report);
        assert.equal(report.sourceRevision, host === "win32" ? "release-revision" : host === "darwin" ? "github-revision" : null);
      }
    });

    test("directory mode does not generate an installer policy or artifact report", async () => {
      process.argv.push("--dir");
      await new Package().runAsync();
      assert.ok(PackageScriptFixture.processCommands[0]?.includes("--dir"));
      await assert.rejects(access("_build/installer-policy/windows-x64.nsh"));
      await assert.rejects(access("_build/package/windows-x64/package-report-windows-x64.json"));
    });

    test("refuses missing renderer output before staging dependencies", async () => {
      PackageScriptFixture.rendererAvailable = false;
      await assert.rejects(new Package().runAsync(), /renderer build did not produce index.html/);
      assert.equal(PackageScriptFixture.processCommands.length, 0);
      assert.equal(PackageScriptFixture.npmCommands.length, 1);
    });

    test("refuses dependency drift before invoking the builder", async () => {
      PackageScriptFixture.dependencyVersion = "0.0.0-fixture";
      await assert.rejects(new Package().runAsync(), /does not match locked version/);
      assert.equal(PackageScriptFixture.processCommands.length, 0);
    });
    
    test("the packaging test entry point type-checks then measures every listed file, loaded or not, at full coverage", async () => {
      await import("../test-package.ts");
      assert.deepEqual(PackageScriptFixture.compilerCommands, [["--project", "scripts/tsconfig.json"]]);
      assert.equal(PackageScriptFixture.processCommands.length, 2);
      for (const command of PackageScriptFixture.processCommands) {
        assert.equal(command[0], "--test");
        for (const flag of ["--experimental-test-coverage", "--test-coverage-include-all", "--test-coverage-exclude=scripts/tests/**",
          "--test-coverage-lines=100", "--test-coverage-branches=100", "--test-coverage-functions=100"])
          assert.ok(command.includes(flag), flag);
        assert.equal(command.filter(t => t.startsWith("--test-coverage-exclude=")).length, 1);
      }
      assert.ok(PackageScriptFixture.processCommands[0]?.includes("--test-coverage-include=scripts/packaging/package-options.ts"));
      assert.ok(PackageScriptFixture.processCommands[1]?.includes("--test-coverage-include=scripts/package.ts"));
      assert.ok(PackageScriptFixture.processCommands[1]?.includes("--test-coverage-include=scripts/test-package.ts"));
      assert.ok(PackageScriptFixture.processCommands[1]?.includes("scripts/tests/package-orchestration.test.ts"));
    });
  }
}

PackageOrchestrationTests.register();
