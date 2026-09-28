/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeResizeObserver } from "./fake-resize-observer";

export class TerminalWindow {
  private readonly target: Window & typeof globalThis;
  private readonly resizeObserver: PropertyDescriptor | undefined;
  private readonly matchMedia: PropertyDescriptor | undefined;
  private readonly fonts: PropertyDescriptor | undefined;
  private readonly clipboard: PropertyDescriptor | undefined;

  public readonly copied: string[] = [];

  private constructor(target: Window & typeof globalThis) {
    this.target = target;
    this.resizeObserver = Object.getOwnPropertyDescriptor(target, "ResizeObserver");
    this.matchMedia = Object.getOwnPropertyDescriptor(target, "matchMedia");
    this.fonts = Object.getOwnPropertyDescriptor(target.document, "fonts");
    this.clipboard = Object.getOwnPropertyDescriptor(target.navigator, "clipboard");
  }

  public static install(target: Window & typeof globalThis = window): TerminalWindow {
    const installed = new TerminalWindow(target);
    FakeResizeObserver.observing.clear();
    const media = (query: string): object => ({
      matches: false, media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined,
      removeEventListener: () => undefined, dispatchEvent: () => false
    });
    Object.defineProperty(target, "ResizeObserver", { value: FakeResizeObserver, configurable: true, writable: true });
    Object.defineProperty(target, "matchMedia", { value: media, configurable: true, writable: true });
    Object.defineProperty(target.document, "fonts", { value: { load: () => Promise.resolve([]) }, configurable: true });
    const writeText = (text: string): Promise<void> => {
      installed.copied.push(text);
      return Promise.resolve();
    };
    Object.defineProperty(target.navigator, "clipboard", { value: { writeText }, configurable: true });
    return installed;
  }

  public restore(): void {
    TerminalWindow.put(this.target, "ResizeObserver", this.resizeObserver);
    TerminalWindow.put(this.target, "matchMedia", this.matchMedia);
    TerminalWindow.put(this.target.document, "fonts", this.fonts);
    TerminalWindow.put(this.target.navigator, "clipboard", this.clipboard);
  }

  private static put(owner: object, name: string, descriptor: PropertyDescriptor | undefined): void {
    if (descriptor === undefined)
      Reflect.deleteProperty(owner, name);
    else
      Object.defineProperty(owner, name, descriptor);
  }
}
