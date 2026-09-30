/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { deepStrictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Assert, Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class RestartProcessesTests {
  private static readonly CHILD: string = fileURLToPath(new URL("../fixtures/reopen-child.fixture.js", import.meta.url));
  private static readonly PROBE: string = fileURLToPath(new URL("../fixtures/descriptor-probe.fixture.js", import.meta.url));

  @TestMethod
  public async reopensADesktopWithoutTheDesktopsOpenDescriptors(): Promise<void> {
    using directory = new TemporaryDirectory();
    const data = directory.resolve("data with spaces");
    mkdirSync(data);
    const executable = directory.resolve("TeamRun with spaces");
    writeFileSync(executable, `#!/bin/sh\nexec '${process.execPath}' '${RestartProcessesTests.PROBE}'\n`, { mode: 0o755 });
    const environment: NodeJS.ProcessEnv = { ...process.env };
    delete environment["NODE_V8_COVERAGE"];
    const descriptor = openSync(directory.resolve("data with spaces", "inherited"), "w");
    const stdio: ("ignore" | "pipe" | number)[] = Array.from({ length: 4097 }, () => "ignore");
    stdio[2] = "pipe";
    stdio[3] = descriptor;
    stdio[4096] = descriptor;
    try {
      const result = spawnSync(process.execPath, [RestartProcessesTests.CHILD, executable, data],
        { encoding: "utf8", timeout: 10_000, stdio, env: environment });
      Assert.areEqual(0, result.status, result.error?.message ?? result.stderr);
    }
    finally {
      closeSync(descriptor);
    }

    const report = directory.resolve("data with spaces", "report.json");
    await Wait.until(() => existsSync(report));
    deepStrictEqual(JSON.parse(readFileSync(report, "utf8")), { inheritedDescriptors: [] });
  }
}

if (process.platform !== "linux")
  Skip("Descriptor cleanup uses Linux /proc and Bash.")(RestartProcessesTests.prototype.reopensADesktopWithoutTheDesktopsOpenDescriptors);
