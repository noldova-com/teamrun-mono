/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../enums/dock-side";
import { PanelEdge } from "../enums/panel-edge";
import { PanelId } from "../enums/panel-id";
import { SplitAxis } from "../enums/split-axis";
import { Resources } from "../resources";
import { Dock } from "./dock";
import type { LayoutNode } from "./layout.node";
import { PanelArrangement } from "./panel-arrangement";
import { SplitNode } from "./split.node";
import { TabGroup } from "./tab-group";

export class ArrangementReader {
  private readonly seen: Set<PanelId> = new Set();
  private documents: TabGroup | null = null;
  private nextId: number = TabGroup.documentsId + 1;

  public read(record: Record<string, unknown>): PanelArrangement {
    const stored = record[Resources.docksField];
    const docks: Record<string, unknown> = Object.isObject(stored) && !Array.isArray(stored) ? { ...stored } : {};
    const read = Object.values(DockSide).map(side => this.readDock(side, docks[side]));
    return new PanelArrangement(read, this.completeMiddle(this.readNode(record[Resources.middleField], true)));
  }

  private readDock(side: DockSide, value: unknown): Dock {
    if (!Object.isObject(value) || Array.isArray(value))
      return Dock.createEmpty(side);
    const record: Record<string, unknown> = { ...value };
    const size = record[Resources.sizeField];
    const root = Resources.rootField in record ? this.readNode(record[Resources.rootField], false) : this.readGroup(record, false);
    return new Dock(side, root, Object.isNumber(size) && Number.isFinite(size) ? size : null, record[Resources.collapsedField] === true);
  }

  private readNode(value: unknown, inMiddle: boolean): LayoutNode | null {
    if (!Object.isObject(value) || Array.isArray(value))
      return null;
    const record: Record<string, unknown> = { ...value };
    return Array.isArray(record[Resources.childrenField]) ? this.readSplit(record, inMiddle) : this.readGroup(record, inMiddle);
  }

  private readSplit(record: Record<string, unknown>, inMiddle: boolean): LayoutNode | null {
    const id = this.nextId++;
    const parts = record[Resources.childrenField];
    const listed: readonly unknown[] = Array.isArray(parts) ? parts : [];
    const stored = record[Resources.weightsField];
    const weights: readonly unknown[] = Array.isArray(stored) && stored.length === listed.length ? stored : listed.map(() => 1);
    const children: LayoutNode[] = [];
    const kept: number[] = [];
    listed.forEach((value, index) => {
      const child = this.readNode(value, inMiddle);
      const weight = weights[index];
      if (Object.isNull(child))
        return;
      children.push(child);
      kept.push(Object.isNumber(weight) ? weight : 0);
    });
    const axis = Object.values(SplitAxis).find(t => t === record[Resources.axisField]) ?? SplitAxis.Horizontal;
    return SplitNode.join(id, axis, children, kept);
  }

  private readGroup(record: Record<string, unknown>, inMiddle: boolean): TabGroup | null {
    const listed = record[Resources.panelsField];
    const known = Object.values(PanelId);
    const panels = (Array.isArray(listed) ? listed : []).filter((t): t is PanelId => known.some(k => k === t) && !this.seen.has(t));
    const active = known.find(t => t === record[Resources.activePanelField]) ?? null;
    for (const panel of panels)
      this.seen.add(panel);
    if (inMiddle && Object.isNull(this.documents) && record[Resources.documentsGroupField] === true) {
      this.documents = new TabGroup(TabGroup.documentsId, panels, active);
      return this.documents;
    }
    return panels.length === 0 ? null : new TabGroup(this.nextId++, panels, active);
  }

  private completeMiddle(middle: LayoutNode | null): LayoutNode {
    if (!Object.isNull(this.documents))
      return middle ?? this.documents;
    const documents = new TabGroup(TabGroup.documentsId, [], null);
    return Object.isNull(middle) ? documents : SplitNode.beside(middle, documents, PanelEdge.Left, this.nextId++);
  }
}
