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

import { Resources } from "../resources";

@Injectable({ providedIn: "root" })
export class MotionPreference {
  private readonly query: MediaQueryList | null = MotionPreference.watch(inject(DOCUMENT).defaultView);
  private readonly isReduced: WritableSignal<boolean> = signal(this.query?.matches ?? false);

  public readonly reduced: Signal<boolean> = this.isReduced.asReadonly();

  public constructor() {
    this.query?.addEventListener(Resources.changeEvent, event => this.isReduced.set(event.matches));
  }

  private static watch(view: Window | null): MediaQueryList | null {
    return Object.isNull(view) || !Object.isFunction(view.matchMedia) ? null : view.matchMedia(Resources.reducedMotionQuery);
  }
}
