/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { access, chmod, cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import configuration from "../../../electron-builder.json" with { type: "json" };
import NativeTerminalFiles from "../../packaging/native-terminal-files.ts";
import PackageException from "../../packaging/package.exception.ts";

class NativeTerminalFilesTests {
  private static readonly PREBUILDS: Readonly<Record<string, readonly string[]>> = {
    "win32-x64": ["conpty.node", "conpty_console_list.node", "conpty/conpty.dll", "conpty/OpenConsole.exe"],
    "win32-arm64": ["conpty.node", "conpty_console_list.node", "conpty/conpty.dll", "conpty/OpenConsole.exe"],
    "darwin-arm64": ["pty.node", "spawn-helper"],
    "darwin-x64": ["pty.node", "spawn-helper"],
    "linux-x64": ["pty.node"],
    "linux-arm64": ["pty.node"]
  };

  public static register(): void {
    test("packaging unpacks node-pty and signs its libraries and native modules on Windows", () => {
      assert.deepEqual(configuration.asarUnpack, ["node_modules/node-pty/**"]);
      assert.deepEqual(configuration.win.signExts, [".dll", ".node"]);
    });

    const targets: readonly (readonly [NodeJS.Platform, string])[] = [["win32", "x64"], ["win32", "arm64"], ["linux", "x64"],
      ...(process.platform === "win32" ? [] : [["darwin", "arm64"] as const])];
    for (const [platform, architecture] of targets)
      test(`staging keeps only the ${platform}-${architecture} native terminal files, which the package check then finds`, async t => {
        const root = await mkdtemp(path.join(tmpdir(), "teamrun-native-terminal-"));
        t.after(() => rm(root, { recursive: true, force: true }));
        const application = path.join(root, "app");
        const target = `${platform}-${architecture}`;
        await NativeTerminalFilesTests.writeNodePty(path.join(application, "node_modules", "node-pty"));
        const files = new NativeTerminalFiles(platform, architecture);

        await files.prune(application);

        assert.deepEqual(await readdir(path.join(application, "node_modules", "node-pty", "prebuilds")), [target]);
        await assert.rejects(access(path.join(application, "node_modules", "node-pty", "third_party")));
        const resources = path.join(root, "resources");
        await cp(application, path.join(resources, "app.asar.unpacked"), { recursive: true });
        const prebuilds = path.join(resources, "app.asar.unpacked", "node_modules", "node-pty", "prebuilds");
        const verified = await files.verify(resources);
        assert.deepEqual(verified.map(t => path.relative(prebuilds, t).replaceAll("\\", "/")),
          (NativeTerminalFilesTests.PREBUILDS[target] ?? []).map(t => `${target}/${t}`));
      });

    test("the package check refuses missing, foreign, leftover and non-executable native terminal files", async t => {
      const root = await mkdtemp(path.join(tmpdir(), "teamrun-native-terminal-"));
      t.after(() => rm(root, { recursive: true, force: true }));
      const resources = path.join(root, "resources");
      const nodePty = path.join(resources, "app.asar.unpacked", "node_modules", "node-pty");
      const prebuilds = path.join(nodePty, "prebuilds");
      const mac = new NativeTerminalFiles("darwin", "arm64");

      await assert.rejects(mac.verify(resources), (error: unknown) => error instanceof PackageException && error.message.includes("it holds []"));
      await NativeTerminalFilesTests.writeNodePty(nodePty);
      await assert.rejects(mac.verify(resources), /for darwin-arm64 only, outside the archive; it holds \[darwin-arm64, darwin-x64/);
      for (const other of ["darwin-x64", "linux-arm64", "linux-x64", "win32-arm64", "win32-x64"])
        await rm(path.join(prebuilds, other), { recursive: true });
      await assert.rejects(mac.verify(resources), /still holds node-pty's third_party folder/);
      await rm(path.join(nodePty, "third_party"), { recursive: true });
      await chmod(path.join(prebuilds, "darwin-arm64", "spawn-helper"), 0o644);
      await assert.rejects(mac.verify(resources), /spawn-helper is not executable/);
      await rm(path.join(prebuilds, "darwin-arm64", "pty.node"));
      await assert.rejects(mac.verify(resources), /lacks the native terminal file .*pty\.node/);
      await mkdir(path.join(prebuilds, "darwin-arm64", "pty.node"));
      await assert.rejects(mac.verify(resources), /lacks the native terminal file .*pty\.node/);
    });
  }

  private static async writeNodePty(directory: string): Promise<void> {
    for (const [target, files] of Object.entries(NativeTerminalFilesTests.PREBUILDS))
      for (const file of files) {
        const location = path.join(directory, "prebuilds", target, ...file.split("/"));
        await mkdir(path.dirname(location), { recursive: true });
        await writeFile(location, "native");
        if (file === "spawn-helper")
          await chmod(location, 0o755);
      }
    await mkdir(path.join(directory, "third_party", "conpty", "1.25", "win10-x64"), { recursive: true });
    await writeFile(path.join(directory, "third_party", "conpty", "1.25", "win10-x64", "conpty.dll"), "native");
    await writeFile(path.join(directory, "package.json"), "{}");
  }
}

NativeTerminalFilesTests.register();
