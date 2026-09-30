/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import PackageException from "./package.exception.ts";

export default class NativeTerminalFiles {
  private static readonly PACKAGE_SEGMENTS: readonly string[] = ["node_modules", "node-pty"];
  private static readonly UNPACKED_FOLDER: string = "app.asar.unpacked";
  private static readonly PREBUILDS_FOLDER: string = "prebuilds";
  private static readonly THIRD_PARTY_FOLDER: string = "third_party";
  private static readonly WINDOWS_PLATFORM: NodeJS.Platform = "win32";
  private static readonly MAC_PLATFORM: NodeJS.Platform = "darwin";
  private static readonly WINDOWS_FILES: readonly string[] = ["conpty.node", "conpty_console_list.node", "conpty/conpty.dll", "conpty/OpenConsole.exe"];
  private static readonly UNIX_FILES: readonly string[] = ["pty.node"];
  private static readonly MAC_HELPER: string = "spawn-helper";
  private static readonly EXECUTABLE_BITS: number = 0o111;

  private readonly nodePlatform: NodeJS.Platform;
  private readonly architecture: string;

  public constructor(nodePlatform: NodeJS.Platform, architecture: string) {
    this.nodePlatform = nodePlatform;
    this.architecture = architecture;
  }

  private get target(): string {
    return `${this.nodePlatform}-${this.architecture}`;
  }

  private get requiredFiles(): readonly string[] {
    if (this.nodePlatform === NativeTerminalFiles.WINDOWS_PLATFORM)
      return NativeTerminalFiles.WINDOWS_FILES;
    return this.nodePlatform === NativeTerminalFiles.MAC_PLATFORM ? [...NativeTerminalFiles.UNIX_FILES, NativeTerminalFiles.MAC_HELPER]
      : NativeTerminalFiles.UNIX_FILES;
  }

  public async prune(appDirectory: string): Promise<void> {
    const root = path.join(appDirectory, ...NativeTerminalFiles.PACKAGE_SEGMENTS);
    const prebuilds = path.join(root, NativeTerminalFiles.PREBUILDS_FOLDER);
    for (const entry of await readdir(prebuilds))
      if (entry !== this.target)
        await rm(path.join(prebuilds, entry), { recursive: true, force: true });
    await rm(path.join(root, NativeTerminalFiles.THIRD_PARTY_FOLDER), { recursive: true, force: true });
  }

  public async verify(resourcesDirectory: string): Promise<readonly string[]> {
    const root = path.join(resourcesDirectory, NativeTerminalFiles.UNPACKED_FOLDER, ...NativeTerminalFiles.PACKAGE_SEGMENTS);
    const prebuilds = path.join(root, NativeTerminalFiles.PREBUILDS_FOLDER);
    const entries = await NativeTerminalFiles.list(prebuilds);
    if (entries.length !== 1 || entries[0] !== this.target)
      throw new PackageException(NativeTerminalFiles.formatWrongPrebuilds(this.target, entries));
    if ((await NativeTerminalFiles.list(root)).includes(NativeTerminalFiles.THIRD_PARTY_FOLDER))
      throw new PackageException(NativeTerminalFiles.formatLeftOver(NativeTerminalFiles.THIRD_PARTY_FOLDER));

    const files: string[] = [];
    for (const name of this.requiredFiles) {
      const file = path.join(prebuilds, this.target, ...name.split("/"));
      const info = await stat(file).catch(() => null);
      if (info === null || !info.isFile())
        throw new PackageException(NativeTerminalFiles.formatMissing(file));
      if (name === NativeTerminalFiles.MAC_HELPER && (info.mode & NativeTerminalFiles.EXECUTABLE_BITS) === 0)
        throw new PackageException(NativeTerminalFiles.formatNotExecutable(file));
      files.push(file);
    }
    return files;
  }

  private static async list(directory: string): Promise<readonly string[]> {
    return (await readdir(directory).catch(() => [])).sort();
  }

  private static formatWrongPrebuilds(target: string, entries: readonly string[]): string {
    return `The package must hold node-pty's native files for ${target} only, outside the archive; it holds [${entries.join(", ")}].`;
  }

  private static formatLeftOver(folder: string): string {
    return `The package still holds node-pty's ${folder} folder, which the terminal does not load.`;
  }

  private static formatMissing(file: string): string {
    return `The package lacks the native terminal file ${file}.`;
  }

  private static formatNotExecutable(file: string): string {
    return `The native terminal helper ${file} is not executable.`;
  }
}
