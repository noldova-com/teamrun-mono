/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";
import type { ITerminalOptions, ITheme } from "@xterm/xterm";

import "@noldova/teamrun-foundation-core";
import {
  type Event,
  EventName,
  MethodName,
  TerminalIdParams,
  TerminalOpenParams,
  TerminalOutputPayload,
  TerminalScreen,
  TerminalSize,
  TerminalState
} from "@noldova/teamrun-protocol";

import { PanelKind } from "../enums/panel-kind";
import { TerminalColor } from "../enums/terminal-color";
import { Panel } from "../models/panel";
import { TabDropTarget } from "../models/tab-drop-target";
import type { Theme } from "../models/theme";
import { Resources } from "../resources";
import { BridgeService } from "./bridge.service";
import { ChatStore } from "./chat-store.service";
import { LayoutService } from "./layout.service";
import { PreferencesService } from "./preferences.service";
import { TerminalSession } from "./terminal-session";
import { ThemeService } from "./theme.service";

@Injectable({ providedIn: "root" })
export class TerminalsService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly bridge: BridgeService = inject(BridgeService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly store: ChatStore = inject(ChatStore);
  private readonly theme: ThemeService = inject(ThemeService);
  private readonly preferences: PreferencesService = inject(PreferencesService);
  private readonly sessionsSignal: WritableSignal<ReadonlyMap<string, TerminalSession>> = signal(new Map());
  private readonly errorSignal: WritableSignal<string | null> = signal(null);
  private readonly palette: Signal<ITheme> = computed(() => TerminalsService.paletteOf(this.theme.active()));
  private placed: ReadonlySet<string> = new Set();
  private lastUsed: string | null = null;
  private returnFocus: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;

  public readonly sessions: Signal<ReadonlyMap<string, TerminalSession>> = this.sessionsSignal.asReadonly();
  public readonly error: Signal<string | null> = this.errorSignal.asReadonly();
  public readonly canOpen: Signal<boolean> = computed(() => !Object.isNull(this.store.selectedProject()));

  public constructor() {
    effect(() => {
      const fontFamily = this.preferences.codeFontStack();
      const fontSize = this.preferences.codeTextSize();
      const palette = this.palette();
      untracked(() => {
        for (const session of this.sessions().values())
          session.configure(fontFamily, fontSize, palette);
      });
    });
    effect(() => {
      const placed = new Set(this.layout.arrangement().groups.flatMap(t => t.panels)
        .flatMap(t => t.kind === PanelKind.Terminal && !Object.isNull(t.instance) ? [t.instance] : []));
      untracked(() => this.endRemoved(placed));
    });
  }

  public async start(): Promise<void> {
    this.unsubscribe ??= this.bridge.subscribe(event => this.apply(event));
    await this.restore();
  }

  public stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const session of this.sessions().values())
      session.dispose();
    this.sessionsSignal.set(new Map());
  }

  public sessionOf(panel: Panel): TerminalSession | null {
    return Object.isNull(panel.instance) ? null : this.sessions().get(panel.instance) ?? null;
  }

  public async open(groupId: number | null = null): Promise<void> {
    const project = this.store.selectedProject();
    if (Object.isNull(project))
      return;

    await this.perform(async () => {
      const opened = await this.bridge.call(MethodName.TerminalOpen, new TerminalOpenParams(project.id, this.nextSize()).toJson());
      const session = await this.attach(TerminalState.fromJson(opened));
      session.requestFocus();
      this.place(new Panel(PanelKind.Terminal, session.id), groupId);
      this.lastUsed = session.id;
    });
  }

  public async restart(session: TerminalSession): Promise<void> {
    await this.perform(async () => {
      await this.bridge.call(MethodName.TerminalRestart, new TerminalIdParams(session.id).toJson());
    });
    session.requestFocus();
  }

  public toggle(): boolean {
    const focused = [...this.sessions().values()].find(t => t.hasFocus);
    if (!Object.isUndefined(focused))
      return this.leave(focused);

    const session = (Object.isNull(this.lastUsed) ? undefined : this.sessions().get(this.lastUsed)) ?? this.sessions().values().next().value;
    if (Object.isUndefined(session)) {
      void this.open();
      return true;
    }
    const active = this.document.activeElement;
    this.returnFocus = active instanceof HTMLElement ? active : null;
    this.layout.activatePanel(new Panel(PanelKind.Terminal, session.id));
    session.requestFocus();
    return true;
  }

  public markUsed(session: TerminalSession): void {
    this.lastUsed = session.id;
  }

  public dismissError(): void {
    this.errorSignal.set(null);
  }

  private apply(event: Event): void {
    switch (event.name) {
      case EventName.TerminalOutput: {
        const payload = TerminalOutputPayload.fromJson(event.payload);
        this.sessions().get(payload.terminalId)?.receiveOutput(payload);
        break;
      }
      case EventName.TerminalChanged: {
        const state = TerminalState.fromJson(event.payload);
        this.sessions().get(state.id)?.receiveState(state);
        break;
      }
      case EventName.StateResyncRequested:
        void this.restore();
        break;
    }
  }

  private async restore(): Promise<void> {
    await this.perform(async () => {
      const listed = await this.bridge.call(MethodName.TerminalList, null);
      if (!Array.isArray(listed))
        throw new TypeError(String(listed));

      const states = listed.map(t => TerminalState.fromJson(t));
      for (const id of this.sessions().keys())
        if (!states.some(t => t.id === id))
          this.remove(id);
      this.layout.keepInstances(PanelKind.Terminal, states.map(t => t.id));
      for (const state of states.filter(t => !this.sessions().has(t.id))) {
        await this.attach(state);
        const panel = new Panel(PanelKind.Terminal, state.id);
        if (!this.layout.isOpen(panel))
          this.layout.openPanel(panel);
      }
    });
  }

  private async attach(state: TerminalState): Promise<TerminalSession> {
    const session = await this.create(state);
    this.sessionsSignal.update(t => new Map([...t, [session.id, session]]));
    try {
      session.load(TerminalScreen.fromJson(await this.bridge.call(MethodName.TerminalScreen, new TerminalIdParams(session.id).toJson())));
    }
    catch (error) {
      this.remove(session.id);
      throw error;
    }
    return session;
  }

  private async create(state: TerminalState): Promise<TerminalSession> {
    const [xterm, fit] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
    const fontFamily = this.preferences.codeFontStack();
    const fontSize = this.preferences.codeTextSize();
    await this.document.fonts.load(Resources.formatFontLoad(fontSize, fontFamily));
    const options: ITerminalOptions = { allowTransparency: true, fontFamily, fontSize, scrollback: Resources.terminalScrollback, theme: this.palette() };
    return new TerminalSession(state, new xterm.Terminal(options), new fit.FitAddon(), this.bridge);
  }

  private place(panel: Panel, groupId: number | null): void {
    const target = this.targetFor(groupId);
    if (Object.isNull(target))
      this.layout.openPanel(panel);
    else
      this.layout.movePanel(panel, target);
  }

  private targetFor(groupId: number | null): TabDropTarget | null {
    const arrangement = this.layout.arrangement();
    if (!Object.isNull(groupId)) {
      const group = arrangement.group(groupId);
      return Object.isNull(group) ? null : new TabDropTarget(group.id, group.panels.length);
    }
    if (Object.isNull(this.lastUsed))
      return null;
    const last = new Panel(PanelKind.Terminal, this.lastUsed);
    const group = arrangement.groupOf(last);
    return Object.isNull(group) ? null : new TabDropTarget(group.id, group.panels.findIndex(t => t.equals(last)) + 1);
  }

  private nextSize(): TerminalSize {
    const last = Object.isNull(this.lastUsed) ? undefined : this.sessions().get(this.lastUsed);
    return last?.state().size ?? new TerminalSize(Resources.defaultTerminalColumns, Resources.defaultTerminalRows);
  }

  private leave(session: TerminalSession): boolean {
    const arrangement = this.layout.arrangement();
    const group = arrangement.groupOf(new Panel(PanelKind.Terminal, session.id));
    const side = Object.isNull(group) ? null : arrangement.sideOf(group.id);
    if (!Object.isNull(side))
      this.layout.toggleDock(side);
    const target = this.returnFocus;
    this.returnFocus = null;
    if (Object.isNull(target) || !target.isConnected)
      return false;

    target.focus();
    return true;
  }

  private endRemoved(placed: ReadonlySet<string>): void {
    for (const id of this.placed)
      if (!placed.has(id) && this.sessions().has(id)) {
        this.remove(id);
        this.bridge.call(MethodName.TerminalClose, new TerminalIdParams(id).toJson()).catch(() => undefined);
      }
    this.placed = placed;
  }

  private remove(id: string): void {
    this.sessions().get(id)?.dispose();
    this.sessionsSignal.update(t => new Map([...t].filter(([key]) => key !== id)));
    if (this.lastUsed === id)
      this.lastUsed = null;
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    }
    catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : String(error));
    }
  }

  private static paletteOf(theme: Theme): ITheme {
    const palette: ITheme = { background: Resources.transparentColor };
    for (const color of Object.values(TerminalColor)) {
      const value = Resources.terminalColorTokens[color].resolve(theme);
      if (!Object.isNull(value))
        palette[color] = value;
    }
    return palette;
  }
}
