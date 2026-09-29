/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import * as api from "@noldova/teamrun-runtime";

@TestClass
export class RuntimeApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const expected = [
      "ClientSession", "ConnectionException", "Endpoint", "EndpointKind", "IdleMonitor", "InvalidOperationException", "LaunchException", "LineBuffer",
      "LockFile", "PendingCall", "ProcessInspector", "ProcessProbe", "ProcessRegistry", "ProviderRegistryFactory", "Resources",
      "RuntimeAlreadyRunningException", "RuntimeBuildMismatchException", "RuntimeClient", "RuntimeEntry", "RuntimeLaunchCommand", "RuntimeLauncher",
      "RuntimeLock", "RuntimeServer", "RuntimeService", "RuntimeSettings", "RuntimeTimings", "TokenGenerator", "TrackedProcess"
    ];

    expected.push("InstallationRole", "InstallationUpdatePhase", "InstallationMember", "InstallationUpdate", "InstallationRegistry");
    expected.push("RegistryScope", "RegistryVariable", "Shell", "ShellEnvironment", "TerminalSettings", "HostedTerminal", "PseudoTerminal", "ShellLocator",
      "TerminalEmulator", "TerminalEnvironment", "TerminalHistory", "TerminalHost", "TerminalLineReader", "WindowsEnvironmentReader");
    Assert.areEqual([...expected].sort().join(","), Object.keys(api).sort().join(","));
  }
}
