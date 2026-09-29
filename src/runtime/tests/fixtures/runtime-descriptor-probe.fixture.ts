/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdirSync, readlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export class RuntimeDescriptorProbe {
  public static get entryPath(): string {
    return fileURLToPath(import.meta.url);
  }

  public static run(): void {
    const inheritedDescriptors: number[] = [];
    for (const descriptor of readdirSync("/proc/self/fd")) {
      try {
        if (readlinkSync(`/proc/self/fd/${descriptor}`) === process.argv[2])
          inheritedDescriptors.push(Number(descriptor));
      }
      catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT")
          throw error;
      }
    }
    process.stdout.write(JSON.stringify({ arguments: process.argv.slice(2), inheritedDescriptors }) + "\n");
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === RuntimeDescriptorProbe.entryPath)
  RuntimeDescriptorProbe.run();
