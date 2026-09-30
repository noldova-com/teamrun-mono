/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

class SignatureCheckFixture {
  public static run(mode: string | undefined, values: readonly string[]): void {
    if (mode === "answer") {
      process.stdout.write(values[0] ?? "");
      process.exitCode = Number(values[1] ?? "0");
      return;
    }
    if (mode === "hang") {
      setInterval(() => undefined, 1000);
      return;
    }
    if (mode === "environment") {
      const matches = process.env["TEAMRUN_SIGNED_FILE"] === values[0] && process.env["TEAMRUN_SIGNATURE_PUBLISHER"] === values[1] &&
        !Object.keys(process.env).some(t => t.toUpperCase() === "PSMODULEPATH");
      process.stdout.write(matches ? "Signed\r\n" : "Refused\r\n");
      return;
    }
    throw new Error(`Unknown signature check fixture mode: ${mode}`);
  }
}

SignatureCheckFixture.run(process.argv[2], process.argv.slice(3));
