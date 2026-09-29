/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import hljs from "highlight.js/lib/common";
import { Marked, Renderer, type Token, type Tokens } from "marked";
import { MentionResolver, type TeammateMention } from "@noldova/teamrun-protocol";

import { Resources } from "../resources";
import { MarkdownBlock } from "./markdown-block";
import { RenderedText } from "./rendered-text";

export class MarkdownBlocks {
  private static readonly plain: Marked = new Marked({ gfm: true, breaks: true, renderer: MarkdownBlocks.createRenderer([], []) });
  private readonly marked: Marked;
  private rendered: ReadonlyMap<string, MarkdownBlock> = new Map();

  public constructor(mentions: readonly TeammateMention[] = [], unavailable: readonly string[] = []) {
    this.marked = mentions.length === 0 ? MarkdownBlocks.plain
      : new Marked({ gfm: true, breaks: true, renderer: MarkdownBlocks.createRenderer(mentions, unavailable) });
  }

  public render(text: string): readonly MarkdownBlock[] {
    const tokens = this.marked.lexer(text);
    const reusable = Object.keys(tokens.links).length === 0 ? this.rendered : new Map<string, MarkdownBlock>();
    const next = new Map<string, MarkdownBlock>();
    const blocks: MarkdownBlock[] = [];
    for (const token of tokens) {
      if (token.type === "space")
        continue;
      const block = next.get(token.raw) ?? reusable.get(token.raw) ?? this.create(token);
      next.set(token.raw, block);
      blocks.push(block);
    }
    this.rendered = next;

    return blocks;
  }

  private create(token: Token): MarkdownBlock {
    const html = this.marked.parser([token]);

    return new MarkdownBlock(html, RenderedText.of(html).count);
  }

  private static createRenderer(mentions: readonly TeammateMention[], unavailable: readonly string[]): Renderer {
    const renderer = new Renderer();
    const plainText = renderer.text;
    renderer.text = function(token): string {
      if ("tokens" in token && token.tokens)
        return plainText.call(this, token);
      const spans = MentionResolver.find(token.text, mentions);
      const parts: string[] = [];
      let offset = 0;
      for (const span of spans) {
        parts.push(plainText.call(this, { ...token, text: token.text.slice(offset, span.start) }));
        const label = plainText.call(this, { ...token, text: token.text.slice(span.start, span.end) });
        parts.push(Resources.formatMentionHtml(label, unavailable.includes(span.mention.teammateId)));
        offset = span.end;
      }
      parts.push(plainText.call(this, { ...token, text: token.text.slice(offset) }));
      return parts.join(String.empty);
    };
    const plainCode = renderer.code.bind(renderer);
    renderer.code = (token: Tokens.Code): string => {
      const lang = token.lang ?? String.empty;
      const language = String.isNullOrWhitespace(lang) ? Resources.codeLabel : lang.split(Resources.space)[0] ?? Resources.codeLabel;
      const known = hljs.getLanguage(language);
      const inner = Object.isUndefined(known) ? plainCode(token) : Resources.formatHighlightedCode(language, hljs.highlight(token.text, { language }).value);
      return Resources.formatCodeBlock(language, inner);
    };

    return renderer;
  }
}
