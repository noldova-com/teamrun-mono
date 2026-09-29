/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RenderedText } from "../../../src/app/models/rendered-text";

describe("RenderedText", () => {
  const rendered = (html: string): { root: HTMLElement; text: RenderedText } => {
    const root = document.createElement("div");
    root.innerHTML = html;
    return { root, text: new RenderedText(root) };
  };
  const visible = (node: Node): string => Array.from(node.childNodes)
    .map(t => t instanceof Text ? t.data : t instanceof HTMLElement && !t.hidden ? visible(t) : String.empty).join(String.empty);

  it("counts the characters a reader sees, without markup, layout newlines or the code header", () => {
    const { text } = rendered("<p>Hello <strong>world</strong></p>\n<ul>\n<li>one</li>\n</ul>\n<div class=\"tr-code\"><div class=\"tr-code-header\"><span>typescript</span></div>"
      + "<pre><code><span>a</span>\nb</code></pre></div>");

    expect(text.count).toBe("Hello world".length + "one".length + "a\nb".length);
    expect(RenderedText.of("<p>x</p>\n<p>yz</p>").count).toBe(3);
  });

  it("shows the first characters and hides what comes after", () => {
    const { root, text } = rendered("<p>Hello <strong>world</strong> again</p><p>Second</p>");

    text.show(8);
    expect(visible(root)).toBe("Hello wo");
    expect(root.querySelectorAll("p")[1]?.hidden).toBe(true);

    text.show(0);
    expect(visible(root)).toBe("");

    text.show(17);
    expect(visible(root)).toBe("Hello world again");
    expect(root.querySelectorAll("p")[1]?.hidden).toBe(true);

    text.show(18);
    expect(visible(root)).toBe("Hello world againS");
    expect(root.querySelectorAll("p")[1]?.hidden).toBe(false);
  });

  it("keeps an element hidden until its first character is reached", () => {
    const { root, text } = rendered("<p>a<em>b</em></p>");

    text.show(1);
    expect(root.querySelector("em")?.hidden).toBe(true);

    text.show(2);
    expect(root.querySelector("em")?.hidden).toBe(false);
    expect(visible(root)).toBe("ab");
  });

  it("moves by whole characters", () => {
    const { root, text } = rendered("<p>a👍🏽b́c</p>");

    text.show(2);
    expect(visible(root)).toBe("a👍🏽");

    text.show(3);
    expect(visible(root)).toBe("a👍🏽b́");
  });

  it("restores everything when all of it is shown, including trailing elements without text", () => {
    const { root, text } = rendered("<p>one<br></p><hr><p>two</p>");

    text.show(2);
    expect(visible(root)).toBe("on");
    expect(root.querySelector("br")?.hidden).toBe(true);

    text.showAll();
    expect(visible(root)).toBe("onetwo");
    expect(Array.from(root.querySelectorAll("*")).every(t => !(t as HTMLElement).hidden)).toBe(true);
  });

  it("can move backwards and forwards again", () => {
    const { root, text } = rendered("<p>abcdef</p>");

    text.show(5);
    text.show(2);
    expect(visible(root)).toBe("ab");
    text.show(4);
    expect(visible(root)).toBe("abcd");
  });

  it("shows a code block's header with the block and reveals its lines one by one", () => {
    const { root, text } = rendered("<p>Intro</p><div class=\"tr-code\"><div class=\"tr-code-header\"><span>typescript</span></div>"
      + "<pre><code><span>let</span>\n<span>x</span>\n</code></pre></div>");
    const block = root.querySelector<HTMLElement>(".tr-code")!;

    text.show(5);
    expect(block.hidden).toBe(true);

    text.show(6);
    expect(block.hidden).toBe(false);
    expect(block.querySelector(".tr-code-header")?.textContent).toBe("typescript");
    expect(visible(block.querySelector("pre")!)).toBe("l");

    text.show(9);
    expect(visible(block.querySelector("pre")!)).toBe("let\n");
    expect(block.querySelectorAll("span")[2]?.hidden).toBe(true);

    text.showAll();
    expect(visible(block.querySelector("pre")!)).toBe("let\nx\n");
  });
});
