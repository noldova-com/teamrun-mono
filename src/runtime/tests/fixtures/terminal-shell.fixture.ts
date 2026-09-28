/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

class TerminalShellFixture {
  private static readonly ESCAPE_PATTERN: RegExp = /\\e/g;
  private static readonly ESCAPE: string = "\u001b";
  private static readonly NEW_LINE: string = "\r\n";
  private static readonly LINE_END_PATTERN: RegExp = /[\r\n]/;
  private static readonly FLOOD_LINE: string = "0123456789".repeat(10);

  public static run(): void {
    let pending = "";
    process.stdout.write(`ready${TerminalShellFixture.NEW_LINE}`);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      pending += chunk;
      let end = pending.search(TerminalShellFixture.LINE_END_PATTERN);
      while (end >= 0) {
        const command = pending.slice(0, end).trim();
        pending = pending.slice(end + 1);
        if (command.length > 0)
          TerminalShellFixture.execute(command);
        end = pending.search(TerminalShellFixture.LINE_END_PATTERN);
      }
    });
  }

  private static execute(command: string): void {
    const [name, ...args] = command.split(" ");
    const argument = args.join(" ");
    switch (name) {
      case "lines":
        for (let index = 1; index <= Number(argument); index++)
          process.stdout.write(`line ${index}${TerminalShellFixture.NEW_LINE}`);
        break;
      case "print":
        process.stdout.write(argument.replace(TerminalShellFixture.ESCAPE_PATTERN, TerminalShellFixture.ESCAPE));
        break;
      case "env":
        process.stdout.write(`env ${argument}=${process.env[argument] ?? "<unset>"}${TerminalShellFixture.NEW_LINE}`);
        break;
      case "cwd":
        process.stdout.write(`cwd ${process.cwd()}${TerminalShellFixture.NEW_LINE}`);
        break;
      case "flood":
        for (let index = 0; index < Number(argument); index++)
          process.stdout.write(`${TerminalShellFixture.FLOOD_LINE}${TerminalShellFixture.NEW_LINE}`);
        process.stdout.write(`flooded${TerminalShellFixture.NEW_LINE}`);
        break;
      case "ignore-hangup":
        process.on("SIGHUP", () => undefined);
        process.stdout.write(`ignoring${TerminalShellFixture.NEW_LINE}`);
        break;
      case "exit":
        process.exit(Number(argument));
    }
  }
}

TerminalShellFixture.run();
