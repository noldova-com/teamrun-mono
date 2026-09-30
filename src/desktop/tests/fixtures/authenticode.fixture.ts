/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { open } from "node:fs/promises";
import { win32 } from "node:path";

import { Resources } from "@noldova/teamrun-desktop";

export class Authenticode {
  private static nodeSignerValue: string | null = null;

  public static async timed<T>(label: string, action: () => Promise<T> | T): Promise<T> {
    const started = performance.now();
    try { return await action(); }
    finally { console.error(`[timing #193] ${label}: ${Math.round(performance.now() - started)} ms`); }
  }

  public static get nodeSigner(): string {
    const started = performance.now();
    const cached = Authenticode.nodeSignerValue !== null;
    Authenticode.nodeSignerValue ??= Authenticode.signer(process.execPath);
    if (!cached) console.error(`[timing #193] read node.exe signer: ${Math.round(performance.now() - started)} ms`);
    return Authenticode.nodeSignerValue;
  }

  public static get systemRoot(): string {
    const systemRoot = process.env[Resources.systemRootVariable];
    if (!systemRoot) throw new Error("Windows did not provide SystemRoot.");
    return systemRoot;
  }

  public static signer(file: string): string {
    return execFileSync(win32.join(Authenticode.systemRoot, ...Resources.windowsPowerShellSegments),
      ["-NoProfile", "-NonInteractive", "-Command", "(Get-AuthenticodeSignature -LiteralPath $env:TEAMRUN_TEST_FILE).SignerCertificate.Subject"],
      { env: { ...process.env, TEAMRUN_TEST_FILE: file }, encoding: "utf8", windowsHide: true }).trim();
  }

  public static async tamper(file: string): Promise<void> {
    const handle = await open(file, "r+");
    try {
      const position = Math.floor((await handle.stat()).size / 2);
      const byte = Buffer.alloc(1);
      await handle.read(byte, 0, 1, position);
      byte[0] = (byte[0] ?? 0) ^ 0xff;
      await handle.write(byte, 0, 1, position);
    }
    finally { await handle.close(); }
  }
}
