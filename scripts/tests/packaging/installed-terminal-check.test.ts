/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import InstalledTerminalCheck from "../../packaging/installed-terminal-check.ts";
import PackageException from "../../packaging/package.exception.ts";

class InstalledTerminalCheckTests {
  public static register(): void {
    test("runs a command in a real terminal through the application's own node-pty", async t => {
      const resources = await InstalledTerminalCheckTests.resources(t, path.resolve("node_modules", "node-pty"));

      await new InstalledTerminalCheck(process.execPath, resources).run();
    });

    test("reports an application whose terminal module cannot load or answer", async t => {
      const broken = await mkdtemp(path.join(tmpdir(), "teamrun-broken-pty-"));
      t.after(() => rm(broken, { recursive: true, force: true }));
      await writeFile(path.join(broken, "package.json"), JSON.stringify({ name: "node-pty", main: "index.js" }));
      await writeFile(path.join(broken, "index.js"), "throw new Error('no native terminal files');\n");
      const resources = await InstalledTerminalCheckTests.resources(t, broken);

      await assert.rejects(new InstalledTerminalCheck(process.execPath, resources).run(),
        (error: unknown) => error instanceof PackageException && error.message.includes("could not run a command in a terminal (exit 1")
          && error.message.includes("no native terminal files"));
    });

    test("reports an application that cannot start", async () => {
      await assert.rejects(new InstalledTerminalCheck(path.join(tmpdir(), "teamrun-missing-application"), tmpdir()).run(),
        (error: unknown) => error instanceof PackageException && error.message.includes("teamrun-missing-application could not run a command"));
    });
  }

  private static async resources(t: { after(callback: () => Promise<void>): void }, nodePty: string): Promise<string> {
    const resources = await mkdtemp(path.join(tmpdir(), "teamrun-installed-"));
    t.after(() => rm(resources, { recursive: true, force: true }));
    await mkdir(path.join(resources, "app.asar", "node_modules"), { recursive: true });
    await symlink(nodePty, path.join(resources, "app.asar", "node_modules", "node-pty"), "junction");
    return resources;
  }
}

InstalledTerminalCheckTests.register();
