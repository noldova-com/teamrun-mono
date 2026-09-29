/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, type ElementRef, Injector, type WritableSignal, afterNextRender, afterRenderEffect,
  computed, effect, inject, signal, untracked, viewChild
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

import { HeightLedger } from "../../models/height-ledger";
import { ReadingPosition } from "../../models/reading-position";
import type { MessageIndexEntry } from "../../models/message-index-entry";
import { VirtualRange } from "../../models/virtual-range";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { MessageCardComponent } from "../message-card/message-card.component";

@Component({
  selector: "tr-message-list",
  imports: [MatButtonModule, MatIconModule, MessageCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "relative block" },
  templateUrl: "./message-list.component.html"
})
export class MessageListComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly store: ChatStore = inject(ChatStore);
  protected readonly isAway: WritableSignal<boolean> = signal(false);
  protected readonly range: WritableSignal<VirtualRange> = signal(VirtualRange.empty);
  protected readonly height: WritableSignal<number> = signal(0);
  protected readonly shown = computed(() => this.store.messageIndex().slice(this.range().start, this.range().end));
  protected readonly messagesById = computed(() => new Map(this.store.messages().map(t => [t.id, t])));
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>("scroller");
  private readonly content = viewChild.required<ElementRef<HTMLElement>>("content");
  private readonly injector: Injector = inject(Injector);
  private readonly changeDetector: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private ledger: HeightLedger = new HeightLedger([], new Map(), Resources.messageHeightEstimate);
  private observer: ResizeObserver | null = null;
  private readonly observed: Set<HTMLElement> = new Set();
  private lastTop: number = 0;
  private lastGap: number = 0;
  private conversationId: string | null = null;
  private isNavigating: boolean = false;

  public constructor() {
    effect(() => {
      const entries = this.store.messageIndex();
      this.store.messages();
      const conversationId = this.store.selectedConversationId();
      untracked(() => this.onMessages(entries, conversationId));
    });
    effect(() => {
      const messageId = this.store.focusMessageId();
      if (Object.isNull(messageId) || !this.store.messages().some(t => t.id === messageId))
        return;
      untracked(() => this.store.focusMessage(null));
      this.isAway.set(true);
      this.isNavigating = true;
      queueMicrotask(() => this.scrollToMessage(messageId));
    });
    effect(() => {
      const position = this.store.pendingPosition();
      if (Object.isNull(position) || !this.store.messages().some(t => t.id === position.messageId))
        return;
      untracked(() => this.store.consumePosition());
      this.isAway.set(true);
      this.isNavigating = true;
      queueMicrotask(() => this.scrollToPosition(position));
    });
    afterNextRender(() => {
      this.observer = MessageListComponent.createObserver(entries => this.onMeasured(entries));
      this.destroyRef.onDestroy(() => this.observer?.disconnect());
      this.observer?.observe(this.scroller().nativeElement);
      this.observeCards();
    });
    afterRenderEffect(() => {
      this.shown();
      this.store.messages();
      this.store.loadingPage();
      this.store.error();
      untracked(() => {
        this.observeCards();
        this.ensureLoadedRange();
      });
    });
  }

  private static createObserver(onMeasured: (entries: readonly ResizeObserverEntry[]) => void): ResizeObserver | null {
    if (typeof ResizeObserver === "undefined")
      return null;
    return new ResizeObserver(onMeasured);
  }

  private observeCards(): void {
    if (Object.isNull(this.observer))
      return;
    const cards = new Set(this.content().nativeElement.querySelectorAll<HTMLElement>(Resources.messageCardSelector));
    for (const element of this.observed)
      if (!cards.has(element)) {
        this.observer.unobserve(element);
        this.observed.delete(element);
      }
    for (const element of cards)
      if (!this.observed.has(element)) {
        this.observer.observe(element);
        this.observed.add(element);
      }
  }

  private onMessages(entries: readonly MessageIndexEntry[], conversationId: string | null): void {
    const element = this.scroller().nativeElement;
    if (conversationId !== this.conversationId) {
      this.conversationId = conversationId;
      this.isAway.set(false);
      this.lastGap = 0;
      this.ledger = new HeightLedger([], new Map(), Resources.messageHeightEstimate);
    }
    const desired = this.rebuildLedger(entries, element.scrollTop);
    if (desired !== element.scrollTop) {
      this.updateRange(desired);
      this.afterRender(() => this.setScrollTop(desired));
      return;
    }
    this.updateRange(element.scrollTop);
    if (!this.isAway())
      queueMicrotask(() => {
        if (!this.isAway() && Object.isNull(this.store.pendingPosition()))
          this.scrollToBottom();
      });
  }

  private rebuildLedger(entries: readonly MessageIndexEntry[], scrollTop: number): number {
    const anchor = this.ledger.count === 0 ? null : this.ledger.ids[this.ledger.indexAt(scrollTop)] ?? null;
    const distance = Object.isNull(anchor) ? null : scrollTop - (this.ledger.offsetOf(anchor) ?? 0);
    const measured = new Map(entries.filter(t => !Object.isNull(t.height)).map(t => [t.id, t.height ?? Resources.messageHeightEstimate]));
    this.ledger = new HeightLedger(entries.map(t => t.id), measured, Resources.messageHeightEstimate);
    const offset = Object.isNull(anchor) ? null : this.ledger.offsetOf(anchor);
    return Object.isNull(offset) || Object.isNull(distance) ? scrollTop : offset + distance;
  }

  private updateRange(scrollTop: number): boolean {
    const range = this.ledger.rangeFor(scrollTop, this.scroller().nativeElement.clientHeight, Resources.windowMargin);
    if (range.equals(this.range()) && this.height() === this.ledger.total)
      return false;
    this.height.set(this.ledger.total);
    this.range.set(range);
    return true;
  }

  private onMeasured(entries: readonly ResizeObserverEntry[]): void {
    if (this.destroyRef.destroyed)
      return;
    const element = this.scroller().nativeElement;
    const index = new Map(this.store.messageIndex().map(t => [t.id, t]));
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset[Resources.messageIdDataKey];
      const height = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      if (Object.isUndefined(id) || height === 0)
        continue;
      const known = index.get(id);
      if (!Object.isUndefined(known))
        known.height = height;
    }
    const anchored = this.rebuildLedger(this.store.messageIndex(), element.scrollTop);
    if (this.isAway()) {
      this.moveTo(anchored);
      return;
    }
    const changed = this.updateRange(Math.max(0, this.ledger.total - element.clientHeight - this.lastGap));
    if (changed)
      this.renderWindow();
    this.keepDistance();
  }

  private moveTo(desired: number): void {
    if (this.updateRange(desired))
      this.renderWindow();
    if (desired !== this.scroller().nativeElement.scrollTop)
      this.setScrollTop(desired);
  }

  private renderWindow(): void {
    const staying = new Set(this.shown().map(t => t.id));
    for (const element of this.observed)
      if (!staying.has(element.dataset[Resources.messageIdDataKey] ?? String.empty)) {
        this.observer?.unobserve(element);
        this.observed.delete(element);
      }
    this.changeDetector.detectChanges();
  }

  private keepDistance(): void {
    const element = this.scroller().nativeElement;
    const desired = Math.max(0, element.scrollHeight - element.clientHeight - this.lastGap);
    if (desired !== element.scrollTop)
      this.setScrollTop(desired);
  }

  protected onScroll(): void {
    const element = this.scroller().nativeElement;
    const gap = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (gap <= Resources.scrollAwayThreshold && !this.store.hasLaterMessages())
      this.isAway.set(false);
    else if (element.scrollTop < this.lastTop)
      this.isAway.set(true);
    if (element.scrollTop !== this.lastTop)
      this.lastGap = gap;
    this.lastTop = element.scrollTop;
    this.updateRange(element.scrollTop);
    this.rememberPosition(element.scrollTop);
    this.ensureLoadedRange();
  }

  private rememberPosition(scrollTop: number): void {
    const conversationId = this.store.selectedConversationId();
    if (Object.isNull(conversationId))
      return;
    const message = this.isAway() ? this.store.messageIndex()[this.ledger.indexAt(scrollTop)] : undefined;
    const offset = Object.isUndefined(message) ? null : this.ledger.offsetOf(message.id);
    if (Object.isUndefined(message) || Object.isNull(offset)) {
      this.store.rememberPosition(conversationId, null);
      return;
    }
    this.store.rememberPosition(conversationId, new ReadingPosition(message.id, message.sequence, scrollTop - offset));
  }

  private scrollToPosition(position: ReadingPosition): void {
    const offset = this.ledger.offsetOf(position.messageId);
    if (Object.isNull(offset)) {
      this.isNavigating = false;
      return;
    }
    const top = offset + position.distance;
    this.updateRange(top);
    this.afterRender(() => {
      this.setScrollTop(top);
      this.isAway.set(true);
      this.isNavigating = false;
    });
  }

  private scrollToMessage(messageId: string): void {
    const offset = this.ledger.offsetOf(messageId);
    if (Object.isNull(offset)) {
      this.isNavigating = false;
      return;
    }
    this.updateRange(offset);
    this.afterRender(() => {
      this.setScrollTop(offset);
      const card = this.content().nativeElement.querySelector<HTMLElement>(Resources.formatMessageSelector(messageId));
      if (!Object.isNull(card))
        MessageListComponent.highlight(card);
      this.isNavigating = false;
    });
  }

  private static highlight(card: HTMLElement): void {
    card.classList.add(Resources.flashClass);
    setTimeout(() => card.classList.remove(Resources.flashClass), Resources.flashDuration);
  }

  protected async scrollToBottom(): Promise<void> {
    if (this.isNavigating)
      return;
    this.isNavigating = true;
    const conversationId = this.conversationId;
    if (this.store.hasLaterMessages())
      await this.store.loadNewestMessages();
    if (this.destroyRef.destroyed || conversationId !== this.conversationId) {
      this.isNavigating = false;
      return;
    }
    this.scrollToEnd();
  }

  private scrollToEnd(): void {
    const element = this.scroller().nativeElement;
    this.updateRange(Math.max(0, this.ledger.total - element.clientHeight));
    this.afterRender(() => {
      this.setScrollTop(element.scrollHeight);
      this.isAway.set(false);
      this.lastGap = 0;
      this.isNavigating = false;
    });
  }

  private afterRender(callback: () => void): void {
    if (this.destroyRef.destroyed)
      return;
    afterNextRender(callback, { injector: this.injector });
  }

  private setScrollTop(top: number): void {
    const element = this.scroller().nativeElement;
    element.scrollTop = top;
    this.lastTop = element.scrollTop;
  }

  protected heightOf(id: string): number {
    return this.ledger.heightOf(id) ?? Resources.messageHeightEstimate;
  }

  private ensureLoadedRange(): void {
    if (this.destroyRef.destroyed || this.isNavigating || this.store.loadingPage() || !Object.isNull(this.store.pendingPosition()) || this.store.error())
      return;
    const element = this.scroller().nativeElement;
    const entries = this.store.messageIndex();
    const messages = this.messagesById();
    const atTop = this.ledger.indexAt(element.scrollTop);
    const atBottom = this.ledger.indexAt(element.scrollTop + element.clientHeight);
    const missing = entries.slice(atTop, atBottom + 1).find(t => !messages.has(t.id)) ?? this.shown().find(t => !messages.has(t.id));
    if (!Object.isUndefined(missing)) {
      const loaded = this.store.messages();
      const first = entries.findIndex(t => t.id === loaded[0]?.id);
      const last = entries.findIndex(t => t.id === loaded.at(-1)?.id);
      const target = entries.indexOf(missing);
      if (target < first && first - target <= Resources.messagePageSize)
        void this.store.loadEarlierMessages();
      else if (target > last && target - last <= Resources.messagePageSize)
        void this.store.loadLaterMessages();
      else
        void this.store.loadMessagesAt(missing.sequence);
      return;
    }
    if (element.clientHeight > 0 && element.scrollTop < Resources.loadPageThreshold)
      void this.store.loadEarlierMessages();
    else if (element.clientHeight > 0 && element.scrollHeight - element.scrollTop - element.clientHeight <= Resources.loadPageThreshold)
      void this.store.loadLaterMessages();
  }
}
