/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, type OnInit, type WritableSignal, effect, inject, input, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

import "@noldova/teamrun-foundation-core";
import { DetailKind, MessageDetail } from "@noldova/teamrun-protocol";

import type { ActivityEntry } from "../../models/activity-entry";
import { GraphemeText } from "../../models/grapheme-text";
import { ReplyExpansion } from "../../models/reply-expansion";
import { TextReveal } from "../../models/text-reveal";
import { Resources } from "../../resources";
import { Formatter } from "../../services/formatter.service";
import { MotionPreference } from "../../services/motion-preference.service";

@Component({
  selector: "tr-activity-block",
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block py-2" },
  templateUrl: "./activity-block.component.html"
})
export class ActivityBlockComponent implements OnInit {
  private readonly motion: MotionPreference = inject(MotionPreference);
  private readonly changeDetector: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly reveals: Map<number, TextReveal> = new Map();
  private readonly texts: Map<number, GraphemeText> = new Map();
  private readonly frame: WritableSignal<number> = signal(0);
  private initial: ReadonlySet<number> = new Set();

  public readonly entries = input.required<readonly ActivityEntry[]>();
  public readonly label = input.required<string>();
  public readonly rootPath = input<string | null>(null);
  public readonly expansion = input(new ReplyExpansion());
  public readonly beforeExpand = input<(() => Promise<boolean>) | null>(null);
  public readonly streaming = input(false);
  public readonly entering = input(false);
  public readonly growing = input(false);

  protected readonly resources: typeof Resources = Resources;
  protected readonly formatter: Formatter = inject(Formatter);
  protected readonly commandKind: DetailKind = DetailKind.Command;
  protected readonly reasoningKind: DetailKind = DetailKind.Reasoning;

  public constructor() {
    effect(() => this.follow(this.entries(), this.streaming(), !this.motion.reduced()));
    inject(DestroyRef).onDestroy(() => this.reveals.forEach(t => t.dispose()));
  }

  public ngOnInit(): void {
    this.initial = this.entering() ? new Set() : new Set(this.entries().map(t => t.detail.sequence));
  }

  protected shown(entry: ActivityEntry): MessageDetail {
    this.frame();
    const detail = entry.detail;
    const reveal = this.reveals.get(detail.sequence);
    const text = this.texts.get(detail.sequence);
    if (Object.isUndefined(reveal) || Object.isUndefined(text) || reveal.count >= text.count)
      return detail;

    return new MessageDetail(detail.sequence, detail.kind, text.prefix(reveal.count), detail.payload, detail.createdAt);
  }

  protected titleOf(entry: ActivityEntry): string {
    const shown = this.shown(entry);
    if (shown.kind === DetailKind.Reasoning && this.growing() && !this.isOpen(entry) && entry === this.entries().at(-1))
      return this.formatter.latestThought(shown);

    return this.formatter.title(shown, this.rootPath());
  }

  protected isOpen(entry: ActivityEntry): boolean {
    return this.expansion().activity().has(entry.detail.sequence);
  }

  protected async toggle(entry: ActivityEntry): Promise<void> {
    const load = this.beforeExpand();
    if (!this.isOpen(entry) && !Object.isNull(load) && !await load())
      return;
    this.expansion().activity.update(current => ActivityBlockComponent.toggled(current, entry.detail.sequence));
  }

  protected bodyOf(entry: ActivityEntry): string | null {
    const own = this.formatter.body(this.shown(entry));
    const result = Object.isNull(entry.result) ? null : entry.result.text;
    if (Object.isNull(own))
      return result;

    return Object.isNull(result) ? own : `${own}${Resources.lineSeparator}${result}`;
  }

  protected isError(entry: ActivityEntry): boolean {
    return entry.detail.kind === DetailKind.Error || (!Object.isNull(entry.result) && this.formatter.isErrorResult(entry.result));
  }

  protected preview(body: string): string {
    return body.split(Resources.lineSeparator).slice(0, Resources.previewLineCount).join(Resources.lineSeparator);
  }

  protected hasMore(body: string): boolean {
    return body.split(Resources.lineSeparator).length> Resources.previewLineCount;
  }

  protected isExpanded(entry: ActivityEntry): boolean {
    return this.expansion().activityBodies().has(entry.detail.sequence);
  }

  protected expand(entry: ActivityEntry): void {
    this.expansion().activityBodies.update(current => ActivityBlockComponent.toggled(current, entry.detail.sequence));
  }

  private follow(entries: readonly ActivityEntry[], streaming: boolean, motionAllowed: boolean): void {
    const current = new Set<number>();
    for (const entry of entries) {
      const detail = entry.detail;
      if (detail.kind !== DetailKind.Reasoning)
        continue;
      current.add(detail.sequence);
      const known = this.texts.get(detail.sequence);
      const text = known?.text === detail.text ? known : new GraphemeText(detail.text);
      this.texts.set(detail.sequence, text);
      let reveal = this.reveals.get(detail.sequence);
      if (Object.isUndefined(reveal)) {
        reveal = new TextReveal(streaming && !this.initial.has(detail.sequence) ? 0 : text.count, () => this.advance());
        this.reveals.set(detail.sequence, reveal);
      }
      reveal.follow(text.count, !streaming, motionAllowed && (streaming || reveal.count < text.count));
    }
    for (const [sequence, reveal] of this.reveals)
      if (!current.has(sequence)) {
        reveal.dispose();
        this.reveals.delete(sequence);
        this.texts.delete(sequence);
      }
    this.frame.update(t => t + 1);
  }

  private advance(): void {
    this.frame.update(t => t + 1);
    this.changeDetector.detectChanges();
  }

  private static toggled(current: ReadonlySet<number>, sequence: number): ReadonlySet<number> {
    const next = new Set(current);
    if (!next.delete(sequence))
      next.add(sequence);
    return next;
  }
}
