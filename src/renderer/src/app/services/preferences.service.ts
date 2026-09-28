/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, type Signal, type WritableSignal, computed, effect, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { AccessMode } from "../enums/access-mode";
import { ClockChoice } from "../enums/clock-choice";
import { OpenMode } from "../enums/open-mode";
import type { ImageOpenMode } from "../enums/image-open-mode";
import { FontChoice } from "../enums/font-choice";
import type { ComposerSettings } from "../models/composer-settings";
import { Preferences } from "../models/preferences";
import { Resources } from "../resources";

@Injectable({ providedIn: "root" })
export class PreferencesService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly current: WritableSignal<Preferences> = signal(this.read());

  public readonly preferences: Signal<Preferences> = this.current.asReadonly();
  public readonly theme: Signal<string> = computed(() => this.current().theme);
  public readonly interfaceFont: Signal<FontChoice> = computed(() => this.current().interfaceFont);
  public readonly codeFont: Signal<FontChoice> = computed(() => this.current().codeFont);
  public readonly panelTextSize: Signal<number> = computed(() => this.current().panelTextSize);
  public readonly messageTextSize: Signal<number> = computed(() => this.current().messageTextSize);
  public readonly codeTextSize: Signal<number> = computed(() => this.current().codeTextSize);
  public readonly codeFontStack: Signal<string> = computed(() => PreferencesService.monoStack(this.current().codeFont));
  public readonly defaultComposer: Signal<ComposerSettings | null> = computed(() => this.current().defaultComposer);
  public readonly accessMode: Signal<AccessMode> = computed(() => this.current().accessMode);
  public readonly timeFormat: Signal<string> = computed(() => this.current().timeFormat);
  public readonly dateTimeFormat: Signal<string> = computed(() => this.current().dateTimeFormat);
  public readonly openMode: Signal<OpenMode> = computed(() => this.current().openMode);
  public readonly imageOpenMode: Signal<ImageOpenMode> = computed(() => this.current().imageOpenMode);
  public readonly clock: Signal<ClockChoice> =
    computed(() => this.current().timeFormat.includes(Resources.meridiemToken) ? ClockChoice.TwelveHour : ClockChoice.TwentyFourHour);

  public constructor() {
    effect(() => this.apply(this.current()));
  }

  public setOpenMode(openMode: OpenMode): void {
    this.update(current => current.with({ openMode }));
  }

  public flush(): boolean {
    try {
      const storage = this.document.defaultView?.localStorage;
      if (Object.isUndefined(storage))
        return false;
      storage.setItem(Resources.preferencesStorageKey, JSON.stringify(this.current().toJson()));
      return true;
    }
    catch {
      return false;
    }
  }

  public setImageOpenMode(imageOpenMode: ImageOpenMode): void {
    this.update(current => current.with({ imageOpenMode }));
  }

  public setTheme(theme: string): void {
    this.update(current => current.with({ theme }));
  }

  public setInterfaceFont(interfaceFont: FontChoice): void {
    this.update(current => current.with({ interfaceFont }));
  }

  public setCodeFont(codeFont: FontChoice): void {
    this.update(current => current.with({ codeFont }));
  }

  public setPanelTextSize(panelTextSize: number): void {
    this.update(current => current.with({ panelTextSize: PreferencesService.clampSize(panelTextSize) }));
  }

  public setMessageTextSize(messageTextSize: number): void {
    this.update(current => current.with({ messageTextSize: PreferencesService.clampSize(messageTextSize) }));
  }

  public setCodeTextSize(codeTextSize: number): void {
    this.update(current => current.with({ codeTextSize: PreferencesService.clampSize(codeTextSize) }));
  }

  public setTimeFormat(timeFormat: string): void {
    this.update(current => current.with({ timeFormat: String.isNullOrWhitespace(timeFormat) ? Resources.defaultTimeFormat : timeFormat }));
  }

  public setDateTimeFormat(dateTimeFormat: string): void {
    this.update(current => current.with({ dateTimeFormat: String.isNullOrWhitespace(dateTimeFormat) ? Resources.defaultDateTimeFormat : dateTimeFormat }));
  }

  public setClock(clock: ClockChoice): void {
    const formats = Resources.clockFormats[clock];
    this.update(current => current.with({ timeFormat: formats.time, dateTimeFormat: formats.dateTime }));
  }

  public setAccessMode(accessMode: AccessMode): void {
    this.update(current => current.with({ accessMode }));
  }

  public setDefaultComposer(defaultComposer: ComposerSettings | null): void {
    this.update(current => current.with({ defaultComposer }));
  }

  public composerFor(conversationId: string): ComposerSettings | null {
    return this.current().composerByConversation.get(conversationId) ?? null;
  }

  public rememberComposer(conversationId: string, composer: ComposerSettings): void {
    this.update(current => current.with({ composerByConversation: new Map(current.composerByConversation).set(conversationId, composer) }));
  }

  private update(change: (current: Preferences) => Preferences): void {
    const next = change(this.current());
    this.current.set(next);
    this.write(next);
  }

  private apply(preferences: Preferences): void {
    const root = this.document.documentElement;
    const sans = preferences.interfaceFont === FontChoice.Noldova ? Resources.noldovaSansStack : Resources.systemSansStack;
    const mono = PreferencesService.monoStack(preferences.codeFont);
    root.style.setProperty(Resources.sansFontVariable, sans);
    root.style.setProperty(Resources.monoFontVariable, mono);
    root.style.setProperty(Resources.panelTextSizeVariable, Resources.formatPixels(preferences.panelTextSize));
    root.style.setProperty(Resources.messageTextSizeVariable, Resources.formatPixels(preferences.messageTextSize));
    root.style.setProperty(Resources.codeTextSizeVariable, Resources.formatPixels(preferences.codeTextSize));
  }

  private static monoStack(choice: FontChoice): string {
    return choice === FontChoice.Noldova ? Resources.noldovaMonoStack : Resources.systemMonoStack;
  }

  private static clampSize(size: number): number {
    return Math.min(Resources.maximumTextSize, Math.max(Resources.minimumTextSize, Math.round(size)));
  }

  private read(): Preferences {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(Resources.preferencesStorageKey) ?? null;
      return Object.isNull(stored) ? Preferences.createDefault() : Preferences.fromJson(JSON.parse(stored));
    }
    catch {
      return Preferences.createDefault();
    }
  }

  private write(preferences: Preferences): void {
    try {
      this.document.defaultView?.localStorage.setItem(Resources.preferencesStorageKey, JSON.stringify(preferences.toJson()));
    }
    catch {
    }
  }
}
