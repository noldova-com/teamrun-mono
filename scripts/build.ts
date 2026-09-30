/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Builds the packages in dependency order: each package is compiled into `_build/dist/<name>`
 * together with its version-stamped manifest and resources, license, and hand-maintained API declarations, packed into
 * `_packages/`, and installed into the root `node_modules` so tests and dependants consume the
 * installed artifact.
 *
 * @example
 * npm run build - builds all packages.
 * npm run build foundation-core foundation-exceptions - builds the named packages.
 */

import path from "node:path";

import Config from "./config.ts";
import BuildEvidence from "./build/build-evidence.ts";
import type PackageInfo from "./build/package-info.ts";
import Script from "./script.ts";

export class Build extends Script {
  private static readonly PROJECT_OPTION: string = "--project";
  private static readonly INSTALLING_PACKAGES: string = "Installing npm packages...";
  private static readonly RENDERER_OPTION: string = "--renderer";
  private static readonly BUILDING_RENDERER: string = "Building the renderer...";
  private static readonly NPM_QUIET_ARGUMENTS: readonly string[] = ["--no-audit", "--no-fund"];
  private static readonly ANGULAR_BUILD_ARGUMENTS: readonly string[] = ["build", "--configuration", "production"];
  private static readonly FONT_LICENSES: readonly string[] = ["INTER-OFL.txt", "INCONSOLATA-OFL.txt"];
  private static readonly FONT_ASSETS_DIRECTORY: string = "assets/fonts";
  private static readonly RENDERER_FONT_LICENSES_DIRECTORY: string = "_build/renderer/browser/licenses/fonts";

  public override async runAsync(): Promise<void> {
    await this.bootstrapNodeModulesAsync();
    await this.createDirectoryAsync(Config.BUILD_FOLDER);
    await this.createDirectoryAsync(Config.PACKAGES_FOLDER);

    const requested = process.argv.slice(2);
    const names = requested.filter(t => t !== Build.RENDERER_OPTION);
    const packages = requested.length === 0 ? Config.PACKAGES : this.selectPackages(names);
    for (const packageInfo of packages) {
      const progress = `Building "${packageInfo.packageName}"...`;
      this.writeLog(progress);
      await this.buildPackageAsync(packageInfo);
      this.writeLog(`${progress} Done.`, true);
    }
    this.writeLog(`Built ${packages.length} package(s).`);
    if (requested.length === 0 || requested.includes(Build.RENDERER_OPTION))
      await this.buildRendererAsync();
  }

  private async buildRendererAsync(): Promise<void> {
    this.writeLog(Build.BUILDING_RENDERER);
    const rendererDirectory = path.resolve(Config.RENDERER_DIRECTORY);
    await this.removeDirectoryAsync(path.join(rendererDirectory, Config.NODE_MODULES_FOLDER, Config.OWN_PACKAGE_SCOPE));
    if (!await this.pathExistsAsync(path.join(rendererDirectory, Config.ANGULAR_CLI_PATH)))
      await this.executeNpmCommandAsync(["ci", ...Build.NPM_QUIET_ARGUMENTS], rendererDirectory);
    const angularCli = path.join(rendererDirectory, Config.ANGULAR_CLI_PATH);
    await this.executeProcessAsync(process.execPath, [angularCli, ...Build.ANGULAR_BUILD_ARGUMENTS], rendererDirectory);
    for (const name of Build.FONT_LICENSES)
      await this.copyFileAsync(path.join(Build.FONT_ASSETS_DIRECTORY, name), path.join(Build.RENDERER_FONT_LICENSES_DIRECTORY, name));
  }

  private async bootstrapNodeModulesAsync(): Promise<void> {
    if (await this.pathExistsAsync(path.join(Config.NODE_MODULES_FOLDER, "typescript", Config.PACKAGE_MANIFEST_FILE_NAME)))
      return;

    this.writeLog(Build.INSTALLING_PACKAGES);
    await this.executeNpmCommandAsync(["ci", ...Build.NPM_QUIET_ARGUMENTS], process.cwd());
  }

  private async buildPackageAsync(packageInfo: PackageInfo): Promise<void> {
    const outputDirectory = path.join(Config.BUILD_FOLDER, packageInfo.name);
    const sourceDirectory = path.join(packageInfo.directory, Config.SOURCE_DIRECTORY_NAME);

    await this.removeDirectoryAsync(outputDirectory);
    await this.createDirectoryAsync(outputDirectory);
    await this.writeStampedManifestAsync(packageInfo, outputDirectory);
    await this.copyFileAsync(Config.LICENSE_FILE_NAME, path.join(outputDirectory, Config.LICENSE_FILE_NAME));
    await this.copyFileAsync(
      path.join(sourceDirectory, Config.API_DIRECTORY_NAME, Config.DECLARATIONS_FILE_NAME),
      path.join(outputDirectory, Config.API_DIRECTORY_NAME, Config.DECLARATIONS_FILE_NAME));
    await this.executeTypeScriptCompilerAsync([Build.PROJECT_OPTION, path.join(sourceDirectory, Config.PROJECT_FILE_NAME)]);
    await this.stampResourcesAsync(packageInfo, outputDirectory);
    await this.executeNpmCommandAsync(["pack", "--silent", "--pack-destination", path.resolve(Config.PACKAGES_FOLDER)], path.resolve(outputDirectory), true);
    await this.installPackageAsync(packageInfo);
    await BuildEvidence.record(packageInfo);
  }

  private async installPackageAsync(packageInfo: PackageInfo): Promise<void> {
    const archives: string[] = [];
    for (const candidate of Config.PACKAGES) {
      const archive = path.resolve(Config.PACKAGES_FOLDER, candidate.formatTarballFileName(Config.VERSION));
      if (candidate.name === packageInfo.name || await this.pathExistsAsync(archive))
        archives.push(archive);
    }

    await this.removeDirectoryAsync(path.join(Config.NODE_MODULES_FOLDER, packageInfo.packageName));
    await this.executeNpmCommandAsync(
      ["install", "--no-save", "--ignore-scripts", ...Build.NPM_QUIET_ARGUMENTS, ...archives],
      process.cwd(),
      true);
  }

  private async stampResourcesAsync(packageInfo: PackageInfo, outputDirectory: string): Promise<void> {
    const resourcesPath = path.join(outputDirectory, Config.RESOURCES_FILE_NAME);
    if (!await this.pathExistsAsync(resourcesPath))
      return;
    const resources = await this.readFileAsync(resourcesPath);
    let stamped = resources.split(Config.PROTOCOL_VERSION_PLACEHOLDER).join(Config.PROTOCOL_VERSION).split(Config.VERSION_PLACEHOLDER).join(Config.VERSION)
      .split(Config.WINDOWS_PUBLISHER_PLACEHOLDER).join(Config.WINDOWS_PUBLISHER);
    if (stamped.includes(Config.BUILD_PLACEHOLDER))
      stamped = stamped.split(Config.BUILD_PLACEHOLDER).join(await BuildEvidence.fingerprintInputs(packageInfo));
    await this.writeFileAsync(resourcesPath, stamped);
  }

  private async writeStampedManifestAsync(packageInfo: PackageInfo, outputDirectory: string): Promise<void> {
    const manifest = await this.readFileAsync(path.join(packageInfo.directory, Config.PACKAGE_MANIFEST_FILE_NAME));
    await this.writeFileAsync(path.join(outputDirectory, Config.PACKAGE_MANIFEST_FILE_NAME), manifest.split(Config.VERSION_PLACEHOLDER).join(Config.VERSION));
  }

  private selectPackages(names: readonly string[]): readonly PackageInfo[] {
    if (names.length === 0)
      return [];

    const unknown = names.filter(t => !Config.PACKAGES.some(p => p.name === t));
    if (unknown.length > 0)
      throw new Error(`Unknown package(s): ${unknown.join(", ")}. Known packages: ${Config.PACKAGES.map(t => t.name).join(", ")}.`);

    return Config.PACKAGES.filter(t => names.includes(t.name));
  }
}

if (import.meta.main)
  await new Build().runAsync();
