/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader, JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AppServerException, AppServerUnavailableException, type INotificationHandler, ProcessCommand, type ProcessExit } from "@noldova/teamrun-providers";

import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class AppServerClientTests {
  @TestMethod
  public async initializesRequestsAndStops(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    const versionBeforeStart = client.version;

    const initialization = await client.start();
    const empty = await client.request("test/empty", {}, 1000);
    const models = JSON.stringify(await client.request("model/list", {}, 1000));
    const unknown = await Assert.throwsAsync(() => client.request("nope", {}, 1000), AppServerException);
    const timedOut = await Assert.throwsAsync(() => client.request("test/never", {}, 50), AppServerUnavailableException);
    const twice = await Assert.throwsAsync(() => client.start(), AppServerUnavailableException);
    await client.stop();
    await client.stop();
    const afterStop = await Assert.throwsAsync(() => client.request("model/list", {}, 100), AppServerUnavailableException);
    client.notify("ignored", {});
    const exit = await client.waitForExit();

    Assert.isNull(versionBeforeStart);
    Assert.isNull(empty);
    Assert.areEqual("9.9.9", initialization.version);
    Assert.areEqual("9.9.9", client.version);
    Assert.areEqual("codex-cli/9.9.9-fake (fake)", client.initialization?.userAgent);
    Assert.isTrue(models.includes("gpt-5.6-sol"));
    Assert.areEqual("nope: unknown method nope (code -32601)", unknown.message);
    Assert.areEqual("The Codex app-server did not answer test/never within the timeout.", timedOut.message);
    Assert.areEqual("The Codex app-server was already started.", twice.message);
    Assert.areEqual("The Codex app-server is not running (model/list).", afterStop.message);
    Assert.isFalse(client.isAlive);
    Assert.areEqual(0, exit.code);
  }

  @TestMethod
  public async routesNotificationsAndServerRequests(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    const methods: string[] = [];
    let answers: string | null = null;
    const recorder = AppServerClientTests.createHandler((method, params) => {
      methods.push(method);
      if (method === "item/completed" && params.readObject("item").readString("id") === "answers")
        answers = params.readObject("item").readString("text");
    });
    const throwing = AppServerClientTests.createHandler(() => {
      throw new Error("handler failure");
    });
    client.setServerRequestHandler({
      handleServerRequest: (method: string): Promise<JsonValue> =>
        method === "item/tool/requestUserInput" ? Promise.resolve({ answers: {} }) : Promise.reject(new Error("refused"))
    });
    await client.start();
    const subscription = client.subscribe(recorder);
    client.subscribe(throwing);

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "approve" }] }, 1000);
    await Wait.until(() => methods.includes("turn/completed"));
    subscription[Symbol.dispose]();
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "fail" }] }, 1000);
    await Wait.delay(100);
    await client.stop();

    const decoded = JSON.parse(String(answers)) as { result: unknown; error: { code: number; message: string } | null }[];
    Assert.areEqual(8, decoded.length);
    Assert.areEqual("refused", decoded[0]?.error?.message);
    Assert.areEqual(-32000, decoded[0]?.error?.code);
    Assert.areEqual("{\"answers\":{}}", JSON.stringify(decoded[4]?.result));
    Assert.areEqual(1, methods.filter(t => t === "turn/completed").length);
    Assert.isTrue(client.handlerFailureCount > 0);
    Assert.isFalse(subscription.isActive);
  }

  @TestMethod
  public async declinesServerRequestsWithoutAHandler(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    let answers: string | null = null;
    client.subscribe(AppServerClientTests.createHandler((method, params) => {
      if (method === "item/completed")
        answers = params.readObject("item").readString("text");
    }));
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "approve" }] }, 1000);
    await Wait.until(() => answers !== null);
    await client.stop();

    const decoded = JSON.parse(String(answers)) as { error: { code: number; message: string } | null }[];
    Assert.areEqual(8, decoded.filter(t => t.error?.code === -32601).length);
    Assert.areEqual("TeamRun has no handler for server requests.", decoded[0]?.error?.message);
  }

  @TestMethod
  public async ignoresLinesItCannotRead(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient();
    const methods: string[] = [];
    client.subscribe(AppServerClientTests.createHandler(method => methods.push(method)));
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "garbage" }] }, 1000);
    await Wait.until(() => methods.includes("turn/completed"));
    await client.stop();

    Assert.areEqual(2, client.droppedLineCount);
    Assert.areEqual(2, methods.filter(t => t === "thread/started").length);
    Assert.areEqual(3, methods.filter(t => t === "item/completed").length);
    Assert.areEqual(0, client.handlerFailureCount);
  }

  @TestMethod
  public async failsPendingRequestsWhenTheServerExits(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient({ ...host.environment, TEAMRUN_FAKE_CODEX_STDERR: "1" });
    const exits: number[] = [];
    client.subscribeExit({ handleExit: (exit: ProcessExit) => exits.push(exit.code ?? -1) });
    await client.start();

    const threadId = await AppServerClientTests.startThread(client);
    const pending = Assert.throwsAsync(() => client.request("test/never", {}, 5000), AppServerUnavailableException);
    await client.request("turn/start", { threadId, input: [{ type: "text", text: "exit" }] }, 1000);
    const failure = await pending;
    const exit = await client.waitForExit();

    Assert.areEqual("The Codex app-server exited (code 1, signal null): fake stderr line\n", failure.message);
    Assert.areEqual(1, exit.code);
    Assert.areEqual("1", exits.join(","));
    Assert.isTrue(client.stderr.includes("fake stderr line"));
  }

  @TestMethod
  public async reportsInitializationFailures(): Promise<void> {
    using host = new CodexTestHost();
    const refusing = host.createClient({ ...host.environment, TEAMRUN_FAKE_CODEX_INIT: "fail" });
    const exiting = host.createClient({ ...host.environment, TEAMRUN_FAKE_CODEX_INIT: "exit" });
    const missing = host.createClient(host.environment, new ProcessCommand("teamrun-no-such-executable", ["app-server"]));

    const refused = await Assert.throwsAsync(() => refusing.start(), AppServerException);
    const exited = await Assert.throwsAsync(() => exiting.start(), AppServerUnavailableException);
    const unspawnable = await Assert.throwsAsync(() => missing.start(), AppServerUnavailableException);
    await refusing.stop();

    Assert.areEqual("initialize: init failed (code -32000)", refused.message);
    Assert.areEqual("{\"detail\":\"x\"}", JSON.stringify(refused.error.data));
    Assert.isTrue(exited.message.startsWith("The Codex app-server exited (code 3, signal null)"));
    Assert.isTrue(unspawnable.message.includes("ENOENT"));
    Assert.isFalse(missing.isAlive);
    Assert.areNotEqual(0, (await missing.waitForExit()).code);
  }

  @TestMethod
  public async terminatesAServerThatIgnoresTheClosedInput(): Promise<void> {
    using host = new CodexTestHost();
    const client = host.createClient({ ...host.environment, TEAMRUN_FAKE_CODEX_IGNORE_STDIN_END: "1" });
    await client.start();

    await client.stop();
    const exit = await client.waitForExit();

    Assert.isFalse(client.isAlive);
    Assert.isTrue(exit.code !== 0 || exit.signal !== null);
  }

  private static createHandler(handle: (method: string, params: JsonReader) => void): INotificationHandler {
    return { handleNotification: handle };
  }

  private static async startThread(client: { request(method: string, params: JsonValue, timeout: number): Promise<JsonValue> }): Promise<string> {
    const started = await client.request("thread/start", { cwd: "D:/work" }, 1000);
    return String((started as { thread: { id: string } }).thread.id);
  }
}
