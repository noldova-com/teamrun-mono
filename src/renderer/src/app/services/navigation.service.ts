/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { DestroyRef, Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { AppView } from "../enums/app-view";
import type { PanelId } from "../enums/panel-id";
import { SettingsSection } from "../enums/settings-section";
import { ImageDocument } from "../models/image-document";
import type { ImageSource } from "../models/image-source";
import { Resources } from "../resources";
import { LayoutService } from "./layout.service";

@Injectable({ providedIn: "root" })
export class NavigationService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly documentView: WritableSignal<AppView> = signal(AppView.Chat);
  private readonly sectionSignal: WritableSignal<SettingsSection> = signal(SettingsSection.General);
  private readonly settingsOpenSignal: WritableSignal<boolean> = signal(false);
  private readonly imagesSignal = signal<readonly ImageDocument[]>([]);
  private readonly imageId = signal<number | null>(null);
  private imageSequence: number = 0;

  public readonly images = this.imagesSignal.asReadonly();
  public readonly activeImage = computed(() => this.images().find(t => t.id === this.imageId()) ?? null);

  public readonly panel: Signal<PanelId | null> = computed(() => this.layout.arrangement().documents.activePanel);
  public readonly view: Signal<AppView> = computed(() => (Object.isNull(this.panel()) ? this.documentView() : AppView.Panel));
  public readonly section: Signal<SettingsSection> = this.sectionSignal.asReadonly();
  public readonly settingsOpen: Signal<boolean> = this.settingsOpenSignal.asReadonly();

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.closeImages());
    const hash = inject(DOCUMENT).location?.hash ?? String.empty;
    if (hash === Resources.settingsHash)
      this.openSettings();
  }

  public openImage(image: ImageSource): void {
    const key = image.path ?? image.data ?? image.key;
    let document = this.images().find(t => t.key === key);
    if (Object.isUndefined(document)) {
      const created = new ImageDocument(++this.imageSequence, image);
      this.imagesSignal.update(images => [...images, created]);
      document = created;
    }
    this.showImage(document.id);
  }

  public showImage(id: number): void {
    if (!this.images().some(t => t.id === id))
      return;
    this.imageId.set(id);
    this.show(AppView.Image);
  }

  public closeImage(id: number): void {
    const images = this.images();
    const index = images.findIndex(t => t.id === id);
    if (index < 0)
      return;
    images[index]?.dispose();
    const remaining = images.filter(t => t.id !== id);
    this.imagesSignal.set(remaining);
    if (this.imageId() !== id)
      return;
    const next = remaining[Math.min(index, remaining.length - 1)];
    this.imageId.set(next?.id ?? null);
    if (Object.isUndefined(next) && this.documentView() === AppView.Image)
      this.documentView.set(AppView.Chat);
  }

  public closeImages(): void {
    for (const image of this.images())
      image.dispose();
    this.imagesSignal.set([]);
    this.imageId.set(null);
    if (this.documentView() === AppView.Image)
      this.documentView.set(AppView.Chat);
  }

  public openSettings(section: SettingsSection = this.sectionSignal()): void {
    this.sectionSignal.set(section);
    this.settingsOpenSignal.set(true);
    this.show(AppView.Settings);
  }

  public showSection(section: SettingsSection): void {
    this.sectionSignal.set(section);
  }

  public showChat(): void {
    this.show(AppView.Chat);
  }

  public closeSettingsTab(): void {
    this.settingsOpenSignal.set(false);
    if (this.documentView() === AppView.Settings)
      this.documentView.set(AppView.Chat);
  }

  private show(view: AppView): void {
    this.documentView.set(view);
    this.layout.showDocuments();
  }
}
