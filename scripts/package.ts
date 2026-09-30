/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp } from "node:fs/promises";
import path from "node:path";

import rootLock from "../package-lock.json" with { type: "json" };
import rootManifest from "../package.json" with { type: "json" };
import BuildEvidence from "./build/build-evidence.ts";
import Config from "./config.ts";
import AppImageLauncher from "./packaging/app-image-launcher.ts";
import PackageArtifacts from "./packaging/package-artifacts.ts";
import PackageOptions from "./packaging/package-options.ts";
import PackageException from "./packaging/package.exception.ts";
import NativeTerminalFiles from "./packaging/native-terminal-files.ts";
import PackagedManifest from "./packaging/packaged-manifest.ts";
import Script from "./script.ts";
import TrustedSigningModule from "./packaging/trusted-signing-module.ts";
import WindowsInstallerPolicy from "./packaging/windows-installer-policy.ts";

export default class Package extends Script {
  private static readonly HELP: string =
    "npm run package -- [--platform windows|linux|mac] [--arch x64|arm64] [--dir] [--signed]\n" +
    "Defaults: current OS and CPU. Use the matching OS runner; either CPU target is accepted.\n" +
    "--dir builds an unpacked app. --signed requires platform signing (and macOS notarization).\n" +
    "Outputs: _build/package/<platform>-<arch>. Packages are never published by this command.";
  private static readonly RENDERER_BUILD_ARGUMENTS: readonly string[] = ["run", "build", "--", "--renderer"];
  private static readonly RENDERER_OUTPUT: string = "_build/renderer/browser";
  private static readonly RENDERER_INDEX: string = "index.html";
  private static readonly MISSING_RENDERER: string = "The renderer build did not produce index.html.";
  private static readonly TESTING_PACKAGE_NAME: string = "@noldova/teamrun-foundation-testing";
  private static readonly SIGNING_MODULE: string = "Saving the recorded TrustedSigning module...";
  private static readonly STAGING: string = "Staging the application directory...";
  private static readonly INSTALLING: string = "Installing locked production dependencies...";
  private static readonly NODE_MODULES_PREFIX: string = "node_modules/";
  private static readonly NESTED_NODE_MODULES_SEGMENT: string = "/node_modules/";
  private static readonly JSON_INDENTATION: number = 2;
  private static readonly NEWLINE: string = "\n";
  private static readonly RENDERER_SEGMENTS: readonly string[] = ["_build", "renderer", "browser"];
  private static readonly BUILDING: string = "Running electron-builder (publication disabled)...";
  private static readonly CHECKING_TERMINAL_FILES: string = "Checking the native terminal files outside the archive...";
  private static readonly WINDOWS_PLATFORM: string = "windows";
  private static readonly LINUX_PLATFORM: string = "linux";
  private static readonly BUILDER_CLI_PATH: string = "node_modules/electron-builder/cli.js";
  private static readonly RELEASE_REVISION_VARIABLE: string = "RELEASE_REVISION";
  private static readonly GITHUB_REVISION_VARIABLE: string = "GITHUB_SHA";

  public override async runAsync(): Promise<void> {
    const options = new PackageOptions(process.argv.slice(2));
    if (options.help) {
      this.writeLog(Package.HELP);
      return;
    }
    options.assertSigningEnvironment(process.env);
    await BuildEvidence.requireCurrent();
    if (options.signed && options.platform === Package.WINDOWS_PLATFORM) {
      this.writeLog(Package.SIGNING_MODULE);
      await new TrustedSigningModule().prepareAsync();
    }
    await this.executeNpmCommandAsync(Package.RENDERER_BUILD_ARGUMENTS, process.cwd());
    const rendererOutput = path.resolve(Package.RENDERER_OUTPUT);
    if (!await this.pathExistsAsync(path.join(rendererOutput, Package.RENDERER_INDEX)))
      throw new PackageException(Package.MISSING_RENDERER);
    const packages = Config.PACKAGES.filter(t => t.packageName !== Package.TESTING_PACKAGE_NAME);

    this.writeLog(Package.STAGING);
    await this.removeDirectoryAsync(options.appDirectory);
    await this.createDirectoryAsync(options.appDirectory);
    for (const filename of [Config.PACKAGE_MANIFEST_FILE_NAME, Config.PACKAGE_LOCK_FILE_NAME, Config.LICENSE_FILE_NAME])
      await this.copyFileAsync(path.resolve(filename), path.join(options.appDirectory, filename));

    this.writeLog(Package.INSTALLING);
    await this.executeNpmCommandAsync(options.createInstallArguments(), options.appDirectory);
    const archives = packages.map(packageInfo => path.resolve(Config.PACKAGES_FOLDER, packageInfo.formatTarballFileName(Config.VERSION)));
    await this.executeNpmCommandAsync(options.createInstallArguments(archives), options.appDirectory);
    const nativeTerminalFiles = new NativeTerminalFiles(options.nodePlatform, options.architecture);
    await nativeTerminalFiles.prune(options.appDirectory);

    const externalDependencies: Record<string, string> = { ...rootManifest.dependencies };
    for (const [location, entry] of Object.entries(rootLock.packages)) {
      if (!location.startsWith(Package.NODE_MODULES_PREFIX))
        continue;
      const name = location.slice(Package.NODE_MODULES_PREFIX.length);
      const installedManifest = path.join(options.appDirectory, location, Config.PACKAGE_MANIFEST_FILE_NAME);
      if (!await this.pathExistsAsync(installedManifest))
        continue;
      const installed: unknown = JSON.parse(await this.readFileAsync(installedManifest));
      if (typeof installed !== "object" || installed === null || !("version" in installed) || installed.version !== entry.version)
        throw new PackageException(Package.formatDependencyMismatch(name, entry.version));
      if (!name.includes(Package.NESTED_NODE_MODULES_SEGMENT))
        externalDependencies[name] = entry.version;
    }

    const manifest = new PackagedManifest(externalDependencies, packages);
    await this.writeFileAsync(
      path.join(options.appDirectory, Config.PACKAGE_MANIFEST_FILE_NAME),
      JSON.stringify(manifest, null, Package.JSON_INDENTATION) + Package.NEWLINE);
    await this.removeFileAsync(path.join(options.appDirectory, Config.PACKAGE_LOCK_FILE_NAME));
    await cp(rendererOutput, path.join(options.appDirectory, ...Package.RENDERER_SEGMENTS), { recursive: true });

    this.writeLog(Package.BUILDING);
    await this.removeDirectoryAsync(options.outputDirectory);
    if (options.platform === Package.WINDOWS_PLATFORM && !options.directoryOnly)
      await WindowsInstallerPolicy.write(options.installerPolicyPath);
    if (options.platform === Package.LINUX_PLATFORM)
      await AppImageLauncher.write(options.appImageLauncherPath);
    await this.executeProcessAsync(
      process.execPath,
      [path.resolve(Package.BUILDER_CLI_PATH), ...options.createBuilderArguments()],
      process.cwd());
    this.writeLog(Package.CHECKING_TERMINAL_FILES);
    await nativeTerminalFiles.verify(options.resourcesDirectory);
    if (!options.directoryOnly)
      await new PackageArtifacts(options, Config.VERSION).writeReport(process.env[Package.RELEASE_REVISION_VARIABLE] ?? process.env[Package.GITHUB_REVISION_VARIABLE] ?? null);
  }

  private static formatDependencyMismatch(name: string, version: string): string {
    return `The staged dependency ${name} does not match locked version ${version}.`;
  }
}

if (import.meta.main)
  await new Package().runAsync();
