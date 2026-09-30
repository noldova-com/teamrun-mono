/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode } from "@noldova/teamrun-protocol";
import { CommandRunner, ProcessCommand, ProcessTerminator } from "@noldova/teamrun-providers";
import { ShellEnvironment, type VisualStudioInstallation, VisualStudioReader } from "@noldova/teamrun-runtime";

@TestClass
export class VisualStudioReaderTests {
  private static readonly FIXTURE: string = fileURLToPath(new URL("../../fixtures/registry-output.fixture.js", import.meta.url));
  private static readonly runner: CommandRunner = new CommandRunner(new ProcessTerminator(process.platform));

  @TestMethod
  public async readsTheInstallationsVswhereReports(): Promise<void> {
    const installations = await VisualStudioReaderTests.read(JSON.stringify([
      { instanceId: "e7143cad", displayName: "Visual Studio Professional 2026", installationPath: "C:\\Program Files\\Microsoft Visual Studio\\18\\Professional",
        installationVersion: "18.10" },
      { instanceId: "1b2c", displayName: "Visual Studio Build Tools 2022 — Café", installationPath: "D:\\Tools" }
    ]));

    Assert.areEqual(2, installations.length);
    Assert.areEqual("e7143cad", installations[0]?.instanceId);
    Assert.areEqual("Visual Studio Professional 2026", installations[0]?.name);
    Assert.areEqual("C:\\Program Files\\Microsoft Visual Studio\\18\\Professional", installations[0]?.path);
    Assert.areEqual("Visual Studio Build Tools 2022 — Café", installations[1]?.name);
  }

  @TestMethod
  public async readsNothingWithoutVswhere(): Promise<void> {
    const missing = new VisualStudioReader(new ProcessCommand("C:\\teamrun-missing\\vswhere.exe", []), VisualStudioReaderTests.runner, 5000);
    const none = new VisualStudioReader(null, VisualStudioReaderTests.runner, 5000);
    const withoutFolder = VisualStudioReader.forEnvironment(new ShellEnvironment(true), VisualStudioReaderTests.runner);
    const withoutInstaller = new ShellEnvironment(true);
    withoutInstaller.set("ProgramFiles(x86)", tmpdir());

    Assert.areEqual(0, (await missing.read(process.env)).length);
    Assert.areEqual(0, (await none.read(process.env)).length);
    Assert.areEqual(0, (await withoutFolder.read(process.env)).length);
    Assert.areEqual(0, (await VisualStudioReader.forEnvironment(withoutInstaller, VisualStudioReaderTests.runner).read(process.env)).length);
  }

  @TestMethod
  public async refusesOutputItCannotRead(): Promise<void> {
    const valid = { instanceId: "a", displayName: "b", installationPath: "c" };
    const outputs = ["not json", "{}", "[1]", "[[]]", JSON.stringify([{ ...valid, instanceId: 3 }]), JSON.stringify([{ ...valid, displayName: " " }]),
      JSON.stringify([{ instanceId: "a", displayName: "b" }]), JSON.stringify([{ displayName: "b", installationPath: "c" }]),
      JSON.stringify([{ instanceId: "a", installationPath: "c" }])];

    for (const output of outputs) {
      const exception = await Assert.throwsAsync(() => VisualStudioReaderTests.read(output), ServiceException);
      Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
      Assert.areEqual("TeamRun could not list the Visual Studio installations. vswhere returned output TeamRun could not read.", exception.message);
    }
  }

  @TestMethod
  public async reportsAFailedCommand(): Promise<void> {
    const exited = await Assert.throwsAsync(() => VisualStudioReaderTests.run(["--exit", "4"], 10_000), ServiceException);
    const hung = await Assert.throwsAsync(() => VisualStudioReaderTests.run(["--hang"], 200), ServiceException);
    const unstartable = new VisualStudioReader(new ProcessCommand(tmpdir(), []), VisualStudioReaderTests.runner, 5000);

    Assert.isTrue(exited.message.endsWith("vswhere ended with exit code 4."));
    Assert.isTrue(hung.message.endsWith("vswhere did not answer in time."));
    const unstarted = await Assert.throwsAsync(() => unstartable.read(process.env), ServiceException);
    Assert.areEqual("TeamRun could not list the Visual Studio installations. vswhere could not start.", unstarted.message);
    Assert.isDefined(unstarted.cause);
  }

  @TestMethod
  public async readsTheInstallationsOfThisComputer(): Promise<void> {
    const environment = new ShellEnvironment(true);
    for (const [name, value] of Object.entries(process.env))
      if (value !== undefined)
        environment.set(name, value);

    const installations = await VisualStudioReader.forEnvironment(environment, VisualStudioReaderTests.runner).read(process.env);

    Assert.isTrue(installations.every(t => t.path.length > 0 && t.instanceId.length > 0));
  }

  private static read(output: string): Promise<readonly VisualStudioInstallation[]> {
    return VisualStudioReaderTests.run([output], 10_000);
  }

  private static run(args: readonly string[], timeoutMilliseconds: number): Promise<readonly VisualStudioInstallation[]> {
    const command = new ProcessCommand(process.execPath, [VisualStudioReaderTests.FIXTURE, ...args]);
    return new VisualStudioReader(command, VisualStudioReaderTests.runner, timeoutMilliseconds).read(process.env);
  }
}

if (process.platform !== "win32")
  Skip("Visual Studio and vswhere exist only on Windows.")(VisualStudioReaderTests.prototype.readsTheInstallationsOfThisComputer);
