/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default class PowerShellGalleryFixture {
  private static readonly POWERSHELL: string = "pwsh";
  private static readonly MODULE_PATH_QUERY: readonly string[] = ["-NoProfile", "-NonInteractive", "-Command", "$env:PSModulePath"];
  private static readonly MODULE_PATH_QUERY_TIMEOUT: number = 30_000;
  private static readonly MODULES_DIRECTORY: string = "modules";
  private static readonly GALLERY_DIRECTORY: string = "gallery";
  private static readonly PROVIDER_NAME: string = "PowerShellGetFixture";
  private static readonly MODULE_NAME: string = "TrustedSigning";
  private static readonly MODULE_FOLDER_VERSION: string = "0.5.8";
  private static readonly MANIFEST_EXTENSION: string = ".psd1";
  private static readonly MODULE_EXTENSION: string = ".psm1";
  private static readonly SAVE_RECORD_NAME: string = "save-module.json";
  private static readonly SIGNING_RECORD_EXTENSION: string = ".signing.json";
  private static readonly PROVIDER_MANIFEST: string =
    "@{ ModuleVersion = '1.0.0'; RootModule = 'PowerShellGetFixture.psm1'; FunctionsToExport = @('Save-Module') }";
  private static readonly PROVIDER_MODULE: string = [
    "function Save-Module {",
    "  param([string]$Name, [string]$RequiredVersion, [string]$Repository, [string]$Path, [switch]$Force)",
    "  New-Item -ItemType Directory -Force -Path $Path | Out-Null",
    "  @{ Name = $Name; RequiredVersion = $RequiredVersion; Repository = $Repository; Path = $Path; Force = [bool]$Force } | ConvertTo-Json |",
    "    Set-Content -Path (Join-Path $Path 'save-module.json')",
    "  Copy-Item -Recurse -Path (Join-Path $PSScriptRoot '..' '..' 'gallery' $Name) -Destination (Join-Path $Path $Name)",
    "}"
  ].join("\n");
  private static readonly SIGNING_MODULE: string = [
    "function Invoke-TrustedSigning {",
    "  [CmdletBinding()]",
    "  param([string]$Endpoint, [string]$CodeSigningAccountName, [string]$CertificateProfileName, [string]$FileDigest,",
    "    [string]$TimestampRfc3161, [string]$TimestampDigest, [string]$Files)",
    "  $PSBoundParameters | ConvertTo-Json | Set-Content -Path ($Files + '.signing.json')",
    "}"
  ].join("\n");
  private static readonly UTF8_ENCODING: BufferEncoding = "utf8";

  public static get saveRecordName(): string {
    return PowerShellGalleryFixture.SAVE_RECORD_NAME;
  }

  public static get signingRecordExtension(): string {
    return PowerShellGalleryFixture.SIGNING_RECORD_EXTENSION;
  }

  /**
   * Returns a PSModulePath that starts with the fixture modules and continues with the folders pwsh uses by default.
   * pwsh puts its own folders in front of an inherited PSModulePath that lacks them, which would hide the fixture.
   */
  public static modulePath(modules: string): string {
    const query = spawnSync(PowerShellGalleryFixture.POWERSHELL, [...PowerShellGalleryFixture.MODULE_PATH_QUERY],
      { encoding: PowerShellGalleryFixture.UTF8_ENCODING, timeout: PowerShellGalleryFixture.MODULE_PATH_QUERY_TIMEOUT });
    if (query.error !== undefined)
      throw query.error;
    if (query.status !== 0)
      throw new Error(query.stderr);
    return modules + path.delimiter + query.stdout.trim();
  }

  public static async writeAsync(root: string, manifestVersion: string): Promise<string> {
    const provider = path.join(root, PowerShellGalleryFixture.MODULES_DIRECTORY, PowerShellGalleryFixture.PROVIDER_NAME);
    const module = path.join(
      root,
      PowerShellGalleryFixture.GALLERY_DIRECTORY,
      PowerShellGalleryFixture.MODULE_NAME,
      PowerShellGalleryFixture.MODULE_FOLDER_VERSION);
    await mkdir(provider, { recursive: true });
    await mkdir(module, { recursive: true });
    await writeFile(
      path.join(provider, PowerShellGalleryFixture.PROVIDER_NAME + PowerShellGalleryFixture.MANIFEST_EXTENSION),
      PowerShellGalleryFixture.PROVIDER_MANIFEST, PowerShellGalleryFixture.UTF8_ENCODING);
    await writeFile(
      path.join(provider, PowerShellGalleryFixture.PROVIDER_NAME + PowerShellGalleryFixture.MODULE_EXTENSION),
      PowerShellGalleryFixture.PROVIDER_MODULE, PowerShellGalleryFixture.UTF8_ENCODING);
    await writeFile(
      path.join(module, PowerShellGalleryFixture.MODULE_NAME + PowerShellGalleryFixture.MANIFEST_EXTENSION),
      PowerShellGalleryFixture.formatSigningManifest(manifestVersion), PowerShellGalleryFixture.UTF8_ENCODING);
    await writeFile(
      path.join(module, PowerShellGalleryFixture.MODULE_NAME + PowerShellGalleryFixture.MODULE_EXTENSION),
      PowerShellGalleryFixture.SIGNING_MODULE, PowerShellGalleryFixture.UTF8_ENCODING);
    return path.join(root, PowerShellGalleryFixture.MODULES_DIRECTORY);
  }

  private static formatSigningManifest(version: string): string {
    return `@{ ModuleVersion = '${version}'; RootModule = 'TrustedSigning.psm1'; FunctionsToExport = @('Invoke-TrustedSigning') }`;
  }
}
