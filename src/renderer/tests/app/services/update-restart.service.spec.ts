/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { AppUpdateCommand, AppUpdateState, AppUpdateStatus, Event, EventName, Message, MessageAuthor, MessageIdParams, MessageStatus,
  MethodName } from "@noldova/teamrun-protocol";

import type { FakeTeamRunBridge } from "../../fixtures/fake-teamrun-bridge";
import { SampleData } from "../../fixtures/sample-data";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { AppUpdatesService } from "../../../src/app/services/app-updates.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";
import { UpdateRestartService } from "../../../src/app/services/update-restart.service";

describe("UpdateRestartService", () => {
  const first = SampleData.withStatus(SampleData.reply, MessageStatus.Running);
  const second = new Message("second", "c1", 3, MessageAuthor.Provider, SampleData.userMessage.id, MessageStatus.Pending, [], first.provenance,
    SampleData.timestamp, null, null, [], "bob", "Bob");
  let bridge: FakeTeamRunBridge;
  let store: ChatStore;
  let restart: UpdateRestartService;

  const start = async (running: readonly Message[]): Promise<void> => {
    bridge = SampleData.createBridge();
    bridge.answer(MethodName.MessageList, () => [SampleData.userMessage, ...running].map(t => t.toJson()));
    bridge.answer(MethodName.MessageListOpen, () => running.map(t => t.toJson()));
    bridge.answer(MethodName.MessageCancel, payload => {
      const id = MessageIdParams.fromJson(payload).messageId;
      return SampleData.withStatus(id === first.id ? first : second, MessageStatus.Cancelled).toJson();
    });
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    store = TestBed.inject(ChatStore);
    await store.initialize();
    await store.selectConversation("c1");
    restart = TestBed.inject(UpdateRestartService);
    const updates = TestBed.inject(AppUpdatesService);
    await vi.waitFor(() => expect(updates.isPending()).toBe(false));
  };
  const installs = (): number => bridge.updateCommands.filter(t => t === AppUpdateCommand.Install).length;
  const choice = (): string | undefined => document.querySelector("tr-restart-choice-dialog")?.textContent ?? undefined;
  const choose = async (label: string): Promise<void> => {
    let button: HTMLButtonElement | undefined;
    await vi.waitFor(() => {
      TestBed.tick();
      button = Array.from(document.querySelectorAll<HTMLButtonElement>("tr-restart-choice-dialog button")).find(t => t.textContent?.trim() === label);
      expect(button).toBeDefined();
    });
    button!.click();
    await vi.waitFor(() => { TestBed.tick(); expect(document.querySelector("tr-restart-choice-dialog")).toBeNull(); });
  };
  const finish = (message: Message): void => {
    store.apply(new Event(EventName.MessageUpdated, SampleData.withStatus(message, MessageStatus.Completed).toJson()));
    TestBed.tick();
  };

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    store.dispose();
  });

  it("restarts right away when no reply is running", async () => {
    await start([]);
    restart.restart();
    await vi.waitFor(() => expect(installs()).toBe(1));
    expect(document.querySelector("tr-restart-choice-dialog")).toBeNull();
  });

  it("waits for running replies and then restarts", async () => {
    await start([first, second]);
    restart.restart();
    await vi.waitFor(() => { TestBed.tick(); expect(choice()).toContain("2 replies are still running."); });
    await choose("Restart when finished");
    expect(restart.waitingFor()).toBe(2);
    finish(first);
    expect(restart.waitingFor()).toBe(1);
    expect(installs()).toBe(0);
    finish(second);
    await vi.waitFor(() => { TestBed.tick(); expect(installs()).toBe(1); });
    expect(restart.waitingFor()).toBeNull();
    expect(bridge.methods).not.toContain(MethodName.MessageCancel);
  });

  it("stops waiting when the restart is cancelled", async () => {
    await start([first]);
    restart.restart();
    await choose("Restart when finished");
    expect(restart.waitingFor()).toBe(1);
    restart.cancelWaiting();
    expect(restart.waitingFor()).toBeNull();
    finish(first);
    expect(installs()).toBe(0);
  });

  it("stops the running replies and then restarts", async () => {
    await start([first, second]);
    restart.restart();
    await choose("Stop and restart");
    await vi.waitFor(() => { TestBed.tick(); expect(installs()).toBe(1); });
    expect(bridge.methods.filter(t => t === MethodName.MessageCancel)).toHaveLength(2);
    expect(restart.waitingFor()).toBeNull();
  });

  it("changes nothing when the choice is dismissed", async () => {
    await start([first]);
    restart.restart();
    await choose("Cancel");
    expect(restart.waitingFor()).toBeNull();
    expect(bridge.methods).not.toContain(MethodName.MessageCancel);
    finish(first);
    expect(installs()).toBe(0);
  });

  it("shows the installing dialog while preparing and installing, and closes it when the restart fails", async () => {
    await start([]);
    const dialog = (): Element | null => document.querySelector("tr-update-install-dialog");
    bridge.emitUpdate(new AppUpdateState(AppUpdateStatus.Preparing, "0.0.4", "0.0.5", 100, null, null, false, true));
    await vi.waitFor(() => { TestBed.tick(); expect(dialog()).not.toBeNull(); });
    expect(TestBed.inject(MatDialog).openDialogs[0]?.disableClose).toBe(true);
    bridge.emitUpdate(new AppUpdateState(AppUpdateStatus.Installing, "0.0.4", "0.0.5", 100, null, null, false, true));
    TestBed.tick();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    bridge.emitUpdate(new AppUpdateState(AppUpdateStatus.Error, "0.0.4", "0.0.5", 100, "The update installer could not start.", null, false, true));
    await vi.waitFor(() => { TestBed.tick(); expect(dialog()).toBeNull(); });
  });
});
