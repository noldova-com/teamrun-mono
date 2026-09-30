/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { win32 } from "node:path";

import "@noldova/teamrun-foundation-core";

import { UpdateSignatureException } from "../exceptions/update-signature.exception.js";
import { Resources } from "../resources.js";

export class WindowsSignatureVerifier {
  private readonly publisher: string;
  private readonly executable: string;
  private readonly arguments: readonly string[];
  private readonly timeoutMilliseconds: number;

  public constructor(publisher: string, executable: string, args: readonly string[], timeoutMilliseconds: number) {
    this.publisher = publisher;
    this.executable = executable;
    this.arguments = args;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  public static forSystemRoot(publisher: string, systemRoot: string): WindowsSignatureVerifier {
    const script = Buffer.from(Resources.signatureScript, Resources.utf16Encoding).toString(Resources.base64Encoding);
    return new WindowsSignatureVerifier(publisher, win32.join(systemRoot, ...Resources.windowsPowerShellSegments), [...Resources.signatureArguments, script],
      Resources.signatureMilliseconds);
  }

  public async verify(file: string): Promise<void> {
    let answer: string;
    try {
      answer = await this.run(file);
    }
    catch (error) {
      throw new UpdateSignatureException(Resources.updateSignatureUnchecked, error);
    }
    if (answer === Resources.signatureRefused)
      throw new UpdateSignatureException(Resources.updateSignatureRejected);
    if (answer !== Resources.signatureAccepted)
      throw new UpdateSignatureException(Resources.updateSignatureUnchecked);
  }

  private run(file: string): Promise<string> {
    const environment: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env)
      .filter(([name]) => name.toUpperCase() !== Resources.powerShellModulePathVariable));
    environment[Resources.signatureFileVariable] = file;
    environment[Resources.signaturePublisherVariable] = this.publisher;
    return new Promise((resolve, reject) => {
      const child = execFile(this.executable, this.arguments, { env: environment, timeout: this.timeoutMilliseconds, windowsHide: true },
        (error, stdout) => Object.isNull(error) ? resolve(stdout.trim()) : reject(error));
      child.stdin?.end();
    });
  }
}
