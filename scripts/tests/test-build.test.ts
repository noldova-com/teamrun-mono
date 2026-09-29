/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mock, test } from "node:test";
import { fileURLToPath } from "node:url";

import BuildProjectFixture from "./build/fixtures/build-project.fixture.ts";
import BuildScriptFixture from "./build/fixtures/build-script.fixture.ts";

mock.module("../script.ts", { exports: { default: BuildScriptFixture } });
const { default: TestBuild } = await import("../test-build.ts");

class TestBuildTests {
  public static register(): void {
    test("the build test gate type-checks and includes unloaded production files at full line, branch and function coverage", async t => {
      const fixture = await BuildProjectFixture.create();
      fixture.enter(t);
      assert.equal(BuildScriptFixture.calls.length, 0);
      await new TestBuild().runAsync();
      assert.deepEqual(BuildScriptFixture.calls[0], ["typecheck", fixture.directory, "--project", "scripts/tsconfig.json"]);
      const command = BuildScriptFixture.calls[1];
      assert.ok(command);
      assert.deepEqual(command.slice(0, 3), ["tests", process.execPath, fixture.directory]);
      for (const flag of ["--test", "--experimental-test-coverage", "--experimental-test-module-mocks", "--test-coverage-include-all",
        "--test-coverage-lines=100", "--test-coverage-branches=100", "--test-coverage-functions=100"])
        assert.ok(command.includes(flag), flag);
      assert.deepEqual(command.filter(t => t.startsWith("--test-coverage-include=")), [
        "--test-coverage-include=scripts/build.ts", "--test-coverage-include=scripts/build/build-evidence.ts", "--test-coverage-include=scripts/test-build.ts"
      ]);
      assert.deepEqual(command.filter(t => t.startsWith("--test-coverage-exclude=")), ["--test-coverage-exclude=scripts/tests/**"]);
      assert.deepEqual(command.filter(t => t.endsWith(".test.ts")), [
        "scripts/tests/build.test.ts", "scripts/tests/build/build-evidence.test.ts", "scripts/tests/test-build.test.ts"
      ]);
    });

    for (const failure of ["", "typecheck", "tests"])
      test(`the test entry point terminates with the ${failure || "successful"} process outcome`, async t => {
        const fixture = await BuildProjectFixture.create();
        t.after(() => fixture.close());
        const command = fileURLToPath(new URL("../test-build.ts", import.meta.url));
        const preload = new URL("./build/fixtures/build-command.fixture.ts", import.meta.url).href;
        const child = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", preload, command], {
          cwd: fixture.directory, env: { ...process.env, TEAMRUN_BUILD_FAIL_AT: failure }, encoding: "utf8", timeout: 10_000
        });
        assert.equal(child.error, undefined);
        assert.equal(child.status, failure === "" ? 0 : 1, child.stderr);
        assert.equal(child.signal, null);
        if (failure !== "")
          assert.match(child.stderr, /code 17/);
        if (failure === "typecheck")
          assert.doesNotMatch(await fixture.read("build-calls.json"), /"tests"/);
      });
  }
}

TestBuildTests.register();
