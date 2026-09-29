/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MarkdownTail } from "../../../src/app/models/markdown-tail";

describe("MarkdownTail", () => {
  const settled = (text: string): string => new MarkdownTail(text).settled;
  const unchanged = (...texts: string[]): void => texts.forEach(t => expect(settled(t)).toBe(t));

  it("keeps text whose formatting is complete", () => {
    unchanged("", "Plain words", "Hello **bold** and *it* and `code` and [link](http://x.y/a_b_c) done", "**bold *it* end**", "~~strike~~ text",
      "5 * 3 = 15 and a * b", "snake_case_name and __init__", "~5 minutes", "``a ` b`` fine", "array[0] and [x] task", "Done **bold\n\nNext paragraph");
  });

  it("waits for an emphasis that is still open", () => {
    expect(settled("Hello **bo")).toBe("Hello ");
    expect(settled("Hello *it")).toBe("Hello ");
    expect(settled("a _b")).toBe("a ");
    expect(settled("_it")).toBe("");
    expect(settled("~~str")).toBe("");
    expect(settled("**bold** and **b")).toBe("**bold** and ");
    expect(settled("**bold *it")).toBe("");
    expect(settled("Say **")).toBe("Say ");
  });

  it("does not take a shorter closing run for the end of a longer one", () => {
    expect(settled("Say **bold*")).toBe("Say ");
    expect(settled("Say **bold**")).toBe("Say **bold**");
  });

  it("waits for code and links that are still open", () => {
    expect(settled("Use `co")).toBe("Use ");
    expect(settled("Use ``a ` b")).toBe("Use ");
    expect(settled("See [the docs")).toBe("See ");
    expect(settled("See [the docs]")).toBe("See ");
    expect(settled("See [the docs](http://ex")).toBe("See ");
    expect(settled("See ![the picture](")).toBe("See ");
    expect(settled("See [the docs](http://ex.com) and [x")).toBe("See [the docs](http://ex.com) and ");
    expect(settled("a\\")).toBe("a");
    expect(settled("a\\*b")).toBe("a\\*b");
  });

  it("waits for a code fence's opening line and for its closing line to be complete", () => {
    unchanged("Intro\n\n```ts\nlet a", "```\na\n\nb", "```\ncode\n```", "~~~\ncode\n~~~\nDone");
    expect(settled("Intro\n\n```ts")).toBe("Intro\n\n");
    expect(settled("```")).toBe("");
    expect(settled("Intro\n```ts\nlet a = 1;\n``")).toBe("Intro\n```ts\nlet a = 1;\n");
    expect(settled("```\ncode\n```\n\nAfter **b")).toBe("```\ncode\n```\n\nAfter ");
    expect(settled("~~~\ncode `x\n~~~\nDone")).toBe("~~~\ncode `x\n~~~\nDone");
  });

  it("waits for a block marker that has no content yet", () => {
    expect(settled("Text\n\n-")).toBe("Text\n\n");
    expect(settled("Text\n\n#")).toBe("Text\n\n");
    expect(settled("Text\n\n12.")).toBe("Text\n\n");
    expect(settled("Text\n\n>")).toBe("Text\n\n");
    unchanged("Text\n\n- ", "Text\n\n- item", "Text\n\n## Title", "Text\n\n1. one");
  });

  it("waits for a table until its header is followed by a matching delimiter row", () => {
    expect(settled("| a | b |")).toBe("");
    expect(settled("| a | b |\n")).toBe("");
    expect(settled("| a | b |\n|---")).toBe("");
    expect(settled("Intro\n\n| a | b |\n|-")).toBe("Intro\n\n");
    unchanged("| a | b |\n|---|---|", "| a | b |\n|---|---|\n| 1 |", "| a | b |\n| :-- | --: |\n| 1 | 2 |", "a | b");
  });

  it("does not hold back a construct that has stayed open for too long", () => {
    unchanged("*" + "x".repeat(400));
    expect(settled("*" + "x".repeat(100))).toBe("");
  });
});
