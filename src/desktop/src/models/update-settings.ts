/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources.js";

export class UpdateSettings {
  public readonly feedUrl: string | null;
  public readonly disabledReason: string | null;
  public readonly allowInstallation: boolean;
  public readonly isTestFeed: boolean;
  public readonly windowsPublisher: string;

  private constructor(feedUrl: string | null, disabledReason: string | null, windowsPublisher: string, allowInstallation: boolean = false,
    isTestFeed: boolean = false) {
    this.feedUrl = feedUrl;
    this.disabledReason = disabledReason;
    this.windowsPublisher = windowsPublisher;
    this.allowInstallation = allowInstallation;
    this.isTestFeed = isTestFeed;
  }

  public static fromEnvironment(environment: NodeJS.ProcessEnv, isPackaged: boolean, platform: string, architecture: string, inApplicationsFolder: boolean,
    windowsPublisher: string = Resources.windowsPublisher): UpdateSettings {
    if (!isPackaged)
      return new UpdateSettings(null, Resources.updatesDevelopmentDisabled, windowsPublisher);
    if (platform === Resources.macPlatform && !inApplicationsFolder)
      return new UpdateSettings(null, Resources.updatesOutsideApplications, windowsPublisher);
    const appImage = environment[Resources.appImageVariable];
    const canSelfUpdate = Resources.updateArchitectures.includes(architecture) && (platform === Resources.windowsPlatform
      || platform === Resources.macPlatform
      || (platform === Resources.linuxPlatform && !Object.isUndefined(appImage) && !String.isNullOrWhitespace(appImage)));
    if (!canSelfUpdate)
      return new UpdateSettings(null, Resources.updatesUnsupported, windowsPublisher);
    const value = environment[Resources.updateTestFeedVariable];
    if (Object.isUndefined(value) || String.isNullOrWhitespace(value))
      return new UpdateSettings(Resources.publicUpdateFeed, null, windowsPublisher, true);
    try {
      const url = new URL(value);
      if (url.protocol !== Resources.httpProtocol || !Resources.updateLoopbackHosts.includes(url.hostname)
        || !String.isNullOrEmpty(url.username) || !String.isNullOrEmpty(url.password)
        || !String.isNullOrEmpty(url.search) || !String.isNullOrEmpty(url.hash))
        return new UpdateSettings(null, Resources.updatesFeedInvalid, windowsPublisher);
      url.pathname = `${url.pathname.replace(Resources.updateTrailingSlashes, String.empty)}/`;
      return new UpdateSettings(url.href, null, windowsPublisher, environment[Resources.updateTestInstallVariable] === Resources.enabledValue, true);
    }
    catch {
      return new UpdateSettings(null, Resources.updatesFeedInvalid, windowsPublisher);
    }
  }
}
