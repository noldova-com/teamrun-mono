/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatTooltip } from "@angular/material/tooltip";
import { By } from "@angular/platform-browser";

import { TruncatedTooltipDirective } from "../../../src/app/directives/truncated-tooltip.directive";
import { FakeResizeObserver } from "../../fixtures/fake-resize-observer";

@Component({ imports: [TruncatedTooltipDirective], template: `<span [trTruncatedTooltip]="'Developer Command Prompt'">Developer Command Prompt</span>` })
class TruncatedTooltipTestHost {
}

describe("TruncatedTooltipDirective", () => {
  const render = async (): Promise<{ text: HTMLElement; tooltip: MatTooltip; destroy: () => void }> => {
    const fixture = TestBed.createComponent(TruncatedTooltipTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.debugElement.query(By.directive(MatTooltip));
    return { text: host.nativeElement as HTMLElement, tooltip: host.injector.get(MatTooltip), destroy: () => fixture.destroy() };
  };
  const measure = (text: HTMLElement, scrollWidth: number, clientWidth: number): void => {
    Object.defineProperty(text, "scrollWidth", { value: scrollWidth, configurable: true });
    Object.defineProperty(text, "clientWidth", { value: clientWidth, configurable: true });
    FakeResizeObserver.resizeAll();
  };

  it("offers the full text on hover only while the element shortens it", async () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
    onTestFinished(() => { delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver; });
    const { text, tooltip, destroy } = await render();

    expect(tooltip.message).toBe("Developer Command Prompt");
    expect(tooltip.disabled).toBe(true);
    measure(text, 240, 120);
    expect(tooltip.disabled).toBe(false);
    measure(text, 120, 120);
    expect(tooltip.disabled).toBe(true);
    destroy();
    expect(FakeResizeObserver.observing.size).toBe(0);
  });

  it("keeps the tooltip off where the element cannot be measured", async () => {
    const { tooltip, destroy } = await render();

    expect(tooltip.disabled).toBe(true);
    destroy();
  });
});
