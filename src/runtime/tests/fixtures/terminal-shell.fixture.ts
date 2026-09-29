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
  private static readonly ATTRIBUTES_QUERY: string = "\u001b[c";
  private static readonly ATTRIBUTES_START: string = "[";
  private static readonly ATTRIBUTES_END: string = "c";
  private static asking: boolean = false;
  private static reply: string = "";

  public static run(): void {
    let pending = "";
    process.stdout.write(`ready${TerminalShellFixture.NEW_LINE}`);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      if (TerminalShellFixture.asking) {
        TerminalShellFixture.collectReply(chunk);
        return;
      }
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
        process.stdout.write(Array.from({ length: Number(argument) }, (_t, index) => `line ${index + 1}${TerminalShellFixture.NEW_LINE}`).join(""));
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
      case "attributes":
        TerminalShellFixture.asking = true;
        process.stdin.setRawMode(true);
        process.stdout.write(TerminalShellFixture.ATTRIBUTES_QUERY);
        break;
      case "ignore-hangup":
        process.on("SIGHUP", () => undefined);
        process.stdout.write(`ignoring${TerminalShellFixture.NEW_LINE}`);
        break;
      case "exit":
        process.exit(Number(argument));
    }
  }

  private static collectReply(chunk: string): void {
    TerminalShellFixture.reply += chunk;
    const end = TerminalShellFixture.reply.indexOf(TerminalShellFixture.ATTRIBUTES_END);
    if (end < 0)
      return;

    const answer = TerminalShellFixture.reply.slice(TerminalShellFixture.reply.indexOf(TerminalShellFixture.ATTRIBUTES_START) + 1, end + 1);
    TerminalShellFixture.asking = false;
    TerminalShellFixture.reply = "";
    process.stdin.setRawMode(false);
    process.stdout.write(`attributes ${answer}${TerminalShellFixture.NEW_LINE}`);
  }
}

TerminalShellFixture.run();
