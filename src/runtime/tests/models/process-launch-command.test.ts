/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { deepStrictEqual } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, { closeSync, existsSync, openSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessCommand } from "@noldova/teamrun-providers";
import { ProcessLaunchCommand, ProcessLaunchException } from "@noldova/teamrun-runtime";

import { RuntimeDescriptorProbe } from "../fixtures/runtime-descriptor-probe.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class ProcessLaunchCommandTests {
  @TestMethod
  public preservesDirectCommandsOnWindowsAndMac(): void {
    for (const platform of ["win32", "darwin"]) {
      const args = ["entry with spaces.js", "--data-dir", "quoted ' \" $value"];
      const command = new ProcessLaunchCommand(platform, "executable with spaces", args);
      args.push("later mutation");

      Assert.areEqual("executable with spaces", command.executable);
      deepStrictEqual(command.arguments, ["entry with spaces.js", "--data-dir", "quoted ' \" $value"]);
    }
  }

  @TestMethod
  public validatesLinuxPrerequisitesAndPreservesLiteralArguments(): void {
    const originalAccess = fs.accessSync;
    const originalRead = fs.readdirSync;
    const failure = new Error("Fixture filesystem failure");
    let failedOperation = "";
    const checked: string[] = [];
    fs.accessSync = (path, mode) => {
      checked.push(String(path));
      Assert.areEqual(path === "/bin/bash" ? fs.constants.X_OK : fs.constants.R_OK | fs.constants.X_OK, mode);
      if (path === failedOperation)
        throw failure;
    };
    fs.readdirSync = () => {
      checked.push("enumerate");
      if (failedOperation === "enumerate")
        throw failure;
      return [];
    };
    syncBuiltinESMExports();
    try {
      const args = ["entry with spaces.js", "$(printf not-a-command)", ""];
      const command = new ProcessLaunchCommand("linux", "executable with spaces", args);
      args.push("later mutation");

      deepStrictEqual(checked, ["/bin/bash", "/proc/self/fd", "enumerate"]);
      Assert.areEqual("/bin/bash", command.executable);
      deepStrictEqual(command.arguments.slice(0, 4), ["--noprofile", "--norc", "-p", "-c"]);
      deepStrictEqual(command.arguments.slice(5), ["teamrun-launch", "executable with spaces", "entry with spaces.js", "$(printf not-a-command)", ""]);
      for (failedOperation of ["/bin/bash", "/proc/self/fd", "enumerate"]) {
        const error = Assert.throws(() => new ProcessLaunchCommand("linux", process.execPath, []), ProcessLaunchException);
        const reason = failedOperation === "/bin/bash"
          ? "Starting a program on Linux requires executable Bash at /bin/bash. Install Bash or restore its execute permissions."
          : "Starting a program on Linux requires access to /proc/self/fd. Ensure procfs is mounted at /proc and this process can read and traverse its descriptor directory.";
        Assert.areEqual(reason, error.message);
        Assert.areEqual(failure, error.cause);
      }
    }
    finally {
      fs.accessSync = originalAccess;
      fs.readdirSync = originalRead;
      syncBuiltinESMExports();
    }
  }

  @TestMethod
  public refusesABlankDestinationOnEveryPlatform(): void {
    for (const platform of ["win32", "darwin", "linux"])
      Assert.throws(() => new ProcessLaunchCommand(platform, " ", []), ArgumentException);
  }

  @TestMethod
  public doesNotInterpretTheDestinationAsAnExecOption(): void {
    using directory = new TemporaryDirectory();
    const command = new ProcessLaunchCommand("linux", "-l", []);

    const result = spawnSync(command.executable, command.arguments,
      { encoding: "utf8", timeout: 10_000, env: { ...process.env, PATH: directory.path } });

    Assert.areEqual(127, result.status, result.error?.message ?? result.stderr);
  }

  @TestMethod
  public closesLowAndHighInheritedDescriptorsWithoutInterpretingArgumentsOrStartupFiles(): void {
    using directory = new TemporaryDirectory();
    const sentinel = directory.resolve("inherited file");
    const startup = directory.resolve("unwanted startup");
    const marker = directory.resolve("startup ran");
    const executable = directory.resolve("node with spaces $value");
    writeFileSync(startup, 'printf unsafe > "$TEAMRUN_STARTUP_MARKER"\n');
    symlinkSync(process.execPath, executable);
    const descriptor = openSync(sentinel, "w");
    const args = [RuntimeDescriptorProbe.entryPath, sentinel, "space and ünicode", "'\";$(printf injected)*", ""];
    const stdio: ("ignore" | "pipe" | number)[] = Array.from({ length: 4097 }, () => "ignore");
    stdio[1] = "pipe";
    stdio[2] = "pipe";
    stdio[3] = descriptor;
    stdio[4096] = descriptor;
    try {
      const direct = new ProcessCommand(executable, args);
      const isolated = new ProcessLaunchCommand("linux", executable, args);
      for (const command of [direct, isolated]) {
        const result = spawnSync(command.executable, command.arguments,
          { encoding: "utf8", timeout: 10_000, stdio, env: { ...process.env, BASH_ENV: startup, TEAMRUN_STARTUP_MARKER: marker } });
        Assert.areEqual(0, result.status, result.error?.message ?? result.stderr);
        const report: unknown = JSON.parse(result.stdout);
        deepStrictEqual(report, { arguments: args.slice(1), inheritedDescriptors: command === direct ? [3, 4096] : [] });
      }
      Assert.isFalse(existsSync(marker));
    }
    finally {
      closeSync(descriptor);
    }
  }
}

if (process.platform !== "linux") {
  Skip("Descriptor cleanup uses Linux /proc and Bash.")(ProcessLaunchCommandTests.prototype.doesNotInterpretTheDestinationAsAnExecOption);
  Skip("Descriptor cleanup uses Linux /proc and Bash.")(ProcessLaunchCommandTests.prototype.closesLowAndHighInheritedDescriptorsWithoutInterpretingArgumentsOrStartupFiles);
}
