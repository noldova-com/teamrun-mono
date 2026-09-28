/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode } from "@noldova/teamrun-protocol";
import { CommandRunner, ProcessCommand, ProcessTerminator } from "@noldova/teamrun-providers";
import { RegistryScope, type RegistryVariable, WindowsEnvironmentReader } from "@noldova/teamrun-runtime";

@TestClass
export class WindowsEnvironmentReaderTests {
  private static readonly FIXTURE: string = fileURLToPath(new URL("../../fixtures/registry-output.fixture.js", import.meta.url));

  @TestMethod
  public async readsTheMachineAndUserVariablesWithoutExpandingThem(): Promise<void> {
    const variables = await WindowsEnvironmentReaderTests.read([
      WindowsEnvironmentReaderTests.line("System", "String", "JAVA_HOME", "C:\\Java"),
      WindowsEnvironmentReaderTests.line("User", "ExpandString", "Path", "%JAVA_HOME%\\bin;C:\\Café\\日本"),
      WindowsEnvironmentReaderTests.line("User", "String", "EMPTY", ""),
      "End"
    ]);

    Assert.areEqual(3, variables.length);
    Assert.areEqual(RegistryScope.System, variables[0]?.scope);
    Assert.areEqual("JAVA_HOME", variables[0]?.name);
    Assert.isFalse(variables[0]?.isExpandable ?? true);
    Assert.areEqual(RegistryScope.User, variables[1]?.scope);
    Assert.areEqual("%JAVA_HOME%\\bin;C:\\Café\\日本", variables[1]?.value);
    Assert.isTrue(variables[1]?.isExpandable ?? false);
    Assert.areEqual("", variables[2]?.value);
  }

  @TestMethod
  public async refusesOutputItCannotRead(): Promise<void> {
    const valid = WindowsEnvironmentReaderTests.line("System", "String", "A", "B");
    const outputs = [
      [valid],
      [`${valid} extra`, "End"],
      [valid.replace("System", "Machine"), "End"],
      [valid.replace("String", "MultiString"), "End"],
      [valid.replace(" QQ==", " Q"), "End"],
      [`${valid.slice(0, valid.lastIndexOf(" "))} QQ=!`, "End"],
      ["System String", "End"]
    ];

    for (const output of outputs) {
      const exception = await Assert.throwsAsync(() => WindowsEnvironmentReaderTests.read(output), ServiceException);
      Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
      Assert.isTrue(exception.message.endsWith("Windows PowerShell returned output TeamRun could not read."));
    }
  }

  @TestMethod
  public async reportsAFailedCommand(): Promise<void> {
    const exited = await Assert.throwsAsync(() => WindowsEnvironmentReaderTests.read(["--exit", "3"]), ServiceException);
    const hung = await Assert.throwsAsync(() => WindowsEnvironmentReaderTests.read(["--hang"], 200), ServiceException);
    const missing = new WindowsEnvironmentReader(new ProcessCommand("teamrun-no-such-powershell", []), new CommandRunner(new ProcessTerminator(process.platform)), 5000);
    const unstarted = await Assert.throwsAsync(() => missing.read(process.env), ServiceException);

    Assert.isTrue(exited.message.endsWith("Windows PowerShell ended with exit code 3."));
    Assert.isTrue(hung.message.endsWith("Windows PowerShell did not answer in time."));
    Assert.areEqual(ErrorCode.Unavailable, unstarted.info.name);
    Assert.isTrue(unstarted.message.endsWith("Windows PowerShell could not start."));
    Assert.isDefined(unstarted.cause);
  }

  @TestMethod
  public async readsTheRegistryOfThisComputer(): Promise<void> {
    const reader = WindowsEnvironmentReader.forSystemRoot(process.env["SystemRoot"] ?? "C:\\Windows", new CommandRunner(new ProcessTerminator(process.platform)));

    const variables = await reader.read(process.env);

    Assert.isTrue(variables.some(t => t.scope === RegistryScope.System && t.name.toUpperCase() === "PATH"));
    Assert.isTrue(variables.some(t => t.scope === RegistryScope.User));
  }

  private static read(lines: readonly string[], timeoutMilliseconds: number = 10_000): Promise<readonly RegistryVariable[]> {
    const command = new ProcessCommand(process.execPath, [WindowsEnvironmentReaderTests.FIXTURE, ...lines]);
    return new WindowsEnvironmentReader(command, new CommandRunner(new ProcessTerminator(process.platform)), timeoutMilliseconds).read(process.env);
  }

  private static line(scope: string, kind: string, name: string, value: string): string {
    return [scope, kind, Buffer.from(name, "utf8").toString("base64"), Buffer.from(value, "utf8").toString("base64")].join(" ");
  }
}

if (process.platform !== "win32")
  Skip("The Windows registry exists only on Windows.")(WindowsEnvironmentReaderTests.prototype.readsTheRegistryOfThisComputer);
