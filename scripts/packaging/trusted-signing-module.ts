/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";

import PackageException from "./package.exception.ts";

/**
 * The recorded version of Microsoft's TrustedSigning PowerShell module and the commands that sign Windows files with it.
 * `prepareAsync` saves exactly that version from the PowerShell Gallery into its own directory and checks that it loads;
 * `signFileAsync` runs in electron-builder's process and needs the Azure signing environment variables.
 */
export default class TrustedSigningModule {
  private static readonly NAME: string = "TrustedSigning";
  private static readonly VERSION: string = "0.5.8";
  private static readonly REPOSITORY: string = "PSGallery";
  private static readonly DIRECTORY: string = "_build/signing";
  private static readonly MANIFEST_EXTENSION: string = ".psd1";
  private static readonly POWERSHELL: string = "pwsh";
  private static readonly POWERSHELL_ARGUMENTS: readonly string[] = ["-NoProfile", "-NonInteractive", "-Command"];
  private static readonly DIRECTORY_VARIABLE: string = "TEAMRUN_SIGNING_DIRECTORY";
  private static readonly MANIFEST_VARIABLE: string = "TEAMRUN_SIGNING_MODULE";
  private static readonly FILE_VARIABLE: string = "TEAMRUN_SIGNING_FILE";
  private static readonly FILE_SEPARATOR: string = ",";
  private static readonly ENDPOINT: string = "https://wus3.codesigning.azure.net/";
  private static readonly ACCOUNT_NAME: string = "noldova-signing";
  private static readonly CERTIFICATE_PROFILE: string = "TeamRun";
  private static readonly TIMESTAMP_SERVER: string = "http://timestamp.acs.microsoft.com";
  private static readonly DIGEST: string = "SHA256";
  private static readonly STOP_ON_ERROR: string = "$ErrorActionPreference = 'Stop'";
  private static readonly SAVE_COMMAND: string = [
    TrustedSigningModule.STOP_ON_ERROR,
    `Save-Module -Name ${TrustedSigningModule.NAME} -RequiredVersion ${TrustedSigningModule.VERSION} ` +
      `-Repository ${TrustedSigningModule.REPOSITORY} -Path $env:${TrustedSigningModule.DIRECTORY_VARIABLE} -Force`
  ].join("\n");
  private static readonly VERIFY_COMMAND: string = [
    TrustedSigningModule.STOP_ON_ERROR,
    `Import-Module $env:${TrustedSigningModule.MANIFEST_VARIABLE}`,
    `$module = Get-Module -Name ${TrustedSigningModule.NAME}`,
    `if ($module.Version -ne [version]'${TrustedSigningModule.VERSION}') ` +
      `{ throw "${TrustedSigningModule.NAME} $($module.Version) loaded instead of ${TrustedSigningModule.VERSION}." }`,
    `Write-Output "${TrustedSigningModule.NAME} $($module.Version) from $($module.ModuleBase)"`
  ].join("\n");
  private static readonly SIGN_COMMAND: string = [
    TrustedSigningModule.STOP_ON_ERROR,
    `Import-Module $env:${TrustedSigningModule.MANIFEST_VARIABLE}`,
    `Invoke-TrustedSigning -Endpoint '${TrustedSigningModule.ENDPOINT}' -CodeSigningAccountName '${TrustedSigningModule.ACCOUNT_NAME}' ` +
      `-CertificateProfileName '${TrustedSigningModule.CERTIFICATE_PROFILE}' -FileDigest '${TrustedSigningModule.DIGEST}' ` +
      `-TimestampRfc3161 '${TrustedSigningModule.TIMESTAMP_SERVER}' -TimestampDigest '${TrustedSigningModule.DIGEST}' ` +
      `-Files $env:${TrustedSigningModule.FILE_VARIABLE}`
  ].join("\n");

  private readonly directory: string;

  public constructor(directory: string = path.resolve(TrustedSigningModule.DIRECTORY)) {
    this.directory = directory;
  }

  public get manifestPath(): string {
    return path.join(
      this.directory,
      TrustedSigningModule.NAME,
      TrustedSigningModule.VERSION,
      TrustedSigningModule.NAME + TrustedSigningModule.MANIFEST_EXTENSION);
  }

  public async prepareAsync(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
    await this.runAsync(TrustedSigningModule.SAVE_COMMAND, { [TrustedSigningModule.DIRECTORY_VARIABLE]: this.directory });
    await this.runAsync(TrustedSigningModule.VERIFY_COMMAND, { [TrustedSigningModule.MANIFEST_VARIABLE]: this.manifestPath });
  }

  public async signFileAsync(file: string): Promise<void> {
    if (file.includes(TrustedSigningModule.FILE_SEPARATOR))
      throw new PackageException(TrustedSigningModule.formatUnsignableFile(file));
    await this.runAsync(TrustedSigningModule.SIGN_COMMAND, {
      [TrustedSigningModule.MANIFEST_VARIABLE]: this.manifestPath,
      [TrustedSigningModule.FILE_VARIABLE]: path.resolve(file)
    });
  }

  private static formatUnsignableFile(file: string): string {
    return `The TrustedSigning module takes a comma-separated file list, so it cannot sign ${file}.`;
  }

  private static formatFailure(code: number | null, signal: NodeJS.Signals | null): string {
    return `${TrustedSigningModule.POWERSHELL} exited with code ${code} and signal ${signal} while running the ${TrustedSigningModule.NAME} module.`;
  }

  private runAsync(command: string, environment: Readonly<Record<string, string>>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(TrustedSigningModule.POWERSHELL, [...TrustedSigningModule.POWERSHELL_ARGUMENTS, command], {
        stdio: "inherit",
        shell: false,
        env: { ...process.env, ...environment }
      });
      child.on("error", reject);
      child.on("exit", (code, signal) => {
        if (code === 0)
          resolve();
        else
          reject(new PackageException(TrustedSigningModule.formatFailure(code, signal)));
      });
    });
  }
}
