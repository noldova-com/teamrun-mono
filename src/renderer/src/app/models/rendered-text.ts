/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";
import { GraphemeText } from "./grapheme-text";

export class RenderedText {
  private static readonly originals: WeakMap<Text, GraphemeText> = new WeakMap();
  private readonly root: Node;
  private left: number = 0;
  private offset: number = 0;

  public constructor(root: Node) {
    this.root = root;
  }

  public get count(): number {
    return this.countIn(this.root);
  }

  public static of(html: string): RenderedText {
    const template = document.createElement("template");
    template.innerHTML = html;

    return new RenderedText(template.content);
  }

  public show(count: number): void {
    this.left = count;
    this.visit(this.root);
  }

  public showAll(): void {
    this.show(Number.POSITIVE_INFINITY);
  }

  public ranges(start: number, end: number): Range[] {
    const ranges: Range[] = [];
    this.offset = 0;
    this.collect(this.root, start, end, ranges);

    return ranges;
  }

  private countIn(node: Node): number {
    let total = 0;
    for (const child of node.childNodes)
      if (child instanceof Text)
        total += RenderedText.isLayout(child) ? 0 : RenderedText.originalOf(child).count;
      else if (child instanceof HTMLElement && !child.classList.contains(Resources.codeHeaderClass))
        total += this.countIn(child);

    return total;
  }

  private visit(node: Node): void {
    for (const child of node.childNodes)
      if (child instanceof Text)
        this.showText(child);
      else if (child instanceof HTMLElement && !child.classList.contains(Resources.codeHeaderClass))
        this.showElement(child);
  }

  private showText(node: Text): void {
    if (RenderedText.isLayout(node))
      return;

    const original = RenderedText.originalOf(node);
    const shown = Math.min(this.left, original.count);
    this.left -= shown;
    const data = original.prefix(shown);
    if (node.data !== data)
      node.data = data;
  }

  private showElement(element: HTMLElement): void {
    const hide = this.left <= 0;
    if (element.hidden !== hide)
      element.hidden = hide;
    if (!hide)
      this.visit(element);
  }

  private collect(node: Node, start: number, end: number, ranges: Range[]): void {
    for (const child of node.childNodes) {
      if (this.offset >= end)
        return;
      if (child instanceof Text && !RenderedText.isLayout(child)) {
        const original = RenderedText.originalOf(child);
        const from = Math.max(start - this.offset, 0);
        const to = Math.min(end - this.offset, original.count);
        if (from < to) {
          const range = document.createRange();
          range.setStart(child, Math.min(original.prefix(from).length, child.length));
          range.setEnd(child, Math.min(original.prefix(to).length, child.length));
          ranges.push(range);
        }
        this.offset += original.count;
      }
      else if (child instanceof HTMLElement && !child.classList.contains(Resources.codeHeaderClass))
        this.collect(child, start, end, ranges);
    }
  }

  private static originalOf(node: Text): GraphemeText {
    let original = RenderedText.originals.get(node);
    if (Object.isUndefined(original)) {
      original = new GraphemeText(node.data);
      RenderedText.originals.set(node, original);
    }

    return original;
  }

  private static isLayout(node: Text): boolean {
    return Resources.layoutWhitespacePattern.test(RenderedText.originalOf(node).text)
      && Object.isNullOrUndefined(node.parentElement?.closest(Resources.preformattedSelector));
  }
}
