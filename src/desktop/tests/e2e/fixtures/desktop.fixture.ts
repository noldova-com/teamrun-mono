/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { _electron, type CDPSession, type ElectronApplication, expect, type Page, type TestInfo } from "@playwright/test";
import { ProviderRegistry } from "@noldova/teamrun-core";
import { Resources } from "@noldova/teamrun-desktop";
import { ConversationCreateParams, MethodName, Project, ProjectOpenParams } from "@noldova/teamrun-protocol";
import { ProcessInspector, ProcessProbe, ProcessRegistry, RuntimeClient, RuntimeService, RuntimeSettings, RuntimeTimings } from "@noldova/teamrun-runtime";

import DevelopmentBinary from "../../../../../scripts/desktop/development-binary.ts";
import { FixtureProvider } from "./fixture-provider.fixture.ts";

export class DesktopFixture {
  private static readonly VIEWPORT_WIDTH: number = 1920;
  private static readonly VIEWPORT_HEIGHT: number = 1080;
  private static readonly DEVICE_SCALE_FACTOR: number = 1;
  private static readonly NO_GPU_SWITCHES: readonly string[] = ["--disable-gpu", "--disable-software-rasterizer"];
  private static readonly EXIT_MILLISECONDS: number = 10_000;
  private static readonly PNG_WIDTH_OFFSET: number = 16;
  private static readonly PNG_HEIGHT_OFFSET: number = 20;

  private readonly info: TestInfo;
  private readonly errors: string[] = [];
  private readonly logs: WriteStream[] = [];
  private directory: string | null = null;
  private runtime: RuntimeService | null = null;
  private application: ElectronApplication | null = null;
  private window: Page | null = null;
  private captureSession: CDPSession | null = null;
  private launches: number = 0;
  private tracing: boolean = false;

  public readonly provider = new FixtureProvider();

  public constructor(info: TestInfo) {
    this.info = info;
  }

  public get page(): Page {
    if (!this.window)
      throw new Error("The fixture window is not running.");
    return this.window;
  }

  public async start(): Promise<void> {
    this.directory = await mkdtemp(path.join(tmpdir(), "teamrun-ui-"));
    const projectPath = path.join(this.directory, "project");
    await mkdir(projectPath);
    const settings = RuntimeSettings.forPlatform(process.platform, path.join(this.directory, "data"), Resources.productVersion, null);
    const processes = new ProcessRegistry(settings.processesPath, process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(process.platform));
    const providers = new ProviderRegistry();
    providers.register(this.provider);
    this.runtime = new RuntimeService(settings, providers, processes);
    await this.runtime.start();
    const lock = this.runtime.lock;
    if (!lock)
      throw new Error("The fixture runtime did not publish an endpoint.");
    const client = await RuntimeClient.connect(lock.endpoint, lock.token, "ui-fixture",
      { onEvent: () => undefined, onDisconnected: () => undefined }, RuntimeTimings.createDefault());
    try {
      const opened = await client.call(MethodName.ProjectOpen, new ProjectOpenParams(projectPath).toJson());
      if (opened.hasErrors)
        throw new Error("The fixture project could not be opened.");
      const project = Project.fromJson(opened.payload);
      for (const title of ["Conversation A", "Conversation B"]) {
        const response = await client.call(MethodName.ConversationCreate, new ConversationCreateParams(project.id, title).toJson());
        if (response.hasErrors)
          throw new Error("The fixture conversation could not be created.");
      }
    }
    finally {
      client.close();
    }
    await this.launch();
  }

  public async restart(): Promise<void> {
    await this.closeWindow();
    await this.launch();
  }

  public async capture(name: string): Promise<Buffer> {
    if (!this.captureSession)
      throw new Error("The fixture capture session is not running.");
    const metrics = await this.page.evaluate(() => ({
      width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio,
      visualWidth: window.visualViewport?.width, visualHeight: window.visualViewport?.height,
      documentWidth: document.documentElement.clientWidth, documentScrollWidth: document.documentElement.scrollWidth
    }));
    const viewportPath = this.info.outputPath(`${name}-viewport.json`);
    const imagePath = this.info.outputPath(`${name}.png`);
    await writeFile(viewportPath, JSON.stringify(metrics, null, 2));
    await this.info.attach(`${name}-viewport`, { path: viewportPath, contentType: "application/json" });
    
    const screenshot = await this.captureSession.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: DesktopFixture.VIEWPORT_WIDTH, height: DesktopFixture.VIEWPORT_HEIGHT, scale: 1 }
    });
    const image = Buffer.from(screenshot.data, "base64");
    await writeFile(imagePath, image);
    await this.info.attach(name, { path: imagePath, contentType: "image/png" });
    expect(image.readUInt32BE(DesktopFixture.PNG_WIDTH_OFFSET), "Screenshot width").toBe(DesktopFixture.VIEWPORT_WIDTH);
    expect(image.readUInt32BE(DesktopFixture.PNG_HEIGHT_OFFSET), "Screenshot height").toBe(DesktopFixture.VIEWPORT_HEIGHT);
    return image;
  }

  public async setWindowSize(width: number, height: number): Promise<void> {
    if (!this.application)
      throw new Error("The fixture window is not running.");
    await this.application.evaluate(({ BrowserWindow }, size) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window)
        throw new Error("The native fixture window is missing.");
      window.setContentSize(size.width, size.height);
    }, { width, height });
  }

  public async readPixel(image: Buffer, x: number, y: number): Promise<readonly number[]> {
    if (!this.application)
      throw new Error("The fixture window is not running.");
    return await this.application.evaluate(({ nativeImage }, sample) => {
      const image = nativeImage.createFromBuffer(Buffer.from(sample.data, "base64"));
      const offset = (sample.y * image.getSize().width + sample.x) * 4;
      return [...image.toBitmap().subarray(offset, offset + 4)];
    }, { data: image.toString("base64"), x, y });
  }

  public async attachImage(): Promise<void> {
    if (!this.directory)
      throw new Error("The fixture data directory is not available.");
    const file = path.join(this.directory, "fixture.png");
    await writeFile(file, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64"));
    await this.page.locator('input[type="file"]').setInputFiles(file);
  }

  public async setZoom(factor: number): Promise<void> {
    if (!this.application)
      throw new Error("The fixture application is not running.");
    await this.application.evaluate(({ BrowserWindow }, zoom) => BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(zoom), factor);
  }

  public async dispose(): Promise<void> {
    try {
      if (this.info.status !== this.info.expectedStatus && this.window && !this.window.isClosed())
        await this.capture("failure").catch(error => this.errors.push(String(error)));
      await this.closeWindow();
    }
    finally {
      await this.runtime?.stop("UI fixture finished");
      for (const log of this.logs)
        await new Promise<void>(resolve => log.end(resolve));
      if (this.directory)
        await rm(this.directory, { recursive: true, force: true });
    }
    expect(this.errors, "Unexpected renderer or main-process errors").toEqual([]);
  }

  private async launch(): Promise<void> {
    if (!this.directory)
      throw new Error("The fixture data directory is not available.");
    const environment: Record<string, string> = {};
    for (const [name, value] of Object.entries(process.env))
      if (value !== undefined)
        environment[name] = value;
    environment["TEAMRUN_DATA_DIR"] = path.join(this.directory, "data");
    delete environment["ELECTRON_RUN_AS_NODE"];
    delete environment["TEAMRUN_RENDERER_URL"];
    delete environment["TEAMRUN_RENDERER_INDEX"];
    delete environment["TEAMRUN_SCREENSHOT"];
    this.application = await _electron.launch({
      executablePath: await new DevelopmentBinary().prepare(),
      args: [`--force-device-scale-factor=${DesktopFixture.DEVICE_SCALE_FACTOR}`, ...DesktopFixture.NO_GPU_SWITCHES, fileURLToPath(new URL("./desktop-entry.fixture.ts", import.meta.url))],
      env: environment, chromiumSandbox: true, timeout: 60_000
    });
    expect(this.application.process().spawnargs).not.toContain("--no-sandbox");
    this.launches++;
    for (const [name, stream] of [["stdout", this.application.process().stdout], ["stderr", this.application.process().stderr]] as const) {
      const log = createWriteStream(this.info.outputPath(`desktop-${this.launches}.${name}.log`));
      this.logs.push(log);
      stream?.pipe(log, { end: false });
    }
    this.window = await this.application.firstWindow();
    this.captureSession = await this.window.context().newCDPSession(this.window);
    await this.captureSession.send("Emulation.setDeviceMetricsOverride", {
      width: DesktopFixture.VIEWPORT_WIDTH,
      height: DesktopFixture.VIEWPORT_HEIGHT,
      deviceScaleFactor: DesktopFixture.DEVICE_SCALE_FACTOR,
      mobile: false
    });
    await expect.poll(() => this.page.evaluate(() => ({
      width: window.innerWidth, height: window.innerHeight, scale: window.devicePixelRatio
    }))).toEqual({ width: DesktopFixture.VIEWPORT_WIDTH, height: DesktopFixture.VIEWPORT_HEIGHT, scale: DesktopFixture.DEVICE_SCALE_FACTOR });
    await this.window.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    this.tracing = true;
    await this.window.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    const host = await this.application.evaluate(({ app, BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window)
        throw new Error("The native fixture window is missing.");
      return {
        platform: process.platform, architecture: process.arch, electron: process.versions.electron,
        name: app.getName(), executable: process.execPath, packaged: app.isPackaged, defaultApp: process.defaultApp,
        bounds: window.getBounds(), contentBounds: window.getContentBounds(), zoom: window.webContents.getZoomFactor()
      };
    });
    expect(host.name).toBe("TeamRun");
    expect(host.defaultApp).toBe(true);
    expect(path.basename(host.executable)).toBe(process.platform === "win32" ? "TeamRun.exe" : process.platform === "darwin" ? "TeamRun" : "teamrun");
    const renderer = await this.window.evaluate(() => ({
      nodeGlobal: "process" in globalThis, requireGlobal: "require" in globalThis, bridge: "teamrun" in globalThis,
      webgl2: document.createElement("canvas").getContext("webgl2") !== null
    }));
    expect(renderer).toEqual({ nodeGlobal: false, requireGlobal: false, bridge: true, webgl2: false });
    await this.info.attach(`host-${this.launches}`, {
      body: JSON.stringify({ ...host, renderer, chromiumSandboxRequested: true, gpuRequested: false,
        colorScheme: "dark", reducedMotion: "reduce", screenshotAnimations: "reduced-motion preference" }, null, 2),
      contentType: "application/json"
    });
    this.window.on("pageerror", error => this.errors.push(error.message));
    this.window.on("console", message => {
      if (message.type() === "error")
        this.errors.push(message.text());
    });
    await expect(this.window.locator("tr-sidebar")).toBeVisible();
    await expect(this.window.getByRole("button", { name: "Conversation A", exact: true })).toBeVisible();
  }

  public async destroyWindow(): Promise<number | null> {
    if (!this.application || !this.window)
      throw new Error("The fixture window is not running.");
    const application = this.application;
    const child = application.process();
    this.application = null;
    await this.stopTracing();
    const exited = new Promise<number | null>(resolve => child.once("exit", code => resolve(code)));
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window)
        throw new Error("The fixture window is missing.");
      window.setContentSize(1000, 700);
      setImmediate(() => window.destroy());
    });
    this.window = null;
    this.captureSession = null;
    let expired = false;
    const deadline = setTimeout(() => {
      expired = true;
      void application.evaluate(({ app }) => app.exit(1)).catch(() => child.kill());
    }, DesktopFixture.EXIT_MILLISECONDS);
    try {
      const code = await exited;
      expect(expired, "TeamRun kept running after its window closed").toBe(false);
      return code;
    }
    finally {
      clearTimeout(deadline);
    }
  }

  private async stopTracing(): Promise<void> {
    try {
      if (this.tracing && this.window && !this.window.isClosed()) {
        const trace = this.info.outputPath(`desktop-${this.launches}.zip`);
        await this.window.context().tracing.stop({ path: trace });
        await this.info.attach(`trace-${this.launches}`, { path: trace, contentType: "application/zip" });
      }
    }
    catch (error) {
      this.errors.push(String(error));
    }
    finally {
      this.tracing = false;
    }
  }

  private async closeWindow(): Promise<void> {
    if (!this.application)
      return;
    const application = this.application;
    const child = application.process();
    this.application = null;
    await this.stopTracing();
    try {
      await application.close();
    }
    finally {
      this.captureSession = null;
      if (child.exitCode === null && child.signalCode === null)
        await new Promise<void>((resolve, reject) => {
          child.once("exit", () => resolve());
          if (!child.kill())
            reject(new Error("The fixture process could not be stopped."));
        });
    }
    this.window = null;
  }
}
