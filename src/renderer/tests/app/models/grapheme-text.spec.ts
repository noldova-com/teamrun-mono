/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GraphemeText } from "../../../src/app/models/grapheme-text";

describe("GraphemeText", () => {
  it("counts what a reader sees as one character, not its code units", () => {
    const text = new GraphemeText("á 👍🏽 🇲🇩 x");

    expect(text.count).toBe(7);
    expect(new GraphemeText("").count).toBe(0);
  });

  it("takes whole characters from the start and never splits one", () => {
    const text = new GraphemeText("á👍🏽b");

    expect(text.prefix(0)).toBe("");
    expect(text.prefix(-3)).toBe("");
    expect(text.prefix(1)).toBe("á");
    expect(text.prefix(2)).toBe("á👍🏽");
    expect(text.prefix(3)).toBe("á👍🏽b");
    expect(text.prefix(30)).toBe("á👍🏽b");
  });
});
