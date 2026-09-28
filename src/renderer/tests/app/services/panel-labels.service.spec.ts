/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MethodName, TerminalScreen } from "@noldova/teamrun-protocol";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { SampleData } from "../../fixtures/sample-data";
import { TerminalWindow } from "../../fixtures/terminal-window";
import { PanelKind } from "../../../src/app/enums/panel-kind";
import { Panel } from "../../../src/app/models/panel";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { PanelLabels } from "../../../src/app/services/panel-labels.service";
import { TerminalsService } from "../../../src/app/services/terminals.service";

describe("PanelLabels", () => {
  it("names a panel by its kind and a terminal by its shell", async () => {
    MemoryStorage.install(window);
    const terminalWindow = TerminalWindow.install();
    onTestFinished(() => terminalWindow.restore());
    const bridge = SampleData.createBridge()
      .answer(MethodName.TerminalList, () => [SampleData.terminal("t1").toJson()])
      .answer(MethodName.TerminalScreen, () => new TerminalScreen(SampleData.terminal("t1"), "").toJson());
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const terminals = TestBed.inject(TerminalsService);
    onTestFinished(() => terminals.stop());
    await terminals.start();
    const labels = TestBed.inject(PanelLabels);

    expect(labels.of(new Panel(PanelKind.Explorer))).toBe("Explorer");
    expect(labels.of(new Panel(PanelKind.Terminal, "t1"))).toBe("PowerShell");
    expect(labels.of(new Panel(PanelKind.Terminal, "ended"))).toBe("Terminal");
  });
});
