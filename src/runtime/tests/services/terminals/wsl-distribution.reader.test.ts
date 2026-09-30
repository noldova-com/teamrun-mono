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
import { WslDistributionReader } from "@noldova/teamrun-runtime";

@TestClass
export class WslDistributionReaderTests {
  private static readonly FIXTURE: string = fileURLToPath(new URL("../../fixtures/registry-output.fixture.js", import.meta.url));

  @TestMethod
  public async readsTheDistributionsWithTheDefaultFirst(): Promise<void> {
    const distributions = await WslDistributionReaderTests.read([
      WslDistributionReaderTests.line("docker-desktop", false),
      WslDistributionReaderTests.line("Ubuntu", true),
      WslDistributionReaderTests.line("Débian 日本", false),
      "End"
    ]);

    Assert.areEqual("Ubuntu|docker-desktop|Débian 日本", distributions.join("|"));
  }

  @TestMethod
  public async readsNoDistributionsWithoutWsl(): Promise<void> {
    Assert.areEqual(0, (await WslDistributionReaderTests.read(["End"])).length);
  }

  @TestMethod
  public async refusesOutputItCannotRead(): Promise<void> {
    const valid = WslDistributionReaderTests.line("Ubuntu", true);
    const outputs = [[valid], [`${valid} extra`, "End"], [valid.replace(" 1", " 2"), "End"], ["VWJ1bnR1", "End"], [" 1", "End"], ["VWJ1bnR! 0", "End"]];

    for (const output of outputs) {
      const exception = await Assert.throwsAsync(() => WslDistributionReaderTests.read(output), ServiceException);
      Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
      Assert.areEqual("TeamRun could not read the WSL distributions from Windows. Windows PowerShell returned output TeamRun could not read.", exception.message);
    }
  }

  @TestMethod
  public async reportsAFailedCommand(): Promise<void> {
    const exited = await Assert.throwsAsync(() => WslDistributionReaderTests.read(["--exit", "3"]), ServiceException);
    const hung = await Assert.throwsAsync(() => WslDistributionReaderTests.read(["--hang"], 200), ServiceException);
    const missing = new WslDistributionReader(new ProcessCommand("teamrun-no-such-powershell", []), new CommandRunner(new ProcessTerminator(process.platform)), 5000);
    const unstarted = await Assert.throwsAsync(() => missing.read(process.env), ServiceException);
    const withoutWindows = WslDistributionReader.forSystemRoot(tmpdir(), new CommandRunner(new ProcessTerminator(process.platform)));

    Assert.isTrue(exited.message.endsWith("Windows PowerShell ended with exit code 3."));
    Assert.isTrue(hung.message.endsWith("Windows PowerShell did not answer in time."));
    Assert.areEqual(ErrorCode.Unavailable, unstarted.info.name);
    Assert.isTrue(unstarted.message.endsWith("Windows PowerShell could not start."));
    Assert.isDefined(unstarted.cause);
    Assert.isTrue((await Assert.throwsAsync(() => withoutWindows.read(process.env), ServiceException)).message.endsWith("Windows PowerShell could not start."));
  }

  @TestMethod
  public async readsTheDistributionsOfThisComputer(): Promise<void> {
    const reader = WslDistributionReader.forSystemRoot(process.env["SystemRoot"] ?? "C:\\Windows", new CommandRunner(new ProcessTerminator(process.platform)));

    const distributions = await reader.read(process.env);

    Assert.isTrue(distributions.every(t => t.trim().length > 0));
  }

  private static read(lines: readonly string[], timeoutMilliseconds: number = 10_000): Promise<readonly string[]> {
    const command = new ProcessCommand(process.execPath, [WslDistributionReaderTests.FIXTURE, ...lines]);
    return new WslDistributionReader(command, new CommandRunner(new ProcessTerminator(process.platform)), timeoutMilliseconds).read(process.env);
  }

  private static line(name: string, isDefault: boolean): string {
    return `${Buffer.from(name, "utf8").toString("base64")} ${isDefault ? "1" : "0"}`;
  }
}

if (process.platform !== "win32")
  Skip("The Windows registry exists only on Windows.")(WslDistributionReaderTests.prototype.readsTheDistributionsOfThisComputer);
