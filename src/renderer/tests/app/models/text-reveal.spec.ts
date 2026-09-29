/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TextReveal } from "../../../src/app/models/text-reveal";

describe("TextReveal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows what has arrived at once when it does not animate", () => {
    const changed = vi.fn();
    const reveal = new TextReveal(0, changed);

    reveal.follow(50, false, false);
    vi.advanceTimersByTime(1000);

    expect(reveal.count).toBe(50);
    expect(changed).not.toHaveBeenCalled();
  });

  it("moves toward the arrived text in small steps and never passes it", () => {
    const counts: number[] = [];
    const reveal = new TextReveal(0, count => counts.push(count));

    reveal.follow(200, false, true);
    vi.advanceTimersByTime(3000);

    expect(reveal.count).toBe(200);
    expect(counts.length).toBeGreaterThan(20);
    expect(counts.every((t, i) => i === 0 ? t > 0 : t > counts[i - 1]!)).toBe(true);
    expect(Math.max(...counts)).toBe(200);
  });

  it("stays about the catch-up time behind a steady stream", () => {
    const reveal = new TextReveal(0, () => undefined);
    let arrived = 0;

    for (let tick = 0; tick < 30; tick++) {
      arrived += 100;
      reveal.follow(arrived, false, true);
      vi.advanceTimersByTime(100);
    }

    expect(arrived - reveal.count).toBeGreaterThan(150);
    expect(arrived - reveal.count).toBeLessThan(350);
  });

  it("speeds up when it falls far behind", () => {
    const reveal = new TextReveal(0, () => undefined);

    reveal.follow(2000, false, true);
    vi.advanceTimersByTime(600);

    expect(reveal.count).toBeGreaterThan(1200);
    expect(reveal.count).toBeLessThan(2000);
  });

  it("finishes quickly once the reply has ended", () => {
    const streaming = new TextReveal(0, () => undefined);
    const ended = new TextReveal(0, () => undefined);

    streaming.follow(1000, false, true);
    ended.follow(1000, true, true);
    vi.advanceTimersByTime(600);

    expect(streaming.count).toBeLessThan(1000);
    expect(ended.count).toBe(1000);
  });

  it("keeps a minimum pace so a short remainder does not trickle", () => {
    const reveal = new TextReveal(0, () => undefined);

    reveal.follow(3, false, true);
    vi.advanceTimersByTime(200);

    expect(reveal.count).toBe(3);
  });

  it("shows less when the text it follows becomes shorter", () => {
    const reveal = new TextReveal(0, () => undefined);
    reveal.follow(100, false, true);
    vi.advanceTimersByTime(3000);

    reveal.follow(20, false, true);

    expect(reveal.count).toBe(20);
  });

  it("does not count the time it was idle as time to reveal", () => {
    const reveal = new TextReveal(0, () => undefined);
    reveal.follow(100, false, true);
    vi.advanceTimersByTime(3000);
    vi.advanceTimersByTime(5000);

    reveal.follow(400, false, true);
    vi.advanceTimersByTime(20);

    expect(reveal.count).toBeGreaterThanOrEqual(100);
    expect(reveal.count).toBeLessThan(150);
  });

  it("stops asking for frames when it has caught up and when it is disposed", () => {
    const request = vi.spyOn(globalThis, "requestAnimationFrame");
    const changed = vi.fn();
    const reveal = new TextReveal(0, changed);
    reveal.follow(10, false, true);
    vi.advanceTimersByTime(1000);
    const requests = request.mock.calls.length;
    vi.advanceTimersByTime(1000);

    expect(request.mock.calls.length).toBe(requests);

    reveal.follow(1000, false, true);
    vi.advanceTimersByTime(40);
    reveal.dispose();
    const seen = changed.mock.calls.length;
    vi.advanceTimersByTime(3000);

    expect(changed.mock.calls.length).toBe(seen);
    expect(reveal.count).toBeLessThan(1000);
    request.mockRestore();
  });
});
