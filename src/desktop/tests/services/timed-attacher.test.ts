/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TimedAttacher } from "@noldova/teamrun-desktop";

import { DesktopTestHost } from "../fixtures/desktop-test-host.fixture.js";

@TestClass
export class TimedAttacherTests {
  @TestMethod
  public async reportsOnlyFailedAttachments(): Promise<void> {
    await using host = new DesktopTestHost();
    await host.startRuntime();
    const lines: string[] = [];
    const attacher = new TimedAttacher(host, line => lines.push(line));
    const listener = { onEvent: (): void => undefined, onDisconnected: (): void => undefined };

    const first = await attacher.attach("first", listener);
    const second = await attacher.attach("second", listener);
    Assert.areEqual(0, lines.length);
    host.failNextAttach = new Error("no runtime");
    await Assert.throwsAsync(() => attacher.attach("third", listener), Error);
    first.close();
    second.close();
    await host.stopRuntime();

    Assert.areEqual(1, lines.length);
    Assert.isTrue(/^TeamRun runtime not reached after \d+ ms: Error: no runtime$/.test(lines[0] ?? ""), lines[0]);
  }

  @TestMethod
  public async checksTheBuildThroughItsAttacherWithoutReporting(): Promise<void> {
    await using host = new DesktopTestHost();
    const lines: string[] = [];
    const attacher = new TimedAttacher(host, line => lines.push(line));

    attacher.assertSameBuild();
    host.buildMismatch = new Error("another build");
    const refused = Assert.throws(() => attacher.assertSameBuild(), Error);

    Assert.areEqual("another build", refused.message);
    Assert.areEqual(2, host.buildCheckCount);
    Assert.areEqual(0, host.attachCount);
    Assert.areEqual(0, lines.length);
  }
}
