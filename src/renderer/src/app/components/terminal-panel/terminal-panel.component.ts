/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy, Component, DestroyRef, type ElementRef, type InputSignal, type Signal, afterNextRender, afterRenderEffect, computed, inject, input,
  untracked, viewChild
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";

import "@noldova/teamrun-foundation-core";

import type { Panel } from "../../models/panel";
import { Resources } from "../../resources";
import { PlatformService } from "../../services/platform.service";
import { ShortcutsService } from "../../services/shortcuts.service";
import type { TerminalSession } from "../../services/terminal-session";
import { TerminalsService } from "../../services/terminals.service";

@Component({
  selector: "tr-terminal-panel",
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tr-terminal flex h-full min-h-0 flex-col", "(focusin)": "onFocusIn()" },
  templateUrl: "./terminal-panel.component.html"
})
export class TerminalPanelComponent {
  private readonly terminals: TerminalsService = inject(TerminalsService);
  private readonly shortcuts: ShortcutsService = inject(ShortcutsService);
  private readonly platform: PlatformService = inject(PlatformService);
  private readonly screen: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("screen");
  private readonly resizing: ResizeObserver = new ResizeObserver(() => this.session()?.fitToHost());

  protected readonly resources: typeof Resources = Resources;
  protected readonly session: Signal<TerminalSession | null> = computed(() => this.terminals.sessionOf(this.panel()));
  protected readonly exitCode: Signal<number | null> = computed(() => this.session()?.state().exitCode ?? null);

  public readonly panel: InputSignal<Panel> = input.required<Panel>();

  public constructor() {
    afterRenderEffect(() => {
      const session = this.session();
      const host = this.screen().nativeElement;
      if (!Object.isNull(session))
        untracked(() => session.show(host, event => this.onKey(session, event)));
    });
    afterNextRender(() => this.resizing.observe(this.screen().nativeElement));
    inject(DestroyRef).onDestroy(() => this.resizing.disconnect());
  }

  protected onFocusIn(): void {
    const session = this.session();
    if (!Object.isNull(session))
      this.terminals.markUsed(session);
  }

  protected restart(): void {
    const session = this.session();
    if (!Object.isNull(session))
      void this.terminals.restart(session);
  }

  private onKey(session: TerminalSession, event: KeyboardEvent): boolean {
    if (this.shortcuts.isShortcut(event))
      return false;
    const command = this.platform.isMac()
      ? event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
      : event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey;
    const key = event.key.toLowerCase();
    if (!command || (key !== Resources.copyKey && key !== Resources.pasteKey))
      return true;
    if (key === Resources.copyKey && event.type === Resources.keydownEvent && session.copySelection())
      event.preventDefault();
    return false;
  }
}
