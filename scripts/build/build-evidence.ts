/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import Config from "../config.ts";
import type PackageInfo from "./package-info.ts";

export default class BuildEvidence {
  private static readonly DIRECTORY: string = "_build/evidence";
  private static readonly ALGORITHM: string = "sha256";
  private static readonly ENCODING: BufferEncoding = "utf8";
  private static readonly ROOT_INPUTS: readonly string[] = [
    "tsconfig.base.json",
    "package-lock.json",
    "scripts/build.ts",
    "scripts/build/build-evidence.ts",
    "scripts/config.ts",
    "scripts/script.ts",
    "scripts/build/package-info.ts"
  ];

  public static async record(packageInfo: PackageInfo): Promise<void> {
    await mkdir(BuildEvidence.DIRECTORY, { recursive: true });
    await writeFile(BuildEvidence.file(packageInfo), await BuildEvidence.fingerprint(packageInfo));
  }

  public static async requireCurrent(): Promise<void> {
    for (const packageInfo of Config.PACKAGES) {
      let current = false;
      try {
        current = await readFile(BuildEvidence.file(packageInfo), BuildEvidence.ENCODING) === await BuildEvidence.fingerprint(packageInfo);
      }
      catch {
      }
      if (!current)
        throw new Error(`The installed artifact of ${packageInfo.packageName} is missing or stale. Run "npm run build" before testing or packaging.`);
    }
  }

  public static async fingerprintInputs(packageInfo: PackageInfo): Promise<string> {
    const inputs = createHash(BuildEvidence.ALGORITHM).update(Config.VERSION).update(Config.PROTOCOL_VERSION).update(Config.WINDOWS_PUBLISHER);

    for (const file of [...BuildEvidence.ROOT_INPUTS, path.join(packageInfo.directory, Config.PACKAGE_MANIFEST_FILE_NAME)])
      inputs.update(await readFile(file));
    inputs.update(await BuildEvidence.tree(path.join(packageInfo.directory, Config.SOURCE_DIRECTORY_NAME)));

    for (const predecessor of Config.PACKAGES) {
      if (predecessor.name === packageInfo.name)
        break;
      inputs.update(await readFile(path.join(Config.PACKAGES_FOLDER, predecessor.formatTarballFileName(Config.VERSION))));
    }

    return inputs.digest("hex");
  }

  private static file(packageInfo: PackageInfo): string {
    return path.join(BuildEvidence.DIRECTORY, `${packageInfo.name}.sha256`);
  }

  private static async fingerprint(packageInfo: PackageInfo): Promise<string> {
    const tarball = createHash(BuildEvidence.ALGORITHM).update(await readFile(path.join(Config.PACKAGES_FOLDER, packageInfo.formatTarballFileName(Config.VERSION))));
    return `${await BuildEvidence.fingerprintInputs(packageInfo)}\n${tarball.digest("hex")}\n${await BuildEvidence.tree(path.join(Config.NODE_MODULES_FOLDER, packageInfo.packageName))}\n`;
  }

  private static async tree(directory: string): Promise<string> {
    const hash = createHash(BuildEvidence.ALGORITHM);
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      hash.update(entry.name).update("\0");
      hash.update(entry.isDirectory() ? await BuildEvidence.tree(file) : await readFile(file));
    }
    
    return hash.digest("hex");
  }
}
