/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import {
  ErrorCode,
  Event,
  EventName,
  MethodName,
  TerminalAcknowledgeParams,
  TerminalExit,
  TerminalIdParams,
  TerminalLineRange,
  TerminalOpenParams,
  TerminalOutputPayload,
  TerminalScreen,
  TerminalShellKind,
  TerminalSize,
  TerminalState
} from "@noldova/teamrun-protocol";

import type { FakeTeamRunBridge } from "../../fixtures/fake-teamrun-bridge";
import { MemoryStorage } from "../../fixtures/memory-storage";
import { SampleData } from "../../fixtures/sample-data";
import { TerminalWindow } from "../../fixtures/terminal-window";
import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelKind } from "../../../src/app/enums/panel-kind";
import { Layout } from "../../../src/app/models/layout";
import { Panel } from "../../../src/app/models/panel";
import { PanelArrangement } from "../../../src/app/models/panel-arrangement";
import { TabDropTarget } from "../../../src/app/models/tab-drop-target";
import { Resources } from "../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { PreferencesService } from "../../../src/app/services/preferences.service";
import { TerminalsService } from "../../../src/app/services/terminals.service";

describe("TerminalsService", () => {
  const explorer = new Panel(PanelKind.Explorer);
  const changes = new Panel(PanelKind.Changes);
  const activity = new Panel(PanelKind.Activity);
  const terminal = (id: string): Panel => new Panel(PanelKind.Terminal, id);
  let storage: MemoryStorage;
  let terminalWindow: TerminalWindow;
  let bridge: FakeTeamRunBridge;
  let opened: number;

  const stateOf = (id: string, size: TerminalSize = new TerminalSize(80, 24)): TerminalState =>
    new TerminalState(id, SampleData.project.id, "PowerShell", TerminalShellKind.PowerShell, null, size, null, 0, 0, new TerminalLineRange(0, 0));
  const requests = (method: string): unknown[] => bridge.requests.filter(t => t.method === method).map(t => t.payload);
  const start = async (): Promise<TerminalsService> => {
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    await TestBed.inject(ChatStore).initialize();
    const terminals = TestBed.inject(TerminalsService);
    await terminals.start();
    return terminals;
  };

  beforeEach(() => {
    storage = MemoryStorage.install(window);
    terminalWindow = TerminalWindow.install();
    opened = 0;
    bridge = SampleData.createBridge()
      .answer(MethodName.TerminalOpen, payload => stateOf(`t${++opened}`, TerminalOpenParams.fromJson(payload).size).toJson())
      .answer(MethodName.TerminalScreen, payload => new TerminalScreen(stateOf(TerminalIdParams.fromJson(payload).terminalId), "").toJson())
      .answer(MethodName.TerminalClose, () => null)
      .answer(MethodName.TerminalRestart, payload => stateOf(TerminalIdParams.fromJson(payload).terminalId).toJson())
      .answer(MethodName.TerminalAcknowledge, () => null);
  });

  afterEach(() => {
    TestBed.inject(TerminalsService).stop();
    terminalWindow.restore();
  });

  it("opens a terminal in the selected project, next to the last one used or in the group asked for", async () => {
    const terminals = await start();
    const layout = TestBed.inject(LayoutService);

    await terminals.open();
    expect(requests(MethodName.TerminalOpen)).toEqual([new TerminalOpenParams(SampleData.project.id, "pwsh", new TerminalSize(80, 24)).toJson()]);
    expect(layout.dock(DockSide.Bottom).panels).toEqual([activity, terminal("t1")]);
    expect(layout.dock(DockSide.Bottom).collapsed).toBe(false);
    expect([...terminals.sessions().keys()]).toEqual(["t1"]);
    expect(requests(MethodName.TerminalScreen)).toEqual([new TerminalIdParams("t1").toJson()]);

    layout.movePanel(terminal("t1"), new TabDropTarget(layout.arrangement().groupOf(explorer)?.id ?? -1, 0));
    await terminals.open();
    expect(layout.dock(DockSide.Left).panels).toEqual([terminal("t1"), terminal("t2"), explorer]);

    await terminals.open(layout.arrangement().groupOf(changes)?.id ?? -1);
    expect(layout.dock(DockSide.Right).panels).toEqual([changes, terminal("t3")]);
    expect(terminals.sessionOf(terminal("t3"))?.state().shell).toBe("PowerShell");
    expect(terminals.sessionOf(explorer)).toBeNull();
  });

  it("lists the shells, opens the one chosen and reports a list that cannot be read", async () => {
    const terminals = await start();
    expect(terminals.shells()).toEqual(SampleData.shells);
    expect(terminals.defaultShell()?.id).toBe("pwsh");

    await terminals.open(null, "cmd");
    expect(requests(MethodName.TerminalOpen)).toEqual([new TerminalOpenParams(SampleData.project.id, "cmd", new TerminalSize(80, 24)).toJson()]);

    bridge.answer(MethodName.TerminalShells, () => ({ unexpected: true }));
    await terminals.loadShells();
    expect(terminals.error()).not.toBeNull();
    expect(terminals.shells()).toEqual(SampleData.shells);
  });

  it("opens new terminals with the chosen default shell while it is installed, and with the platform's otherwise", async () => {
    const terminals = await start();
    const preferences = TestBed.inject(PreferencesService);

    preferences.setDefaultShellId("cmd");
    expect(terminals.defaultShell()?.id).toBe("cmd");
    await terminals.open();
    preferences.setDefaultShellId("uninstalled");
    expect(terminals.defaultShell()?.id).toBe("pwsh");
    await terminals.open();
    bridge.answer(MethodName.TerminalShells, () => []);
    await terminals.loadShells();
    expect(terminals.defaultShell()).toBeNull();
    await terminals.open();

    expect(requests(MethodName.TerminalOpen).map(t => TerminalOpenParams.fromJson(t).shellId)).toEqual(["cmd", "pwsh", null]);
    expect(requests(MethodName.TerminalShells)).toHaveLength(3);
  });

  it("opens new terminals with the output limit chosen in Settings", async () => {
    const terminals = await start();

    await terminals.open();
    TestBed.inject(PreferencesService).setTerminalOutputLimit(25);
    await terminals.open();

    expect(requests(MethodName.TerminalOpen).map(t => TerminalOpenParams.fromJson(t).storedLimit)).toEqual([100 * 1024 * 1024, 25 * 1024 * 1024]);
  });

  it("opens a terminal in the home folder without a selected project and reports a terminal that cannot open", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const terminals = TestBed.inject(TerminalsService);
    onTestFinished(() => terminals.stop());

    await terminals.open();
    expect(terminals.sessions().size).toBe(1);

    await TestBed.inject(ChatStore).initialize();
    bridge.fail(MethodName.TerminalOpen, ErrorCode.NotFound, "The terminal's folder does not exist.");
    await terminals.open();
    expect(requests(MethodName.TerminalOpen).map(t => TerminalOpenParams.fromJson(t).projectId)).toEqual([null, SampleData.project.id]);
    expect(requests(MethodName.TerminalOpen).map(t => TerminalOpenParams.fromJson(t).shellId)).toEqual(["pwsh", "pwsh"]);
    expect(requests(MethodName.TerminalShells)).toHaveLength(1);
    expect(terminals.error()).toBe("The terminal's folder does not exist.");
    terminals.dismissError();
    expect(terminals.error()).toBeNull();
    expect(terminals.sessions().size).toBe(1);
  });

  it("gives each terminal its own events and ends a terminal whose tab closes", async () => {
    const terminals = await start();
    const layout = TestBed.inject(LayoutService);
    await terminals.open();
    await terminals.open();

    bridge.emit(new Event(EventName.TerminalOutput, new TerminalOutputPayload("t2", 1, "x".repeat(20_000), new TerminalLineRange(0, 0)).toJson()));
    bridge.emit(new Event(EventName.TerminalOutput, new TerminalOutputPayload("gone", 1, "lost", new TerminalLineRange(0, 0)).toJson()));
    bridge.emit(new Event(EventName.TerminalChanged, new TerminalState("t1", SampleData.project.id, "PowerShell", TerminalShellKind.PowerShell, null,
      new TerminalSize(80, 24), new TerminalExit(3), 0, 1, new TerminalLineRange(0, 0)).toJson()));
    await vi.waitFor(() => expect(requests(MethodName.TerminalAcknowledge)).toEqual([new TerminalAcknowledgeParams("t2", 20_000).toJson()]));
    expect(terminals.sessionOf(terminal("t1"))?.state().exit?.code).toBe(3);
    expect(terminals.sessionOf(terminal("t2"))?.state().exit).toBeNull();

    layout.closePanel(terminal("t1"));
    TestBed.tick();
    expect(requests(MethodName.TerminalClose)).toEqual([new TerminalIdParams("t1").toJson()]);
    expect([...terminals.sessions().keys()]).toEqual(["t2"]);
    layout.closePanel(terminal("t1"));
    TestBed.tick();
    expect(requests(MethodName.TerminalClose)).toHaveLength(1);
  });

  it("finds a reloaded window's terminals again, drops the tabs of ended ones and follows a reconnection", async () => {
    const arrangement = PanelArrangement.createDefault().openPanel(terminal("t1")).openPanel(terminal("ended"));
    storage.setItem(Resources.layoutStorageKey, JSON.stringify(Layout.createDefault().withArrangement(arrangement).toJson()));
    let listed = [stateOf("t1"), stateOf("untabbed")];
    bridge.answer(MethodName.TerminalList, () => listed.map(t => t.toJson()));

    const terminals = await start();
    const layout = TestBed.inject(LayoutService);
    expect([...terminals.sessions().keys()]).toEqual(["t1", "untabbed"]);
    expect(layout.dock(DockSide.Bottom).panels).toEqual([activity, terminal("t1"), terminal("untabbed")]);

    listed = [stateOf("t1")];
    bridge.emit(new Event(EventName.StateResyncRequested, null));
    await vi.waitFor(() => expect([...terminals.sessions().keys()]).toEqual(["t1"]));
    expect(layout.isOpen(terminal("untabbed"))).toBe(false);

    bridge.answer(MethodName.TerminalList, () => ({ unexpected: true }));
    bridge.emit(new Event(EventName.StateResyncRequested, null));
    await vi.waitFor(() => expect(terminals.error()).not.toBeNull());
  });

  it("drops a terminal whose screen cannot be read", async () => {
    bridge.answer(MethodName.TerminalList, () => [stateOf("t1").toJson()]).fail(MethodName.TerminalScreen, ErrorCode.NotFound, "The terminal does not exist.");

    const terminals = await start();

    expect(terminals.sessions().size).toBe(0);
    expect(terminals.error()).toBe("The terminal does not exist.");
  });

  it("shows the last-used terminal and leaves it for where the focus was, hiding its dock", async () => {
    const terminals = await start();
    const layout = TestBed.inject(LayoutService);
    const host = document.body.appendChild(document.createElement("div"));
    const button = document.body.appendChild(document.createElement("button"));
    onTestFinished(() => {
      host.remove();
      button.remove();
    });

    expect(terminals.toggle()).toBe(true);
    await vi.waitFor(() => expect(terminals.sessions().size).toBe(1));
    const session = terminals.sessionOf(terminal("t1"));
    layout.toggleDock(DockSide.Bottom);
    layout.activatePanel(activity);
    button.focus();

    expect(terminals.toggle()).toBe(true);
    expect(layout.arrangement().isShown(terminal("t1"))).toBe(true);
    session?.show(host, () => true);
    expect(session?.hasFocus).toBe(true);
    terminals.markUsed(session!);
    expect(terminals.toggle()).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(layout.dock(DockSide.Bottom).collapsed).toBe(true);

    layout.toggleDock(DockSide.Bottom);
    session?.show(host, () => true);
    session?.requestFocus();
    expect(terminals.toggle()).toBe(false);
  });

  it("restarts a terminal and reports a restart that fails", async () => {
    const terminals = await start();
    await terminals.open();
    const session = terminals.sessionOf(terminal("t1"))!;

    await terminals.restart(session);
    expect(requests(MethodName.TerminalRestart)).toEqual([new TerminalIdParams("t1").toJson()]);
    bridge.fail(MethodName.TerminalRestart, ErrorCode.Conflict, "busy");
    await terminals.restart(session);
    expect(terminals.error()).toBe("busy");
  });
});
