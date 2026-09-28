/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FakeResizeObserver {
  public static readonly observing: Set<FakeResizeObserver> = new Set();
  private readonly callback: () => void;

  public constructor(callback: () => void) {
    this.callback = callback;
  }

  public static resizeAll(): void {
    for (const observer of [...FakeResizeObserver.observing])
      observer.callback();
  }

  public observe(): void {
    FakeResizeObserver.observing.add(this);
  }

  public unobserve(): void {
    FakeResizeObserver.observing.delete(this);
  }

  public disconnect(): void {
    FakeResizeObserver.observing.delete(this);
  }
}
