/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { Theme } from "../../../src/app/models/theme";
import { Resources } from "../../../src/app/resources";
import { PreferencesService } from "../../../src/app/services/preferences.service";
import { ThemeService } from "../../../src/app/services/theme.service";

describe("ThemeService", () => {
  it("offers the built-in themes, follows the system by default, and writes the chosen theme's colours to the document", () => {
    MemoryStorage.install(window);
    const service = TestBed.inject(ThemeService);
    const preferences = TestBed.inject(PreferencesService);
    const root = document.documentElement;
    TestBed.tick();

    expect(service.themes.map(t => t.id)).toEqual([Resources.darkModernThemeId, Resources.lightModernThemeId]);
    expect(service.themes.map(t => t.name)).toEqual(["Dark Modern", "Light Modern"]);
    expect(service.active().id).toBe(Resources.darkModernThemeId);
    expect(service.dark()).toBe(true);
    expect(root.style.colorScheme).toBe(Resources.darkScheme);
    expect(root.style.getPropertyValue("--tr-window")).toBe("#181818");
    expect(root.style.getPropertyValue("--tr-panel")).toBe("#1F1F1F");
    expect(root.style.getPropertyValue("--tr-accent")).toBe("#0078D4");
    expect(root.style.getPropertyValue("--mat-sys-primary")).toBe("#0078D4");
    expect(root.style.getPropertyValue("--tr-terminal-foreground")).toBe("#CCCCCC");
    expect(root.style.getPropertyValue("--tr-terminal-cursor")).toBe("#CCCCCC");
    expect(root.style.getPropertyValue("--tr-terminal-selection")).toBe("#264F78");
    expect(root.style.getPropertyValue("--tr-terminal-green")).toBe("#0DBC79");
    expect(root.style.getPropertyValue("--tr-terminal-bright-white")).toBe("#E5E5E5");

    preferences.setTheme(Resources.lightModernThemeId);
    TestBed.tick();
    expect(service.active().name).toBe("Light Modern");
    expect(service.dark()).toBe(false);
    expect(root.style.colorScheme).toBe(Resources.lightScheme);
    expect(root.style.getPropertyValue("--tr-window")).toBe("#F8F8F8");
    expect(root.style.getPropertyValue("--tr-text-muted")).toBe("#616161");
    expect(root.style.getPropertyValue("--tr-terminal-foreground")).toBe("#3B3B3B");
    expect(root.style.getPropertyValue("--tr-terminal-cursor")).toBe("#005FB8");
    expect(root.style.getPropertyValue("--tr-terminal-selection")).toBe("#ADD6FF");
    expect(root.style.getPropertyValue("--tr-terminal-green")).toBe("#107C10");
    expect(root.style.getPropertyValue("--tr-terminal-bright-white")).toBe("#A5A5A5");

    preferences.setTheme("purple");
    TestBed.tick();
    expect(service.active().id).toBe(Resources.darkModernThemeId);
    expect(root.style.getPropertyValue("--tr-window")).toBe("#181818");
  });

  it("reads a theme file leniently and resolves tokens through their fallback keys", () => {
    expect(Theme.fromJson("x", null)).toBeNull();
    expect(Theme.fromJson("x", { type: "dark", colors: {} })).toBeNull();
    const theme = Theme.fromJson("x", { name: "Plain", colors: { "editor.background": "#101010", "widget.border": "#303030", "focusBorder": "blue", "foreground": 3 } });
    expect(theme).not.toBeNull();
    expect(theme!.dark).toBe(true);
    expect(theme!.color("editor.background")).toBe("#101010");
    expect(theme!.color("focusBorder")).toBeNull();
    expect(theme!.color("foreground")).toBeNull();
    const cardBorder = Resources.themeTokens.find(t => t.variable === "--tr-card-border")!;
    expect(cardBorder.resolve(theme!)).toBe("#303030");
    const accent = Resources.themeTokens.find(t => t.variable === "--tr-accent")!;
    expect(accent.resolve(theme!)).toBeNull();
    expect(Theme.fromJson("y", { name: "Bright", type: "light", colors: {} })!.dark).toBe(false);
  });
});
