/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { DockSide } from "../enums/dock-side";
import { PanelEdge } from "../enums/panel-edge";
import type { PanelId } from "../enums/panel-id";
import type { DropTarget } from "../models/drop-target";
import { SideDropTarget } from "../models/side-drop-target";
import { SplitDropTarget } from "../models/split-drop-target";
import { TabDropTarget } from "../models/tab-drop-target";
import { Resources } from "../resources";
import { LayoutService } from "./layout.service";

@Injectable({ providedIn: "root" })
export class PanelDragService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly draggingSignal: WritableSignal<PanelId | null> = signal(null);
  private readonly targetSignal: WritableSignal<DropTarget | null> = signal(null);
  private readonly hoveredSignal: WritableSignal<number | null> = signal(null);
  private readonly pointSignal: WritableSignal<readonly [number, number]> = signal([0, 0]);
  private readonly onMove: (event: PointerEvent) => void = event => this.move(event);
  private readonly onEnd: () => void = () => this.end();
  private readonly onCancel: () => void = () => this.stop();
  private readonly onKey: (event: KeyboardEvent) => void = event => this.cancelOnEscape(event);
  private pending: { panel: PanelId; x: number; y: number } | null = null;

  public readonly dragging: Signal<PanelId | null> = this.draggingSignal.asReadonly();
  public readonly target: Signal<DropTarget | null> = this.targetSignal.asReadonly();
  public readonly hoveredGroup: Signal<number | null> = this.hoveredSignal.asReadonly();
  public readonly point: Signal<readonly [number, number]> = this.pointSignal.asReadonly();

  public begin(panel: PanelId, event: PointerEvent): void {
    if (event.button !== Resources.primaryButton)
      return;
    this.pending = { panel, x: event.clientX, y: event.clientY };
    this.document.addEventListener(Resources.pointerMoveEvent, this.onMove);
    this.document.addEventListener(Resources.pointerUpEvent, this.onEnd);
    this.document.addEventListener(Resources.pointerCancelEvent, this.onCancel);
    this.document.addEventListener(Resources.keydownEvent, this.onKey, { capture: true });
  }

  public isDropBefore(groupId: number, index: number): boolean {
    const target = this.targetSignal();
    return !Object.isNull(target) && target.equals(new TabDropTarget(groupId, index));
  }

  private move(event: PointerEvent): void {
    if (Object.isNull(this.pending))
      return;
    if (Object.isNull(this.draggingSignal())) {
      if (Math.hypot(event.clientX - this.pending.x, event.clientY - this.pending.y) < Resources.dragThreshold)
        return;
      this.draggingSignal.set(this.pending.panel);
      this.document.body.classList.add(Resources.draggingBodyClass);
    }
    this.pointSignal.set([event.clientX, event.clientY]);
    const element = this.document.elementFromPoint(event.clientX, event.clientY);
    this.hoveredSignal.set(this.groupAt(element));
    const target = this.targetAt(element, event.clientX);
    if (!(target?.equals(this.targetSignal()) ?? Object.isNull(this.targetSignal())))
      this.targetSignal.set(target);
  }

  private end(): void {
    const panel = this.draggingSignal();
    const target = this.targetSignal();
    this.stop();
    if (!Object.isNull(panel) && !Object.isNull(target))
      this.layout.movePanel(panel, target);
  }

  private cancelOnEscape(event: KeyboardEvent): void {
    if (event.key !== Resources.escapeKey || Object.isNull(this.draggingSignal()))
      return;
    event.preventDefault();
    event.stopPropagation();
    this.stop();
  }

  private stop(): void {
    this.document.removeEventListener(Resources.pointerMoveEvent, this.onMove);
    this.document.removeEventListener(Resources.pointerUpEvent, this.onEnd);
    this.document.removeEventListener(Resources.pointerCancelEvent, this.onCancel);
    this.document.removeEventListener(Resources.keydownEvent, this.onKey, { capture: true });
    this.pending = null;
    this.draggingSignal.set(null);
    this.targetSignal.set(null);
    this.hoveredSignal.set(null);
    this.document.body.classList.remove(Resources.draggingBodyClass);
  }

  private groupAt(element: Element | null): number | null {
    const zone = element?.closest<HTMLElement>(Resources.dropGroupSelector) ?? null;
    return Object.isNull(zone) ? null : Number(zone.dataset[Resources.dropGroupData]);
  }

  private targetAt(element: Element | null, x: number): DropTarget | null {
    const guide = element?.closest<HTMLElement>(Resources.dropSideSelector) ?? null;
    if (!Object.isNull(guide)) {
      const side = Object.values(DockSide).find(t => t === guide.dataset[Resources.dropSideData]);
      return Object.isUndefined(side) ? null : new SideDropTarget(side);
    }
    const groupId = this.groupAt(element);
    const group = Object.isNull(groupId) ? null : this.layout.arrangement().group(groupId);
    if (Object.isNull(element) || Object.isNull(group))
      return null;
    const arrow = element.closest<HTMLElement>(Resources.dropEdgeSelector);
    if (!Object.isNull(arrow)) {
      const edge = Object.values(PanelEdge).find(t => t === arrow.dataset[Resources.dropEdgeData]);
      return Object.isUndefined(edge) ? null : new SplitDropTarget(group.id, edge);
    }
    if (!Object.isNull(element.closest(Resources.dropCenterSelector)))
      return new TabDropTarget(group.id, group.panels.length);
    if (Object.isNull(element.closest(Resources.dropTabsSelector)))
      return null;
    const tab = element.closest<HTMLElement>(Resources.tabIndexSelector);
    if (Object.isNull(tab))
      return new TabDropTarget(group.id, group.panels.length);
    const bounds = tab.getBoundingClientRect();
    return new TabDropTarget(group.id, Number(tab.dataset[Resources.tabIndexData]) + (x > bounds.left + bounds.width / 2 ? 1 : 0));
  }
}
