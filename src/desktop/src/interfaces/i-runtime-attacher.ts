/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimeClientListener, RuntimeClient } from "@noldova/teamrun-runtime";

export interface IRuntimeAttacher {
  assertSameBuild(): void;
  attach(clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient>;
}
