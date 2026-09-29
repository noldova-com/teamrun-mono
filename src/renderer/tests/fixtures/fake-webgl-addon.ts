/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDisposable, IEvent, Terminal } from "@xterm/xterm";

export class FakeWebglAddon {
  private readonly lossListeners: Set<() => void> = new Set();
  private readonly unavailable: boolean;
  public textureAtlas?: HTMLCanvasElement;
  public readonly onContextLoss: IEvent<void> = listener => FakeWebglAddon.subscribe(this.lossListeners, listener);
  public readonly onChangeTextureAtlas: IEvent<HTMLCanvasElement> = () => FakeWebglAddon.nothing();
  public readonly onAddTextureAtlasCanvas: IEvent<HTMLCanvasElement> = () => FakeWebglAddon.nothing();
  public readonly onRemoveTextureAtlasCanvas: IEvent<HTMLCanvasElement> = () => FakeWebglAddon.nothing();
  public activations: number = 0;
  public disposals: number = 0;

  public constructor(unavailable: boolean = false) {
    this.unavailable = unavailable;
  }

  public activate(_terminal: Terminal): void {
    if (this.unavailable)
      throw new Error("WebGL2 is not supported.");
    this.activations += 1;
  }

  public dispose(): void {
    this.disposals += 1;
  }

  public clearTextureAtlas(): void {
  }

  public loseContext(): void {
    for (const listener of this.lossListeners)
      listener();
  }

  private static subscribe(listeners: Set<() => void>, listener: () => void): IDisposable {
    listeners.add(listener);
    return { dispose: () => listeners.delete(listener) };
  }

  private static nothing(): IDisposable {
    return { dispose: () => undefined };
  }
}
