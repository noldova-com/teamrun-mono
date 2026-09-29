/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class VisibleText {
  public static of(node: Node): string {
    return Array.from(node.childNodes).map(t => {
      if (t instanceof Text)
        return VisibleText.isLayout(t) ? String.empty : t.data;

      return t instanceof HTMLElement && !t.hidden ? VisibleText.of(t) : String.empty;
    }).join(String.empty);
  }

  private static isLayout(node: Text): boolean {
    return /^\s*\n\s*$/.test(node.data) && node.parentElement?.closest("pre") === null;
  }
}
