/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../enums/dock-side";
import type { PanelEdge } from "../enums/panel-edge";
import type { PanelKind } from "../enums/panel-kind";
import { Resources } from "../resources";
import { Dock } from "./dock";
import type { LayoutNode } from "./layout.node";
import { Panel } from "./panel";
import { SplitNode } from "./split.node";
import { TabGroup } from "./tab-group";

export class PanelArrangement {
  public readonly docks: ReadonlyMap<DockSide, Dock>;
  public readonly middle: LayoutNode;
  public readonly documents: TabGroup;

  public constructor(docks: readonly Dock[], middle: LayoutNode) {
    const documents = middle.groups.find(t => t.isDocuments);
    const panels = [...docks.flatMap(t => t.panels), ...middle.groups.flatMap(t => t.panels)];
    if (Object.isUndefined(documents))
      throw new RangeError(Resources.missingDocumentsGroupMessage);
    if (new Set(panels.map(t => t.key)).size !== panels.length)
      throw new RangeError(Resources.repeatedPanelMessage);

    this.docks = new Map(Object.values(DockSide).map(side => [side, docks.find(t => t.side === side) ?? Dock.createEmpty(side)]));
    this.middle = middle;
    this.documents = documents;
  }

  public static createDefault(): PanelArrangement {
    let id = TabGroup.documentsId;
    const docks = Object.values(DockSide).map(side => {
      const panels = Resources.singlePanelKinds.filter(t => Resources.defaultDockSides[t] === side).map(t => new Panel(t));
      return new Dock(side, panels.length === 0 ? null : new TabGroup(++id, panels, null), null, Resources.defaultCollapsedDocks.includes(side));
    });
    return new PanelArrangement(docks, new TabGroup(TabGroup.documentsId, [], null));
  }

  public get groups(): readonly TabGroup[] {
    return [...[...this.docks.values()].flatMap(t => t.root?.groups ?? []), ...this.middle.groups];
  }

  public toJson(): Record<string, unknown> {
    return {
      [Resources.docksField]: Object.fromEntries([...this.docks].map(([side, dock]) => [side, dock.toJson()])),
      [Resources.middleField]: this.middle.toJson()
    };
  }

  public dock(side: DockSide): Dock {
    const dock = this.docks.get(side);
    if (Object.isUndefined(dock))
      throw new RangeError(side);
    return dock;
  }

  public group(id: number): TabGroup | null {
    return this.groups.find(t => t.id === id) ?? null;
  }

  public groupOf(panel: Panel): TabGroup | null {
    return this.groups.find(t => t.has(panel)) ?? null;
  }

  public sideOf(groupId: number): DockSide | null {
    return [...this.docks.values()].find(t => t.holds(groupId))?.side ?? null;
  }

  public isOpen(panel: Panel): boolean {
    return !Object.isNull(this.groupOf(panel));
  }

  public isShown(panel: Panel): boolean {
    const group = this.groupOf(panel);
    if (Object.isNull(group) || !panel.equals(group.activePanel))
      return false;
    const side = this.sideOf(group.id);
    return Object.isNull(side) || !this.dock(side).collapsed;
  }

  public openPanel(panel: Panel): PanelArrangement {
    if (this.isOpen(panel))
      return this.activatePanel(panel);
    const dock = this.dock(Resources.defaultDockSides[panel.kind]);
    const root = dock.root;
    const opened = Object.isNull(root) ? new TabGroup(this.nextId, [panel], panel) : root.withGroup(root.cornerGroup.insert(panel, root.cornerGroup.panels.length));
    return this.withDock(dock.withRoot(opened).withCollapsed(false));
  }

  public closePanel(panel: Panel): PanelArrangement {
    const group = this.groupOf(panel);
    if (Object.isNull(group))
      return this;
    const rest = group.remove(panel);
    return rest.panels.length > 0 || rest.isDocuments ? this.withGroup(rest) : this.withoutGroup(group.id);
  }

  public togglePanel(panel: Panel): PanelArrangement {
    return this.isShown(panel) ? this.closePanel(panel) : this.openPanel(panel);
  }

  public activatePanel(panel: Panel): PanelArrangement {
    const group = this.groupOf(panel);
    return Object.isNull(group) ? this : this.withGroup(group.activate(panel)).reveal(group.id);
  }

  public insertTab(panel: Panel, groupId: number, index: number): PanelArrangement {
    const arrangement = this.groupOf(panel)?.id === groupId ? this : this.closePanel(panel);
    const target = arrangement.group(groupId);
    return Object.isNull(target) ? this : arrangement.withGroup(target.insert(panel, index)).reveal(groupId);
  }

  public splitGroup(panel: Panel, groupId: number, edge: PanelEdge): PanelArrangement {
    const source = this.groupOf(panel);
    if (source?.id === groupId && source.panels.length === 1 && !source.isDocuments)
      return this;
    const arrangement = this.closePanel(panel);
    if (Object.isNull(arrangement.group(groupId)))
      return this;
    const added = new TabGroup(arrangement.nextId, [panel], panel);
    return arrangement.withRegions(t => t.splitGroup(groupId, added, edge, added.id + 1)).reveal(added.id);
  }

  public dockOnSide(panel: Panel, side: DockSide): PanelArrangement {
    const source = this.groupOf(panel);
    if (!Object.isNull(source) && this.dock(side).root === source && source.panels.length === 1)
      return this.withDock(this.dock(side).withCollapsed(false));
    const arrangement = this.closePanel(panel);
    const dock = arrangement.dock(side);
    const added = new TabGroup(arrangement.nextId, [panel], panel);
    const root = Object.isNull(dock.root) ? added : SplitNode.beside(dock.root, added, Resources.dockEdges[side], added.id + 1);
    return arrangement.withDock(dock.withRoot(root).withCollapsed(false));
  }

  public keepInstances(kind: PanelKind, existing: readonly string[]): PanelArrangement {
    const gone = this.groups.flatMap(t => t.panels).filter(t => t.kind === kind && !existing.some(k => k === t.instance));
    return gone.reduce<PanelArrangement>((arrangement, t) => arrangement.closePanel(t), this);
  }

  public showDocuments(): PanelArrangement {
    return Object.isNull(this.documents.activePanel) ? this : this.withGroup(new TabGroup(TabGroup.documentsId, this.documents.panels, null));
  }

  public toggleDock(side: DockSide): PanelArrangement {
    const dock = this.dock(side);
    return this.withDock(dock.withCollapsed(!dock.collapsed));
  }

  public resizeDock(side: DockSide, size: number | null): PanelArrangement {
    return this.withDock(this.dock(side).withSize(size));
  }

  public resizeSplit(splitId: number, weights: readonly number[]): PanelArrangement {
    return this.withRegions(t => t.withWeights(splitId, weights));
  }

  private get nextId(): number {
    return Math.max(this.middle.maximumId, ...[...this.docks.values()].map(t => t.root?.maximumId ?? 0)) + 1;
  }

  private withGroup(group: TabGroup): PanelArrangement {
    return this.withRegions(t => t.withGroup(group));
  }

  private withoutGroup(id: number): PanelArrangement {
    const docks = [...this.docks.values()].map(t => t.withRoot(t.root?.withoutGroup(id) ?? null));
    return this.copy(docks, this.middle.withoutGroup(id) ?? this.documents);
  }

  private withRegions(change: (node: LayoutNode) => LayoutNode): PanelArrangement {
    const docks = [...this.docks.values()].map(t => (Object.isNull(t.root) ? t : t.withRoot(change(t.root))));
    return this.copy(docks, change(this.middle));
  }

  private withDock(dock: Dock): PanelArrangement {
    return this.copy([...this.docks.values()].map(t => (t.side === dock.side ? dock : t)), this.middle);
  }

  private reveal(groupId: number): PanelArrangement {
    const side = this.sideOf(groupId);
    return Object.isNull(side) ? this : this.withDock(this.dock(side).withCollapsed(false));
  }

  private copy(docks: readonly Dock[], middle: LayoutNode): PanelArrangement {
    return middle === this.middle && docks.every(t => t === this.docks.get(t.side)) ? this : new PanelArrangement(docks, middle);
  }
}
