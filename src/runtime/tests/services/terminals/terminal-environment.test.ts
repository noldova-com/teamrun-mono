/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ErrorCode } from "@noldova/teamrun-protocol";
import { CommandRunner, ProcessCommand, ProcessTerminator } from "@noldova/teamrun-providers";
import { TerminalEnvironment, WindowsEnvironmentReader } from "@noldova/teamrun-runtime";

@TestClass
export class TerminalEnvironmentTests {
  private static readonly FIXTURE: string = fileURLToPath(new URL("../../fixtures/registry-output.fixture.js", import.meta.url));

  @TestMethod
  public async keepsTheSessionWithoutTheLaunchVariables(): Promise<void> {
    const base = {
      HOME: "/home/person", SSH_AUTH_SOCK: "/tmp/agent", ELECTRON_RUN_AS_NODE: "1", APPIMAGE: "/opt/TeamRun.AppImage", APPDIR: "/tmp/mount",
      ARGV0: "TeamRun", OWD: "/home/person", XDG_CURRENT_DESKTOP: "Unity", ORIGINAL_XDG_CURRENT_DESKTOP: "GNOME", UNSET: undefined
    };

    const environment = await TerminalEnvironment.forPlatform("linux", base, "en-US").create();

    Assert.areEqual(JSON.stringify({ HOME: "/home/person", SSH_AUTH_SOCK: "/tmp/agent", XDG_CURRENT_DESKTOP: "GNOME", COLORTERM: "truecolor", TERM: "xterm-256color" }),
      JSON.stringify(environment.toRecord()));
  }

  @TestMethod
  public async setsTheLocaleOnMacWhenNoneIsSet(): Promise<void> {
    const language = await TerminalEnvironment.forPlatform("darwin", {}, "fr-CA").create();
    const regionless = await TerminalEnvironment.forPlatform("darwin", {}, "zxx").create();
    const chosen = await TerminalEnvironment.forPlatform("darwin", { LC_ALL: "de_DE.UTF-8" }, "fr-CA").create();
    const linux = await TerminalEnvironment.forPlatform("linux", {}, "fr-CA").create();

    Assert.areEqual("fr_CA.UTF-8", language.get("LANG"));
    Assert.isUndefined(regionless.get("LANG"));
    Assert.areEqual("UTF-8", regionless.get("LC_CTYPE"));
    Assert.isUndefined(chosen.get("LANG"));
    Assert.isUndefined(linux.get("LANG"));
  }

  @TestMethod
  public async addsTheRegistryVariablesOnWindows(): Promise<void> {
    const reader = TerminalEnvironmentTests.reader([
      TerminalEnvironmentTests.line("System", "ExpandString", "Path", "%SystemRoot%\\system32;%JAVA_HOME%\\bin;"),
      TerminalEnvironmentTests.line("System", "String", "JAVA_HOME", "C:\\Java"),
      TerminalEnvironmentTests.line("User", "ExpandString", "Path", "%USERPROFILE%\\bin;%NOT_SET%"),
      TerminalEnvironmentTests.line("User", "String", "TOOL", "installed"),
      TerminalEnvironmentTests.line("System", "String", "USERNAME", "SYSTEM"),
      TerminalEnvironmentTests.line("Session", "String", "USERNAME", "Person"),
      "End"
    ]);
    const base = { PATH: "C:\\stale", SystemRoot: "C:\\Windows", USERPROFILE: "C:\\Users\\Person", ELECTRON_RUN_AS_NODE: "1" };

    const environment = await new TerminalEnvironment("win32", base, reader, "en-US").create();

    Assert.areEqual("C:\\Windows\\system32;C:\\Java\\bin;C:\\Users\\Person\\bin;%NOT_SET%", environment.get("PATH"));
    Assert.isTrue(Object.hasOwn(environment.toRecord(), "Path"));
    Assert.areEqual("installed", environment.get("tool"));
    Assert.areEqual("Person", environment.get("USERNAME"));
    Assert.areEqual("truecolor", environment.get("COLORTERM"));
    Assert.isUndefined(environment.get("TERM"));
    Assert.isUndefined(environment.get("ELECTRON_RUN_AS_NODE"));
  }

  @TestMethod
  public async keepsTheInheritedPathWhenTheRegistryHasNone(): Promise<void> {
    const reader = TerminalEnvironmentTests.reader([TerminalEnvironmentTests.line("User", "String", "TOOL", "installed"), "End"]);

    const environment = await new TerminalEnvironment("win32", { Path: "C:\\inherited" }, reader, "en-US").create();

    Assert.areEqual("C:\\inherited", environment.get("PATH"));
  }

  @TestMethod
  public async reportsARegistryThatCannotBeRead(): Promise<void> {
    const reader = TerminalEnvironmentTests.reader(["--exit", "1"]);

    const exception = await Assert.throwsAsync(() => new TerminalEnvironment("win32", {}, reader, "en-US").create(), ServiceException);

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
  }

  @TestMethod
  public requiresTheWindowsFolderOnWindows(): void {
    const exception = Assert.throws(() => TerminalEnvironment.forPlatform("win32", {}, "en-US"), ServiceException);

    Assert.areEqual(ErrorCode.Unavailable, exception.info.name);
    Assert.isDefined(TerminalEnvironment.forPlatform("win32", { SystemRoot: "C:\\Windows" }, "en-US"));
  }

  private static reader(lines: readonly string[]): WindowsEnvironmentReader {
    const command = new ProcessCommand(process.execPath, [TerminalEnvironmentTests.FIXTURE, ...lines]);
    return new WindowsEnvironmentReader(command, new CommandRunner(new ProcessTerminator(process.platform)), 10_000);
  }

  private static line(scope: string, kind: string, name: string, value: string): string {
    return [scope, kind, Buffer.from(name, "utf8").toString("base64"), Buffer.from(value, "utf8").toString("base64")].join(" ");
  }
}
