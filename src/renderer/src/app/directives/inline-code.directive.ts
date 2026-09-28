/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Directive, ElementRef, afterNextRender, afterRenderEffect, inject, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { Lexer, type Token } from "marked";

import { Resources } from "../resources";

@Directive({ selector: "textarea[trInlineCode]", host: { "(input)": "render()", "(scroll)": "syncScroll()" } })
export class InlineCodeDirective {
  private readonly box = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;
  private readonly backdrop = this.box.ownerDocument.createElement(Resources.composerBackdropTag);
  private observer: ResizeObserver | null = null;
  private previousText: string | null = null;

  public readonly value = input.required<string>({ alias: "trInlineCode" });

  public constructor() {
    this.backdrop.className = Resources.composerBackdropClass;
    this.backdrop.ariaHidden = String(true);
    afterNextRender(() => {
      this.box.before(this.backdrop);
      if (typeof ResizeObserver !== "undefined") {
        this.observer = new ResizeObserver(() => this.syncScroll());
        this.observer.observe(this.box);
      }
      this.render(this.value());
    });
    afterRenderEffect(() => this.render(this.value()));
    inject(DestroyRef).onDestroy(() => {
      this.observer?.disconnect();
      this.backdrop.remove();
    });
  }

  protected render(text: string = this.box.value): void {
    if (text !== this.previousText) {
      this.previousText = text;
      const content = this.box.ownerDocument.createDocumentFragment();
      this.append(content, text, Lexer.lex(text));
      content.append(Resources.composerLineEnd);
      this.backdrop.replaceChildren(content);
    }
    this.syncScroll();
  }

  protected syncScroll(): void {
    this.backdrop.style.width = `${this.box.clientWidth}px`;
    this.backdrop.style.height = `${this.box.clientHeight}px`;
    this.backdrop.scrollTop = this.box.scrollTop;
    this.backdrop.scrollLeft = this.box.scrollLeft;
  }

  private append(parent: Node, text: string, tokens: readonly Token[]): void {
    let position = 0;
    for (const token of tokens) {
      const source = [token.raw, token.raw.trimEnd()].find(t => t.length > 0 && text.includes(t, position));
      if (Object.isUndefined(source))
        continue;
      const start = text.indexOf(source, position);
      this.appendText(parent, text.slice(position, start));
      if (token.type === Resources.markdownCodeSpanType) {
        let delimiter = 0;
        while (source[delimiter] === Resources.markdownBacktick)
          delimiter += 1;
        const code = this.box.ownerDocument.createElement(Resources.composerCodeTag);
        code.className = Resources.composerCodeClass;
        this.appendDelimiter(code, source.slice(0, delimiter));
        this.appendText(code, source.slice(delimiter, -delimiter));
        this.appendDelimiter(code, source.slice(-delimiter));
        parent.appendChild(code);
      } else if ("tokens" in token && !Object.isUndefined(token.tokens))
        this.append(parent, source, token.tokens);
      else if (token.type === Resources.markdownListType && "items" in token)
        this.append(parent, source, token.items);
      else if (token.type === Resources.markdownTableType)
        this.append(parent, source, Lexer.lexInline(source));
      else
        this.appendText(parent, source);
      position = start + source.length;
    }
    this.appendText(parent, text.slice(position));
  }

  private appendText(parent: Node, text: string): void {
    parent.appendChild(this.box.ownerDocument.createTextNode(text));
  }

  private appendDelimiter(parent: Node, text: string): void {
    const delimiter = this.box.ownerDocument.createElement(Resources.composerCodeTag);
    delimiter.className = Resources.composerDelimiterClass;
    delimiter.textContent = text;
    parent.appendChild(delimiter);
  }
}
