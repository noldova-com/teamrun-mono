/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import Config from "../config.ts";
import type PackageInfo from "../build/package-info.ts";

export default class PackagedManifest {
  private static readonly PACKAGE_NAME: string = "teamrun";
  private static readonly PACKAGE_AUTHOR: string = "Noldova";
  private static readonly PACKAGE_LICENSE: string = "MIT";
  private static readonly MODULE_TYPE: string = "module";
  private static readonly DESKTOP_PACKAGE_NAME: string = "@noldova/teamrun-desktop";
  private static readonly DESKTOP_MAIN: string = "main.js";

  public readonly name: string = PackagedManifest.PACKAGE_NAME;
  public readonly productName: string = Config.PRODUCT_NAME;
  public readonly version: string = Config.VERSION;
  public readonly description: string = Config.PRODUCT_NAME;
  public readonly author: string = PackagedManifest.PACKAGE_AUTHOR;
  public readonly license: string = PackagedManifest.PACKAGE_LICENSE;
  public readonly private: boolean = true;
  public readonly type: string = PackagedManifest.MODULE_TYPE;
  public readonly main: string = path.posix.join(Config.NODE_MODULES_FOLDER, PackagedManifest.DESKTOP_PACKAGE_NAME, PackagedManifest.DESKTOP_MAIN);
  public readonly dependencies: Readonly<Record<string, string>>;

  public constructor(externalDependencies: Readonly<Record<string, string>>, packages: readonly PackageInfo[]) {
    this.dependencies = {
      ...externalDependencies,
      ...Object.fromEntries(packages.map(t => [t.packageName, Config.VERSION]))
    };
  }
}
