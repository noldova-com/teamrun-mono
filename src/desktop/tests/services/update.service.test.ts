/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources, UpdateService, UpdateSettings } from "@noldova/teamrun-desktop";
import { AppUpdateCommand, AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

import { FakeUpdateBackend } from "../fixtures/fake-update-backend.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class UpdateServiceTests {
  @TestMethod
  public async installsOnlyAfterDownloadAndKeepsARetryAfterPreparationFails(): Promise<void> {
    const backend = new FakeUpdateBackend();
    const settings = UpdateSettings.fromEnvironment({ TEAMRUN_UPDATE_TEST_FEED: "http://127.0.0.1:8000/", TEAMRUN_UPDATE_TEST_INSTALL: "1" }, true, "win32", "x64", true);
    let attempts = 0;
    const restart = { install: async (version: string, install: () => Promise<void>): Promise<void> => {
      Assert.areEqual("0.0.2", version);
      attempts++;
      if (attempts === 1) throw new Error("Workspace could not be saved.");
      await install();
    } };
    const service = new UpdateService(settings, "0.0.1", backend, () => undefined, restart);
    try {
      await service.execute(AppUpdateCommand.Install);
      Assert.areEqual(0, attempts);
      await service.execute(AppUpdateCommand.Check);
      await service.execute(AppUpdateCommand.Download);
      Assert.isTrue(service.state.canInstall);
      Assert.areEqual(AppUpdateStatus.Error, (await service.execute(AppUpdateCommand.Install)).status);
      Assert.isTrue(service.state.canInstall);
      Assert.areEqual(0, backend.installs);
      await service.execute(AppUpdateCommand.Install);
      Assert.areEqual(1, backend.installs);
      Assert.areEqual(2, attempts);
    }
    finally { service.dispose(); }
  }

  @TestMethod
  public checksWithoutDownloadingAndCoalescesConcurrentOperations(): Promise<void> {
    return this.run(async (service, backend, states) => {
      const check = Promise.withResolvers<string | null>();
      backend.checkResult = () => check.promise;
      Assert.areEqual(AppUpdateStatus.Idle, (await service.execute(AppUpdateCommand.Download)).status);
      const first = service.execute(AppUpdateCommand.Check);
      Assert.isTrue(first === service.execute(AppUpdateCommand.Check));
      await Wait.until(() => backend.checks === 1);
      Assert.areEqual(AppUpdateStatus.Checking, (await service.execute(AppUpdateCommand.Status)).status);
      Assert.isTrue(first === service.execute(AppUpdateCommand.Download));
      check.resolve("0.0.2");
      Assert.areEqual(AppUpdateStatus.Available, (await first).status);
      Assert.areEqual(0, backend.downloads);
      Assert.areEqual("Checking,Available", states.map(t => t.status).join(","));
      Assert.isNotNull(service.state.lastCheckedAt);
      backend.checkResult = () => Promise.resolve(null);
      Assert.areEqual(AppUpdateStatus.UpToDate, (await service.execute(AppUpdateCommand.Check)).status);
    });
  }

  @TestMethod
  public sanitizesFailuresAndAllowsCheckAndDownloadRetries(): Promise<void> {
    return this.run(async (service, backend, states) => {
      backend.checkResult = () => Promise.reject(new Error("private feed details"));
      Assert.areEqual(Resources.updateCheckFailed, (await service.execute(AppUpdateCommand.Check)).message);
      Assert.isNull(service.state.availableVersion);
      backend.checkResult = () => Promise.resolve("0.0.2");
      await service.execute(AppUpdateCommand.Check);
      backend.downloadResult = async progress => {
        progress(42.8);
        progress(42.9);
        progress(Number.NaN);
        throw new Error("internal hash mismatch");
      };
      Assert.areEqual(Resources.updateDownloadFailed, (await service.execute(AppUpdateCommand.Download)).message);
      Assert.areEqual("0.0.2", service.state.availableVersion);
      Assert.areEqual(1, states.filter(t => t.progressPercent === 42).length);
      backend.downloadResult = async progress => { progress(-1); progress(101); };
      Assert.areEqual(AppUpdateStatus.Downloaded, (await service.execute(AppUpdateCommand.Download)).status);
      Assert.areEqual(Resources.updateInstallDeferred, service.state.message);
      Assert.areEqual(100, service.state.progressPercent);
      await service.execute(AppUpdateCommand.Check);
      await service.execute(AppUpdateCommand.Download);
      Assert.areEqual(2, backend.checks);
      Assert.areEqual(2, backend.downloads);
    });
  }

  @TestMethod
  public keepsDisabledBuildsOfflineAndOwnsItsTimerLifetime(): Promise<void> {
    return this.run(async (service, backend) => {
      const disabled = new UpdateService(UpdateSettings.fromEnvironment({}, false, "win32", "x64", true), "0.0.1", backend, () => undefined);
      disabled.start(1, 1);
      await disabled.execute(AppUpdateCommand.Check);
      await disabled.execute(AppUpdateCommand.Download);
      Assert.areEqual(0, backend.checks);
      service.start(1, 10);
      service.start(1, 1);
      await Wait.until(() => backend.checks >= 2);
      service.dispose();
      service.dispose();
      const count = backend.checks;
      await delay(30);
      await service.execute(AppUpdateCommand.Check);
      service.start(1, 1);
      Assert.areEqual(count, backend.checks);
      Assert.areEqual(1, backend.disposals);
    });
  }

  @TestMethod
  public ignoresCompletionsAndProgressAfterDisposal(): Promise<void> {
    return this.run(async (service, backend, states) => {
      await service.execute(AppUpdateCommand.Check);
      const download = Promise.withResolvers<void>();
      const started = Promise.withResolvers<(value: number) => void>();
      backend.downloadResult = progress => { started.resolve(progress); return download.promise; };
      const work = service.execute(AppUpdateCommand.Download);
      const progress = await started.promise;
      service.dispose();
      const count = states.length;
      progress(50);
      download.resolve();
      await work;
      Assert.areEqual(count, states.length);
      Assert.areEqual(1, backend.disposals);
    });
  }

  private async run(body: (service: UpdateService, backend: FakeUpdateBackend, states: AppUpdateState[]) => Promise<void>): Promise<void> {
    const backend = new FakeUpdateBackend();
    const states: AppUpdateState[] = [];
    const settings = UpdateSettings.fromEnvironment({ TEAMRUN_UPDATE_TEST_FEED: "http://127.0.0.1:8000/" }, true, "win32", "x64", true);
    const service = new UpdateService(settings, "0.0.1", backend, t => states.push(t));
    try { await body(service, backend, states); }
    finally { service.dispose(); }
  }
}
