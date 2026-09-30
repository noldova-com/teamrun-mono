/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { PanelKind } from "../enums/panel-kind";
import type { Panel } from "../models/panel";
import { Resources } from "../resources";
import type { TerminalSession } from "./terminal-session";
import { TerminalsService } from "./terminals.service";

@Injectable({ providedIn: "root" })
export class PanelLabels {
  private readonly terminals: TerminalsService = inject(TerminalsService);

  public of(panel: Panel): string {
    return this.sessionOf(panel)?.state().shell ?? Resources.panelLabels[panel.kind];
  }

  public iconOf(panel: Panel): string | null {
    const session = this.sessionOf(panel);
    return Object.isNull(session) ? null : Resources.shellKindIcons[session.state().shellKind];
  }

  private sessionOf(panel: Panel): TerminalSession | null {
    return panel.kind === PanelKind.Terminal ? this.terminals.sessionOf(panel) : null;
  }
}
