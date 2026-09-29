/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import Desktop from "../desktop.ts";

class DesktopTests {
  public static register(): void {
    test("importing the launcher does not start the application", () => {
      assert.equal(typeof Desktop, "function");
    });

    for (const mode of ["success", "main", "chosen", "code", "signal", "missing", "prepare"])
      test(`launcher preserves arguments, keeps development data apart and reports the child outcome (${mode})`, async t => {
        const root = process.cwd();
        const home = await mkdtemp(path.join(tmpdir(), "teamrun-launcher-test-"));
        t.after(() => rm(home, { recursive: true, force: true }));
        const checkoutName = mode === "main" ? "main" : "claude_1";
        const directory = path.join(home, checkoutName);
        await mkdir(path.join(directory, "node_modules/@noldova/teamrun-desktop"), { recursive: true });
        await mkdir(path.join(directory, "_build/renderer/browser"), { recursive: true });
        await writeFile(path.join(directory, "_build/renderer/browser/index.html"), "fixture");
        await writeFile(path.join(directory, "package.json"), await readFile("package.json"));
        await writeFile(path.join(directory, "node_modules/@noldova/teamrun-desktop/package.json"), '{"type":"commonjs"}');
        await writeFile(path.join(directory, "node_modules/@noldova/teamrun-desktop/main.js"),
          'const fs = require("node:fs"); fs.writeFileSync("launch.json", JSON.stringify({ args: process.argv.slice(2), asNode: process.env.ELECTRON_RUN_AS_NODE ?? null, dataDirectory: process.env.TEAMRUN_DATA_DIR ?? null })); process.exit(process.env.TEAMRUN_LAUNCH_FIXTURE === "code" ? 4 : 0);');
        const environment: NodeJS.ProcessEnv = { ...process.env, TEAMRUN_LAUNCH_FIXTURE: mode, ELECTRON_RUN_AS_NODE: "1", HOME: home, USERPROFILE: home };
        delete environment["TEAMRUN_DATA_DIR"];
        if (mode === "chosen")
          environment["TEAMRUN_DATA_DIR"] = path.join(home, "chosen-data");
        const result = spawnSync(process.execPath, [
          "--experimental-test-module-mocks", "--import", pathToFileURL(path.join(root, "scripts/tests/fixtures/launcher-preload.fixture.ts")).href,
          path.join(root, "scripts/desktop.ts"), ...(mode === "prepare" ? ["--prepare-only"] : ["--fixture-argument", "two words"])
        ], { cwd: directory, env: environment, encoding: "utf8", timeout: 10_000 });
        assert.equal(result.error, undefined);
        assert.equal(result.status, mode === "success" || mode === "main" || mode === "chosen" || mode === "prepare" ? 0 : 1, result.stderr);
        if (mode === "success" || mode === "main")
          assert.deepEqual(JSON.parse(await readFile(path.join(directory, "launch.json"), "utf8")),
            { args: ["--fixture-argument", "two words"], asNode: null, dataDirectory: path.join(home, ".noldova", `teamrun-dev-${checkoutName}`) });
        if (mode === "chosen")
          assert.equal(JSON.parse(await readFile(path.join(directory, "launch.json"), "utf8")).dataDirectory, path.join(home, "chosen-data"));
        if (mode === "code") assert.match(result.stderr, /code 4/);
        if (mode === "signal") assert.match(result.stderr, /signal SIGTERM/);
        if (mode === "missing") assert.match(result.stderr, /ENOENT/);
        if (mode === "prepare") await assert.rejects(readFile(path.join(directory, "launch.json")));
      });
  }
}

DesktopTests.register();
