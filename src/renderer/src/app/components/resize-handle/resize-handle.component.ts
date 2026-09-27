/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
  computed,
  inject,
  input,
  output,
  signal
} from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { PanelEdge } from "../../enums/panel-edge";
import { Resources } from "../../resources";

@Component({
  selector: "tr-resize-handle",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tr-resize-handle",
    role: "separator",
    tabindex: "0",
    "[attr.data-edge]": "edge()",
    "[attr.aria-orientation]": "orientation()",
    "[attr.aria-label]": "resources.resizeHandleLabel",
    "[attr.aria-valuetext]": "valueText()",
    "[class.tr-resizing]": "isDragging()",
    "[attr.title]": "resources.resizeHandleLabel",
    "(pointerdown)": "start($event)",
    "(pointermove)": "move($event)",
    "(pointerup)": "end($event)",
    "(pointercancel)": "end($event)",
    "(keydown)": "step($event)",
    "(dblclick)": "reset.emit()"
  },
  templateUrl: "./resize-handle.component.html"
})
export class ResizeHandleComponent {
  public readonly edge: InputSignal<PanelEdge> = input.required<PanelEdge>();
  public readonly size: InputSignal<number | null> = input<number | null>(null);
  public readonly resized: OutputEmitterRef<number> = output<number>();
  public readonly reset: OutputEmitterRef<void> = output<void>();
  protected readonly resources: typeof Resources = Resources;
  protected readonly isDragging: WritableSignal<boolean> = signal(false);
  protected readonly orientation: Signal<string> = computed(() => (this.isHorizontal() ? Resources.verticalOrientation : Resources.horizontalOrientation));
  protected readonly valueText: Signal<string | null> = computed(() => {
    const size = this.size();
    return Object.isNull(size) ? null : Resources.formatPixelSize(size);
  });
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);
  private origin: { position: number; size: number } | null = null;

  protected start(event: PointerEvent): void {
    if (event.button !== Resources.primaryButton)
      return;
    event.preventDefault();
    this.origin = { position: this.positionOf(event), size: this.size() ?? this.measure() };
    this.isDragging.set(true);
    try {
      this.host.nativeElement.setPointerCapture(event.pointerId);
    }
    catch {
    }
  }

  protected move(event: PointerEvent): void {
    if (Object.isNull(this.origin))
      return;
    const delta = (this.positionOf(event) - this.origin.position) * this.direction();
    this.resized.emit(Math.round(this.origin.size + delta));
  }

  protected step(event: KeyboardEvent): void {
    if (event.key === Resources.enterKey) {
      event.preventDefault();
      this.reset.emit();
      return;
    }
    const forward = this.isHorizontal() ? Resources.arrowRightKey : Resources.arrowDownKey;
    const backward = this.isHorizontal() ? Resources.arrowLeftKey : Resources.arrowUpKey;
    if (event.key !== forward && event.key !== backward)
      return;
    event.preventDefault();
    const delta = (event.key === forward ? Resources.resizeStep : -Resources.resizeStep) * this.direction();
    this.resized.emit(Math.round((this.size() ?? this.measure()) + delta));
  }

  protected end(event: PointerEvent): void {
    if (Object.isNull(this.origin))
      return;
    this.origin = null;
    this.isDragging.set(false);
    try {
      this.host.nativeElement.releasePointerCapture(event.pointerId);
    }
    catch {
    }
  }

  private isHorizontal(): boolean {
    return this.edge() === PanelEdge.Left || this.edge() === PanelEdge.Right;
  }

  private direction(): number {
    return this.edge() === PanelEdge.Right || this.edge() === PanelEdge.Bottom ? 1 : -1;
  }

  private positionOf(event: PointerEvent): number {
    return this.isHorizontal() ? event.clientX : event.clientY;
  }

  private measure(): number {
    const panel = this.host.nativeElement.parentElement;
    if (Object.isNull(panel))
      return 0;
    const bounds = panel.getBoundingClientRect();

    return this.isHorizontal() ? bounds.width : bounds.height;
  }
}
