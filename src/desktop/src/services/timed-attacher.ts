/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimeClientListener, RuntimeClient } from "@noldova/teamrun-runtime";

import type { IRuntimeAttacher } from "../interfaces/i-runtime-attacher.js";
import { Resources } from "../resources.js";

export class TimedAttacher implements IRuntimeAttacher {
  private readonly attacher: IRuntimeAttacher;
  private readonly report: (line: string) => void;

  public constructor(attacher: IRuntimeAttacher, report: (line: string) => void) {
    this.attacher = attacher;
    this.report = report;
  }

  public assertSameBuild(): void {
    this.attacher.assertSameBuild();
  }

  public async attach(clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient> {
    const started = Date.now();
    try {
      return await this.attacher.attach(clientName, listener);
    }
    catch (error) {
      this.report(Resources.formatRuntimeAttachFailed(Date.now() - started, String(error)));
      throw error;
    }
  }
}
