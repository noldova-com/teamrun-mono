/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ShortcutAction } from "../enums/shortcut-action";

export class Shortcut {
  public readonly action: ShortcutAction;
  public readonly key: string;
  public readonly control: boolean;
  public readonly shift: boolean;
  public readonly alt: boolean;
  public readonly global: boolean;
  public readonly code: string | null;

  public constructor(action: ShortcutAction, key: string, control: boolean, shift: boolean, alt: boolean, global: boolean, code: string | null = null) {
    this.action = action;
    this.key = key;
    this.control = control;
    this.shift = shift;
    this.alt = alt;
    this.global = global;
    this.code = code;
  }

  public shifted(): Shortcut {
    return this.shift ? this : new Shortcut(this.action, this.key, this.control, true, this.alt, this.global, this.code);
  }

  public matches(event: KeyboardEvent): boolean {
    return (event.key.toLowerCase() === this.key.toLowerCase() || event.code === this.code)
      && (event.ctrlKey || event.metaKey) === this.control
      && event.shiftKey === this.shift
      && event.altKey === this.alt;
  }
}
