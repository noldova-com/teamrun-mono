/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { beforeEach, mock, test } from "node:test";
import { fileURLToPath } from "node:url";

import BuildEvidence from "../build/build-evidence.ts";
import Config from "../config.ts";
import BuildProjectFixture from "./build/fixtures/build-project.fixture.ts";
import BuildScriptFixture from "./build/fixtures/build-script.fixture.ts";

mock.module("../script.ts", { exports: { default: BuildScriptFixture } });
const { Build } = await import("../build.ts");

class BuildTests {
  public static register(): void {
    beforeEach(t => {
      if (!("after" in t))
        throw new Error("The build fixture requires an individual test context.");
      const originalArguments = process.argv;
      t.after(() => { process.argv = originalArguments; });
      process.argv = [process.execPath, "scripts/build.ts"];
      BuildScriptFixture.calls.length = 0;
      BuildScriptFixture.messages.length = 0;
      BuildScriptFixture.failAt = null;
    });

    test("importing the build command leaves the project and toolchain untouched", async t => {
      const fixture = await BuildProjectFixture.create();
      t.after(() => fixture.close());
      const command = new URL("../build.ts", import.meta.url);
      const preload = new URL("./build/fixtures/build-command.fixture.ts", import.meta.url).href;
      const child = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", preload,
        "--input-type=module", "-e", `await import(${JSON.stringify(command.href)});`], { cwd: fixture.directory, encoding: "utf8", timeout: 10_000 });
      assert.equal(child.error, undefined);
      assert.equal(child.status, 0, child.stderr);
      assert.equal(child.stdout, "");
      await assert.rejects(fixture.read("build-calls.json"), { code: "ENOENT" });
      await assert.rejects(fixture.read("_build/evidence/foundation-core.sha256"), { code: "ENOENT" });
    });

    test("the default build bootstraps, builds and installs in dependency order, stamps the runtime and prepares the renderer", async t => {
      const fixture = await BuildProjectFixture.create();
      fixture.enter(t);
      await fixture.write("_build/dist/foundation-core/obsolete.js", "stale output");
      await fixture.write("node_modules/@noldova/teamrun-foundation-core/obsolete.js", "stale installed output");
      await fixture.write("src/renderer/node_modules/@noldova/obsolete.js", "stale renderer dependency");
      await new Build().runAsync();

      assert.deepEqual(BuildScriptFixture.calls[0], ["npm-ci", fixture.directory, "false", "ci", "--no-audit", "--no-fund"]);
      assert.deepEqual(BuildScriptFixture.calls.filter(t => t[0]?.startsWith("compile-")).map(t => t[0]), Config.PACKAGES.map(t => `compile-${t.name}`));
      const installs = BuildScriptFixture.calls.filter(t => t[0] === "npm-install");
      assert.equal(installs.length, Config.PACKAGES.length);
      for (const [index, call] of installs.entries())
        assert.deepEqual(call, ["npm-install", fixture.directory, "true", "install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund",
          ...Config.PACKAGES.slice(0, index + 1).map(t => path.resolve("_packages", t.formatTarballFileName(Config.VERSION)))]);
      for (const item of Config.PACKAGES) {
        assert.equal(await fixture.read(`node_modules/${item.packageName}/package.json`),
          JSON.stringify({ name: item.packageName, version: Config.VERSION, type: "module" }));
        assert.equal(await fixture.read(`node_modules/${item.packageName}/LICENSE`), "Fixture license\n");
        assert.equal(await fixture.read(`node_modules/${item.packageName}/api/index.d.ts`), "export declare const answer: number;\n");
      }
      const runtime = Config.PACKAGES.find(t => t.name === "runtime");
      assert.ok(runtime);
      const fingerprint = await BuildEvidence.fingerprintInputs(runtime);
      const expected = `export const version = "${Config.VERSION}";\nexport const protocol = "${Config.PROTOCOL_VERSION}";\n`
        + `export const publisher = "${Config.WINDOWS_PUBLISHER}";\nexport const build = "${fingerprint}";\n`;
      for (const file of ["_build/dist/runtime/resources.js", "_packages/contents/runtime/resources.js", "node_modules/@noldova/teamrun-runtime/resources.js"])
        assert.equal(await fixture.read(file), expected);
      assert.equal((await fixture.read("_build/evidence/runtime.sha256")).split("\n")[0], fingerprint);
      await BuildEvidence.requireCurrent();
      for (const file of ["_build/dist/foundation-core/obsolete.js", "node_modules/@noldova/teamrun-foundation-core/obsolete.js",
        "src/renderer/node_modules/@noldova/obsolete.js"])
        await assert.rejects(fixture.read(file), { code: "ENOENT" });
      assert.deepEqual(BuildScriptFixture.calls.slice(-2), [
        ["renderer-ci", path.resolve("src/renderer"), "false", "ci", "--no-audit", "--no-fund"],
        ["renderer", process.execPath, path.resolve("src/renderer"), path.resolve("src/renderer/node_modules/@angular/cli/bin/ng.js"),
          "build", "--configuration", "production"]
      ]);
      for (const name of ["INTER-OFL.txt", "INCONSOLATA-OFL.txt"])
        assert.equal(await fixture.read(`_build/renderer/browser/licenses/fonts/${name}`), `Fixture ${name}\n`);
      assert.ok(BuildScriptFixture.messages.includes(`Built ${Config.PACKAGES.length} package(s).`));
    });

    test("explicit names retain dependency order, omit duplicates and do not build the renderer", async t => {
      const fixture = await BuildProjectFixture.create();
      fixture.enter(t);
      await fixture.write("node_modules/typescript/package.json", "{}");
      process.argv.push("foundation-exceptions", "foundation-core", "foundation-core");
      await new Build().runAsync();
      assert.deepEqual(BuildScriptFixture.calls.map(t => t[0]), [
        "compile-foundation-core", "npm-pack", "npm-install", "compile-foundation-exceptions", "npm-pack", "npm-install"
      ]);
      assert.equal(BuildScriptFixture.messages.at(-1), "Built 2 package(s).");
      await assert.rejects(fixture.read("_build/evidence/foundation-text.sha256"), { code: "ENOENT" });
    });

    test("renderer-only builds reuse Angular and preserve existing package artifacts", async t => {
      const fixture = await BuildProjectFixture.create();
      fixture.enter(t);
      await fixture.write("node_modules/typescript/package.json", "{}");
      await fixture.write("src/renderer/node_modules/@angular/cli/bin/ng.js", "fixture CLI");
      await fixture.write("_packages/existing.tgz", "existing archive");
      process.argv.push("--renderer");
      await new Build().runAsync();
      assert.deepEqual(BuildScriptFixture.calls.map(t => t[0]), ["renderer"]);
      assert.equal(await fixture.read("_packages/existing.tgz"), "existing archive");
      assert.ok(BuildScriptFixture.messages.includes("Built 0 package(s)."));
    });

    test("unknown names fail before compiling or installing any package", async t => {
      const fixture = await BuildProjectFixture.create();
      fixture.enter(t);
      await fixture.write("node_modules/typescript/package.json", "{}");
      process.argv.push("missing", "foundation-core", "also-missing");
      await assert.rejects(new Build().runAsync(), { message: `Unknown package(s): missing, also-missing. Known packages: ${Config.PACKAGES.map(t => t.name).join(", ")}.` });
      assert.deepEqual(BuildScriptFixture.calls, []);
    });

    for (const resources of [null, "export const answer = 42;\n"])
      test(`packages ${resources === null ? "without resources" : "with no resource placeholders"} remain unchanged`, async t => {
        const fixture = await BuildProjectFixture.create();
        fixture.enter(t);
        if (resources === null)
          await rm("src/foundation/core/src/resources.ts");
        else
          await fixture.write("src/foundation/core/src/resources.ts", resources);
        process.argv.push("foundation-core");
        await new Build().runAsync();
        if (resources === null)
          await assert.rejects(fixture.read("node_modules/@noldova/teamrun-foundation-core/resources.js"), { code: "ENOENT" });
        else
          assert.equal(await fixture.read("node_modules/@noldova/teamrun-foundation-core/resources.js"), resources);
      });

    for (const failure of ["npm-ci", "compile-foundation-core", "npm-pack", "npm-install", "compile-foundation-exceptions", "renderer-ci", "renderer"])
      test(`the build process terminates unsuccessfully at ${failure} without running subsequent steps`, async t => {
        const fixture = await BuildProjectFixture.create();
        t.after(() => fixture.close());
        const command = fileURLToPath(new URL("../build.ts", import.meta.url));
        const preload = new URL("./build/fixtures/build-command.fixture.ts", import.meta.url).href;
        const args = failure.startsWith("renderer") ? ["--renderer"] : ["foundation-core", "foundation-exceptions"];
        const child = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", preload, command, ...args], {
          cwd: fixture.directory, env: { ...process.env, TEAMRUN_BUILD_FAIL_AT: failure }, encoding: "utf8", timeout: 10_000
        });
        assert.equal(child.error, undefined);
        assert.equal(child.status, 1);
        assert.equal(child.signal, null);
        assert.match(child.stderr, /Fixture tool failed/);
        assert.match(child.stderr, /code 17/);
        const calls: unknown = JSON.parse(await fixture.read("build-calls.json"));
        assert.ok(Array.isArray(calls));
        const lastCall: unknown = calls.at(-1);
        assert.ok(Array.isArray(lastCall));
        assert.equal(lastCall[0], failure);
        await assert.rejects(fixture.read("_build/evidence/foundation-exceptions.sha256"), { code: "ENOENT" });
        if (failure === "compile-foundation-exceptions")
          assert.match(await fixture.read("_build/evidence/foundation-core.sha256"), /^[a-f0-9]{64}\n/);
      });

    test("the real compiler, npm pack and offline installation produce the recorded installed artifact", async t => {
      const fixture = await BuildProjectFixture.create();
      t.after(() => fixture.close());
      await fixture.write("node_modules/typescript/package.json", "{}");
      await fixture.write("src/foundation/core/src/resources.ts", BuildProjectFixture.RESOURCES + 'export const build = "__BUILD__";\n');
      const command = fileURLToPath(new URL("../build.ts", import.meta.url));
      const child = spawnSync(process.execPath, [command, "foundation-core"], {
        cwd: fixture.directory, encoding: "utf8", timeout: 30_000,
        env: { ...process.env, npm_config_offline: "true", npm_config_cache: path.join(fixture.directory, "npm-cache") }
      });
      assert.equal(child.error, undefined);
      assert.equal(child.status, 0, child.stderr);
      assert.match(child.stdout, /Built 1 package\(s\)\./);
      const evidence = await fixture.read("_build/evidence/foundation-core.sha256");
      assert.match(evidence, /^(?:[a-f0-9]{64}\n){3}$/);
      assert.equal(await fixture.read("node_modules/@noldova/teamrun-foundation-core/resources.js"),
        `export const version = "${Config.VERSION}";\nexport const protocol = "${Config.PROTOCOL_VERSION}";\n`
        + `export const publisher = "${Config.WINDOWS_PUBLISHER}";\nexport const build = "${evidence.split("\n")[0]}";\n`);
      const tarball = await readFile(path.join(fixture.directory, "_packages", `noldova-teamrun-foundation-core-${Config.VERSION}.tgz`));
      assert.deepEqual(tarball.subarray(0, 2), Buffer.from([0x1f, 0x8b]));
    });
  }
}

BuildTests.register();
