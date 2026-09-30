/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { parseArgs } from "node:util";

import Config from "../config.ts";
import PackageException from "./package.exception.ts";

export default class PackageOptions {
  private static readonly PACKAGE_ARGUMENT_OPTIONS = {
    platform: { type: "string" },
    arch: { type: "string" },
    dir: { type: "boolean", default: false },
    signed: { type: "boolean", default: false },
    help: { type: "boolean", default: false }
  } as const;
  private static readonly OPTION_TOKEN_KIND = "option";
  private static readonly WINDOWS_NODE_PLATFORM: NodeJS.Platform = "win32";
  private static readonly WINDOWS_PLATFORM: string = "windows";
  private static readonly MAC_NODE_PLATFORM: NodeJS.Platform = "darwin";
  private static readonly MAC_PLATFORM: string = "mac";
  private static readonly LINUX_PLATFORM: string = "linux";
  private static readonly ARCHITECTURES: readonly string[] = ["x64", "arm64"];
  private static readonly DEFAULT_ARCHITECTURE: string = "x64";
  private static readonly WINDOWS_UNPACKED_PREFIX: string = "win";
  private static readonly UNPACKED_SUFFIX: string = "-unpacked";
  private static readonly RESOURCES_FOLDER: string = "resources";
  private static readonly MAC_RESOURCES_SEGMENTS: readonly string[] = ["TeamRun.app", "Contents", "Resources"];
  private static readonly LINUX_SIGNING_UNSUPPORTED: string = "--signed is supported for Windows and macOS only.";
  private static readonly SIGNED_DIRECTORY_UNSUPPORTED: string = "--signed requires an installer build; omit --dir.";
  private static readonly WINDOWS_BUILDER_OPTION: string = "--win";
  private static readonly MAC_BUILDER_OPTION: string = "--mac";
  private static readonly LINUX_BUILDER_OPTION: string = "--linux";
  private static readonly PACKAGE_STAGING_FOLDER: string = "_build/app";
  private static readonly PACKAGE_OUTPUT_FOLDER: string = "_build/package";
  private static readonly INSTALLER_POLICY_DIRECTORY: string = "_build/installer-policy";
  private static readonly INSTALLER_POLICY_EXTENSION: string = ".nsh";
  private static readonly APPIMAGE_LAUNCHER_DIRECTORY: string = "_build/appimage";
  private static readonly APPIMAGE_LAUNCHER_NAME: string = "AppRun";
  private static readonly NOTARIZATION_ENVIRONMENT_GROUPS: readonly (readonly string[])[] = [
    ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"],
    ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"],
    ["APPLE_KEYCHAIN_PROFILE"]
  ];
  private static readonly MISSING_NOTARIZATION: string = "Signed macOS packages require a complete Apple notarization environment.";
  private static readonly WINDOWS_SIGNING_ENVIRONMENT: readonly string[] = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"];
  private static readonly MISSING_WINDOWS_SIGNING: string = "Signed Windows packages require AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET.";
  private static readonly BUILDER_CONFIG_ARGUMENTS: readonly string[] = ["--config", "electron-builder.json"];
  private static readonly NEVER_PUBLISH_ARGUMENTS: readonly string[] = ["--publish", "never"];
  private static readonly DIRECTORY_OPTION: string = "--dir";
  private static readonly SIGNED_OPTIONS: readonly string[] = ["--config.forceCodeSigning=true"];
  private static readonly SIGNED_WINDOWS_OPTIONS: readonly string[] = ["--config.win.signExecutable=true",
    `--config.win.signtoolOptions.publisherName=${Config.WINDOWS_PUBLISHER}`];
  private static readonly SIGNED_MAC_OPTION: string = "--config.mac.notarize=true";
  private static readonly UNSIGNED_WINDOWS_OPTION: string = "--config.win.signExecutable=false";
  private static readonly UNSIGNED_MAC_OPTIONS: readonly string[] = ["--config.mac.identity=null", "--config.mac.notarize=false"];
  private static readonly PACKAGE_INSTALL_ARGUMENTS: readonly string[] = [
    "ci", "--omit=dev", "--omit=optional", "--ignore-scripts", "--no-audit", "--no-fund"
  ];

  private readonly builderPlatform: string;

  public readonly platform: string;
  public readonly nodePlatform: NodeJS.Platform;
  public readonly architecture: string;
  public readonly directoryOnly: boolean;
  public readonly signed: boolean;
  public readonly help: boolean;

  public constructor(args: readonly string[], hostPlatform: NodeJS.Platform = process.platform, hostArchitecture: string = process.arch) {
    const parsed = parseArgs({ args: [...args], options: PackageOptions.PACKAGE_ARGUMENT_OPTIONS, strict: true, allowPositionals: false, tokens: true });
    const names = new Set<string>();
    for (const token of parsed.tokens) {
      if (token.kind !== PackageOptions.OPTION_TOKEN_KIND)
        continue;
      if (names.has(token.name))
        throw new PackageException(PackageOptions.formatDuplicateOption(token.name));
      names.add(token.name);
    }
    const hostName = hostPlatform === PackageOptions.WINDOWS_NODE_PLATFORM ? PackageOptions.WINDOWS_PLATFORM :
      hostPlatform === PackageOptions.MAC_NODE_PLATFORM ? PackageOptions.MAC_PLATFORM : hostPlatform;
    const platform = parsed.values.platform ?? hostName;
    const architecture = parsed.values.arch ?? hostArchitecture;
    if (![PackageOptions.WINDOWS_PLATFORM, PackageOptions.LINUX_PLATFORM, PackageOptions.MAC_PLATFORM].includes(platform))
      throw new PackageException(PackageOptions.formatUnsupportedPlatform(platform));
    if (!PackageOptions.ARCHITECTURES.includes(architecture))
      throw new PackageException(PackageOptions.formatUnsupportedArchitecture(architecture));
    if (platform !== hostName)
      throw new PackageException(PackageOptions.formatWrongHost(platform));
    if (parsed.values.signed && platform === PackageOptions.LINUX_PLATFORM)
      throw new PackageException(PackageOptions.LINUX_SIGNING_UNSUPPORTED);
    if (parsed.values.signed && parsed.values.dir)
      throw new PackageException(PackageOptions.SIGNED_DIRECTORY_UNSUPPORTED);

    this.platform = platform;
    this.nodePlatform = hostPlatform;
    this.architecture = architecture;
    this.directoryOnly = parsed.values.dir;
    this.signed = parsed.values.signed;
    this.help = parsed.values.help;
    this.builderPlatform = platform === PackageOptions.WINDOWS_PLATFORM ? PackageOptions.WINDOWS_BUILDER_OPTION :
      platform === PackageOptions.MAC_PLATFORM ? PackageOptions.MAC_BUILDER_OPTION : PackageOptions.LINUX_BUILDER_OPTION;
  }

  public get targetName(): string {
    return PackageOptions.formatTarget(this.platform, this.architecture);
  }

  public get appDirectory(): string {
    return path.resolve(PackageOptions.PACKAGE_STAGING_FOLDER, this.targetName);
  }

  public get outputDirectory(): string {
    return path.resolve(PackageOptions.PACKAGE_OUTPUT_FOLDER, this.targetName);
  }

  public get resourcesDirectory(): string {
    const suffix = this.architecture === PackageOptions.DEFAULT_ARCHITECTURE ? String() : `-${this.architecture}`;
    if (this.platform === PackageOptions.WINDOWS_PLATFORM)
      return path.join(this.outputDirectory, `${PackageOptions.WINDOWS_UNPACKED_PREFIX}${suffix}${PackageOptions.UNPACKED_SUFFIX}`, PackageOptions.RESOURCES_FOLDER);
    if (this.platform === PackageOptions.LINUX_PLATFORM)
      return path.join(this.outputDirectory, `${PackageOptions.LINUX_PLATFORM}${suffix}${PackageOptions.UNPACKED_SUFFIX}`, PackageOptions.RESOURCES_FOLDER);
    return path.join(this.outputDirectory, `${PackageOptions.MAC_PLATFORM}${suffix}`, ...PackageOptions.MAC_RESOURCES_SEGMENTS);
  }

  public get installerPolicyPath(): string {
    return path.resolve(PackageOptions.INSTALLER_POLICY_DIRECTORY, this.targetName + PackageOptions.INSTALLER_POLICY_EXTENSION);
  }

  public get appImageLauncherPath(): string {
    return path.resolve(PackageOptions.APPIMAGE_LAUNCHER_DIRECTORY, this.architecture, PackageOptions.APPIMAGE_LAUNCHER_NAME);
  }

  public assertSigningEnvironment(environment: NodeJS.ProcessEnv): void {
    if (!this.signed)
      return;
    if (this.platform === PackageOptions.WINDOWS_PLATFORM && !PackageOptions.WINDOWS_SIGNING_ENVIRONMENT.every(t => (environment[t]?.trim().length ?? 0) > 0))
      throw new PackageException(PackageOptions.MISSING_WINDOWS_SIGNING);
    if (this.platform === PackageOptions.MAC_PLATFORM
      && !PackageOptions.NOTARIZATION_ENVIRONMENT_GROUPS.some(t => t.every(t => (environment[t]?.trim().length ?? 0) > 0)))
      throw new PackageException(PackageOptions.MISSING_NOTARIZATION);
  }

  public createBuilderArguments(): readonly string[] {
    const argumentsList = [
      ...PackageOptions.BUILDER_CONFIG_ARGUMENTS,
      this.builderPlatform,
      PackageOptions.formatArchitectureOption(this.architecture),
      ...PackageOptions.NEVER_PUBLISH_ARGUMENTS,
      PackageOptions.formatAppDirectoryOption(this.appDirectory),
      PackageOptions.formatOutputDirectoryOption(this.outputDirectory)
    ];
    if (this.directoryOnly)
      argumentsList.push(PackageOptions.DIRECTORY_OPTION);
    else if (this.platform === PackageOptions.WINDOWS_PLATFORM)
      argumentsList.push(PackageOptions.formatInstallerPolicyOption(this.installerPolicyPath));
    if (this.platform === PackageOptions.LINUX_PLATFORM)
      argumentsList.push(PackageOptions.formatLinuxArtifactNameOption(this.architecture));
    if (this.signed) {
      argumentsList.push(...PackageOptions.SIGNED_OPTIONS);
      if (this.platform === PackageOptions.WINDOWS_PLATFORM)
        argumentsList.push(...PackageOptions.SIGNED_WINDOWS_OPTIONS);
      else
        argumentsList.push(PackageOptions.SIGNED_MAC_OPTION);
    }
    else if (this.platform === PackageOptions.WINDOWS_PLATFORM)
      argumentsList.push(PackageOptions.UNSIGNED_WINDOWS_OPTION);
    else if (this.platform === PackageOptions.MAC_PLATFORM)
      argumentsList.push(...PackageOptions.UNSIGNED_MAC_OPTIONS);
    return argumentsList;
  }

  public createInstallArguments(archives: readonly string[] = []): readonly string[] {
    return [
      ...(archives.length === 0 ? PackageOptions.PACKAGE_INSTALL_ARGUMENTS : ["install", "--no-save", ...PackageOptions.PACKAGE_INSTALL_ARGUMENTS.slice(1)]),
      PackageOptions.formatNpmPlatform(this.nodePlatform),
      PackageOptions.formatNpmArchitecture(this.architecture),
      ...archives
    ];
  }

  private static formatDuplicateOption(option: string): string {
    return `Packaging option --${option} was supplied more than once.`;
  }

  private static formatUnsupportedPlatform(platform: string): string {
    return `Unsupported packaging platform "${platform}". Use windows, linux, or mac.`;
  }

  private static formatUnsupportedArchitecture(architecture: string): string {
    return `Unsupported packaging architecture "${architecture}". Use x64 or arm64.`;
  }

  private static formatWrongHost(platform: string): string {
    return `Build ${platform} packages on a ${platform} runner.`;
  }

  private static formatTarget(platform: string, architecture: string): string {
    return `${platform}-${architecture}`;
  }

  private static formatArchitectureOption(architecture: string): string {
    return `--${architecture}`;
  }

  private static formatAppDirectoryOption(directory: string): string {
    return `--config.directories.app=${directory}`;
  }

  private static formatOutputDirectoryOption(directory: string): string {
    return `--config.directories.output=${directory}`;
  }

  private static formatInstallerPolicyOption(path: string): string { return `--config.nsis.include=${path}`; }

  private static formatLinuxArtifactNameOption(architecture: string): string {
    return `--config.linux.artifactName=TeamRun-linux-${architecture}.\${ext}`;
  }

  private static formatNpmPlatform(platform: NodeJS.Platform): string {
    return `--os=${platform}`;
  }

  private static formatNpmArchitecture(architecture: string): string {
    return `--cpu=${architecture}`;
  }
}
