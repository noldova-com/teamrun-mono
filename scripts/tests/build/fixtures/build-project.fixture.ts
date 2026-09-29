/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import Config from "../../../config.ts";

export default class BuildProjectFixture {
  public static readonly ROOT_INPUTS: readonly string[] = [
    "tsconfig.base.json", "package-lock.json", "scripts/build.ts", "scripts/build/build-evidence.ts",
    "scripts/config.ts", "scripts/script.ts", "scripts/build/package-info.ts"
  ];
  public static readonly RESOURCES: string = 'export const version = "__VERSION__";\nexport const protocol = "__PROTOCOL_VERSION__";\n';

  public readonly directory: string;

  private constructor(directory: string) {
    this.directory = directory;
  }

  public static async create(): Promise<BuildProjectFixture> {
    const fixture = new BuildProjectFixture(await realpath(await mkdtemp(path.join(tmpdir(), "teamrun-build-test-"))));
    try {
      await fixture.write("package.json", JSON.stringify({ name: "build-fixture", version: Config.VERSION, private: true,
        type: "module", teamrun: { protocolVersion: Config.PROTOCOL_VERSION } }));
      for (const file of BuildProjectFixture.ROOT_INPUTS)
        await fixture.write(file, file.endsWith(".json") ? "{}\n" : `// ${file}\n`);
      await fixture.write("LICENSE", "Fixture license\n");
      for (const name of ["INTER-OFL.txt", "INCONSOLATA-OFL.txt"])
        await fixture.write(`assets/fonts/${name}`, `Fixture ${name}\n`);
      for (const item of Config.PACKAGES) {
        await fixture.write(`${item.directory}/package.json`, JSON.stringify({ name: item.packageName, version: "__VERSION__", type: "module" }));
        await fixture.write(`${item.directory}/src/api/index.d.ts`, "export declare const answer: number;\n");
        await fixture.write(`${item.directory}/src/index.ts`, "export const answer = 42;\n");
        await fixture.write(`${item.directory}/src/tsconfig.json`, JSON.stringify({ compilerOptions: {
          target: "ES2022", module: "NodeNext", rootDir: ".", types: [],
          outDir: path.relative(path.join(item.directory, "src"), path.join("_build/dist", item.name))
        }, include: ["**/*.ts"] }));
        await fixture.write(`${item.directory}/src/resources.ts`, BuildProjectFixture.RESOURCES
          + (item.name === "runtime" ? 'export const build = "__BUILD__";\n' : ""));
      }
      return fixture;
    }
    catch (error) {
      await fixture.close();
      throw error;
    }
  }

  public async write(relativePath: string, content: string): Promise<void> {
    const file = path.join(this.directory, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }

  public read(relativePath: string): Promise<string> {
    return readFile(path.join(this.directory, relativePath), "utf8");
  }

  public enter(t: TestContext): void {
    const originalDirectory = process.cwd();
    t.after(async () => {
      process.chdir(originalDirectory);
      await this.close();
    });
    process.chdir(this.directory);
  }

  public async seedArtifacts(): Promise<void> {
    for (const item of Config.PACKAGES) {
      await this.write(`_packages/${item.formatTarballFileName(Config.VERSION)}`, `archive:${item.name}\n`);
      await this.write(`node_modules/${item.packageName}/index.js`, `export const name = "${item.name}";\n`);
      await this.write(`node_modules/${item.packageName}/nested/value.js`, "export const value = 1;\n");
      await cp(path.join(this.directory, "node_modules", item.packageName), path.join(this.directory, "_packages/contents", item.name), { recursive: true });
    }
  }

  public close(): Promise<void> {
    return rm(this.directory, { recursive: true, force: true });
  }
}
