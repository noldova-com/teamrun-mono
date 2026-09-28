/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

class RegistryOutputFixture {
  private static readonly EXIT_OPTION: string = "--exit";
  private static readonly HANG_OPTION: string = "--hang";

  public static run(args: readonly string[]): void {
    if (args.includes(RegistryOutputFixture.HANG_OPTION)) {
      setInterval(() => undefined, 60_000);
      return;
    }
    const exitIndex = args.indexOf(RegistryOutputFixture.EXIT_OPTION);
    if (exitIndex >= 0) {
      process.exitCode = Number(args[exitIndex + 1]);
      return;
    }
    process.stdout.write(args.map(t => `${t}\r\n`).join(""));
  }
}

RegistryOutputFixture.run(process.argv.slice(2));
