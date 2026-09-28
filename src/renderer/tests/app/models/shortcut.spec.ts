/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShortcutAction } from "../../../src/app/enums/shortcut-action";
import { Shortcut } from "../../../src/app/models/shortcut";

describe("Shortcut", () => {
  const key = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent("keydown", init);

  it("matches its key or its physical key with exactly its modifiers", () => {
    const settings = new Shortcut(ShortcutAction.OpenSettings, ",", true, false, false, true, "Comma");
    const composer = new Shortcut(ShortcutAction.FocusComposer, "l", true, false, false, true);

    expect(settings.matches(key({ key: ",", ctrlKey: true }))).toBe(true);
    expect(settings.matches(key({ key: ",", metaKey: true }))).toBe(true);
    expect(settings.matches(key({ key: ";", code: "Comma", ctrlKey: true }))).toBe(true);
    expect(settings.matches(key({ key: ",", ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(settings.matches(key({ key: ",", ctrlKey: true, altKey: true }))).toBe(false);
    expect(settings.matches(key({ key: ".", code: "Period", ctrlKey: true }))).toBe(false);
    expect(composer.matches(key({ key: "L", code: "KeyL", ctrlKey: true }))).toBe(true);
    expect(composer.code).toBeNull();
  });

  it("makes the same shortcut with Shift added", () => {
    const composer = new Shortcut(ShortcutAction.FocusComposer, "l", true, false, false, true);
    const shifted = composer.shifted();

    expect([shifted.action, shifted.key, shifted.control, shifted.shift, shifted.alt, shifted.global, shifted.code])
      .toEqual([ShortcutAction.FocusComposer, "l", true, true, false, true, null]);
    expect(shifted.matches(key({ key: "L", ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(shifted.shifted()).toBe(shifted);
  });
});
