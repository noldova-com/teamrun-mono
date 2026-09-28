/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources } from "@noldova/teamrun-runtime";

@TestClass
export class ResourcesTests {
  @TestMethod
  public formatsMessages(): void {
    Assert.areEqual("The client speaks protocol 2.0, which runtime protocol 0.1 cannot serve.", Resources.formatVersionMismatch("2.0", "0.1"));
    Assert.areEqual("A runtime for this data directory is already running (process 7, endpoint 127.0.0.1:9).", Resources.formatAlreadyRunning(7, "127.0.0.1:9"));
    Assert.areEqual("The runtime did not answer project/list within the timeout.", Resources.formatCallTimedOut("project/list"));
    Assert.areEqual("The runtime could not be started: why", Resources.formatLaunchFailed("why"));
    Assert.areEqual("127.0.0.1:80", Resources.formatTcpEndpoint("127.0.0.1", 80));
    Assert.areEqual("The argument --providers does not accept \"x\".", Resources.formatUnknownArgumentValue("--providers", "x"));
  }

  @TestMethod
  public formatsTerminalMessages(): void {
    Assert.areEqual("TerminalExplode is not a terminal method.", Resources.formatUnknownTerminalMethod("TerminalExplode"));
    Assert.areEqual("TeamRun could not read the environment variables from Windows. Why.", Resources.formatWindowsEnvironmentFailed("Why."));
    Assert.areEqual("Windows PowerShell ended with exit code null.", Resources.formatWindowsEnvironmentExit(null));
    Assert.areEqual("pt_BR.UTF-8", Resources.formatUtf8Locale("pt", "BR"));
  }
}
