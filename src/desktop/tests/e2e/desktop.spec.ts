/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";

import { DesktopFixture } from "./fixtures/desktop.fixture.ts";

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

test("quits when its window is gone before it could save", async () => {
  expect(await desktop.closeFromPage()).toBe(0);
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
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0);
  await expect(page.locator("tr-composer textarea")).toBeEnabled();
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
