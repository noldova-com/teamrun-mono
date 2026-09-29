/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { Resources } from "../../../src/app/resources";
import { MotionPreference } from "../../../src/app/services/motion-preference.service";

describe("MotionPreference", () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("follows the system's reduced-motion setting while the app runs", () => {
    let matches = true;
    let listener: ((event: MediaQueryListEvent) => void) | null = null;
    const queries: string[] = [];
    const query = {
      get matches(): boolean { return matches; },
      addEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void): void => { listener = handler; }
    } as unknown as MediaQueryList;
    window.matchMedia = (text: string): MediaQueryList => {
      queries.push(text);
      return query;
    };
    const motion = TestBed.inject(MotionPreference);

    expect(queries).toEqual([Resources.reducedMotionQuery]);
    expect(motion.reduced()).toBe(true);
    matches = false;
    listener!({ matches } as MediaQueryListEvent);
    expect(motion.reduced()).toBe(false);
  });

  it("does not reduce motion when the window cannot answer", () => {
    Object.defineProperty(window, "matchMedia", { value: undefined, configurable: true, writable: true });

    expect(TestBed.inject(MotionPreference).reduced()).toBe(false);
  });
});
