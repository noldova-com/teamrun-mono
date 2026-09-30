/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { homedir } from "node:os";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { DesktopFixture } from "./fixtures/desktop.fixture.ts";
import { FixtureProvider } from "./fixtures/fixture-provider.fixture.ts";

let desktop: DesktopFixture;

test.beforeEach(async ({}, info) => {
  desktop = new DesktopFixture(info);
  await desktop.start();
});

test.afterEach(async () => {
  await desktop.dispose();
});

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box)
    throw new Error("The element is not drawn.");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragTab(page: Page, panel: string, over: Locator, target: () => Locator): Promise<void> {
  const from = await centerOf(page.locator(`.tr-tab[data-panel="${panel}"]`));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 24, from.y + 24, { steps: 4 });
  const middle = await centerOf(over);
  await page.mouse.move(middle.x, middle.y, { steps: 8 });
  const to = await centerOf(target());
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await expect(page.locator(".tr-drop-preview")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".tr-dock-guide")).toHaveCount(0);
}

function startSampling(page: Page): Promise<{ answer: string[]; thought: string[] }> {
  return page.evaluate(() => new Promise<{ answer: string[]; thought: string[] }>(resolve => {
    const answer: string[] = [];
    const thought: string[] = [];
    let started = false;
    let quiet = 0;
    const sample = (): void => {
      const card = Array.from(document.querySelectorAll<HTMLElement>("tr-message-card")).at(-1);
      const active = document.querySelector(".tr-reply-status") !== null;
      started ||= active;
      if (started) {
        answer.push(card?.querySelector<HTMLElement>("tr-markdown")?.innerText ?? "");
        thought.push(card?.querySelector<HTMLElement>("tr-activity-block li button span")?.innerText ?? "");
      }
      quiet = started && !active ? quiet + 1 : 0;
      if (quiet > 90)
        resolve({ answer, thought });
      else
        requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
}

async function sampleStreamedReply(page: Page): Promise<{ answer: string[]; thought: string[] }> {
  const sampling = startSampling(page);
  await page.locator("tr-composer textarea").fill("Stream slowly");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  return sampling;
}

function settle(page: Page): Promise<void> {
  return page.evaluate(() => new Promise<void>((resolve, reject) => {
    const revealed = (): string => {
      const card = Array.from(document.querySelectorAll<HTMLElement>("tr-message-card")).at(-1);
      return `${card?.querySelector<HTMLElement>("tr-markdown")?.innerText ?? ""}\n${card?.querySelector<HTMLElement>("tr-activity-block li button span")?.innerText ?? ""}`;
    };
    let previous = revealed();
    let quiet = 0;
    let frames = 0;
    const check = (): void => {
      const current = revealed();
      quiet = current === previous ? quiet + 1 : 0;
      previous = current;
      if (quiet >= 20)
        resolve();
      else if (++frames >= 1000)
        reject(new Error("The reveal did not settle within 1000 frames."));
      else
        requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }));
}

async function sampleStepwiseReply(page: Page, provider: FixtureProvider): Promise<{ answer: string[]; thought: string[] }> {
  const sampling = startSampling(page);
  await page.locator("tr-composer textarea").fill("Stream stepwise");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const batches = FixtureProvider.batches(FixtureProvider.streamedThought).length + FixtureProvider.batches(FixtureProvider.streamedAnswer).length;
  for (let index = 0; index < batches; index++) {
    await provider.releaseBatch();
    await settle(page);
  }
  return sampling;
}

test("captures the full renderer viewport when the native window starts smaller", async () => {
  await desktop.setWindowSize(1000, 680);
  await desktop.restart();
  await desktop.page.evaluate(() => {
    const marker = document.createElement("div");
    marker.style.cssText = "position:fixed;right:0;bottom:0;width:16px;height:16px;background:rgb(219,47,173);z-index:2147483647";
    document.body.append(marker);
  });
  const image = await desktop.capture("viewport-boundary");
  expect(await desktop.readPixel(image, 1919, 1079)).toEqual([173, 47, 219, 255]);
  await desktop.setWindowSize(900, 600);
  const resizedImage = await desktop.capture("viewport-boundary-after-resize");
  expect(await desktop.readPixel(resizedImage, 1919, 1079)).toEqual([173, 47, 219, 255]);
});

test("permits clipboard writing without granting clipboard reads or notifications", async () => {
  const write: unknown = await desktop.page.evaluate("navigator.permissions.query({name: 'clipboard-write'}).then(t => t.state)");
  const read: unknown = await desktop.page.evaluate("navigator.permissions.query({name: 'clipboard-read'}).then(t => t.state)");
  const notifications = await desktop.page.evaluate(() => navigator.permissions.query({ name: "notifications" }).then(t => t.state));
  expect(write).toBe("granted");
  expect(read).toBe("denied");
  expect(notifications).toBe("denied");
});

test("keeps application updates disabled in the branded development application", async () => {
  await desktop.page.getByRole("button", { name: "Settings", exact: true }).click();
  await desktop.page.locator("tr-settings-page a").filter({ hasText: "About" }).click();
  await expect(desktop.page.locator("tr-app-updates")).toContainText("Updates are unavailable when running TeamRun from source.");
  await expect(desktop.page.getByRole("button", { name: "Check for updates", exact: true })).toHaveCount(0);
  await expect(desktop.page.locator("tr-window-controls .tr-update-open")).toHaveCount(0);
  await expect(desktop.page.locator("tr-app-updates").getByRole("button", { name: /Download the latest version/ })).toHaveCount(1);
  await desktop.capture("branded-development-about");
});

test("preserves drafts and tabs across Settings, navigation, sending and restart", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).dblclick();
  const composer = page.locator("tr-composer textarea");
  await composer.fill("A saved draft");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("tr-settings-page")).toBeVisible();
  await desktop.capture("settings-opened");
  await page.getByRole("button", { name: "Conversation A", exact: true }).click();
  await expect(composer).toHaveValue("A saved draft");
  await desktop.restart();
  await expect(desktop.page.locator("tr-composer textarea")).toHaveValue("A saved draft");
  await desktop.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(desktop.page.locator("tr-message-list")).toContainText("Fixture reply completed.");
  await expect(desktop.page.locator("tr-composer textarea")).toHaveValue("");
  expect(desktop.provider.requests).toHaveLength(1);
  await desktop.capture("main-window");
});

test("arranges panels in every region by dragging and from the tab menu, and restores the arrangement", async () => {
  let page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).dblclick();
  await page.locator("tr-composer textarea").fill("Kept while the panels move");
  const documents = (): Locator => page.locator(".tr-documents");
  const middleGroup = (panel: string): Locator => page.locator(`tr-tab-group:not([data-side]):has(.tr-tab[data-panel="${panel}"])`);

  await dragTab(page, "Changes", documents().locator("main"), () => page.locator('.tr-dock-compass [data-drop-edge="Right"]'));
  await expect(middleGroup("Changes").locator("tr-changes-panel")).toBeVisible();
  await expect(page.locator("tr-dock[data-side='Right']")).toBeHidden();
  await expect(page.locator("tr-composer textarea")).toHaveValue("Kept while the panels move");
  await desktop.capture("docking-split-beside-conversation");

  await page.locator("tr-dock[data-side='Bottom'] .tr-dock-strip-button").click();
  await dragTab(page, "Activity", documents().locator("main"), () => page.locator(".tr-dock-compass [data-drop-center]"));
  await expect(page.locator('.tr-panel-tab[data-panel="Activity"]')).toHaveAttribute("aria-selected", "true");
  await expect(documents().locator("main tr-activity-panel")).toBeVisible();
  await expect(page.locator("header")).toContainText("Activity");
  await desktop.capture("docking-tab-among-conversations");

  await dragTab(page, "Explorer", documents().locator("main"), () => page.locator('[data-guide="Bottom"]'));
  await expect(page.locator("tr-tab-group[data-side='Bottom'] tr-sidebar")).toBeVisible();
  await expect(page.locator("tr-dock[data-side='Left']")).toBeHidden();

  await page.locator('.tr-panel-tab[data-panel="Activity"]').focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Move to" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menuitem", { name: "Split to the left" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(middleGroup("Activity").locator("tr-activity-panel")).toBeVisible();
  await expect(page.locator('.tr-tab[data-panel="Activity"]')).toBeFocused();
  await expect(page.locator("tr-document-tabs .tr-panel-tab")).toHaveCount(0);
  const conversation = await documents().boundingBox();
  const activity = await middleGroup("Activity").boundingBox();
  expect(activity!.y).toBeGreaterThan(conversation!.y + conversation!.height);
  expect(activity!.x).toBe(conversation!.x);

  const sash = await centerOf(page.locator("tr-resize-handle.tr-split-handle[data-edge='Bottom']"));
  await page.mouse.move(sash.x, sash.y);
  await page.mouse.down();
  await page.mouse.move(sash.x, sash.y - 120, { steps: 6 });
  await page.mouse.up();
  const resized = await documents().boundingBox();
  expect(Math.round(resized!.height)).toBe(Math.round(conversation!.height) - 120);
  await desktop.capture("docking-arranged");

  await desktop.restart();
  page = desktop.page;
  await expect(middleGroup("Changes").locator("tr-changes-panel")).toBeVisible();
  await expect(middleGroup("Activity").locator("tr-activity-panel")).toBeVisible();
  await expect(page.locator("tr-tab-group[data-side='Bottom'] tr-sidebar")).toBeVisible();
  expect(Math.round((await documents().boundingBox())!.height)).toBe(Math.round(resized!.height));
  await expect(page.locator("tr-composer textarea")).toHaveValue("Kept while the panels move");
  await desktop.capture("docking-restored");

  await page.getByRole("button", { name: "Panels", exact: true }).click();
  await page.getByRole("menuitem", { name: "Reset the layout" }).click();
  await expect(page.locator("tr-tab-group[data-side='Left'] tr-sidebar")).toBeVisible();
  await expect(page.locator('tr-tab-group[data-side="Right"] .tr-tab[data-panel="Changes"]')).toBeVisible();
  await expect(page.locator("tr-dock[data-side='Bottom'] .tr-dock-strip")).toBeVisible();
  await expect(page.locator("tr-tab-group:not([data-side])")).toHaveCount(0);
});

test("opens the default shell with disposable history, preserves output through hiding and reload, restarts, and closes it", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).click();
  await page.keyboard.press("Control+Shift+Backquote");
  const terminal = page.locator("tr-tab-group[data-side='Bottom'] tr-terminal-panel");
  await expect(terminal.locator(".xterm")).toBeVisible();
  await expect(terminal.locator("textarea")).toBeFocused();
  const panel = (await terminal.locator(".tr-terminal-screen").boundingBox())!;
  const drawn = (await terminal.locator(".xterm-screen").boundingBox())!;
  expect(Math.round(drawn.x - panel.x)).toBe(8);
  expect(Math.round(drawn.y - panel.y)).toBe(6);
  expect(panel.x + panel.width - (drawn.x + drawn.width)).toBeGreaterThanOrEqual(8);
  expect(panel.y + panel.height - (drawn.y + drawn.height)).toBeGreaterThanOrEqual(6);

  await page.keyboard.type("echo teamrun-terminal-check");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(/teamrun-terminal-check[\s\S]*teamrun-terminal-check/, { timeout: 60_000 });
  await desktop.capture("terminal-opened");

  await page.keyboard.press("Control+Backquote");
  await expect(page.locator("tr-terminal-panel")).toHaveCount(0);
  await page.keyboard.press("Control+Backquote");
  await expect(terminal.locator("textarea")).toBeFocused();
  await expect(terminal.locator(".xterm-rows")).toContainText(/teamrun-terminal-check[\s\S]*teamrun-terminal-check/);

  await page.reload();
  await expect(terminal.locator(".xterm-rows")).toContainText(/teamrun-terminal-check[\s\S]*teamrun-terminal-check/);
  await terminal.locator(".xterm-screen").click();
  await page.keyboard.type("echo teamrun-after-reload");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(/teamrun-after-reload[\s\S]*teamrun-after-reload/);
  await desktop.expectShellHistory("echo teamrun-terminal-check", "echo teamrun-after-reload");

  await page.keyboard.type("exit");
  await page.keyboard.press("Enter");
  await terminal.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(terminal.getByRole("button", { name: "Restart", exact: true })).toHaveCount(0);
  await terminal.locator(".xterm-screen").click();
  await page.keyboard.type("echo teamrun-after-restart");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(/teamrun-after-restart[\s\S]*teamrun-after-restart/);
  await desktop.expectShellHistory("echo teamrun-terminal-check", "echo teamrun-after-reload", "echo teamrun-after-restart");

  await page.locator("tr-tab-group[data-side='Bottom'] .tr-tab[data-panel^='Terminal:'] .tr-tab-close").click();
  await expect(page.locator(".tr-tab[data-panel^='Terminal:']")).toHaveCount(0);
  await expect(page.locator("tr-terminal-panel")).toHaveCount(0);
});

test("retains terminal output after a narrow resize, widening and a window reload", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).click();
  await page.keyboard.press("Control+Shift+Backquote");
  const terminal = page.locator("tr-tab-group[data-side='Bottom'] tr-terminal-panel");
  await expect(terminal.locator("textarea")).toBeFocused();
  await page.keyboard.type("echo teamrun-resize-retains-this-output");
  await page.keyboard.press("Enter");
  const repeated = /teamrun-resize-retains-this-output[\s\S]*teamrun-resize-retains-this-output/;
  await expect(terminal.locator(".xterm-rows")).toContainText(repeated, { timeout: 60_000 });
  const host = terminal.locator(".tr-terminal-screen");
  const original = await host.boundingBox();
  if (!original)
    throw new Error("The terminal host is not drawn.");

  await terminal.locator(".tr-terminal-screen").evaluate(element => {
    element.style.width = "1px";
    element.style.height = "1px";
    element.style.flex = "none";
  });
  await expect.poll(async () => {
    const size = (await desktop.terminalState()).size;
    return `${size.columns}x${size.rows}`;
  }).toBe("2x1");
  await terminal.locator(".tr-terminal-screen").evaluate(element => {
    element.style.removeProperty("width");
    element.style.removeProperty("height");
    element.style.removeProperty("flex");
  });
  await expect.poll(async () => (await host.boundingBox())?.width).toBe(original.width);
  await expect.poll(async () => (await host.boundingBox())?.height).toBe(original.height);
  await expect.poll(async () => (await desktop.terminalState()).size.columns).toBeGreaterThan("echo teamrun-resize-retains-this-output".length);
  await desktop.scrollTerminalToStart();
  await expect(terminal.locator(".xterm-rows")).toContainText(repeated);

  await page.reload();
  await expect(terminal.locator(".xterm-rows")).toContainText(/\S/);
  await desktop.scrollTerminalToStart();
  await expect(terminal.locator(".xterm-rows")).toContainText(repeated);
  await desktop.capture("terminal-after-resize-reload");
});

test("scrolls through a terminal's stored output after a reload, oldest line first", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).click();
  await page.keyboard.press("Control+Shift+Backquote");
  const terminal = page.locator("tr-tab-group[data-side='Bottom'] tr-terminal-panel");
  await expect(terminal.locator("textarea")).toBeFocused();
  await page.keyboard.type("node -e \"for (let i = 1; i <= 1500; i++) console.log('teamrun-stored-line ' + i)\"");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText("teamrun-stored-line 1500", { timeout: 60_000 });
  await expect.poll(async () => (await desktop.terminalState()).stored.end).toBeGreaterThan(0);

  await page.reload();
  await expect(terminal.locator(".xterm-rows")).toContainText("teamrun-stored-line 1500");
  await desktop.scrollTerminalToEarliest(/teamrun-stored-line 1(?!\d)/);
  const text = (await terminal.locator(".xterm-rows").textContent()) ?? "";

  expect(text.search(/teamrun-stored-line 1(?!\d)/)).toBeGreaterThanOrEqual(0);
  expect(text.search(/teamrun-stored-line 1(?!\d)/)).toBeLessThan(text.search(/teamrun-stored-line 2(?!\d)/));
  await desktop.capture("terminal-stored-scroll");
});

test("opens a terminal in the home folder when no project is selected", async () => {
  const page = desktop.page;
  const project = page.locator("tr-sidebar div").filter({ has: page.getByRole("button", { name: "project", exact: true }) }).last();
  await project.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Forget project" }).click();
  await page.getByRole("button", { name: "Forget", exact: true }).click();
  await expect(page.locator("tr-sidebar").getByText("Open a folder to start.")).toBeVisible();

  await page.keyboard.press("Control+Shift+Backquote");
  const terminal = page.locator("tr-tab-group[data-side='Bottom'] tr-terminal-panel");
  await expect(terminal.locator("textarea")).toBeFocused();
  await page.keyboard.type("pwd");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText(homedir(), { timeout: 60_000 });
  await expect(terminal.locator(".xterm-rows")).not.toContainText("teamrun-ui-");
});

test("opens the shell chosen from the menu beside the new terminal button and shows its icon and name on its tab", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).click();
  await page.keyboard.press("Control+Shift+Backquote");
  const dock = page.locator("tr-tab-group[data-side='Bottom']");
  await expect(dock.locator("tr-terminal-panel textarea")).toBeFocused();

  await dock.getByRole("button", { name: "Choose a shell", exact: true }).click();
  await expect(page.getByRole("menuitem")).toHaveText([/Default$/, /Fixture shell$/]);
  await desktop.capture("terminal-shell-menu");
  await page.getByRole("menuitem", { name: /Fixture shell/ }).click();

  const tab = dock.locator(".tr-tab[aria-selected='true']");
  await expect(tab.locator(".tr-tab-label")).toHaveText("Fixture shell");
  await expect(tab.locator(".tr-tab-shell-icon")).toHaveText("terminal");
  await expect(dock.locator("tr-terminal-panel .xterm-rows")).toContainText("teamrun-fixture-shell-ready", { timeout: 60_000 });
  await desktop.capture("terminal-chosen-shell");
});

test("drops a terminal's oldest stored output beyond the limit set in Settings and says so at the top", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator(".tr-settings-nav").getByText("Terminal", { exact: true }).click();
  const limit = page.getByRole("spinbutton", { name: "Output kept per terminal" });
  await limit.fill("10");
  await limit.press("Tab");
  await desktop.capture("terminal-output-limit");

  await page.getByRole("button", { name: "Conversation A", exact: true }).click();
  await page.keyboard.press("Control+Shift+Backquote");
  const terminal = page.locator("tr-tab-group[data-side='Bottom'] tr-terminal-panel");
  await expect(terminal.locator("textarea")).toBeFocused();
  await page.keyboard.type("node -e \"const c = t => t.split('').map((x, j) => '\\x1b[3' + (j % 7 + 1) + 'm' + x).join('') + '\\x1b[0m'; for (let i = 1; i <= 3600; i++) console.log(c('teamrun-capped-line-' + i + '-' + 'x'.repeat(76)))\"");
  await page.keyboard.press("Enter");
  await expect(terminal.locator(".xterm-rows")).toContainText("teamrun-capped-line-3600-", { timeout: 120_000 });
  await expect.poll(async () => (await desktop.terminalState()).stored.dropped, { timeout: 30_000 }).toBeGreaterThan(0);

  await page.reload();
  await expect(terminal.locator(".xterm-rows")).toContainText("teamrun-capped-line-3600-");
  await desktop.scrollTerminalToEarliest(/older lines were dropped/);
  const text = (await terminal.locator(".xterm-rows").textContent()) ?? "";
  const stored = (await desktop.terminalState()).stored;

  expect(stored.start).toBe(stored.dropped);
  expect(text.indexOf(`${stored.dropped.toLocaleString("en-US")} older lines were dropped`)).toBe(0);
  expect(text).toMatch(/older lines were dropped[\s\S]*teamrun-capped-line-\d+-/);
  await desktop.capture("terminal-dropped-lines");
});

test("opens new terminals with the default shell chosen in Settings", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator(".tr-settings-nav").getByText("Terminal", { exact: true }).click();
  const select = page.getByRole("combobox", { name: "Default shell" });
  await expect(select).not.toHaveText("");
  await select.click();
  await page.getByRole("option", { name: "Fixture shell", exact: true }).click();
  await expect(select).toHaveText("Fixture shell");
  await desktop.capture("terminal-settings");

  await page.getByRole("button", { name: "Conversation A", exact: true }).click();
  await page.keyboard.press("Control+Shift+Backquote");
  const dock = page.locator("tr-tab-group[data-side='Bottom']");
  await expect(dock.locator(".tr-tab[aria-selected='true'] .tr-tab-label")).toHaveText("Fixture shell");
  await expect(dock.locator("tr-terminal-panel .xterm-rows")).toContainText("teamrun-fixture-shell-ready", { timeout: 60_000 });
  await dock.getByRole("button", { name: "Choose a shell", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Default/ })).toHaveText(/Fixture shell/);
});

test("quits when a window with a pending state save is destroyed", async () => {
  expect(await desktop.destroyWindow()).toBe(0);
});

test("opens an attachment in a modal or tab and retains the composer draft", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).dblclick();
  await page.locator("tr-composer textarea").fill("Image draft");
  await desktop.attachImage();
  const thumbnail = page.getByRole("button", { name: "fixture.png", exact: true });
  await expect(thumbnail).toBeVisible();
  await thumbnail.click();
  await expect(page.locator("tr-image-dialog")).toBeVisible();
  await desktop.capture("image-modal");
  await page.keyboard.press("Escape");
  await expect(page.locator("tr-image-dialog")).toHaveCount(0);
  await thumbnail.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open in a new tab", exact: true }).click();
  await expect(page.locator("tr-image-viewer")).toBeVisible();
  await desktop.capture("image-tab");
  await page.getByRole("button", { name: "Conversation A", exact: true }).click();
  await expect(page.locator("tr-composer textarea")).toHaveValue("Image draft");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("tr-message-list")).toContainText("Fixture reply completed.");
  expect(desktop.provider.requests[0]?.attachments).toHaveLength(1);
});

test("shows approvals and stops an active fixture reply", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).dblclick();
  await page.locator("tr-composer textarea").fill("Request approval");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Allow fixture", exact: true })).toBeVisible();
  await desktop.capture("approval-request");
  await page.getByRole("button", { name: "Allow fixture", exact: true }).click();
  await expect(page.locator("tr-message-list")).toContainText("Fixture reply completed.");
  await page.locator("tr-composer textarea").fill("Wait for cancellation");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("tr-message-list")).toContainText("Waiting for Stop.");
  for (const [spinner, text] of [[".tr-tab-working .tr-tab-spinner", ".tr-tab-working .tr-tab-label"], ["tr-sidebar .tr-row-working", "tr-sidebar .tr-row-working"]] as const) {
    await expect(page.locator(spinner)).toBeVisible();
    const drawn = await page.locator(spinner).evaluate((element, label) => {
      const circle = element.querySelector<SVGCircleElement>(".mdc-circular-progress__indeterminate-container circle")!;
      const box = element.getBoundingClientRect();
      const ring = circle.getBoundingClientRect();
      const beside = label === null ? element.parentElement! : document.querySelector(label)!;
      return { width: box.width, height: box.height, radius: Number(circle.getAttribute("r")), ring: Math.max(ring.width, ring.height),
        stroke: getComputedStyle(circle).stroke, text: getComputedStyle(beside).color };
    }, spinner === text ? null : text);
    expect([drawn.width, drawn.height], spinner).toEqual([12, 12]);
    expect(drawn.radius, spinner).toBeGreaterThan(0);
    expect(drawn.ring, spinner).toBeGreaterThan(4);
    expect(drawn.stroke, spinner).toBe(drawn.text);
  }
  await desktop.capture("running-conversation-spinners");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0);
  await expect(page.locator("tr-composer textarea")).toBeEnabled();
});

test("sets the rewind dialog's checkbox apart from its description, with the standard gap to its label and the box level with the label's first line", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).dblclick();
  await page.locator("tr-composer textarea").fill("Rewind me");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("tr-message-list")).toContainText("Fixture reply completed.");
  const question = page.locator("tr-message-card").filter({ hasText: "Rewind me" }).last();
  await question.hover();
  await question.getByRole("button", { name: "Rewind to here", exact: true }).click();
  const checkbox = page.locator("mat-dialog-container mat-checkbox");
  await expect(checkbox).toBeVisible();
  await page.locator("mat-dialog-container").evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(t => t.finished)));
  const geometry = await checkbox.evaluate(element => {
    const box = element.querySelector(".mdc-checkbox__background")!.getBoundingClientRect();
    const label = element.querySelector(".mat-internal-form-field-label")!;
    const range = document.createRange();
    range.selectNodeContents(label);
    const lines = Array.from(range.getClientRects());
    const content = label.getBoundingClientRect().left + parseFloat(getComputedStyle(label).paddingLeft);
    const text = element.closest("mat-dialog-content")!.querySelector("p")!.getBoundingClientRect();
    return { gap: content - box.right, above: element.getBoundingClientRect().top - text.bottom, boxTop: box.top, lineTop: lines[0]!.top, wraps: new Set(lines.map(t => Math.round(t.top))).size > 1 };
  });
  expect(geometry.gap).toBeCloseTo(8, 0);
  expect(geometry.above).toBeCloseTo(12, 0);
  expect(Math.abs(geometry.boxTop - geometry.lineTop)).toBeLessThanOrEqual(1);
  expect(geometry.wraps).toBe(true);
  await desktop.capture("rewind-dialog");
  await page.locator("mat-dialog-container").getByRole("button", { name: "Close", exact: true }).click();
  await expect(checkbox).toHaveCount(0);
});

test("keeps Settings reachable at enlarged zoom and presents provider and teammate tables", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator(".tr-settings-nav").getByText("Providers", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Add Provider", exact: true })).toBeVisible();
  await desktop.capture("providers");
  await page.locator(".tr-settings-nav").getByText("Teammates", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Add teammate", exact: true })).toBeVisible();
  await desktop.setZoom(2);
  await expect(page.getByRole("button", { name: "Add teammate", exact: true })).toBeInViewport();
  await desktop.capture("settings-at-200-percent");
});

test("reveals a streamed reply in small steps and never shows Markdown symbols", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).dblclick();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { answer, thought } = await sampleStepwiseReply(page, desktop.provider);
  const symbols = ["**", "`", "](", "|", "```"];
  await test.info().attach("reveal-steps", {
    body: JSON.stringify({ answerSteps: new Set(answer).size, thoughtSteps: new Set(thought).size, frames: answer.length }),
    contentType: "application/json"
  });

  expect(new Set(answer).size).toBeGreaterThan(FixtureProvider.batches(FixtureProvider.streamedAnswer).length * 2);
  expect(new Set(thought).size).toBeGreaterThan(FixtureProvider.batches(FixtureProvider.streamedThought).length * 2);
  expect(answer.filter(t => symbols.some(u => t.includes(u)))).toEqual([]);
  expect(answer.every((t, index) => index === 0 || t.trimEnd().startsWith(answer[index - 1]!.trimEnd()))).toBe(true);
  expect(answer.at(-1)).toContain("Here is bold text, some inline code and a link.");
  expect(answer.at(-1)).toContain("let x = 1;");
  expect(answer.at(-1)).toContain("All done, with a last sentence that takes a moment.");
  expect(thought.filter(t => t.length > 0).at(-1)).toBe(FixtureProvider.streamedThought);
  await expect(page.locator("tr-message-card").last().locator("[aria-live]")).toHaveCount(0);
  await desktop.capture("streamed-reply");
});

test("shows a streamed reply as it arrives when reduced motion is preferred", async () => {
  const page = desktop.page;
  await page.getByRole("button", { name: "Conversation A", exact: true }).dblclick();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { answer, thought } = await sampleStreamedReply(page);

  expect(new Set(answer).size).toBeLessThanOrEqual(FixtureProvider.batches(FixtureProvider.streamedAnswer).length + 3);
  expect(new Set(thought).size).toBeLessThanOrEqual(FixtureProvider.batches(FixtureProvider.streamedThought).length + 3);
  expect(answer.filter(t => ["**", "`", "](", "|", "```"].some(u => t.includes(u)))).toEqual([]);
  expect(answer.at(-1)).toContain("All done, with a last sentence that takes a moment.");
});

for (const motion of ["no-preference", "reduce"] as const)
  test(`grows replies in a long conversation without renderer errors (${motion})`, async () => {
    const page = desktop.page;
    await page.getByRole("button", { name: "Conversation A", exact: true }).dblclick();
    await page.emulateMedia({ reducedMotion: motion });
    for (let index = 0; index < 30; index++) {
      await page.locator("tr-composer textarea").fill(`Message ${index}`);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(page.locator("tr-composer textarea")).toHaveValue("");
      await expect(page.locator("tr-message-card").last()).toContainText("Fixture reply completed.");
      await expect(page.locator(".tr-reply-status")).toHaveCount(0);
    }
    await page.locator("tr-composer textarea").fill("Stream slowly");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("tr-message-list")).toContainText("All done, with a last sentence that takes a moment.", { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0);
    await expect(page.locator("tr-composer textarea")).toBeEnabled();
  });
