/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProviderRegistry } from "@noldova/teamrun-core";
import { DesktopSettings, type IRuntimeAttacher } from "@noldova/teamrun-desktop";
import { ProcessInspector, ProcessProbe, ProcessRegistry, RuntimeClient, RuntimeService, RuntimeSettings, RuntimeTimings, type IRuntimeClientListener } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class DesktopTestHost implements IRuntimeAttacher, AsyncDisposable {
  public static readonly PRODUCT_VERSION: string = "0.0.1-desktop-test";

  public readonly directory: TemporaryDirectory = new TemporaryDirectory();
  public readonly timings: RuntimeTimings = new RuntimeTimings(1000, 5000, 5000, 50);
  public readonly clients: RuntimeClient[] = [];
  public attachCount: number = 0;
  public failNextAttach: Error | null = null;
  public buildCheckCount: number = 0;
  public buildMismatch: Error | null = null;
  private service: RuntimeService | null = null;

  public createSettings(rendererUrl: string | null = null, screenshotPath: string | null = null): DesktopSettings {
    const index = this.directory.resolve("renderer", "index.html");
    return new DesktopSettings(this.directory.resolve("data"), DesktopTestHost.PRODUCT_VERSION, index, this.directory.resolve("icon.png"), rendererUrl, screenshotPath, 10);
  }

  public async startRuntime(): Promise<RuntimeService> {
    const settings = RuntimeSettings.forPlatform(process.platform, this.directory.resolve("data"), DesktopTestHost.PRODUCT_VERSION, null);
    const processes = new ProcessRegistry(settings.processesPath, process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(process.platform));
    const service = new RuntimeService(settings, new ProviderRegistry(), processes);
    await service.start();
    this.service = service;
    return service;
  }

  public async stopRuntime(): Promise<void> {
    if (this.service === null)
      return;

    await this.service.stop("test");
    this.service = null;
  }

  public assertSameBuild(): void {
    this.buildCheckCount += 1;
    if (this.buildMismatch !== null)
      throw this.buildMismatch;
  }

  public async attach(clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient> {
    this.attachCount += 1;
    if (this.failNextAttach !== null) {
      const error = this.failNextAttach;
      this.failNextAttach = null;
      throw error;
    }
    if (this.service === null || this.service.lock === null)
      throw new Error("The runtime is not running.");

    const client = await RuntimeClient.connect(this.service.lock.endpoint, this.service.lock.token, clientName, listener, this.timings);
    this.clients.push(client);
    return client;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const client of this.clients)
      client.close();
    await this.stopRuntime();
    this.directory[Symbol.dispose]();
  }
}
