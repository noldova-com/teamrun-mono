/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import configuration from "../../../electron-builder.json" with { type: "json" };
import rootManifest from "../../../package.json" with { type: "json" };
import PackageOptions from "../../packaging/package-options.ts";
import PackageException from "../../packaging/package.exception.ts";
import PackagedManifest from "../../packaging/packaged-manifest.ts";
import PackageInfo from "../../build/package-info.ts";

class PackageOptionsTests {
  public static register(): void {
    test("all six targets select the right builder and isolate their directories", () => {
      const directories = new Set<string>();
      for (const [platform, nodePlatform, builder] of [
        ["windows", "win32", "--win"],
        ["linux", "linux", "--linux"],
        ["mac", "darwin", "--mac"]
      ] as const) {
        for (const architecture of ["x64", "arm64"]) {
          const options = new PackageOptions(["--platform", platform, "--arch", architecture], nodePlatform, "x64");
          const args = options.createBuilderArguments();
          assert.equal(options.architecture, architecture);
          assert.ok(args.includes(builder));
          assert.ok(args.includes("--" + architecture));
          assert.equal(args[args.indexOf("--publish") + 1], "never");
          assert.equal(options.appDirectory, path.resolve("_build/app", platform + "-" + architecture));
          assert.equal(options.outputDirectory, path.resolve("_build/package", platform + "-" + architecture));
          assert.equal(options.appImageLauncherPath, path.resolve("_build/appimage", architecture, "AppRun"));
          assert.equal(args.includes("--config.nsis.include=" + path.resolve("_build/installer-policy", platform + "-" + architecture + ".nsh")), platform === "windows");
          assert.equal(args.includes("--config.linux.artifactName=TeamRun-linux-" + architecture + ".${ext}"), platform === "linux");
          assert.ok(options.createInstallArguments().includes("ci"));
          assert.ok(options.createInstallArguments().includes("--cpu=" + architecture));
          assert.ok(options.createInstallArguments().includes("--os=" + nodePlatform));
          const archiveInstall = options.createInstallArguments(["fixture.tgz"]);
          assert.equal(archiveInstall[0], "install");
          assert.ok(archiveInstall.includes("--no-save"));
          assert.ok(archiveInstall.includes("--cpu=" + architecture));
          assert.ok(archiveInstall.includes("--os=" + nodePlatform));
          assert.equal(archiveInstall.at(-1), "fixture.tgz");
          assert.ok(!archiveInstall.includes("--package-lock=false"));
          directories.add(options.appDirectory);
          directories.add(options.outputDirectory);
        }
      }
      assert.equal(directories.size, 12);
    });

    test("default target follows the host and --dir remains supported", () => {
      const options = new PackageOptions(["--dir"], "darwin", "arm64");
      assert.equal(options.targetName, "mac-arm64");
      assert.ok(options.createBuilderArguments().includes("--dir"));
      assert.ok(options.createBuilderArguments().includes("--config.mac.identity=null"));
      assert.ok(options.createBuilderArguments().includes("--config.mac.notarize=false"));
    });

    test("native defaults and the option terminator preserve the host target", () => {
      const options = new PackageOptions(["--"]);
      assert.equal(options.nodePlatform, process.platform);
      assert.equal(options.architecture, process.arch);
    });

    test("rejects invalid, duplicate, positional, foreign-OS and publication arguments", () => {
      for (const args of [
        ["--platform", "other"], ["--arch", "arm"], ["--arch", "ia32"], ["--arch", "../x64"],
        ["--platform", "linux"], ["--arch"], ["extra"], ["--publish", "always"],
        ["--arch", "x64", "--arch", "arm64"], ["--dir", "--dir"], ["--signed", "--dir"]
      ])
        assert.throws(() => new PackageOptions(args, "win32", "x64"));
      assert.throws(() => new PackageOptions([], "freebsd", "x64"), PackageException);
      assert.throws(() => new PackageOptions([], "win32", "ia32"), PackageException);
    });

    test("unsigned Windows builds preserve resource editing while disabling signing", () => {
      const args = new PackageOptions([], "win32", "x64").createBuilderArguments();
      assert.ok(args.includes("--config.win.signExecutable=false"));
      assert.ok(!args.includes("--config.win.signAndEditExecutable=false"));
    });

    test("signed installers require signing, signed Windows uses the repository's sign hook and signed macOS requires notarization", () => {
      const windows = new PackageOptions(["--signed"], "win32", "x64");
      const azure = { AZURE_TENANT_ID: "fixture", AZURE_CLIENT_ID: "fixture", AZURE_CLIENT_SECRET: "fixture" };
      assert.throws(() => windows.assertSigningEnvironment({}), /AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET/);
      assert.throws(() => windows.assertSigningEnvironment({ ...azure, AZURE_CLIENT_SECRET: " " }), PackageException);
      windows.assertSigningEnvironment(azure);
      new PackageOptions([], "win32", "x64").assertSigningEnvironment({});
      new PackageOptions([], "darwin", "arm64").assertSigningEnvironment({});
      assert.ok(windows.createBuilderArguments().includes("--config.forceCodeSigning=true"));
      assert.ok(windows.createBuilderArguments().includes("--config.win.signExecutable=true"));
      assert.ok(windows.createBuilderArguments().includes(`--config.win.signtoolOptions.publisherName=${rootManifest.teamrun.windowsPublisher}`));
      assert.ok(!windows.createBuilderArguments().some(t => t.includes("azureSignOptions")));
      assert.ok(!new PackageOptions([], "win32", "x64").createBuilderArguments().some(t => t.includes("signtoolOptions")));
      assert.equal(configuration.win.signExecutable, false);
      assert.deepEqual(configuration.win.signtoolOptions, { sign: "./scripts/packaging/windows-sign-hook.ts", signingHashAlgorithms: ["sha256"] });
      const mac = new PackageOptions(["--signed"], "darwin", "arm64");
      assert.ok(mac.createBuilderArguments().includes("--config.mac.notarize=true"));
      assert.ok(!mac.createBuilderArguments().includes("--config.mac.identity=null"));
      assert.throws(() => mac.assertSigningEnvironment({}), PackageException);
      assert.throws(() => mac.assertSigningEnvironment({ APPLE_ID: "fixture" }), PackageException);
      mac.assertSigningEnvironment({ APPLE_ID: "fixture", APPLE_APP_SPECIFIC_PASSWORD: "fixture", APPLE_TEAM_ID: "fixture" });
      mac.assertSigningEnvironment({ APPLE_API_KEY: "fixture", APPLE_API_KEY_ID: "fixture", APPLE_API_ISSUER: "fixture" });
      mac.assertSigningEnvironment({ APPLE_KEYCHAIN: "fixture", APPLE_KEYCHAIN_PROFILE: "fixture" });
      mac.assertSigningEnvironment({ APPLE_KEYCHAIN_PROFILE: "fixture" });
      assert.throws(() => new PackageOptions(["--signed"], "linux", "x64"), PackageException);
    });

    test("final manifest uses installed versions without development metadata or checkout paths", () => {
      const manifest = new PackagedManifest({ "fixture-sdk": "1.2.3" }, [
        new PackageInfo("desktop", "@noldova/teamrun-desktop", "src/desktop")
      ]);
      assert.equal(manifest.dependencies["fixture-sdk"], "1.2.3");
      assert.equal(manifest.dependencies["@noldova/teamrun-desktop"], manifest.version);
      assert.equal(manifest.main, "node_modules/@noldova/teamrun-desktop/main.js");
      assert.ok(!JSON.stringify(manifest).includes("file:"));
      assert.ok(!("devDependencies" in manifest));
      assert.ok(!("scripts" in manifest));
    });

    test("installers carry the product name while the Linux desktop entry keeps the tagline", () => {
      assert.equal(new PackagedManifest({}, []).description, "TeamRun");
      assert.equal(configuration.linux.description, "AI coding agents working as a team.");
    });
    
    test("help is recognized without enabling signing or directory mode", () => {
      const options = new PackageOptions(["--help"], "linux", "x64");
      assert.equal(options.help, true);
      assert.equal(options.signed, false);
      assert.equal(options.directoryOnly, false);
    });
  }
}

PackageOptionsTests.register();
