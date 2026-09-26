/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources, UpdateSettings } from "@noldova/teamrun-desktop";

@TestClass
export class UpdateSettingsTests {
  @TestMethod
  public usesThePublicReleaseFeedWithoutCredentialsOnEveryUpdatableTarget(): void {
    const appImage = { APPIMAGE: "/home/user/Applications/TeamRun-linux-x64.AppImage" };
    for (const architecture of ["x64", "arm64"])
      for (const [environment, platform] of [[{}, "win32"], [{ TEAMRUN_UPDATE_TEST_FEED: " " }, "win32"], [{}, "darwin"], [appImage, "linux"]] as const) {
        const settings = UpdateSettings.fromEnvironment(environment, true, platform, architecture, true);
        Assert.areEqual("https://github.com/noldova-com/teamrun/releases/latest/download/", settings.feedUrl);
        Assert.isTrue(settings.allowInstallation);
        Assert.isFalse(settings.isTestFeed);
        Assert.isNull(settings.disabledReason);
      }
    Assert.isNotNull(UpdateSettings.fromEnvironment({}, true, "win32", "x64", false).feedUrl);
  }

  @TestMethod
  public explainsWhyAPackagedInstallationCannotUpdateItself(): void {
    for (const architecture of ["x64", "arm64"])
      for (const environment of [{}, { TEAMRUN_UPDATE_TEST_FEED: "http://127.0.0.1:8000/" }]) {
        const settings = UpdateSettings.fromEnvironment(environment, true, "darwin", architecture, false);
        Assert.isNull(settings.feedUrl);
        Assert.areEqual(Resources.updatesOutsideApplications, settings.disabledReason);
        Assert.isFalse(settings.allowInstallation);
      }
    const appImage = { APPIMAGE: "/opt/TeamRun-linux-x64.AppImage" };
    for (const [environment, platform, architecture] of [[{}, "linux", "x64"], [{ APPIMAGE: " " }, "linux", "arm64"], [appImage, "linux", "ia32"],
      [{}, "win32", "ia32"]] as const) {
      const settings = UpdateSettings.fromEnvironment(environment, true, platform, architecture, true);
      Assert.isNull(settings.feedUrl);
      Assert.areEqual(Resources.updatesUnsupported, settings.disabledReason);
      Assert.isFalse(settings.allowInstallation);
    }
  }

  @TestMethod
  public permitsOnlyExplicitPackagedLoopbackFeedsForEveryUpdatableTarget(): void {
    const environment = { TEAMRUN_UPDATE_TEST_FEED: "http://127.0.0.1:8000/test///" };
    const appImageEnvironment = { ...environment, APPIMAGE: "/opt/TeamRun-linux-arm64.AppImage" };
    for (const architecture of ["x64", "arm64"])
      for (const [settingsEnvironment, platform] of [[environment, "win32"], [environment, "darwin"], [appImageEnvironment, "linux"]] as const)
        Assert.areEqual("http://127.0.0.1:8000/test/", UpdateSettings.fromEnvironment(settingsEnvironment, true, platform, architecture, true).feedUrl);
    for (const host of ["localhost", "[::1]"])
      Assert.isNotNull(UpdateSettings.fromEnvironment({ TEAMRUN_UPDATE_TEST_FEED: `http://${host}:8000` }, true, "win32", "x64", true).feedUrl);
    Assert.areEqual(Resources.updatesDevelopmentDisabled, UpdateSettings.fromEnvironment(environment, false, "win32", "x64", true).disabledReason);
    Assert.isTrue(UpdateSettings.fromEnvironment(environment, true, "win32", "x64", true).isTestFeed);
    Assert.isFalse(UpdateSettings.fromEnvironment(environment, true, "win32", "x64", true).allowInstallation);
    Assert.isTrue(UpdateSettings.fromEnvironment({ ...environment, TEAMRUN_UPDATE_TEST_INSTALL: "1" }, true, "darwin", "arm64", true).allowInstallation);
    for (const [platform, architecture] of [["linux", "x64"], ["win32", "ia32"]] as const) {
      const settings = UpdateSettings.fromEnvironment(environment, true, platform, architecture, true);
      Assert.isNull(settings.feedUrl);
      Assert.areEqual(Resources.updatesUnsupported, settings.disabledReason);
    }
  }

  @TestMethod
  public rejectsUntrustedFeedAddresses(): void {
    for (const value of ["bad url", "https://localhost/", "http://example.com/", "file:///tmp/feed", "http://localhost.evil/",
      "http://localhost/?secret=value", "http://localhost/#fragment", "http://user@localhost/", "http://:secret@localhost/"])
      Assert.areEqual(Resources.updatesFeedInvalid, UpdateSettings.fromEnvironment({ TEAMRUN_UPDATE_TEST_FEED: value }, true, "win32", "x64", true).disabledReason);
  }

  @TestMethod
  public excludesPreviewVersionsWithoutMistakingBuildMetadataForAPrerelease(): void {
    Assert.isTrue(Resources.updatePrereleasePattern.test("1.0.0-beta.1"));
    Assert.isTrue(Resources.updatePrereleasePattern.test("1.0.0-beta.1+build"));
    Assert.isFalse(Resources.updatePrereleasePattern.test("1.0.0"));
    Assert.isFalse(Resources.updatePrereleasePattern.test("1.0.0+build-with-dashes"));
  }
}
