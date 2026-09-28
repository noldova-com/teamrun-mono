/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { AppView } from "../../../src/app/enums/app-view";
import { PanelId } from "../../../src/app/enums/panel-id";
import { SettingsSection } from "../../../src/app/enums/settings-section";
import { TabDropTarget } from "../../../src/app/models/tab-drop-target";
import { TabGroup } from "../../../src/app/models/tab-group";
import { LayoutService } from "../../../src/app/services/layout.service";
import { NavigationService } from "../../../src/app/services/navigation.service";
import { ImageSource } from "../../../src/app/models/image-source";

describe("NavigationService", () => {
  it("reuses image tabs, closes neighbours and leaves an active settings tab alone", () => {
    const navigation = TestBed.inject(NavigationService);
    const first = new ImageSource("1", "same.png", "D:/one.png", null);
    const second = new ImageSource("2", "same.png", "D:/two.png", null);
    navigation.openImage(first);
    const a = navigation.activeImage()!;
    navigation.openImage(second);
    const b = navigation.activeImage()!;
    navigation.openImage(new ImageSource("different-key", "same.png", "D:/one.png", null));
    expect(navigation.images()).toHaveLength(2);
    expect(navigation.activeImage()).toBe(a);
    navigation.openSettings();
    navigation.showImage(b.id);
    navigation.closeSettingsTab();
    expect(navigation.view()).toBe(AppView.Image);
    navigation.closeImage(b.id);
    expect(navigation.activeImage()).toBe(a);
    navigation.openSettings();
    navigation.closeImage(a.id);
    expect(navigation.view()).toBe(AppView.Settings);
    navigation.openImage(first);
    navigation.closeImages();
    expect(navigation.images()).toHaveLength(0);
    expect(navigation.view()).toBe(AppView.Chat);
  });

  it("owns a draft image URL until its tab closes", () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:tab-owned");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const file = new File(["image"], "draft.png", { type: "image/png" });
    const navigation = TestBed.inject(NavigationService);
    const source = new ImageSource("draft", "draft.png", null, "blob:composer-owned", file);
    navigation.openImage(source);
    const document = navigation.activeImage()!;
    expect(document.data.image.data).toBe("blob:tab-owned");
    navigation.openImage(source);
    expect(create).toHaveBeenCalledTimes(1);
    navigation.closeImage(document.id);
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:tab-owned");
    create.mockRestore();
    revoke.mockRestore();
  });
  it("opens settings on a section, switches sections, and returns to the chat", () => {
    const navigation = TestBed.inject(NavigationService);
    expect(navigation.view()).toBe(AppView.Chat);

    navigation.openSettings(SettingsSection.Teammates);
    expect(navigation.view()).toBe(AppView.Settings);
    expect(navigation.section()).toBe(SettingsSection.Teammates);

    navigation.showSection(SettingsSection.About);
    navigation.showChat();
    expect(navigation.settingsOpen()).toBe(true);
    navigation.openSettings();
    expect(navigation.section()).toBe(SettingsSection.About);
    expect(navigation.view()).toBe(AppView.Settings);
    navigation.closeSettingsTab();
    expect(navigation.settingsOpen()).toBe(false);
    expect(navigation.view()).toBe(AppView.Chat);
  });

  it("shows a panel placed among the conversations until a conversation, Settings or an image is shown", () => {
    MemoryStorage.install(window);
    const navigation = TestBed.inject(NavigationService);
    const layout = TestBed.inject(LayoutService);
    const image = new ImageSource("1", "one.png", "D:/one.png", null);

    layout.movePanel(PanelId.Changes, new TabDropTarget(TabGroup.documentsId, 0));
    expect(navigation.view()).toBe(AppView.Panel);
    expect(navigation.panel()).toBe(PanelId.Changes);

    navigation.openSettings();
    expect(navigation.view()).toBe(AppView.Settings);
    expect(navigation.panel()).toBeNull();
    layout.activatePanel(PanelId.Changes);
    navigation.closeSettingsTab();
    expect(navigation.settingsOpen()).toBe(false);
    expect(navigation.view()).toBe(AppView.Panel);
    navigation.showChat();
    expect(navigation.view()).toBe(AppView.Chat);

    navigation.openImage(image);
    layout.activatePanel(PanelId.Changes);
    navigation.closeImages();
    expect(navigation.view()).toBe(AppView.Panel);
    navigation.openImage(image);
    expect(navigation.view()).toBe(AppView.Image);
    layout.closePanel(PanelId.Changes);
    expect(navigation.view()).toBe(AppView.Image);
    navigation.closeImages();
  });
});
