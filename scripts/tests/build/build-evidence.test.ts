/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import BuildEvidence from "../../build/build-evidence.ts";
import Config from "../../config.ts";
import BuildProjectFixture from "./fixtures/build-project.fixture.ts";

class BuildEvidenceTests {
  public static register(): void {
    test("identical input files have the same fingerprint across directories and creation order", async t => {
      const first = await BuildProjectFixture.create();
      first.enter(t);
      const item = Config.PACKAGES[0];
      assert.ok(item);
      await first.write(`${item.directory}/src/nested/z.ts`, "export const z = 2;\n");
      await first.write(`${item.directory}/src/nested/a.ts`, "export const a = 1;\n");
      await mkdir(path.join(item.directory, "src/empty"));
      const before = await BuildEvidence.fingerprintInputs(item);
      assert.match(before, /^[a-f0-9]{64}$/);
      assert.equal(await BuildEvidence.fingerprintInputs(item), before);
      const second = await BuildProjectFixture.create();
      t.after(() => second.close());
      await second.write(`${item.directory}/src/nested/a.ts`, "export const a = 1;\n");
      await second.write(`${item.directory}/src/nested/z.ts`, "export const z = 2;\n");
      await mkdir(path.join(second.directory, item.directory, "src/empty"));
      process.chdir(second.directory);
      assert.equal(await BuildEvidence.fingerprintInputs(item), before);
    });

    for (const file of [...BuildProjectFixture.ROOT_INPUTS, "src/foundation/core/package.json", "src/foundation/core/src/index.ts"])
      test(`changing ${file} changes the input fingerprint`, async t => {
        const fixture = await BuildProjectFixture.create();
        fixture.enter(t);
        const item = Config.PACKAGES[0];
        assert.ok(item);
        const before = await BuildEvidence.fingerprintInputs(item);
        await fixture.write(file, await fixture.read(file) + "\n");
        assert.notEqual(await BuildEvidence.fingerprintInputs(item), before);
      });

    test("source paths, nested contents and additions participate in the fingerprint", async t => {
      const fixture = await BuildProjectFixture.create();
      fixture.enter(t);
      const item = Config.PACKAGES[0];
      assert.ok(item);
      const original = await BuildEvidence.fingerprintInputs(item);
      await rename(`${item.directory}/src/index.ts`, `${item.directory}/src/renamed.ts`);
      const renamed = await BuildEvidence.fingerprintInputs(item);
      assert.notEqual(renamed, original);
      await fixture.write(`${item.directory}/src/nested/value.ts`, "first");
      const added = await BuildEvidence.fingerprintInputs(item);
      assert.notEqual(added, renamed);
      await fixture.write(`${item.directory}/src/nested/value.ts`, "second");
      assert.notEqual(await BuildEvidence.fingerprintInputs(item), added);
      await rm(`${item.directory}/src/nested`, { recursive: true });
      assert.equal(await BuildEvidence.fingerprintInputs(item), renamed);
    });

    test("predecessor archives affect consumers but a package's own and later archives do not affect its input identity", async t => {
      const fixture = await BuildProjectFixture.create();
      fixture.enter(t);
      await fixture.seedArtifacts();
      const first = Config.PACKAGES[0];
      const second = Config.PACKAGES[1];
      assert.ok(first && second);
      const firstBefore = await BuildEvidence.fingerprintInputs(first);
      const secondBefore = await BuildEvidence.fingerprintInputs(second);
      await fixture.write(`_packages/${first.formatTarballFileName(Config.VERSION)}`, "changed predecessor");
      assert.equal(await BuildEvidence.fingerprintInputs(first), firstBefore);
      assert.notEqual(await BuildEvidence.fingerprintInputs(second), secondBefore);
      await fixture.write(`_packages/${first.formatTarballFileName(Config.VERSION)}`, `archive:${first.name}\n`);
      await fixture.write(`_packages/${second.formatTarballFileName(Config.VERSION)}`, "changed own archive");
      await fixture.write(`node_modules/${second.packageName}/index.js`, "changed installed artifact");
      assert.equal(await BuildEvidence.fingerprintInputs(first), firstBefore);
      assert.equal(await BuildEvidence.fingerprintInputs(second), secondBefore);
    });

    test("fresh processes include both the root product version and protocol version in the input identity", async t => {
      const fixture = await BuildProjectFixture.create();
      t.after(() => fixture.close());
      const code = `const {default: Evidence} = await import(${JSON.stringify(new URL("../../build/build-evidence.ts", import.meta.url).href)});`
        + `const {default: Config} = await import(${JSON.stringify(new URL("../../config.ts", import.meta.url).href)});`
        + "console.log(await Evidence.fingerprintInputs(Config.PACKAGES[0]));";
      const fingerprints: string[] = [];
      for (const [version, protocolVersion] of [["1.2.3", "0.1"], ["1.2.4", "0.1"], ["1.2.3", "0.2"]]) {
        await fixture.write("package.json", JSON.stringify({ version, teamrun: { protocolVersion } }));
        const child = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: fixture.directory, encoding: "utf8", timeout: 10_000 });
        assert.equal(child.error, undefined);
        assert.equal(child.status, 0, child.stderr);
        assert.match(child.stdout, /^[a-f0-9]{64}\r?\n$/);
        fingerprints.push(child.stdout.trim());
      }
      assert.equal(new Set(fingerprints).size, 3);
    });

    test("evidence records input, archive and installed-tree identities and validates every configured package", async t => {
      const fixture = await BuildProjectFixture.create();
      fixture.enter(t);
      await fixture.seedArtifacts();
      for (const item of Config.PACKAGES) {
        await BuildEvidence.record(item);
        const evidence = await fixture.read(`_build/evidence/${item.name}.sha256`);
        assert.match(evidence, /^(?:[a-f0-9]{64}\n){3}$/);
        assert.equal(evidence.split("\n")[0], await BuildEvidence.fingerprintInputs(item));
        const tarball = await readFile(path.join("_packages", item.formatTarballFileName(Config.VERSION)));
        assert.equal(evidence.split("\n")[1], createHash("sha256").update(tarball).digest("hex"));
      }
      await BuildEvidence.requireCurrent();
      await rm("_build/evidence/runtime.sha256");
      await assert.rejects(BuildEvidence.requireCurrent(), { message:
        'The installed artifact of @noldova/teamrun-runtime is missing or stale. Run "npm run build" before testing or packaging.' });
    });

    for (const file of ["_build/evidence/foundation-core.sha256", "src/foundation/core/src/index.ts", "src/foundation/core/package.json",
      "node_modules/@noldova/teamrun-foundation-core/nested/value.js", `_packages/noldova-teamrun-foundation-core-${Config.VERSION}.tgz`])
      for (const remove of [false, true])
        test(`${remove ? "missing" : "changed"} ${file} invalidates the recorded build`, async t => {
          const fixture = await BuildProjectFixture.create();
          fixture.enter(t);
          await fixture.seedArtifacts();
          for (const item of Config.PACKAGES)
            await BuildEvidence.record(item);
          if (remove)
            await rm(file);
          else
            await writeFile(file, "changed\n");
          await assert.rejects(BuildEvidence.requireCurrent(), { message:
            'The installed artifact of @noldova/teamrun-foundation-core is missing or stale. Run "npm run build" before testing or packaging.' });
        });

    test("missing build inputs prevent recording evidence rather than producing a successful record", async t => {
      const fixture = await BuildProjectFixture.create();
      fixture.enter(t);
      await fixture.seedArtifacts();
      const item = Config.PACKAGES[0];
      assert.ok(item);
      await rm("tsconfig.base.json");
      await assert.rejects(BuildEvidence.fingerprintInputs(item), { code: "ENOENT" });
      await assert.rejects(BuildEvidence.record(item), { code: "ENOENT" });
      await assert.rejects(fixture.read("_build/evidence/foundation-core.sha256"), { code: "ENOENT" });
    });
  }
}

BuildEvidenceTests.register();
