/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { app } from "electron";

import { type IUpdateBackend, UpdateSettings, UpdateSignatureException } from "@noldova/teamrun-desktop";

interface IUpdateCase {
  readonly dataDirectory: string;
  readonly feedUrl: string;
  readonly publisher: string;
}

interface IBackendModule {
  readonly ElectronUpdateBackend: new (settings: UpdateSettings, dataDirectory: string) => IUpdateBackend;
}

class UpdateBackendChild {
  private static readonly BACKEND_MODULE: string = "@noldova/teamrun-desktop/services/electron-update-backend.js";

  public static async run(cases: readonly IUpdateCase[]): Promise<void> {
    const { ElectronUpdateBackend } = await import(UpdateBackendChild.BACKEND_MODULE) as IBackendModule;
    for (const item of cases) {
      const settings = UpdateSettings.fromEnvironment({ TEAMRUN_UPDATE_TEST_FEED: item.feedUrl }, true, process.platform, process.arch, true, item.publisher);
      const backend = new ElectronUpdateBackend(settings, item.dataDirectory);
      let refusal: string | null = null;
      const started = performance.now();
      let checked = started;
      try {
        const version = await backend.check();
        checked = performance.now();
        if (version !== "99.0.0") throw new Error(`Unexpected update version: ${version}`);
        await backend.download(() => undefined);
      }
      catch (error) {
        if (!(error instanceof UpdateSignatureException)) throw error;
        refusal = error.message;
      }
      finally { backend.dispose(); }
      console.log(JSON.stringify({ refusal, readyMs: Math.round(started), checkMs: Math.round(checked - started), downloadMs: Math.round(performance.now() - checked) }));
    }
  }
}

app.setPath("userData", process.env["TEAMRUN_TEST_USER_DATA"] ?? "");
void app.whenReady()
  .then(() => UpdateBackendChild.run(JSON.parse(process.env["TEAMRUN_TEST_CASES"] ?? "[]") as IUpdateCase[]))
  .then(() => app.exit(0), (error: unknown) => {
    console.error(error);
    app.exit(1);
  });
