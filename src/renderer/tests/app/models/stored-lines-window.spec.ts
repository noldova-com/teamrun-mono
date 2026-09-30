/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalLine, TerminalLinePage, TerminalLineRange, TerminalTextRun } from "@noldova/teamrun-protocol";

import { StoredLinesWindow } from "../../../src/app/models/stored-lines-window";

describe("StoredLinesWindow", () => {
  const page = (start: number, count: number, stored: TerminalLineRange): TerminalLinePage =>
    new TerminalLinePage(start, Array.from({ length: count }, (_t, index) => new TerminalLine(`line ${start + index}`, false,
      [new TerminalTextRun(`line ${start + index}`.length, -1, -1, 0)])), stored);
  const starts = (window: StoredLinesWindow): number[] => window.pages.map(t => t.start);

  it("starts empty at the end of the stored lines and grows upwards page by page", () => {
    const window = new StoredLinesWindow(3, new TerminalLineRange(10, 1000));

    expect([window.first, window.last, window.hasOlder, window.hasNewer]).toEqual([1000, 1000, true, false]);
    expect(window.prepend(page(500, 500, new TerminalLineRange(10, 1000)))).toBe(false);
    expect(window.prepend(page(10, 490, new TerminalLineRange(10, 1000)))).toBe(false);

    expect([window.first, window.last, window.hasOlder, window.hasNewer]).toEqual([10, 1000, false, false]);
    expect(starts(window)).toEqual([10, 500]);
  });

  it("drops the newest page when a page above overflows it and the oldest when a page below does", () => {
    const window = new StoredLinesWindow(2, new TerminalLineRange(0, 2000));
    window.prepend(page(1500, 500, new TerminalLineRange(0, 2000)));
    window.prepend(page(1000, 500, new TerminalLineRange(0, 2000)));

    expect(window.prepend(page(500, 500, new TerminalLineRange(0, 2000)))).toBe(true);
    expect([starts(window), window.first, window.last, window.hasNewer]).toEqual([[500, 1000], 500, 1500, true]);
    expect(window.append(page(1500, 500, new TerminalLineRange(0, 2500)))).toBe(true);
    expect([starts(window), window.first, window.last, window.hasNewer]).toEqual([[1000, 1500], 1000, 2000, true]);
  });

  it("forgets pages below a raised start and everything on a reset", () => {
    const window = new StoredLinesWindow(4, new TerminalLineRange(0, 1500));
    window.prepend(page(1000, 500, new TerminalLineRange(0, 1500)));
    window.prepend(page(500, 500, new TerminalLineRange(0, 1500)));
    window.prepend(page(0, 500, new TerminalLineRange(0, 1500)));

    window.follow(new TerminalLineRange(700, 1600));
    expect([starts(window), window.first, window.hasOlder, window.hasNewer]).toEqual([[1000], 1000, true, true]);
    window.reset(new TerminalLineRange(700, 1700));
    expect([starts(window), window.first, window.last, window.hasOlder]).toEqual([[], 1700, 1700, true]);
  });

  it("refuses a page that does not join the loaded lines", () => {
    const window = new StoredLinesWindow(4, new TerminalLineRange(0, 1000));
    window.prepend(page(500, 500, new TerminalLineRange(0, 1000)));

    expect(() => window.prepend(page(100, 300, new TerminalLineRange(0, 1000)))).toThrow("A page of stored lines joins the lines already loaded.");
    expect(() => window.append(page(1100, 100, new TerminalLineRange(0, 1200)))).toThrow("A page of stored lines joins the lines already loaded.");
    expect(starts(window)).toEqual([500]);
  });
});
