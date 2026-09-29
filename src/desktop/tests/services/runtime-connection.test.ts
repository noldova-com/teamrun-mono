/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RuntimeConnection } from "@noldova/teamrun-desktop";
import { Event, EventName, MethodName, Request } from "@noldova/teamrun-protocol";
import { ConnectionException } from "@noldova/teamrun-runtime";

import { DesktopTestHost } from "../fixtures/desktop-test-host.fixture.js";
import { RecordingForwarder } from "../fixtures/recording-forwarder.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class RuntimeConnectionTests {
  @TestMethod
  public attachesOnFirstCallAndSharesTheAttachment(): Promise<void> {
    return this.run(async host => {
      await host.startRuntime();
      const forwarder = new RecordingForwarder();
      const connection = new RuntimeConnection(host, forwarder, "desktop-test");
      Assert.isFalse(connection.isConnected);

      const [providers, status] = await Promise.all([
        connection.call(new Request("1", MethodName.ProviderList, null)),
        connection.call(new Request("2", MethodName.ProjectList, null))
      ]);

      Assert.isTrue(connection.isConnected);
      Assert.areEqual(1, host.attachCount);
      Assert.isFalse(providers.hasErrors);
      Assert.isFalse(status.hasErrors);
      await connection.call(new Request("3", MethodName.ProjectList, null));
      Assert.areEqual(1, host.attachCount);
      connection.close();
      Assert.isFalse(connection.isConnected);
      connection.close();
    });
  }

  @TestMethod
  public checksTheBuildWithoutAttaching(): Promise<void> {
    return this.run(async host => {
      const connection = new RuntimeConnection(host, new RecordingForwarder(), "desktop-test");

      connection.assertSameBuild();
      host.buildMismatch = new Error("another build");
      const refused = Assert.throws(() => connection.assertSameBuild(), Error);

      Assert.areEqual("another build", refused.message);
      Assert.areEqual(2, host.buildCheckCount);
      Assert.areEqual(0, host.attachCount);
      Assert.isFalse(connection.isConnected);
    });
  }

  @TestMethod
  public forwardsEventsAndReattachesAfterADisconnection(): Promise<void> {
    return this.run(async host => {
      await host.startRuntime();
      const forwarder = new RecordingForwarder();
      const connection = new RuntimeConnection(host, forwarder, "desktop-test");
      const opened = await connection.call(new Request("1", MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") }));
      Assert.isFalse(opened.hasErrors);
      connection.onEvent(new Event(EventName.MessageCreated, { id: "m1" }));
      Assert.areEqual(EventName.MessageCreated, forwarder.names.at(-1));
      Assert.isFalse(forwarder.names.includes(EventName.StateResyncRequested));

      await host.stopRuntime();
      await Wait.until(() => !connection.isConnected);
      await host.startRuntime();
      const listed = await connection.call(new Request("2", MethodName.ProjectList, null));

      Assert.isFalse(listed.hasErrors);
      Assert.areEqual(2, host.attachCount);
      Assert.isTrue(forwarder.names.includes(EventName.StateInvalidated));
      Assert.areEqual(1, forwarder.names.filter(t => t === EventName.StateResyncRequested).length);
      connection.close();
      await Assert.throwsAsync(() => connection.call(new Request("3", MethodName.ProjectList, null)), ConnectionException);
    });
  }

  @TestMethod
  public surfacesAttachFailuresAndRetriesLater(): Promise<void> {
    return this.run(async host => {
      const connection = new RuntimeConnection(host, new RecordingForwarder(), "desktop-test");
      host.failNextAttach = new ConnectionException("refused", null);

      await Assert.throwsAsync(() => connection.call(new Request("1", MethodName.ProjectList, null)), ConnectionException);
      Assert.isFalse(connection.isConnected);
      await host.startRuntime();
      const listed = await connection.call(new Request("2", MethodName.ProjectList, null));

      Assert.isFalse(listed.hasErrors);
      Assert.areEqual(2, host.attachCount);
      connection.close();
    });
  }

  @TestMethod
  public rejectsABlankClientName(): void {
    const host = new DesktopTestHost();
    try {
      Assert.areEqual("clientName", Assert.throws(() => new RuntimeConnection(host, new RecordingForwarder(), " "), ArgumentException).parameterName);
    }
    finally {
      host.directory[Symbol.dispose]();
    }
  }

  private async run(body: (host: DesktopTestHost) => Promise<void>): Promise<void> {
    await using host = new DesktopTestHost();
    await body(host);
  }
}
