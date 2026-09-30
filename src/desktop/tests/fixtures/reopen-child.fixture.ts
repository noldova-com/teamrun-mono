/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RestartProcesses } from "@noldova/teamrun-desktop";

await new RestartProcesses(process.argv[2] ?? "", process.env).reopen(process.argv[3] ?? "");
