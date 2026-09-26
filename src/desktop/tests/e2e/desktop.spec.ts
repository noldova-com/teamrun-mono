/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "@playwright/test";

import { DesktopFixture } from "./fixtures/desktop.fixture.ts";

let desktop: DesktopFixture;

test.beforeEach(async ({}, info) => {
  desktop = new DesktopFixture(info);
  await desktop.start();
});

test.afterEach(async () => {
  await desktop.dispose();
});

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
