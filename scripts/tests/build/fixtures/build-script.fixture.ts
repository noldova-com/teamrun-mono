/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import Config from "../../../config.ts";
import Script from "../../../script.ts";

export default class BuildScriptFixture extends Script {
  public static readonly calls: (readonly string[])[] = [];
  public static readonly messages: string[] = [];
  public static failAt: string | null = process.env["TEAMRUN_BUILD_FAIL_AT"] ?? null;

  public override async runAsync(): Promise<void> {
    throw new Error("Invoke the build command, not its toolchain fixture.");
  }

  protected override async executeNpmCommandAsync(args: readonly string[], directory: string, silent: boolean = false): Promise<void> {
    const step = args[0];
    await this.recordAsync(step === "ci" && directory !== process.cwd() ? "renderer-ci" : `npm-${step}`, [directory, String(silent), ...args]);
    if (step === "ci") {
      const relativePath = directory === process.cwd() ? "node_modules/typescript/package.json" : Config.ANGULAR_CLI_PATH;
      const target = path.join(directory, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "{}");
    }
    else if (step === "pack") {
      const item = Config.PACKAGES.find(t => t.name === path.basename(directory));
      if (item === undefined)
        throw new Error(`Unknown fixture package: ${directory}`);
      const archive = path.resolve(Config.PACKAGES_FOLDER, item.formatTarballFileName(Config.VERSION));
      await cp(directory, path.join(Config.PACKAGES_FOLDER, "contents", item.name), { recursive: true });
      await writeFile(archive, await readFile(path.join(directory, "package.json")));
    }
    else if (step === "install") {
      for (const archive of args.filter(t => t.endsWith(".tgz"))) {
        const item = Config.PACKAGES.find(t => t.formatTarballFileName(Config.VERSION) === path.basename(archive));
        if (item === undefined)
          throw new Error(`Unknown fixture archive: ${archive}`);
        await cp(path.join(Config.PACKAGES_FOLDER, "contents", item.name), path.join(Config.NODE_MODULES_FOLDER, item.packageName), { recursive: true });
      }
    }
  }

  protected override async executeTypeScriptCompilerAsync(args: readonly string[], directory: string = process.cwd()): Promise<void> {
    if (args[1] === "scripts/tsconfig.json") {
      await this.recordAsync("typecheck", [directory, ...args]);
      return;
    }
    const item = Config.PACKAGES.find(t => path.join(t.directory, "src/tsconfig.json") === args[1]);
    if (item === undefined)
      throw new Error(`Unknown fixture compiler arguments: ${args.join(" ")}`);
    await this.recordAsync(`compile-${item.name}`, [directory, ...args]);
    const output = path.join(Config.BUILD_FOLDER, item.name);
    await this.copyFileAsync(path.join(item.directory, "src/index.ts"), path.join(output, "index.js"));
    const resources = path.join(item.directory, "src/resources.ts");
    if (await this.pathExistsAsync(resources))
      await this.copyFileAsync(resources, path.join(output, "resources.js"));
  }

  protected override async executeProcessAsync(command: string, args: readonly string[], directory: string): Promise<void> {
    await this.recordAsync(args.includes("--test") ? "tests" : "renderer", [command, directory, ...args]);
  }

  protected override writeLog(message: string, _overwrite: boolean = false): void {
    BuildScriptFixture.messages.push(message);
  }

  private async recordAsync(step: string, args: readonly string[]): Promise<void> {
    BuildScriptFixture.calls.push([step, ...args]);
    await writeFile("build-calls.json", JSON.stringify(BuildScriptFixture.calls));
    if (BuildScriptFixture.failAt === step)
      await super.executeProcessAsync(process.execPath, ["-e", 'process.stderr.write("Fixture tool failed\\n"); process.exitCode = 17;'], process.cwd(), true);
  }
}
