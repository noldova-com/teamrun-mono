/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, type Signal, type WritableSignal, afterRenderEffect, computed, inject,
  input, output, signal, viewChildren
} from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { TeammateMention } from "@noldova/teamrun-protocol";

import type { FadeSpan } from "../../models/fade-span";
import type { MarkdownBlock } from "../../models/markdown-block";
import { MarkdownBlocks } from "../../models/markdown-blocks";
import { MarkdownTail } from "../../models/markdown-tail";
import { RenderedText } from "../../models/rendered-text";
import { RevealFade } from "../../models/reveal-fade";
import { TextReveal } from "../../models/text-reveal";
import { Resources } from "../../resources";
import { MotionPreference } from "../../services/motion-preference.service";
import { RevealHighlights } from "../../services/reveal-highlights.service";

@Component({
  selector: "tr-markdown",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tr-markdown block", "(click)": "onClick($event)", "(keydown.enter)": "onClick($event)", "(keydown.space)": "onClick($event)" },
  templateUrl: "./markdown.component.html"
})
export class MarkdownComponent {
  private readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly motion: MotionPreference = inject(MotionPreference);
  private readonly changeDetector: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly wrapped: Set<number> = new Set();
  private readonly wrappers = viewChildren<ElementRef<HTMLElement>>("block");
  private readonly shown: WritableSignal<number> = signal(Number.POSITIVE_INFINITY);
  private readonly appliedHtml: string[] = [];
  private readonly appliedCount: number[] = [];
  private readonly highlights: RevealHighlights = inject(RevealHighlights);
  private readonly painted: [Highlight, Range][] = [];
  private reveal: TextReveal | null = null;
  private fade: RevealFade | null = null;
  private limit: number = Number.POSITIVE_INFINITY;

  public readonly text = input.required<string>();
  public readonly mentions = input<readonly TeammateMention[]>([]);
  public readonly unavailableMentions = input<readonly string[]>([]);
  public readonly wrapChoices = input<Set<number> | null>(null);
  public readonly streaming = input(false);
  public readonly entering = input(false);
  public readonly wrapChanged = output<void>();

  private readonly document: Signal<MarkdownBlocks> = computed(() => new MarkdownBlocks(this.mentions(), this.unavailableMentions()));
  private readonly settled: Signal<string> = computed(() => this.streaming() ? new MarkdownTail(this.text()).settled : this.text());
  private readonly blocks: Signal<readonly MarkdownBlock[]> = computed(() => this.document().render(this.settled()));
  protected readonly visibleBlocks: Signal<readonly MarkdownBlock[]> = computed(() => MarkdownComponent.visible(this.blocks(), this.shown()),
    { equal: (a, b) => a.length === b.length && a.every((t, index) => t === b[index]) });
  private readonly copied: Map<Element, number> = new Map();

  public constructor() {
    afterRenderEffect(() => this.follow(this.blocks(), this.streaming(), !this.motion.reduced()));
    afterRenderEffect(() => {
      this.visibleBlocks();
      this.applyReveal();
      const wrapped = this.wrapChoices() ?? this.wrapped;
      this.element.querySelectorAll<HTMLElement>(Resources.wrapButtonSelector).forEach((button, index) => this.applyWrapping(button, wrapped.has(index)));
    });
    inject(DestroyRef).onDestroy(() => {
      this.reveal?.dispose();
      this.fade?.clear();
      for (const timer of this.copied.values())
        window.clearTimeout(timer);
    });
  }

  protected onClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element))
      return;
    const wrap = target.closest<HTMLElement>(Resources.wrapButtonSelector);
    if (!Object.isNull(wrap)) {
      event.preventDefault();
      const index = Array.from(this.element.querySelectorAll(Resources.wrapButtonSelector)).indexOf(wrap);
      const wrapped = this.wrapChoices() ?? this.wrapped;
      if (!wrapped.delete(index))
        wrapped.add(index);
      this.applyWrapping(wrap, wrapped.has(index));
      this.wrapChanged.emit();
      return;
    }
    const button = target.closest<HTMLElement>(Resources.copyButtonSelector);
    if (Object.isNull(button))
      return;
    const code = button.closest(Resources.codeBlockSelector)?.querySelector(Resources.codeSelector);
    if (Object.isNull(code) || Object.isUndefined(code))
      return;

    event.preventDefault();
    void navigator.clipboard?.writeText(code.textContent ?? String.empty);
    this.showCopied(button);
  }

  private follow(blocks: readonly MarkdownBlock[], streaming: boolean, motionAllowed: boolean): void {
    const available = blocks.reduce((sum, t) => sum + t.count, 0);
    this.reveal ??= new TextReveal(streaming && this.entering() ? 0 : available, count => this.advance(count));
    const animate = motionAllowed && (streaming || this.reveal.count < available);
    this.reveal.follow(available, !streaming, animate);
    this.setLimit(animate ? this.reveal.count : Number.POSITIVE_INFINITY);
    if (animate && this.highlights.isSupported)
      this.fade ??= new RevealFade(this.reveal.count, spans => this.paintFade(spans));
    else if (!motionAllowed)
      this.fade?.clear();
  }

  private advance(count: number): void {
    this.setLimit(count);
    this.changeDetector.detectChanges();
    this.applyReveal();
    this.fade?.note(count);
  }

  private paintFade(spans: readonly FadeSpan[]): void {
    const blocks = this.visibleBlocks();
    const wrappers = this.wrappers();
    const ranges: [Range, number][] = [];
    let offset = 0;
    blocks.forEach((block, index) => {
      const wrapper = wrappers[index]?.nativeElement;
      const start = offset;
      offset += block.count;
      if (Object.isUndefined(wrapper))
        return;
      for (const span of spans)
        if (span.start < offset && span.end > start)
          for (const range of new RenderedText(wrapper).ranges(span.start - start, span.end - start))
            ranges.push([range, span.step]);
    });
    this.highlights.paint(this.painted, ranges);
  }

  private setLimit(limit: number): void {
    this.limit = limit;
    this.shown.set(limit);
  }

  private applyReveal(): void {
    const blocks = this.visibleBlocks();
    const wrappers = this.wrappers();
    this.appliedHtml.length = blocks.length;
    this.appliedCount.length = blocks.length;
    let offset = 0;
    blocks.forEach((block, index) => {
      const wrapper = wrappers[index]?.nativeElement;
      if (!Object.isUndefined(wrapper))
        this.applyBlock(wrapper, block, index, this.limit - offset);
      offset += block.count;
    });
  }

  private applyBlock(wrapper: HTMLElement, block: MarkdownBlock, index: number, remaining: number): void {
    if (this.appliedHtml[index] !== block.html) {
      this.appliedHtml[index] = block.html;
      this.appliedCount[index] = block.count;
    }
    const wanted = Math.min(Math.max(remaining, 0), block.count);
    if (this.appliedCount[index] === wanted)
      return;

    this.appliedCount[index] = wanted;
    const text = new RenderedText(wrapper);
    if (wanted >= block.count)
      text.showAll();
    else
      text.show(wanted);
  }

  private applyWrapping(button: HTMLElement, wrapped: boolean): void {
    const pre = button.closest(Resources.codeBlockSelector)?.querySelector(Resources.codeSelector)?.parentElement;
    pre?.classList.toggle(Resources.wrappedClass, wrapped);
    button.ariaPressed = String(wrapped);
    button.title = wrapped ? Resources.disableWordWrapLabel : Resources.enableWordWrapLabel;
  }

  private showCopied(button: HTMLElement): void {
    const previous = this.copied.get(button);
    if (!Object.isUndefined(previous))
      window.clearTimeout(previous);
    button.classList.add(Resources.copiedClass);
    button.textContent = Resources.copiedIcon;
    button.title = Resources.copiedLabel;
    button.ariaLabel = Resources.copiedLabel;
    this.copied.set(button, window.setTimeout(() => {
      button.classList.remove(Resources.copiedClass);
      button.textContent = Resources.copyIcon;
      button.title = Resources.copyLabel;
      button.ariaLabel = Resources.copyLabel;
      this.copied.delete(button);
    }, Resources.copiedDuration));
  }

  private static visible(blocks: readonly MarkdownBlock[], shown: number): readonly MarkdownBlock[] {
    let offset = 0;
    let visible = 0;
    for (const block of blocks) {
      if (offset > shown || (offset === shown && block.count > 0))
        break;
      visible++;
      offset += block.count;
    }

    return blocks.slice(0, visible);
  }
}
