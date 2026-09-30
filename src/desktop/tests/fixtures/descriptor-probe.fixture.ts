/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdirSync, readlinkSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

class DescriptorProbe {
  public static run(directory: string): void {
    const sentinel = join(directory, "inherited");
    const inheritedDescriptors: number[] = [];
    for (const descriptor of readdirSync("/proc/self/fd")) {
      try {
        if (readlinkSync(`/proc/self/fd/${descriptor}`) === sentinel)
          inheritedDescriptors.push(Number(descriptor));
      }
      catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT")
          throw error;
      }
    }
    writeFileSync(join(directory, "report.tmp"), JSON.stringify({ inheritedDescriptors }));
    renameSync(join(directory, "report.tmp"), join(directory, "report.json"));
  }
}

DescriptorProbe.run(process.env["TEAMRUN_DATA_DIR"] ?? "");
