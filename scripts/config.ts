/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";

import PackageInfo from "./build/package-info.ts";

export default class Config {
  public static readonly PACKAGE_MANIFEST_FILE_NAME: string = "package.json";
  public static readonly VERSION_PLACEHOLDER: string = "__VERSION__";
  public static readonly PROTOCOL_VERSION_PLACEHOLDER: string = "__PROTOCOL_VERSION__";
  public static readonly BUILD_PLACEHOLDER: string = "__BUILD__";
  public static readonly WINDOWS_PUBLISHER_PLACEHOLDER: string = "__WINDOWS_PUBLISHER__";
  public static readonly RESOURCES_FILE_NAME: string = "resources.js";
  private static readonly ROOT_MANIFEST: { version: string; teamrun: { protocolVersion: string; windowsPublisher: string } } =
    JSON.parse(readFileSync(Config.PACKAGE_MANIFEST_FILE_NAME, "utf8"));
  public static readonly VERSION: string = Config.ROOT_MANIFEST.version;
  public static readonly PRODUCT_NAME: string = "TeamRun";
  public static readonly PROTOCOL_VERSION: string = Config.ROOT_MANIFEST.teamrun.protocolVersion;
  public static readonly WINDOWS_PUBLISHER: string = Config.ROOT_MANIFEST.teamrun.windowsPublisher;
  public static readonly BUILD_FOLDER: string = "_build/dist";
  public static readonly TEST_BUILD_FOLDER: string = "_build/tests";
  public static readonly COVERAGE_FOLDER: string = "_build/coverage";
  public static readonly PACKAGES_FOLDER: string = "_packages";
  public static readonly NODE_MODULES_FOLDER: string = "node_modules";
  public static readonly SOURCE_DIRECTORY_NAME: string = "src";
  public static readonly TESTS_DIRECTORY_NAME: string = "tests";
  public static readonly API_DIRECTORY_NAME: string = "api";
  public static readonly DECLARATIONS_FILE_NAME: string = "index.d.ts";
  public static readonly PROJECT_FILE_NAME: string = "tsconfig.json";
  public static readonly LICENSE_FILE_NAME: string = "LICENSE";
  public static readonly OWN_PACKAGE_PREFIX: string = "@noldova/teamrun-";
  public static readonly RENDERER_DIRECTORY: string = "src/renderer";
  public static readonly PACKAGE_LOCK_FILE_NAME: string = "package-lock.json";
  public static readonly OWN_PACKAGE_SCOPE: string = "@noldova";
  public static readonly ANGULAR_CLI_PATH: string = "node_modules/@angular/cli/bin/ng.js";

  public static readonly PACKAGES: readonly PackageInfo[] = [
    new PackageInfo("foundation-core", "@noldova/teamrun-foundation-core", "src/foundation/core"),
    new PackageInfo("foundation-exceptions", "@noldova/teamrun-foundation-exceptions", "src/foundation/exceptions"),
    new PackageInfo("foundation-text", "@noldova/teamrun-foundation-text", "src/foundation/text"),
    new PackageInfo("foundation-testing", "@noldova/teamrun-foundation-testing", "src/foundation/testing"),
    new PackageInfo("foundation-json", "@noldova/teamrun-foundation-json", "src/foundation/json"),
    new PackageInfo("foundation-services", "@noldova/teamrun-foundation-services", "src/foundation/services"),
    new PackageInfo("foundation-data", "@noldova/teamrun-foundation-data", "src/foundation/data"),
    new PackageInfo("foundation-data-sql", "@noldova/teamrun-foundation-data-sql", "src/foundation/data-sql"),
    new PackageInfo("foundation-data-sql-sqlite", "@noldova/teamrun-foundation-data-sql-sqlite", "src/foundation/data-sql-sqlite"),
    new PackageInfo("protocol", "@noldova/teamrun-protocol", "src/protocol"),
    new PackageInfo("core", "@noldova/teamrun-core", "src/core"),
    new PackageInfo("providers", "@noldova/teamrun-providers", "src/providers"),
    new PackageInfo("runtime", "@noldova/teamrun-runtime", "src/runtime"),
    new PackageInfo("cli", "@noldova/teamrun-cli", "src/cli"),
    new PackageInfo("desktop", "@noldova/teamrun-desktop", "src/desktop", false)
  ];
}
