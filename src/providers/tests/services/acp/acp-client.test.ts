/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mock } from "node:test";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { AcpClient, type IAcpClientListener, Resources } from "@noldova/teamrun-providers";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { ControlledProcessTerminator } from "../../fixtures/controlled-process-terminator.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class AcpClientTests {
  @TestMethod
  public async boundsShutdownWhenTheProcessCannotBeTerminated(): Promise<void> {
    await using host = new GrokTestHost();
    const terminator = new ControlledProcessTerminator(process.platform);
    terminator.ignores = true;
    const client = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_GROK_STAY_OPEN: "1" }, host.directory.path, terminator, host.timings, host.tracker);
    client.start();
    let watchdog: NodeJS.Timeout | undefined;
    try {
      await client.request("initialize", {});
      // This guard remains on the real clock if the controlled shutdown stops making progress.
      const deadline = new Promise<never>((_resolve, reject) => {
        watchdog = setTimeout(() => reject(new Error("Controlled ACP shutdown did not settle.")), 5000);
      });
      mock.timers.enable({ apis: ["setTimeout"] });
      let settled = false;
      let failure: unknown;
      const stopped = client.stop().then(
        () => { settled = true; },
        error => { settled = true; failure = error; });

      mock.timers.tick(99);
      await Promise.race([new Promise<void>(resolve => setImmediate(resolve)), deadline]);
      Assert.areEqual(0, terminator.calls);
      Assert.isFalse(settled);

      mock.timers.tick(1);
      await Promise.race([new Promise<void>(resolve => setImmediate(resolve)), deadline]);
      Assert.areEqual(1, terminator.calls);
      mock.timers.tick(4999);
      await Promise.race([new Promise<void>(resolve => setImmediate(resolve)), deadline]);
      Assert.isFalse(settled);

      mock.timers.tick(1);
      await Promise.race([stopped, deadline]);
      Assert.isInstanceOf(failure, Error);
      Assert.isTrue(failure.message.includes("shutdown timeout"));
    }
    finally {
      mock.timers.reset();
      clearTimeout(watchdog);
      terminator.ignores = false;
      await client.stop();
    }
    Assert.areEqual(host.tracker.tracked.length, host.tracker.untracked.length);
  }

  @TestMethod
  @TestData("invalid")
  @TestData("oversize")
  public async retainsTheProtocolFailureWhenInitialTerminationFails(mode: string): Promise<void> {
    await using host = new GrokTestHost();
    const terminator = new ControlledProcessTerminator(process.platform);
    terminator.failures = 1;
    const client = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_GROK_STAY_OPEN: "1", TEAMRUN_FAKE_GROK_INIT: mode }, host.directory.path, terminator, host.timings, host.tracker);
    client.start();
    try {
      const failure = await Assert.throwsAsync(() => client.request("initialize", {}), Error);
      Assert.areNotEqual(Resources.formatAcpTimeout("initialize"), failure.message);
      await Wait.until(() => terminator.calls > 0);
    }
    finally { await client.stop(); }
  }

  @TestMethod
  public async failsPendingRequestsWhenTheAgentClosesItsInputPipe(): Promise<void> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_GROK_STAY_OPEN: "1" }, host.directory.path, host.terminator, host.timings, host.tracker);
    client.start();
    try {
      await client.request("fixture/close-input", {});
      await Assert.throwsAsync(() => client.request("initialize", { padding: "x".repeat(1024 * 1024) }), Error);
    }
    finally { await client.stop(); }
  }

  @TestMethod
  public async boundsRequestsAndClosesPendingWork(): Promise<void> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.terminator, host.timings, host.tracker);
    await Assert.throwsAsync(() => client.request("initialize", {}), Error);
    await client.stop();
    const active = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_GROK_STAY_OPEN: "1" }, host.directory.path, host.terminator, host.timings, host.tracker);
    active.start();
    try {
      Assert.throws(() => active.start(), Error);
      await active.request("initialize", {});
      const timeout = await Assert.throwsAsync(() => active.request("fixture/wait", {}, 1), Error);
      Assert.isTrue(timeout.message.includes("in time"));
      const pending = Array.from({ length: Resources.acpMaximumPending }, () => active.request("fixture/wait", {}, null).catch(error => error));
      await Assert.throwsAsync(() => active.request("fixture/wait", {}), Error);
      await active.stop();
      Assert.isTrue((await Promise.all(pending)).every(t => t instanceof Error));
      Assert.areEqual(host.tracker.tracked.length, host.tracker.untracked.length);
      await Assert.throwsAsync(() => active.request("initialize", {}), Error);
    }
    finally { await active.stop(); }
  }

  @TestMethod
  @TestData("invalid")
  @TestData("oversize")
  @TestData("hang")
  public async rejectsBrokenOrSilentAgents(mode: string): Promise<void> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, { ...host.environment, TEAMRUN_FAKE_GROK_INIT: mode }, host.directory.path, host.terminator, host.timings, host.tracker);
    client.start();
    try { await Assert.throwsAsync(() => client.request("initialize", {}, 1000), Error); }
    finally { await client.stop(); }
  }

  @TestMethod
  public async rejectsUnownedReverseRequestsAndIgnoresUnmatchedReplies(): Promise<void> {
    await using host = new GrokTestHost();
    const client = new AcpClient(host.command, host.environment, host.directory.path, host.terminator, host.timings, host.tracker);
    client.start();
    try {
      await client.request("fixture/reverse", {});
      Assert.isNull(await client.request("fixture/null", {}));
      let notifications = 0;
      const reverse = Promise.withResolvers<JsonValue>();
      const listener: IAcpClientListener = { onRequest: () => reverse.promise,
        onNotification: () => { notifications++; }, onResponse: () => undefined, onExit: () => undefined };
      client.setListener(listener);
      await client.request("fixture/emit", { messages: [{ jsonrpc: "2.0", id: "unmatched", result: {} }, { jsonrpc: "2.0", id: 9999, result: {} },
        { jsonrpc: "2.0", method: "notice" }, { jsonrpc: "2.0", id: "repeated", method: "reverse" }, { jsonrpc: "2.0", id: "repeated", method: "reverse" }] });
      Assert.areEqual(1, notifications);
      reverse.reject(new Error("unsupported"));
      await new Promise(resolve => setTimeout(resolve, 10));
      listener.onNotification = () => { throw "invalid notification"; };
      await Assert.throwsAsync(() => client.request("fixture/emit", { messages: [{ jsonrpc: "2.0", method: "notice" }] }), Error);
    }
    finally { await client.stop(); }
  }
}
