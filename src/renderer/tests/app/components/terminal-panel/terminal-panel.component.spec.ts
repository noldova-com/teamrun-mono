/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import {
  Event,
  EventName,
  MethodName,
  TerminalExit,
  TerminalIdParams,
  TerminalInputParams,
  TerminalLineRange,
  TerminalScreen,
  TerminalShellKind,
  TerminalSize,
  TerminalState
} from "@noldova/teamrun-protocol";

import { FakeResizeObserver } from "../../../fixtures/fake-resize-observer";
import type { FakeTeamRunBridge } from "../../../fixtures/fake-teamrun-bridge";
import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { TerminalWindow } from "../../../fixtures/terminal-window";
import { AppView } from "../../../../src/app/enums/app-view";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelKind } from "../../../../src/app/enums/panel-kind";
import { Panel } from "../../../../src/app/models/panel";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { NavigationService } from "../../../../src/app/services/navigation.service";
import { PlatformService } from "../../../../src/app/services/platform.service";
import { ShortcutsService } from "../../../../src/app/services/shortcuts.service";
import { TerminalsService } from "../../../../src/app/services/terminals.service";
import { TerminalPanelComponent } from "../../../../src/app/components/terminal-panel/terminal-panel.component";

describe("TerminalPanelComponent", () => {
  let terminalWindow: TerminalWindow;
  let bridge: FakeTeamRunBridge;
  let opened: number;

  const stateOf = (id: string, exit: TerminalExit | null = null, sequence: number = 0): TerminalState =>
    new TerminalState(id, SampleData.project.id, "PowerShell", TerminalShellKind.PowerShell, null, new TerminalSize(80, 24), exit, 0, sequence, new TerminalLineRange(0, 0));
  const inputs = (): string[] => bridge.requests.filter(t => t.method === MethodName.TerminalInput).map(t => TerminalInputParams.fromJson(t.payload).data);
  const prepare = async (platform: string): Promise<TerminalsService> => {
    bridge.info = { dataDirectory: "D:\\data", productVersion: "0.0.1-test", platform };
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    await TestBed.inject(PlatformService).ready;
    await TestBed.inject(ChatStore).initialize();
    const shortcuts = TestBed.inject(ShortcutsService);
    shortcuts.start();
    onTestFinished(() => shortcuts.stop());
    const terminals = TestBed.inject(TerminalsService);
    await terminals.start();
    await terminals.open();
    return terminals;
  };
  const render = async (id: string): Promise<ComponentFixture<TerminalPanelComponent>> => {
    const fixture = TestBed.createComponent(TerminalPanelComponent);
    fixture.componentRef.setInput("panel", new Panel(PanelKind.Terminal, id));
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };
  const press = (fixture: ComponentFixture<TerminalPanelComponent>, key: string, modifiers: KeyboardEventInit): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", { key, code: `Key${key.toUpperCase()}`, keyCode: key.toUpperCase().charCodeAt(0), bubbles: true, cancelable: true,
      ...modifiers });
    (fixture.nativeElement as HTMLElement).querySelector("textarea")!.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    MemoryStorage.install(window);
    terminalWindow = TerminalWindow.install();
    opened = 0;
    bridge = SampleData.createBridge()
      .answer(MethodName.TerminalOpen, () => stateOf(`t${++opened}`).toJson())
      .answer(MethodName.TerminalScreen, payload => new TerminalScreen(stateOf(TerminalIdParams.fromJson(payload).terminalId), "PS> ").toJson())
      .answer(MethodName.TerminalInput, () => null)
      .answer(MethodName.TerminalResize, () => null)
      .answer(MethodName.TerminalRestart, payload => stateOf(TerminalIdParams.fromJson(payload).terminalId).toJson());
  });

  afterEach(() => {
    TestBed.inject(TerminalsService).stop();
    terminalWindow.restore();
  });

  it("shows only the terminal its tab names when the panel switches between terminals", async () => {
    const terminals = await prepare("win32");
    await terminals.open();
    const fixture = await render("t1");
    const screen = (fixture.nativeElement as HTMLElement).querySelector(".tr-terminal-screen")!;
    const first = screen.firstElementChild;
    const show = async (id: string): Promise<void> => {
      fixture.componentRef.setInput("panel", new Panel(PanelKind.Terminal, id));
      fixture.detectChanges();
      await fixture.whenStable();
    };

    await show("t2");
    const second = screen.firstElementChild;
    expect(screen.children.length).toBe(1);
    expect(second).not.toBe(first);
    await show("t1");

    expect(screen.children.length).toBe(1);
    expect(screen.firstElementChild).toBe(first);
  });

  it("draws its terminal opaque, in the color of the surface it sits on", async () => {
    await prepare("win32");
    const fixture = TestBed.createComponent(TerminalPanelComponent);
    (fixture.nativeElement as HTMLElement).parentElement!.style.backgroundColor = "rgb(24, 24, 24)";
    fixture.componentRef.setInput("panel", new Panel(PanelKind.Terminal, "t1"));
    fixture.detectChanges();
    await fixture.whenStable();

    const drawn = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(".xterm-scrollable-element")!;

    expect(drawn.style.backgroundColor).toBe("rgb(24, 24, 24)");
  });

  it("draws its terminal, shows how its shell ended, restarts it and counts as the last used when focused", async () => {
    const terminals = await prepare("win32");
    const layout = TestBed.inject(LayoutService);
    await terminals.open();
    const fixture = await render("t1");
    const element = fixture.nativeElement as HTMLElement;

    expect(element.classList.contains("tr-terminal")).toBe(true);
    expect(element.querySelector(".tr-terminal-screen .xterm")).not.toBeNull();
    expect(element.querySelector(".tr-terminal-exit")).toBeNull();
    FakeResizeObserver.resizeAll();

    bridge.emit(new Event(EventName.TerminalChanged, stateOf("t1", new TerminalExit(0), 1).toJson()));
    fixture.detectChanges();
    expect(element.querySelector(".tr-terminal-exit span")?.textContent).toBe("The shell exited with code 0.");
    bridge.emit(new Event(EventName.TerminalChanged, stateOf("t1", new TerminalExit(null), 2).toJson()));
    fixture.detectChanges();
    expect(element.querySelector(".tr-terminal-exit span")?.textContent).toBe("The shell exited without an exit code.");
    element.querySelector<HTMLButtonElement>(".tr-terminal-exit button")!.click();
    expect(bridge.requests.filter(t => t.method === MethodName.TerminalRestart).map(t => t.payload)).toEqual([new TerminalIdParams("t1").toJson()]);

    element.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await terminals.open();
    expect(layout.dock(DockSide.Bottom).panels.map(t => t.instance)).toEqual([null, "t1", "t3", "t2"]);
    fixture.destroy();
    expect(FakeResizeObserver.observing.size).toBe(0);
  });

  it("sends keys to the shell and leaves the Ctrl+Shift shortcuts, copy and paste to TeamRun on Windows and Linux", async () => {
    await prepare("win32");
    const navigation = TestBed.inject(NavigationService);
    const fixture = await render("t1");
    navigation.openSettings();

    const toShell = press(fixture, "l", { ctrlKey: true });
    const toComposer = press(fixture, "L", { ctrlKey: true, shiftKey: true });
    const copy = press(fixture, "C", { ctrlKey: true, shiftKey: true });
    const paste = press(fixture, "V", { ctrlKey: true, shiftKey: true });

    expect(toShell.defaultPrevented).toBe(true);
    expect(toComposer.defaultPrevented).toBe(true);
    expect(navigation.view()).toBe(AppView.Chat);
    expect(copy.defaultPrevented).toBe(false);
    expect(paste.defaultPrevented).toBe(false);
    expect(inputs()).toEqual(["\f"]);
    expect(terminalWindow.copied).toEqual([]);
  });

  it("leaves Cmd shortcuts, copy and paste to TeamRun on macOS while Ctrl goes to the shell", async () => {
    await prepare("darwin");
    const navigation = TestBed.inject(NavigationService);
    const fixture = await render("t1");
    navigation.openSettings();

    press(fixture, "l", { ctrlKey: true });
    expect(navigation.view()).toBe(AppView.Settings);
    press(fixture, "l", { metaKey: true });
    const copy = press(fixture, "c", { metaKey: true });
    const paste = press(fixture, "v", { metaKey: true });

    expect(navigation.view()).toBe(AppView.Chat);
    expect(copy.defaultPrevented).toBe(false);
    expect(paste.defaultPrevented).toBe(false);
    expect(inputs()).toEqual(["\f"]);
  });
});
