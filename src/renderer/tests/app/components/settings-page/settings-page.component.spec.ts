/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MethodName } from "@noldova/teamrun-protocol";

import { ClockChoice } from "../../../../src/app/enums/clock-choice";
import { SettingsSection } from "../../../../src/app/enums/settings-section";
import { ShortcutAction } from "../../../../src/app/enums/shortcut-action";
import { AppView } from "../../../../src/app/enums/app-view";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { NavigationService } from "../../../../src/app/services/navigation.service";
import { PreferencesService } from "../../../../src/app/services/preferences.service";
import { TerminalsService } from "../../../../src/app/services/terminals.service";
import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { SettingsPageComponent } from "../../../../src/app/components/settings-page/settings-page.component";

describe("SettingsPageComponent", () => {
  it("shows every section and closes back to the chat", async () => {
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ imports: [SettingsPageComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const navigation = TestBed.inject(NavigationService);
    await store.initialize();
    navigation.openSettings(SettingsSection.General);
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.textContent).toContain(Resources.dataDirectoryLabel);
    });
    expect(element.textContent).toContain("D:\\data");
    expect(element.textContent).toContain(Resources.runtimeConnected);
    expect(element.textContent).toContain(Resources.clockLabel);
    const preferences = TestBed.inject(PreferencesService);
    const toggles = element.querySelectorAll<HTMLButtonElement>("mat-button-toggle button");
    toggles[toggles.length - 1]!.click();
    fixture.detectChanges();
    expect(preferences.clock()).toBe(ClockChoice.TwelveHour);
    expect(preferences.timeFormat()).toBe(Resources.twelveHourTimeFormat);
    const inputs = element.querySelectorAll<HTMLInputElement>("input[name='timeFormat'], input[name='dateTimeFormat']");
    inputs[0]!.value = "HH.mm";
    inputs[0]!.dispatchEvent(new Event("input"));
    inputs[1]!.value = " ";
    inputs[1]!.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    expect(preferences.timeFormat()).toBe("HH.mm");
    expect(preferences.dateTimeFormat()).toBe(Resources.defaultDateTimeFormat);
    expect(preferences.clock()).toBe(ClockChoice.TwentyFourHour);

    navigation.showSection(SettingsSection.Shortcuts);
    fixture.detectChanges();
    expect(element.textContent).toContain(Resources.shortcutLabels[ShortcutAction.NewConversation]);
    expect(element.querySelectorAll("kbd.tr-key").length).toBe(Resources.shortcuts.length);

    const expectations: [SettingsSection, string][] = [
      [SettingsSection.Appearance, Resources.themeLabel],
      [SettingsSection.Providers, SampleData.account.label],
      [SettingsSection.Teammates, Resources.noTeammates],
      [SettingsSection.Terminal, Resources.defaultShellLabel],
      [SettingsSection.Gallery, Resources.galleryHint],
      [SettingsSection.About, Resources.licensesTitle]
    ];
    for (const [section, text] of expectations) {
      navigation.showSection(section);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(element.textContent).toContain(Resources.sectionLabels[section]);
      expect(element.textContent).toContain(text);
    }

    navigation.showChat();
    expect(navigation.view()).toBe(AppView.Chat);
    store.dispose();
  });

  it("changes appearance and provider defaults from the controls", async () => {
    MemoryStorage.install(window);
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ imports: [SettingsPageComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const navigation = TestBed.inject(NavigationService);
    await store.initialize();
    navigation.openSettings(SettingsSection.Appearance);
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLElement>(".tr-theme-select")!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const options = Array.from(document.querySelectorAll<HTMLElement>("mat-option"));
    expect(options.map(t => t.textContent?.trim())).toEqual([Resources.systemThemeLabel, "Dark Modern", "Light Modern"]);
    options.find(t => t.textContent?.includes("Light Modern"))!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(TestBed.inject(PreferencesService).theme()).toBe(Resources.lightModernThemeId);
    expect(document.documentElement.style.colorScheme).toBe(Resources.lightScheme);

    navigation.showSection(SettingsSection.General);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.textContent).toContain(Resources.defaultsTitle);
    expect(element.textContent).toContain(SampleData.codex.displayName);
    expect(bridge.methods.filter(t => t === "ProviderModelCatalog").length).toBeGreaterThan(0);
    store.dispose();
  });

  it("chooses the default shell from the installed shells", async () => {
    MemoryStorage.install(window);
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ imports: [SettingsPageComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    TestBed.inject(NavigationService).openSettings(SettingsSection.Terminal);
    const fixture = TestBed.createComponent(SettingsPageComponent);
    const element = fixture.nativeElement as HTMLElement;
    const select = (): HTMLElement => element.querySelector<HTMLElement>(".tr-default-shell-select")!;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(select().textContent?.trim()).toBe("PowerShell");
    });

    select().click();
    fixture.detectChanges();
    await fixture.whenStable();
    const options = Array.from(document.querySelectorAll<HTMLElement>("mat-option"));
    expect(options.map(t => t.textContent?.trim())).toEqual(["PowerShell", "Command Prompt"]);
    options[1]!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(TestBed.inject(PreferencesService).defaultShellId()).toBe("cmd");
    expect(TestBed.inject(TerminalsService).defaultShell()?.id).toBe("cmd");
    expect(select().getAttribute("aria-label")).toBe(Resources.defaultShellLabel);
    expect(bridge.methods.filter(t => t === MethodName.TerminalShells)).toHaveLength(1);
  });
});
