/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import GitExecutable from "../git-executable.ts";

class GitExecutableTests {
  public static register(): void {
    test("finds the first executable git file in an absolute PATH folder", t => {
      const directory = GitExecutableTests.createDirectory(t);
      const [gitFolder, first, second] = ["folder", "first", "second"].map(t => path.join(directory, t));
      mkdirSync(path.join(gitFolder!, "git"), { recursive: true });
      for (const folder of [first!, second!]) {
        mkdirSync(folder);
        writeFileSync(path.join(folder, "git"), "", { mode: 0o755 });
      }
      const searchPath = [path.join(directory, "missing"), gitFolder, first, second].join(path.delimiter);
      assert.equal(GitExecutable.locate("darwin", searchPath), path.join(first!, "git"));
      assert.equal(GitExecutable.locate(), GitExecutable.locate(process.platform, process.env["PATH"] ?? ""));
    });

    test("keeps the name on Windows or without an executable on PATH", t => {
      const directory = GitExecutableTests.createDirectory(t);
      writeFileSync(path.join(directory, "git"), "", { mode: 0o755 });
      assert.equal(GitExecutable.locate("win32", directory), "git");
      assert.equal(GitExecutable.locate("darwin", ""), "git");
      const searchPath = process.env["PATH"];
      delete process.env["PATH"];
      try {
        assert.equal(GitExecutable.locate("darwin"), "git");
      }
      finally {
        process.env["PATH"] = searchPath;
      }
      assert.equal(GitExecutable.locate("darwin", path.join(directory, "missing")), "git");
    });

    test("skips relative folders and git files without execute permission", {
      skip: process.platform === "win32" ? "Windows files have no execute permission, and a relative path to another drive is absolute." : false
    }, t => {
      const directory = GitExecutableTests.createDirectory(t);
      const [plain, executable] = ["plain", "executable"].map(t => path.join(directory, t));
      mkdirSync(plain!);
      mkdirSync(executable!);
      writeFileSync(path.join(plain!, "git"), "", { mode: 0o644 });
      writeFileSync(path.join(executable!, "git"), "", { mode: 0o755 });
      const searchPath = [path.relative(process.cwd(), executable!), plain, executable].join(path.delimiter);
      assert.equal(GitExecutable.locate("linux", searchPath), path.join(executable!, "git"));
    });
  }

  private static createDirectory(t: TestContext): string {
    const directory = mkdtempSync(path.join(os.tmpdir(), "teamrun-git-executable-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    return directory;
  }
}

GitExecutableTests.register();
