/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DetailKind, MessageDetail } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { ActivityEntry } from "../../../../src/app/models/activity-entry";
import { Resources } from "../../../../src/app/resources";
import { ActivityBlockComponent } from "../../../../src/app/components/activity-block/activity-block.component";

describe("ActivityBlockComponent", () => {
  const detail = (sequence: number, kind: DetailKind, text: string): MessageDetail => new MessageDetail(sequence, kind, text, null, SampleData.timestamp);
  const longBody = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join(Resources.lineSeparator);

  it("lists the steps one line each, opens a step to its output, and expands long outputs", async () => {
    TestBed.configureTestingModule({ imports: [ActivityBlockComponent] });
    const fixture = TestBed.createComponent(ActivityBlockComponent);
    fixture.componentRef.setInput("entries", [
      new ActivityEntry(detail(0, DetailKind.Note, "Read: D:\\repo\\README.md"), detail(1, DetailKind.Note, longBody)),
      new ActivityEntry(detail(2, DetailKind.Command, `> ls${Resources.lineSeparator}file.txt`), null),
      new ActivityEntry(detail(3, DetailKind.Note, "Session tools: Read"), null)
    ]);
    fixture.componentRef.setInput("label", "Ran 1 command, read 1 file, 1 more step");
    fixture.componentRef.setInput("rootPath", "D:\\repo");
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const items = element.querySelectorAll("li");
    expect(element.textContent).toContain("Ran 1 command, read 1 file, 1 more step");
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain("Read: .\\README.md");
    expect(element.querySelector("pre")).toBeNull();
    expect(items[0]?.querySelector("button span")?.classList.contains("truncate")).toBe(true);

    items[0]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[0]?.querySelector("button span")?.classList.contains("tr-wrap")).toBe(true);
    expect(items[0]?.querySelector("pre")?.textContent?.split(Resources.lineSeparator)).toHaveLength(Resources.previewLineCount);
    items[0]!.querySelectorAll<HTMLButtonElement>("button")[1]!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[0]?.querySelector("pre")?.textContent?.split(Resources.lineSeparator)).toHaveLength(10);
    expect(items[0]?.querySelectorAll("button")[1]?.textContent).toContain(Resources.showLessLabel);

    items[1]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[1]?.querySelector("pre")?.textContent).toBe("file.txt");
    expect(items[1]?.querySelectorAll("button")).toHaveLength(1);
    items[2]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[2]?.querySelector("pre")).toBeNull();

    items[0]!.querySelector<HTMLButtonElement>("button")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(items[0]?.querySelector("pre")).toBeNull();
  });

  describe("while thinking text streams", () => {
    const originalMatchMedia = window.matchMedia;
    beforeEach(() => {
      vi.useFakeTimers();
      TestBed.configureTestingModule({ imports: [ActivityBlockComponent] });
    });
    afterEach(() => {
      vi.useRealTimers();
      window.matchMedia = originalMatchMedia;
    });

    const thought = (text: string, sequence = 0): ActivityEntry => new ActivityEntry(detail(sequence, DetailKind.Reasoning, text), null);
    const create = (entries: readonly ActivityEntry[], streaming = true, entering = true): ComponentFixture<ActivityBlockComponent> => {
      const fixture = TestBed.createComponent(ActivityBlockComponent);
      fixture.componentRef.setInput("entries", entries);
      fixture.componentRef.setInput("label", "Thinking");
      fixture.componentRef.setInput("streaming", streaming);
      fixture.componentRef.setInput("entering", entering);
      fixture.detectChanges();
      return fixture;
    };
    const frames = (fixture: ComponentFixture<ActivityBlockComponent>, count: number, record?: () => void): void => {
      for (let frame = 0; frame < count; frame++) {
        vi.advanceTimersByTime(16);
        fixture.detectChanges();
        record?.();
      }
    };
    const titles = (fixture: ComponentFixture<ActivityBlockComponent>): string[] =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll("li button span")).map(t => t.textContent ?? String.empty);

    it("reveals a new thought in small steps that only grow", () => {
      const text = "Considering the options carefully before answering";
      const fixture = create([thought(text)]);
      const seen: string[] = [titles(fixture)[0]!];

      frames(fixture, 300, () => seen.push(titles(fixture)[0]!));

      expect(seen[0]).toBe("");
      expect(seen.at(-1)).toBe(text);
      expect(new Set(seen).size).toBeGreaterThan(15);
      expect(seen.every((t, index) => index === 0 || t.startsWith(seen[index - 1]!))).toBe(true);
    });

    it("shows a thought that is already there at once and reveals only what is added to it", () => {
      const fixture = create([thought("Already thinking")], true, false);
      expect(titles(fixture)).toEqual(["Already thinking"]);

      fixture.componentRef.setInput("entries", [thought("Already thinking about something new")]);
      fixture.detectChanges();
      expect(titles(fixture)).toEqual(["Already thinking"]);

      frames(fixture, 300);
      expect(titles(fixture)).toEqual(["Already thinking about something new"]);
    });

    it("reveals the title before the body of an opened thought and starts a later thought from empty", () => {
      const fixture = create([thought("Title line\nBody line one\nBody line two")], true, false);
      fixture.componentRef.setInput("entries", [thought("Title line\nBody line one\nBody line two"), thought("A second thought", 1)]);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      element.querySelector<HTMLButtonElement>("li button")!.click();
      fixture.detectChanges();

      expect(titles(fixture)[1]).toBe("");
      frames(fixture, 300);
      expect(titles(fixture)).toEqual(["Title line", "A second thought"]);
      expect(element.querySelector("pre")?.textContent).toBe("Body line one\nBody line two");
    });

    it("draws each step of a thought within its frame", () => {
      const fixture = create([thought("Drawn without waiting for the next render")]);
      const seen: string[] = [];

      for (let frame = 0; frame < 300; frame++) {
        vi.advanceTimersToNextFrame();
        seen.push(titles(fixture)[0]!);
      }

      expect(new Set(seen).size).toBeGreaterThan(10);
      expect(seen.at(-1)).toBe("Drawn without waiting for the next render");
    });

    it("does not animate steps that are not thoughts", () => {
      const fixture = create([new ActivityEntry(detail(0, DetailKind.Command, "> npm test"), null)]);

      expect(titles(fixture)).toEqual(["> npm test"]);
    });

    it("shows a thought as it arrives when the person prefers reduced motion", () => {
      const query = { matches: true, addEventListener: (): void => undefined } as unknown as MediaQueryList;
      window.matchMedia = (): MediaQueryList => query;
      const fixture = create([thought("Everything at once")]);

      expect(titles(fixture)).toEqual(["Everything at once"]);
    });

    it("finishes quickly when the reply ends and releases its frames when it goes away", () => {
      const fixture = create([thought("A fairly long thought that is still being revealed step by step")]);
      frames(fixture, 5);
      expect(titles(fixture)[0]!.length).toBeLessThan(20);

      fixture.componentRef.setInput("streaming", false);
      fixture.detectChanges();
      frames(fixture, 60);
      expect(titles(fixture)).toEqual(["A fairly long thought that is still being revealed step by step"]);

      fixture.componentRef.setInput("entries", [thought("Another thought", 3)]);
      fixture.detectChanges();
      fixture.destroy();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
