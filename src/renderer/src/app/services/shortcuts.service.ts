/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { AppView } from "../enums/app-view";
import { DockSide } from "../enums/dock-side";
import { PanelKind } from "../enums/panel-kind";
import { SettingsSection } from "../enums/settings-section";
import { ShortcutAction } from "../enums/shortcut-action";
import { Panel } from "../models/panel";
import type { Shortcut } from "../models/shortcut";
import { Resources } from "../resources";
import { ChatStore } from "./chat-store.service";
import { DocumentsService } from "./documents.service";
import { HistoryService } from "./history.service";
import { NavigationService } from "./navigation.service";
import { LayoutService } from "./layout.service";
import { SearchLauncher } from "./search-launcher.service";

@Injectable({ providedIn: "root" })
export class ShortcutsService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly store: ChatStore = inject(ChatStore);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly history: HistoryService = inject(HistoryService);
  private readonly documents: DocumentsService = inject(DocumentsService);
  private readonly search: SearchLauncher = inject(SearchLauncher);
  private readonly listener: (event: KeyboardEvent) => void = event => this.handle(event);
  private focusComposer: (() => void) | null = null;
  private focusPending: boolean = false;

  public start(): void {
    this.document.addEventListener(Resources.keydownEvent, this.listener);
  }

  public stop(): void {
    this.document.removeEventListener(Resources.keydownEvent, this.listener);
  }

  public attachComposer(focus: (() => void) | null): void {
    this.focusComposer = focus;
    if (Object.isNull(focus) || !this.focusPending)
      return;
    this.focusPending = false;
    focus();
  }

  public keysOf(action: ShortcutAction): string {
    const shortcut = Resources.shortcuts.find(t => t.action === action);

    return Object.isUndefined(shortcut) ? String.empty : this.describe(shortcut);
  }

  public describe(shortcut: Shortcut): string {
    const parts: string[] = [];
    if (shortcut.control)
      parts.push(Resources.controlKeyLabel);
    if (shortcut.shift)
      parts.push(Resources.shiftKeyLabel);
    if (shortcut.alt)
      parts.push(Resources.altKeyLabel);
    parts.push(Resources.keyLabels[shortcut.key] ?? shortcut.key.toUpperCase());

    return parts.join(Resources.keyJoiner);
  }

  private handle(event: KeyboardEvent): void {
    if (event.defaultPrevented)
      return;
    const shortcut = Resources.shortcuts.find(t => t.global && t.matches(event));
    if (Object.isUndefined(shortcut))
      return;
    if (this.perform(shortcut.action))
      event.preventDefault();
  }

  private perform(action: ShortcutAction): boolean {
    switch (action) {
      case ShortcutAction.NewConversation:
        this.navigation.showChat();
        void this.store.startConversation();
        return true;
      case ShortcutAction.OpenFolder:
        void this.store.openFolder();
        return true;
      case ShortcutAction.OpenSettings:
        this.navigation.openSettings();
        return true;
      case ShortcutAction.ShowShortcuts:
        this.navigation.openSettings(SettingsSection.Shortcuts);
        return true;
      case ShortcutAction.ToggleSidebar:
        this.layout.toggleDock(DockSide.Left);
        return true;
      case ShortcutAction.Back:
        void this.history.back();
        return true;
      case ShortcutAction.Forward:
        void this.history.forward();
        return true;
      case ShortcutAction.Search:
        this.search.open();
        return true;
      case ShortcutAction.ToggleExplorer:
        this.layout.togglePanel(new Panel(PanelKind.Explorer));
        return true;
      case ShortcutAction.ToggleChanges:
        this.layout.togglePanel(new Panel(PanelKind.Changes));
        return true;
      case ShortcutAction.ToggleActivity:
        this.layout.togglePanel(new Panel(PanelKind.Activity));
        return true;
      case ShortcutAction.ToggleBottomDock:
        this.layout.toggleDock(DockSide.Bottom);
        return true;
      case ShortcutAction.CloseDocument:
        return this.closeDocument();
      case ShortcutAction.FocusComposer:
        this.navigation.showChat();
        if (Object.isNull(this.focusComposer))
          this.focusPending = true;
        else
          requestAnimationFrame(() => this.focusComposer?.());
        return true;
      case ShortcutAction.StopOrBack:
        return this.stopOrBack();
      case ShortcutAction.PreviousConversation:
        this.navigation.showChat();
        void this.store.stepConversation(-1);
        return true;
      case ShortcutAction.NextConversation:
        this.navigation.showChat();
        void this.store.stepConversation(1);
        return true;
      default:
        return false;
    }
  }

  private closeDocument(): boolean {
    if (this.navigation.view() === AppView.Image) {
      const image = this.navigation.activeImage();
      if (!Object.isNull(image))
        this.navigation.closeImage(image.id);
      return true;
    }
    if (this.navigation.view() === AppView.Settings) {
      this.navigation.closeSettingsTab();
      return true;
    }
    const panel = this.navigation.panel();
    if (!Object.isNull(panel)) {
      this.layout.closePanel(panel);
      return true;
    }
    const conversationId = this.store.selectedConversationId();
    if (Object.isNull(conversationId))
      return false;
    void this.documents.close(conversationId);

    return true;
  }

  private stopOrBack(): boolean {
    if (this.navigation.view() === AppView.Image)
      return this.closeDocument();
    if (this.navigation.view() === AppView.Settings) {
      this.navigation.showChat();
      return true;
    }
    const running = this.store.runningReply();
    if (Object.isNull(running))
      return false;
    void this.store.cancel(running.id);

    return true;
  }
}
