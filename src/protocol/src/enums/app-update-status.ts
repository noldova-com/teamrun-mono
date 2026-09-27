/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum AppUpdateStatus {
  Disabled = "Disabled",
  Idle = "Idle",
  Checking = "Checking",
  UpToDate = "UpToDate",
  Available = "Available",
  Downloading = "Downloading",
  Downloaded = "Downloaded",
  Preparing = "Preparing",
  Installing = "Installing",
  Error = "Error"
}
