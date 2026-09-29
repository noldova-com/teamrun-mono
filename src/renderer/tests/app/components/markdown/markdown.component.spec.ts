/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { TeammateMention } from "@noldova/teamrun-protocol";

import { VisibleText } from "../../../fixtures/visible-text";
import { Resources } from "../../../../src/app/resources";
import { MarkdownComponent } from "../../../../src/app/components/markdown/markdown.component";

describe("MarkdownComponent", () => {
  it("highlights historical mentions outside code without making markup executable", () => {
    const fixture = TestBed.createComponent(MarkdownComponent);
    fixture.componentRef.setInput("mentions", [new TeammateMention("a", "Alice")]);
    fixture.componentRef.setInput("unavailableMentions", ["a"]);
    fixture.componentRef.setInput("text", "Ask @Alice and **@Alice**; \\@Alice is escaped, `@Alice` is code. <script>bad()</script>\n\n```\n@Alice\n```");
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll(".tr-mention")).toHaveLength(2);
    expect(root.querySelectorAll(".tr-mention-unavailable")).toHaveLength(0);
    expect(root.querySelectorAll(".tr-mention.tr-teammate-unavailable")).toHaveLength(2);
    expect(root.querySelector("code .tr-mention")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
  });
  it("wraps blocks independently, keeps wrapping through text updates, and copies the original lines", async () => {
    TestBed.configureTestingModule({ imports: [MarkdownComponent] });
    const fixture = TestBed.createComponent(MarkdownComponent);
    const original = "    const value = 'a long line with spaces';\n";
    const text = "```ts\n" + original + "```\n\n```text\nsecond\n```";
    fixture.componentRef.setInput("text", text);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = element.querySelectorAll<HTMLElement>(Resources.wrapButtonSelector);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    buttons[0]!.click();
    expect(element.querySelector("pre")?.classList.contains(Resources.wrappedClass)).toBe(true);
    expect(buttons[0]!.title).toBe(Resources.disableWordWrapLabel);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");

    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    buttons[1]!.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
    buttons[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");

    fixture.componentRef.setInput("text", text + "\n\nStreaming more text.");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector("pre")?.classList.contains(Resources.wrappedClass)).toBe(true);
    expect(element.querySelectorAll(Resources.wrapButtonSelector)[1]?.getAttribute("aria-pressed")).toBe("false");
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text: string) => { written.push(text); } }, configurable: true });
    element.querySelector<HTMLElement>(Resources.copyButtonSelector)!.click();
    expect(written).toEqual([original]);
    element.querySelector<HTMLElement>(Resources.wrapButtonSelector)!.click();
    expect(element.querySelector("pre")?.classList.contains(Resources.wrappedClass)).toBe(false);
  });

  it("renders code blocks with a language header and copies their text", async () => {
    TestBed.configureTestingModule({ imports: [MarkdownComponent] });
    const fixture = TestBed.createComponent(MarkdownComponent);
    fixture.componentRef.setInput("text", "Intro\n\n```typescript title\nconst a = 1;\n```\n\n```\nplain\n```\n\nDone `x`");
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const blocks = element.querySelectorAll(".tr-code");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.querySelector(".tr-code-header span")?.textContent).toBe("typescript");
    expect(blocks[1]?.querySelector(".tr-code-header span")?.textContent).toBe(Resources.codeLabel);
    expect(blocks[0]?.querySelector("pre code")?.textContent).toContain("const a = 1;");
    expect(blocks[0]?.querySelector("pre code .hljs-keyword")?.textContent).toBe("const");
    expect(blocks[1]?.querySelector("pre code .hljs-keyword")).toBeNull();

    const written: string[] = [];
    const clipboard = { writeText: (text: string): Promise<void> => { written.push(text); return Promise.resolve(); } };
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    vi.useFakeTimers();
    const copy = blocks[0]!.querySelector<HTMLElement>(".tr-copy")!;
    expect(copy.textContent).toBe(Resources.copyIcon);
    expect(copy.title).toBe(Resources.copyLabel);
    expect(copy.ariaLabel).toBe(Resources.copyLabel);
    copy.click();
    expect(copy.classList.contains(Resources.copiedClass)).toBe(true);
    expect(copy.textContent).toBe(Resources.copiedIcon);
    expect(copy.title).toBe(Resources.copiedLabel);
    expect(copy.ariaLabel).toBe(Resources.copiedLabel);
    vi.advanceTimersByTime(Resources.copiedDuration);
    expect(copy.classList.contains(Resources.copiedClass)).toBe(false);
    expect(copy.textContent).toBe(Resources.copyIcon);
    expect(copy.title).toBe(Resources.copyLabel);
    expect(copy.ariaLabel).toBe(Resources.copyLabel);
    vi.useRealTimers();
    element.querySelector<HTMLElement>("p")!.click();
    await fixture.whenStable();

    expect(written).toEqual(["const a = 1;\n"]);
  });

  describe("while its text streams", () => {
    const originalMatchMedia = window.matchMedia;
    beforeEach(() => {
      vi.useFakeTimers();
      TestBed.configureTestingModule({ imports: [MarkdownComponent] });
    });
    afterEach(() => {
      vi.useRealTimers();
      window.matchMedia = originalMatchMedia;
    });

    const visible = (node: Node): string => VisibleText.of(node);
    const create = (text: string, streaming = true, entering = true): ComponentFixture<MarkdownComponent> => {
      const fixture = TestBed.createComponent(MarkdownComponent);
      fixture.componentRef.setInput("streaming", streaming);
      fixture.componentRef.setInput("entering", entering);
      fixture.componentRef.setInput("text", text);
      fixture.detectChanges();
      return fixture;
    };
    const frames = (fixture: ComponentFixture<MarkdownComponent>, count: number, record?: () => void): void => {
      for (let frame = 0; frame < count; frame++) {
        vi.advanceTimersByTime(16);
        fixture.detectChanges();
        record?.();
      }
    };

    it("shows the text in small steps that only ever grow, and no more than has arrived", () => {
      const text = "Hello **world**, this is a longer sentence that streams in.";
      const fixture = create(text);
      const root = fixture.nativeElement as HTMLElement;
      const seen: string[] = [visible(root)];

      frames(fixture, 300, () => seen.push(visible(root)));

      expect(seen[0]).toBe("");
      expect(seen.at(-1)).toBe("Hello world, this is a longer sentence that streams in.");
      expect(new Set(seen).size).toBeGreaterThan(20);
      expect(seen.every((t, index) => index === 0 || t.startsWith(seen[index - 1]!))).toBe(true);
    });

    it("shows what is already there at once and reveals only what arrives later", () => {
      const fixture = create("Existing paragraph.", true, false);
      const root = fixture.nativeElement as HTMLElement;
      expect(visible(root)).toBe("Existing paragraph.");

      fixture.componentRef.setInput("text", "Existing paragraph.\n\nMore arrives now and is revealed step by step.");
      fixture.detectChanges();
      expect(visible(root)).toBe("Existing paragraph.");

      frames(fixture, 20);
      expect(visible(root).length).toBeGreaterThan("Existing paragraph.".length);
      expect(visible(root).length).toBeLessThan("Existing paragraph.More arrives now and is revealed step by step.".length);
      frames(fixture, 300);
      expect(visible(root)).toBe("Existing paragraph.More arrives now and is revealed step by step.");
    });

    it("leaves finished blocks alone while the last block grows", () => {
      const fixture = create("First paragraph.\n\nSecond", true, false);
      const root = fixture.nativeElement as HTMLElement;
      const first = root.querySelector("p");

      fixture.componentRef.setInput("text", "First paragraph.\n\nSecond paragraph grows");
      fixture.detectChanges();
      frames(fixture, 300);

      expect(root.querySelector("p")).toBe(first);
      expect(root.querySelectorAll("p")).toHaveLength(2);
      expect(visible(root)).toBe("First paragraph.Second paragraph grows");
    });

    it("never shows Markdown symbols while a construct is unfinished, whatever the size of the pieces", () => {
      const full = "Intro **bold text** and `code` and [a link](https://example.com/a_b) here.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```ts\nlet x = 1;\n```\n\n- item\n";
      const fixture = create(String.empty);
      const root = fixture.nativeElement as HTMLElement;
      const symbols = ["**", "`", "](", "|", "```", "\n-"];
      const sightings: string[] = [];
      let arrived = 0;

      for (let tick = 0; tick < 90; tick++) {
        arrived = Math.min(full.length, arrived + 1 + (tick * 7) % 23);
        fixture.componentRef.setInput("text", full.slice(0, arrived));
        frames(fixture, 6, () => sightings.push(...symbols.filter(t => visible(root).replace("tr-code-header", String.empty).includes(t))));
      }

      expect(arrived).toBe(full.length);
      expect(sightings).toEqual([]);
      fixture.componentRef.setInput("streaming", false);
      frames(fixture, 60);
      expect(visible(root)).toContain("Intro bold text and code and a link here.");
      expect(visible(root)).toContain("let x = 1;");
      expect(root.querySelectorAll("table td")).toHaveLength(2);
    });

    it("draws each step of the reveal within its frame, including blocks it reaches", () => {
      const fixture = create("First paragraph.\n\nSecond paragraph.");
      const root = fixture.nativeElement as HTMLElement;
      const seen: string[] = [];

      for (let frame = 0; frame < 300; frame++) {
        vi.advanceTimersToNextFrame();
        seen.push(visible(root));
      }

      expect(seen.at(-1)).toBe("First paragraph.Second paragraph.");
      expect(seen.find(t => t.length > "First paragraph.".length)).toMatch(/^First paragraph\.S/);
    });

    it("waits at the start of an unfinished construct until it closes", () => {
      const fixture = create("Hello **bo");
      const root = fixture.nativeElement as HTMLElement;

      frames(fixture, 100);
      expect(visible(root)).toBe("Hello ");

      fixture.componentRef.setInput("text", "Hello **bold** there");
      fixture.detectChanges();
      frames(fixture, 100);
      expect(visible(root)).toBe("Hello bold there");
      expect(root.querySelector("strong")?.textContent).toBe("bold");
    });

    it("shows the rest quickly, including held-back text, once the reply has ended", () => {
      const fixture = create("Alpha **bold", true, false);
      const root = fixture.nativeElement as HTMLElement;
      expect(visible(root)).toBe("Alpha ");

      fixture.componentRef.setInput("streaming", false);
      fixture.detectChanges();
      frames(fixture, 40);

      expect(visible(root)).toBe("Alpha **bold");
    });

    it("reveals a code block's header with the block and a rule as soon as it is reached", () => {
      const fixture = create("Intro\n\n---\n\n```ts\nlet a = 1;\n```\n\nOutro");
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector(".tr-code")).toBeNull();

      frames(fixture, 30);
      expect(root.querySelector("hr")).not.toBeNull();

      frames(fixture, 300);
      expect(root.querySelector(".tr-code-header span")?.textContent).toBe("ts");
      expect(visible(root)).toContain("Outro");
      expect(Array.from(root.querySelectorAll<HTMLElement>("*")).some(t => t.hidden)).toBe(false);
    });

    it("shows text as it arrives when the person prefers reduced motion", () => {
      const query = { matches: true, addEventListener: (): void => undefined } as unknown as MediaQueryList;
      window.matchMedia = (): MediaQueryList => query;
      const fixture = create("Everything arrives at once.");
      const root = fixture.nativeElement as HTMLElement;
      expect(visible(root)).toBe("Everything arrives at once.");

      fixture.componentRef.setInput("text", "Everything arrives at once. And this too.");
      fixture.detectChanges();
      expect(visible(root)).toBe("Everything arrives at once. And this too.");
    });

    it("adds no live region, so a screen reader does not announce each step", () => {
      const fixture = create("Some **streamed** text");
      const root = fixture.nativeElement as HTMLElement;

      frames(fixture, 30);

      expect(root.closest("[aria-live]")).toBeNull();
      expect(root.querySelector("[aria-live], [role='status'], [role='alert']")).toBeNull();
    });
  });
});
