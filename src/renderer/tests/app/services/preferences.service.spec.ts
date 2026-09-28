/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { ImageOpenMode } from "../../../src/app/enums/image-open-mode";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { AccessMode } from "../../../src/app/enums/access-mode";
import { FontChoice } from "../../../src/app/enums/font-choice";
import { ComposerSettings } from "../../../src/app/models/composer-settings";
import { Preferences } from "../../../src/app/models/preferences";
import { Resources } from "../../../src/app/resources";
import { PreferencesService } from "../../../src/app/services/preferences.service";

describe("PreferencesService", () => {
  it("defaults old settings to popup, persists the image choice and keeps it through other changes", () => {
    const service = TestBed.inject(PreferencesService);
    expect(service.imageOpenMode()).toBe(ImageOpenMode.Popup);
    expect(Preferences.fromJson({ imageOpenMode: "unknown" }).imageOpenMode).toBe(ImageOpenMode.Popup);
    service.setImageOpenMode(ImageOpenMode.Tab);
    service.setTheme(Resources.lightModernThemeId);
    const stored = Preferences.fromJson(JSON.parse(storage.getItem(Resources.preferencesStorageKey) ?? "null"));
    expect(stored.imageOpenMode).toBe(ImageOpenMode.Tab);
    expect(service.imageOpenMode()).toBe(ImageOpenMode.Tab);
  });
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = MemoryStorage.install(window);
  });

  it("starts from the defaults and applies them to the document", () => {
    const service = TestBed.inject(PreferencesService);
    TestBed.tick();

    expect(service.theme()).toBe(Resources.systemThemeId);
    expect(service.panelTextSize()).toBe(Resources.defaultPanelTextSize);
    expect(document.documentElement.style.getPropertyValue(Resources.panelTextSizeVariable)).toBe(Resources.formatPixels(Resources.defaultPanelTextSize));
    expect(document.documentElement.style.getPropertyValue(Resources.sansFontVariable)).toBe(Resources.noldovaSansStack);
  });

  it("stores every change and reads it back", () => {
    const service = TestBed.inject(PreferencesService);
    service.setTheme(Resources.darkModernThemeId);
    service.setInterfaceFont(FontChoice.System);
    service.setCodeFont(FontChoice.System);
    service.setPanelTextSize(16);
    service.setMessageTextSize(30);
    service.setCodeTextSize(12.4);
    service.setDefaultComposer(new ComposerSettings("codex", "gpt-5", "high", null));
    service.rememberComposer("c1", new ComposerSettings("claude", null, null, "a1", "alice"));
    TestBed.tick();

    expect(document.documentElement.style.getPropertyValue(Resources.monoFontVariable)).toBe(Resources.systemMonoStack);
    expect(service.codeFontStack()).toBe(Resources.systemMonoStack);
    expect(document.documentElement.style.getPropertyValue(Resources.panelTextSizeVariable)).toBe("16px");
    expect(document.documentElement.style.getPropertyValue(Resources.messageTextSizeVariable)).toBe(Resources.formatPixels(Resources.maximumTextSize));
    expect(document.documentElement.style.getPropertyValue(Resources.codeTextSizeVariable)).toBe(Resources.formatPixels(Resources.minimumTextSize));
    const stored = Preferences.fromJson(JSON.parse(storage.getItem(Resources.preferencesStorageKey) ?? "null"));
    expect(stored.theme).toBe(Resources.darkModernThemeId);
    expect(stored.interfaceFont).toBe(FontChoice.System);
    expect(stored.defaultComposer?.model).toBe("gpt-5");
    expect(stored.composerByConversation.get("c1")?.providerAccountId).toBe("a1");
    expect(service.composerFor("c1")?.provider).toBe("claude");
    expect(stored.composerByConversation.get("c1")?.responderTeammateId).toBe("alice");
    expect(service.composerFor("missing")).toBeNull();
    expect(service.accessMode()).toBe(AccessMode.Ask);
    service.setAccessMode(AccessMode.Full);
    expect(Preferences.fromJson(JSON.parse(storage.getItem(Resources.preferencesStorageKey) ?? "null")).accessMode).toBe(AccessMode.Full);
  });

  it("falls back to the defaults for unreadable storage", () => {
    storage.setItem(Resources.preferencesStorageKey, "{not json");
    expect(TestBed.inject(PreferencesService).theme()).toBe(Resources.systemThemeId);

    const lenient = Preferences.fromJson({
      theme: "purple", panelTextSize: 40, messageTextSize: "16", codeTextSize: 13, defaultComposer: { provider: " " },
      composerByConversation: { c1: { provider: "codex", model: 3 }, c2: 5 }
    });
    expect(lenient.theme).toBe("purple");
    expect(Preferences.fromJson({ theme: " " }).theme).toBe(Resources.systemThemeId);
    expect(lenient.panelTextSize).toBe(Resources.defaultPanelTextSize);
    expect(lenient.messageTextSize).toBe(Resources.defaultMessageTextSize);
    expect(lenient.codeTextSize).toBe(13);
    expect(lenient.defaultComposer).toBeNull();
    expect(lenient.composerByConversation.get("c1")?.model).toBeNull();
    expect(lenient.composerByConversation.has("c2")).toBe(false);
    expect(lenient.timeFormat).toBe(Resources.defaultTimeFormat);
    expect(Preferences.fromJson({ timeFormat: "h:mm a", dateTimeFormat: " " }).timeFormat).toBe("h:mm a");
    expect(Preferences.fromJson({ timeFormat: "h:mm a", dateTimeFormat: " " }).dateTimeFormat).toBe(Resources.defaultDateTimeFormat);
    expect(Preferences.fromJson([]).codeFont).toBe(FontChoice.Noldova);
    expect(Preferences.fromJson(null).toJson()).toEqual(Preferences.createDefault().toJson());
  });

  it("keeps a chosen theme", () => {
    const service = TestBed.inject(PreferencesService);
    service.setTheme(Resources.lightModernThemeId);
    TestBed.tick();

    expect(service.theme()).toBe(Resources.lightModernThemeId);
  });
});
