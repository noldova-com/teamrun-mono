/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Assert, Skip, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources, UpdateSignatureException, WindowsSignatureVerifier } from "@noldova/teamrun-desktop";

import { Authenticode } from "../fixtures/authenticode.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class WindowsSignatureVerifierTests {
  private static readonly FIXTURE: string = fileURLToPath(new URL("../fixtures/signature-check.fixture.js", import.meta.url));

  @TestMethod
  public async acceptsOnlyTheExactAnswerOfACompletedCheck(): Promise<void> {
    await WindowsSignatureVerifierTests.fake(["answer", "Signed\r\n"]).verify("installer.exe");
    await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureRejected, WindowsSignatureVerifierTests.fake(["answer", "Refused\r\n"]), "installer.exe");
    for (const args of [["answer", "signed"], ["answer", "Signed\nSigned"], ["answer", ""], ["answer", "Signed", "3"]])
      await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureUnchecked, WindowsSignatureVerifierTests.fake(args), "installer.exe");
    await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureUnchecked, WindowsSignatureVerifierTests.fake(["hang"], "CN=Example", 300), "installer.exe");
    using directory = new TemporaryDirectory();
    await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureUnchecked,
      new WindowsSignatureVerifier("CN=Example", directory.resolve("powershell.exe"), [], 5000), "installer.exe");
  }

  @TestMethod
  public async passesTheFileAndPublisherOnlyThroughTheEnvironment(): Promise<void> {
    const file = `C:\\Updates\\it's "$(calc)" [1].exe`;
    const publisher = 'CN="Example, Inc.", O=Example, C=US';
    const modules = process.env["PSModulePath"];
    process.env["PSModulePath"] = "C:\\Modules";
    try {
      await WindowsSignatureVerifierTests.fake(["environment", file, publisher], publisher).verify(file);
    }
    finally {
      if (modules === undefined) delete process.env["PSModulePath"];
      else process.env["PSModulePath"] = modules;
    }
  }

  @TestMethod
  public async acceptsAValidSignatureWhoseSignerMatchesEveryNamedField(): Promise<void> {
    using directory = new TemporaryDirectory();
    const signed = await WindowsSignatureVerifierTests.copySigned(directory, "it's $(Get-Date) [1].exe");
    await WindowsSignatureVerifierTests.verifier(Authenticode.nodeSigner).verify(signed);
    await WindowsSignatureVerifierTests.verifier(WindowsSignatureVerifierTests.commonName).verify(signed);
  }

  @TestMethod
  public async refusesASignatureFromAnotherPublisher(): Promise<void> {
    using directory = new TemporaryDirectory();
    const signed = await WindowsSignatureVerifierTests.copySigned(directory, "signed.exe");
    const common = WindowsSignatureVerifierTests.commonName;
    for (const publisher of [Resources.windowsPublisher, Authenticode.nodeSigner.replace(common, common.toUpperCase()), `${common}, O=Someone Else`])
      await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureRejected, WindowsSignatureVerifierTests.verifier(publisher), signed);
  }

  @TestMethod
  public async refusesAnUnsignedFileAndOneChangedAfterSigning(): Promise<void> {
    using directory = new TemporaryDirectory();
    const unsigned = directory.resolve("unsigned.exe");
    await writeFile(unsigned, "not signed");
    await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureRejected, WindowsSignatureVerifierTests.verifier(Authenticode.nodeSigner), unsigned);
    const changed = await WindowsSignatureVerifierTests.copySigned(directory, "changed.exe");
    await Authenticode.tamper(changed);
    await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureRejected, WindowsSignatureVerifierTests.verifier(Authenticode.nodeSigner), changed);
  }

  @TestMethod
  public async refusesWhenWindowsPowerShellCannotCheckTheSignature(): Promise<void> {
    using directory = new TemporaryDirectory();
    const signed = await WindowsSignatureVerifierTests.copySigned(directory, "signed.exe");
    await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureUnchecked, WindowsSignatureVerifierTests.verifier("__WINDOWS_PUBLISHER__"), signed);
    await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureUnchecked, WindowsSignatureVerifierTests.verifier(Authenticode.nodeSigner),
      directory.resolve("missing.exe"));
    await WindowsSignatureVerifierTests.refuses(Resources.updateSignatureUnchecked, WindowsSignatureVerifier.forSystemRoot(Authenticode.nodeSigner, directory.path),
      signed);
  }

  private static get commonName(): string {
    const common = Authenticode.nodeSigner.split(", ")[0] ?? "";
    Assert.isTrue(common.startsWith("CN="), Authenticode.nodeSigner);
    return common;
  }

  private static verifier(publisher: string): WindowsSignatureVerifier {
    return WindowsSignatureVerifier.forSystemRoot(publisher, Authenticode.systemRoot);
  }

  private static async copySigned(directory: TemporaryDirectory, name: string): Promise<string> {
    const file = directory.resolve(name);
    await copyFile(process.execPath, file);
    return file;
  }

  private static fake(args: readonly string[], publisher: string = "CN=Example", timeoutMilliseconds: number = 10_000): WindowsSignatureVerifier {
    return new WindowsSignatureVerifier(publisher, process.execPath, [WindowsSignatureVerifierTests.FIXTURE, ...args], timeoutMilliseconds);
  }

  private static async refuses(message: string, verifier: WindowsSignatureVerifier, file: string): Promise<void> {
    const refusal = await Assert.throwsAsync(() => verifier.verify(file), UpdateSignatureException);
    Assert.areEqual(message, refusal.message);
  }
}

if (process.platform !== "win32")
  for (const test of [WindowsSignatureVerifierTests.prototype.acceptsAValidSignatureWhoseSignerMatchesEveryNamedField,
    WindowsSignatureVerifierTests.prototype.refusesASignatureFromAnotherPublisher, WindowsSignatureVerifierTests.prototype.refusesAnUnsignedFileAndOneChangedAfterSigning,
    WindowsSignatureVerifierTests.prototype.refusesWhenWindowsPowerShellCannotCheckTheSignature])
    Skip("Authenticode signatures and Windows PowerShell exist only on Windows.")(test);
