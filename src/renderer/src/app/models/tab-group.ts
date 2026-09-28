/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { DockSide } from "../enums/dock-side";
import type { PanelEdge } from "../enums/panel-edge";
import type { SplitAxis } from "../enums/split-axis";
import { Resources } from "../resources";
import { GroupFrame } from "./group-frame";
import { LayoutNode } from "./layout.node";
import type { Panel } from "./panel";
import { SplitNode } from "./split.node";

export class TabGroup extends LayoutNode {
  public static readonly documentsId: number = 0;

  public readonly panels: readonly Panel[];
  public readonly activePanel: Panel | null;

  public constructor(id: number, panels: readonly Panel[], activePanel: Panel | null) {
    super(id);

    const unique = [...new Map(panels.map(t => [t.key, t])).values()];
    this.panels = unique;
    this.activePanel = unique.find(t => t.equals(activePanel)) ?? (this.isDocuments ? null : unique[0] ?? null);
  }

  public get isDocuments(): boolean {
    return this.id === TabGroup.documentsId;
  }

  public override get groups(): readonly TabGroup[] {
    return [this];
  }

  public override get cornerGroup(): TabGroup {
    return this;
  }

  public override get maximumId(): number {
    return this.id;
  }

  public has(panel: Panel): boolean {
    return this.panels.some(t => t.equals(panel));
  }

  public insert(panel: Panel, index: number): TabGroup {
    const current = this.panels.findIndex(t => t.equals(panel));
    const others = this.panels.filter(t => !t.equals(panel));
    const at = Math.max(0, Math.min(others.length, current >= 0 && current < index ? index - 1 : index));
    if (at === current && panel.equals(this.activePanel))
      return this;
    return new TabGroup(this.id, [...others.slice(0, at), panel, ...others.slice(at)], panel);
  }

  public remove(panel: Panel): TabGroup {
    const index = this.panels.findIndex(t => t.equals(panel));
    if (index < 0)
      return this;
    const rest = this.panels.filter(t => !t.equals(panel));
    const active = panel.equals(this.activePanel) ? rest[Math.min(index, rest.length - 1)] ?? null : this.activePanel;
    return new TabGroup(this.id, rest, active);
  }

  public activate(panel: Panel): TabGroup {
    return this.has(panel) && !panel.equals(this.activePanel) ? new TabGroup(this.id, this.panels, panel) : this;
  }

  public override minimumLength(axis: SplitAxis): number {
    return Resources.groupMinimumLengths[axis];
  }

  public override withGroup(group: TabGroup): LayoutNode {
    return group.id === this.id ? group : this;
  }

  public override withoutGroup(id: number): LayoutNode | null {
    return id === this.id ? null : this;
  }

  public override splitGroup(id: number, added: TabGroup, edge: PanelEdge, splitId: number): LayoutNode {
    return id === this.id ? SplitNode.beside(this, added, edge, splitId) : this;
  }

  public override withWeights(): LayoutNode {
    return this;
  }

  public override arrange(bounds: DOMRectReadOnly, side: DockSide | null, frames: GroupFrame[]): void {
    frames.push(new GroupFrame(this, bounds, side));
  }

  public override toJson(): Record<string, unknown> {
    return { [Resources.documentsGroupField]: this.isDocuments, [Resources.panelsField]: this.panels.map(t => t.key), [Resources.activePanelField]: this.activePanel?.key ?? null };
  }
}
