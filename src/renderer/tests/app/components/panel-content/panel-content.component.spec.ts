/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { PanelKind } from "../../../../src/app/enums/panel-kind";
import { Panel } from "../../../../src/app/models/panel";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { PanelContentComponent } from "../../../../src/app/components/panel-content/panel-content.component";

describe("PanelContentComponent", () => {
  it("shows the view of its panel", () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [PanelContentComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(PanelContentComponent);
    const element = fixture.nativeElement as HTMLElement;
    const views: readonly [Panel, string, readonly string[]][] = [
      [new Panel(PanelKind.Explorer), "Explorer", ["tr-sidebar"]],
      [new Panel(PanelKind.Changes), "Changes", ["tr-changes-panel"]],
      [new Panel(PanelKind.Activity), "Activity", ["tr-activity-panel"]],
      [new Panel(PanelKind.Terminal, "terminal-1"), "Terminal:terminal-1", []]
    ];

    for (const [panel, key, children] of views) {
      fixture.componentRef.setInput("panel", panel);
      fixture.detectChanges();
      expect(element.dataset["panel"]).toBe(key);
      expect(Array.from(element.children).map(t => t.localName)).toEqual(children);
    }
  });
});
