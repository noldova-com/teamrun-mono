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
import { PanelId } from "../../../../src/app/enums/panel-id";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { PanelContentComponent } from "../../../../src/app/components/panel-content/panel-content.component";

describe("PanelContentComponent", () => {
  it("shows the view of its panel", () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [PanelContentComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(PanelContentComponent);
    const element = fixture.nativeElement as HTMLElement;
    const views: Record<PanelId, string> = {
      [PanelId.Explorer]: "tr-sidebar",
      [PanelId.Changes]: "tr-changes-panel",
      [PanelId.Activity]: "tr-activity-panel"
    };

    for (const panel of Object.values(PanelId)) {
      fixture.componentRef.setInput("panel", panel);
      fixture.detectChanges();
      expect(element.dataset["panel"]).toBe(panel);
      expect(Array.from(element.children).map(t => t.localName)).toEqual([views[panel]]);
    }
  });
});
