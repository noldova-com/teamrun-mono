/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TeammateMention } from "@noldova/teamrun-protocol";

import { MarkdownBlocks } from "../../../src/app/models/markdown-blocks";

describe("MarkdownBlocks", () => {
  it("renders each top-level block on its own, with the number of characters it shows", () => {
    const blocks = new MarkdownBlocks().render("Hello **world**\n\n\n\n- one\n- two\n\n```ts\nlet a = 1;\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |");

    expect(blocks).toHaveLength(4);
    expect(blocks[0]?.html).toContain("<strong>world</strong>");
    expect(blocks[0]?.count).toBe("Hello world".length);
    expect(blocks[1]?.html).toContain("<li>one</li>");
    expect(blocks[1]?.count).toBe("onetwo".length);
    expect(blocks[2]?.html).toContain("hljs-keyword");
    expect(blocks[2]?.count).toBe("let a = 1;\n".length);
    expect(blocks[3]?.html).toContain("<table>");
    expect(blocks[3]?.count).toBe("ab12".length);
  });

  it("returns nothing for empty text", () => {
    expect(new MarkdownBlocks().render(String.empty)).toHaveLength(0);
  });

  it("keeps a finished block as it was while the text after it grows", () => {
    const blocks = new MarkdownBlocks();
    const first = blocks.render("Intro\n\n```ts\nlet a = 1;\n```\n\nMore");
    const grown = blocks.render("Intro\n\n```ts\nlet a = 1;\n```\n\nMore text");

    expect(grown[0]).toBe(first[0]);
    expect(grown[1]).toBe(first[1]);
    expect(grown[2]).not.toBe(first[2]);
    expect(grown[2]?.html).toContain("More text");
  });

  it("renders again when a reference link defined later changes an earlier block", () => {
    const blocks = new MarkdownBlocks();
    const before = blocks.render("See [docs][x]\n\nEnd");
    const after = blocks.render("See [docs][x]\n\nEnd\n\n[x]: https://example.com");

    expect(before[0]?.html).not.toContain("<a ");
    expect(after[0]?.html).toContain("<a href=\"https://example.com\"");
    expect(after[0]).not.toBe(before[0]);
  });

  it("highlights teammate mentions outside code and marks unavailable teammates", () => {
    const blocks = new MarkdownBlocks([new TeammateMention("a", "Alice"), new TeammateMention("b", "Bob")], ["b"]);
    const rendered = blocks.render("Ask @Alice and @Bob, `@Alice` is code.\n\n```\n@Alice\n```");

    expect(rendered[0]?.html.match(/tr-mention/g)?.length).toBeGreaterThanOrEqual(2);
    expect(rendered[0]?.html).toContain("tr-teammate-unavailable");
    expect(rendered[0]?.html).toContain("<code>@Alice</code>");
    expect(rendered[1]?.html).not.toContain("tr-mention");
  });
});
