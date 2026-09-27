/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";
import { ChatStore } from "./chat-store.service";
import { NavigationService } from "./navigation.service";

@Injectable({ providedIn: "root" })
export class HistoryService {
  private readonly store: ChatStore = inject(ChatStore);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly entries: WritableSignal<readonly string[]> = signal([]);
  private readonly index: WritableSignal<number> = signal(-1);

  public readonly canGoBack: Signal<boolean> = computed(() => this.entries().slice(0, this.index()).some(t => this.store.hasConversation(t)));
  public readonly canGoForward: Signal<boolean> = computed(() => this.entries().slice(this.index() + 1).some(t => this.store.hasConversation(t)));

  public constructor() {
    effect(() => {
      const conversationId = this.store.selectedConversationId();
      untracked(() => this.record(conversationId));
    });
  }

  public back(): Promise<void> {
    return this.travel(-1);
  }

  public forward(): Promise<void> {
    return this.travel(1);
  }

  private record(conversationId: string | null): void {
    if (Object.isNull(conversationId) || this.entries()[this.index()] === conversationId)
      return;
    const kept = [...this.entries().slice(0, this.index() + 1), conversationId].slice(-Resources.historyLimit);
    this.entries.set(kept);
    this.index.set(kept.length - 1);
  }

  private async travel(step: number): Promise<void> {
    const entries = this.entries();
    for (let target = this.index() + step; target >= 0 && target < entries.length; target += step) {
      const conversationId = entries[target];
      if (Object.isUndefined(conversationId) || !this.store.hasConversation(conversationId))
        continue;
      this.index.set(target);
      this.navigation.showChat();
      await this.store.selectConversation(conversationId);
      return;
    }
  }
}
