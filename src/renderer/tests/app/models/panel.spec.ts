/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PanelKind } from "../../../src/app/enums/panel-kind";
import { Panel } from "../../../src/app/models/panel";

describe("Panel", () => {
  it("names an instance exactly when its kind opens more than once", () => {
    const explorer = new Panel(PanelKind.Explorer);
    const terminal = new Panel(PanelKind.Terminal, "terminal-1");

    expect([explorer.kind, explorer.instance, explorer.key]).toEqual(["Explorer", null, "Explorer"]);
    expect([terminal.kind, terminal.instance, terminal.key]).toEqual(["Terminal", "terminal-1", "Terminal:terminal-1"]);
    expect(() => new Panel(PanelKind.Terminal)).toThrow(RangeError);
    expect(() => new Panel(PanelKind.Terminal, "")).toThrow(RangeError);
    expect(() => new Panel(PanelKind.Changes, "changes-1")).toThrow(RangeError);
  });

  it("equals a panel of the same kind and instance", () => {
    const terminal = new Panel(PanelKind.Terminal, "terminal-1");

    expect(terminal.equals(new Panel(PanelKind.Terminal, "terminal-1"))).toBe(true);
    expect(terminal.equals(new Panel(PanelKind.Terminal, "terminal-2"))).toBe(false);
    expect(terminal.equals(null)).toBe(false);
    expect(new Panel(PanelKind.Activity).equals(new Panel(PanelKind.Activity))).toBe(true);
    expect(new Panel(PanelKind.Activity).equals(new Panel(PanelKind.Changes))).toBe(false);
  });

  it("reads a saved key and nothing that names no panel", () => {
    expect(Panel.fromKey("Explorer")).toEqual(new Panel(PanelKind.Explorer));
    expect(Panel.fromKey("Terminal:terminal-1")).toEqual(new Panel(PanelKind.Terminal, "terminal-1"));
    expect(Panel.fromKey("Terminal:a:b")?.instance).toBe("a:b");
    for (const value of ["Terminal", "Terminal:", "Explorer:x", "Browser", "", 7, null, undefined, { kind: "Explorer" }])
      expect(Panel.fromKey(value)).toBeNull();
  });
});
