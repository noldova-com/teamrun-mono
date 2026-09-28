/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { release } from "node:os";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  ErrorCode,
  MethodName,
  Project,
  Request,
  type Response,
  TerminalIdParams,
  TerminalInputParams,
  TerminalLinePage,
  TerminalLinesParams,
  TerminalOpenParams,
  TerminalResizeParams,
  TerminalScreen,
  TerminalSize,
  TerminalState
} from "@noldova/teamrun-protocol";
import { TerminalEnvironment, TerminalHost, TerminalSettings } from "@noldova/teamrun-runtime";

import { FixtureProjects } from "../../fixtures/fixture-projects.fixture.js";
import { FixtureShell } from "../../fixtures/fixture-shell.fixture.js";
import { RecordingTerminalOwner } from "../../fixtures/recording-terminal-owner.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class TerminalHostTests {
  @TestMethod
  public async servesEveryTerminalMethodToTheOwner(): Promise<void> {
    using directory = new TemporaryDirectory();
    const host = TerminalHostTests.createHost(directory);
    const owner = new RecordingTerminalOwner();
    try {
      const opened = TerminalState.fromJson(await TerminalHostTests.succeed(host, owner, MethodName.TerminalOpen,
        new TerminalOpenParams("project-1", new TerminalSize(120, 5)).toJson()));
      await Wait.until(() => owner.output.includes("ready"));
      const id = new TerminalIdParams(opened.id).toJson();

      await TerminalHostTests.succeed(host, owner, MethodName.TerminalInput, new TerminalInputParams(opened.id, "lines 20\r").toJson());
      await Wait.until(() => owner.output.includes("line 20"));
      await TerminalHostTests.succeed(host, owner, MethodName.TerminalResize, new TerminalResizeParams(opened.id, new TerminalSize(100, 6)).toJson());
      const listed = await TerminalHostTests.succeed(host, owner, MethodName.TerminalList, null);
      const screen = TerminalScreen.fromJson(await TerminalHostTests.succeed(host, owner, MethodName.TerminalScreen, id));
      const page = TerminalLinePage.fromJson(await TerminalHostTests.succeed(host, owner, MethodName.TerminalLines,
        new TerminalLinesParams(opened.id, 0, 100).toJson()));
      const restarted = TerminalState.fromJson(await TerminalHostTests.succeed(host, owner, MethodName.TerminalRestart, id));
      const closed = await TerminalHostTests.succeed(host, owner, MethodName.TerminalClose, id);
      const remaining = await TerminalHostTests.succeed(host, owner, MethodName.TerminalList, null);

      Assert.areEqual("Fixture", opened.shell);
      Assert.areEqual("project-1", opened.projectId);
      Assert.areEqual(JSON.stringify([opened.id]), JSON.stringify(TerminalHostTests.ids(listed)));
      Assert.areEqual(opened.id, screen.state.id);
      Assert.isTrue(page.lines.some(t => t.text === "line 1"));
      Assert.areEqual(1, restarted.restartCount);
      Assert.isNull(closed);
      Assert.areEqual("[]", JSON.stringify(remaining));
      Assert.areEqual(0, readdirSync(directory.resolve("terminals")).length);
    }
    finally {
      await host.shutdown();
    }
  }

  @TestMethod
  public async keepsEachTerminalToItsOwnConnection(): Promise<void> {
    using directory = new TemporaryDirectory();
    const host = TerminalHostTests.createHost(directory);
    const owner = new RecordingTerminalOwner();
    const other = new RecordingTerminalOwner();
    try {
      const opened = TerminalState.fromJson(await TerminalHostTests.succeed(host, owner, MethodName.TerminalOpen,
        new TerminalOpenParams("project-1", new TerminalSize(80, 24)).toJson()));

      const input = await host.dispatch(other, new Request("r", MethodName.TerminalInput, new TerminalInputParams(opened.id, "exit 0\r").toJson()));
      const listed = await TerminalHostTests.succeed(host, other, MethodName.TerminalList, null);

      Assert.areEqual(ErrorCode.NotFound, input.info?.name);
      Assert.areEqual("[]", JSON.stringify(listed));
      Assert.areEqual(0, other.events.length);
    }
    finally {
      await host.shutdown();
    }
  }

  @TestMethod
  public async refusesMissingProjectsFoldersAndMethods(): Promise<void> {
    using directory = new TemporaryDirectory();
    const host = TerminalHostTests.createHost(directory);
    const owner = new RecordingTerminalOwner();

    const unknown = await host.dispatch(owner, new Request("a", MethodName.TerminalOpen, new TerminalOpenParams("nope", new TerminalSize(80, 24)).toJson()));
    const missing = await host.dispatch(owner, new Request("b", MethodName.TerminalOpen, new TerminalOpenParams("gone", new TerminalSize(80, 24)).toJson()));
    const invalid = await host.dispatch(owner, new Request("c", MethodName.TerminalOpen, { projectId: "project-1", size: { columns: 0, rows: 5 } }));
    const method = await host.dispatch(owner, new Request("d", "TerminalExplode", null));
    const absent = await host.dispatch(owner, new Request("e", MethodName.TerminalScreen, new TerminalIdParams("absent").toJson()));

    Assert.areEqual(ErrorCode.NotFound, unknown.info?.name);
    Assert.areEqual(ErrorCode.NotFound, missing.info?.name);
    Assert.areEqual(ErrorCode.InvalidParams, invalid.info?.name);
    Assert.areEqual(ErrorCode.UnknownMethod, method.info?.name);
    Assert.areEqual(ErrorCode.NotFound, absent.info?.name);
    Assert.isTrue(host.handles(MethodName.TerminalLines));
    Assert.isFalse(host.handles(MethodName.ProjectList));
  }

  @TestMethod
  public async endsTheTerminalsOfAClosedConnectionAndEveryTerminalAtShutdown(): Promise<void> {
    using directory = new TemporaryDirectory();
    const host = TerminalHostTests.createHost(directory);
    const owner = new RecordingTerminalOwner();
    const other = new RecordingTerminalOwner();
    const open = (by: RecordingTerminalOwner): Promise<JsonValue> =>
      TerminalHostTests.succeed(host, by, MethodName.TerminalOpen, new TerminalOpenParams("project-1", new TerminalSize(80, 5)).toJson());
    await open(owner);
    await open(owner);
    await open(other);
    await Wait.until(() => owner.output.split("ready").length >= 3 && other.output.includes("ready"));

    host.endOwnedBy(owner);
    const afterClose = await TerminalHostTests.succeed(host, owner, MethodName.TerminalList, null);
    const kept = await TerminalHostTests.succeed(host, other, MethodName.TerminalList, null);
    await host.shutdown();
    const refused = await host.dispatch(other, new Request("r", MethodName.TerminalOpen, new TerminalOpenParams("project-1", new TerminalSize(80, 5)).toJson()));

    Assert.areEqual("[]", JSON.stringify(afterClose));
    Assert.areEqual(1, TerminalHostTests.ids(kept).length);
    Assert.areEqual(ErrorCode.Unavailable, refused.info?.name);
    Assert.areEqual(0, readdirSync(directory.resolve("terminals")).length);
  }

  @TestMethod
  public async endsATerminalWhoseConnectionClosedWhileItOpened(): Promise<void> {
    using directory = new TemporaryDirectory();
    const host = TerminalHostTests.createHost(directory);
    const owner = new RecordingTerminalOwner();

    const opening = host.dispatch(owner, new Request("r", MethodName.TerminalOpen, new TerminalOpenParams("project-1", new TerminalSize(80, 5)).toJson()));
    owner.isClosed = true;
    const response = await opening;
    await host.shutdown();

    Assert.areEqual(ErrorCode.Unavailable, response.info?.name);
    Assert.areEqual(0, readdirSync(directory.resolve("terminals")).length);
  }

  @TestMethod
  public removesWhatAnEarlierRuntimeLeftBehind(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("terminals"));
    writeFileSync(directory.resolve("terminals", "left.jsonl"), "{}\n");

    TerminalHostTests.createHost(directory);

    Assert.isTrue(existsSync(directory.resolve("terminals")));
    Assert.areEqual(0, readdirSync(directory.resolve("terminals")).length);
  }

  private static createHost(directory: TemporaryDirectory): TerminalHost {
    mkdirSync(directory.resolve("project"), { recursive: true });
    const projects = new FixtureProjects([
      new Project("project-1", "Project", directory.resolve("project"), "2026-09-28T00:00:00.000Z"),
      new Project("gone", "Gone", directory.resolve("gone"), "2026-09-28T00:00:00.000Z")
    ]);
    const environment = new TerminalEnvironment(process.platform, process.env, null, "en-US");
    const host = new TerminalHost(projects, directory.resolve("terminals"), new FixtureShell(), environment, TerminalSettings.forPlatform(process.platform, release()));
    host.prepare();
    return host;
  }

  private static async succeed(host: TerminalHost, owner: RecordingTerminalOwner, method: string, payload: JsonValue): Promise<JsonValue> {
    const response: Response = await host.dispatch(owner, new Request("r", method, payload));
    if (response.hasErrors)
      throw new Error(`${method} failed: ${response.info?.message ?? ""}`);
    return response.payload;
  }

  private static ids(value: JsonValue): readonly string[] {
    return Array.isArray(value) ? value.map(t => TerminalState.fromJson(t).id) : [];
  }
}
