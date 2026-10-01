/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from "@angular/core";
import { MatTooltip } from "@angular/material/tooltip";

@Directive({
  selector: "[trTruncatedTooltip]",
  hostDirectives: [{ directive: MatTooltip, inputs: ["matTooltip: trTruncatedTooltip"] }]
})
export class TruncatedTooltipDirective {
  private readonly tooltip = inject(MatTooltip);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  public constructor() {
    this.tooltip.disabled = true;
    let observer: ResizeObserver | null = null;
    afterNextRender(() => {
      if (typeof ResizeObserver === "undefined")
        return;
      observer = new ResizeObserver(() => this.tooltip.disabled = this.element.scrollWidth <= this.element.clientWidth);
      observer.observe(this.element);
    });
    inject(DestroyRef).onDestroy(() => observer?.disconnect());
  }
}
