/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import UiReporterFixture from "./fixtures/ui-reporter.fixture.ts";

class GitHubUiReporterTests {
  public static register(): void {
    test("shows outcomes, escapes titles, appends to existing summaries and retains the main PNG", () => {
      using fixture = new UiReporterFixture();
      writeFileSync(fixture.summaryPath, "Existing package and coverage report\n");
      fixture.run(`
        test('passes <tag>|[link](url)', async ({}, info) => {
          const fs = require('node:fs');
          const image = info.outputPath('fixture.png');
          fs.writeFileSync(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64'));
          await info.attach('metadata', { body: 'fixture', contentType: 'text/plain' });
          await info.attach('main-window', { body: 'fixture', contentType: 'text/plain' });
          await info.attach('main-window', { body: Buffer.from('fixture'), contentType: 'image/png' });
          await info.attach('main-window', { path: image, contentType: 'image/png' });
        });
        test('expected failure', () => { test.fail(); throw new Error('expected'); });
        test('declared skip', () => { test.skip(true, 'Unavailable fixture'); });
      `);
      assert.equal(fixture.status, 0, fixture.stdout + fixture.stderr);
      const summary = fixture.summary;
      assert.match(summary, /\| Passed \| 1 \|/);
      assert.match(summary, /\| Expected failure \| 1 \|/);
      assert.match(summary, /\| Skipped \| 1 \|/);
      assert.match(summary, /Unavailable fixture/);
      assert.match(summary, /&lt;tag&gt;&#124;&#91;link&#93;/);
      assert.equal(readFileSync(fixture.summaryPath, "utf8"), "Existing package and coverage report\n" + summary);
      const png = readFileSync(path.join(fixture.directory, "_build/ui-results/main-window.png"));
      assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    });

    test("reports failures and unreached tests without counting them as skipped or passed", () => {
      using fixture = new UiReporterFixture();
      fixture.run("test('fails', () => { throw new Error('<script>bad</script>'); }); test('not reached', () => {});", 0, 1);
      assert.equal(fixture.status, 1);
      assert.match(fixture.summary, /\| Failed \| 1 \|/);
      assert.match(fixture.summary, /\| Not run \| 1 \|/);
      assert.match(fixture.summary, /&lt;script&gt;bad&lt;\/script&gt;/);
      assert.ok(!existsSync(path.join(fixture.directory, "_build/ui-results/main-window.png")));
    });

    test("keeps flaky outcomes distinct from passes", () => {
      using fixture = new UiReporterFixture();
      fixture.run("test('flaky', ({}, info) => { if (info.retry === 0) throw new Error('first attempt'); });", 1);
      assert.equal(fixture.status, 0, fixture.stdout + fixture.stderr);
      assert.match(fixture.summary, /\| Flaky \| 1 \|/);
      assert.match(fixture.summary, /\| Passed \| 0 \|/);
    });

    test("reports discovery failures and supports local runs without a GitHub summary file", () => {
      using fixture = new UiReporterFixture();
      delete fixture.environment["GITHUB_STEP_SUMMARY"];
      fixture.run("throw 'discovery failure';");
      assert.equal(fixture.status, 1);
      assert.match(fixture.summary, /No test results were discovered/);
      assert.match(fixture.summary, /discovery failure/);
      assert.ok(!existsSync(fixture.summaryPath));
    });

    test("fails the run when publishing the summary fails", () => {
      using fixture = new UiReporterFixture();
      mkdirSync(fixture.summaryPath);
      fixture.run("test('passes', () => {});");
      assert.equal(fixture.status, 1);
      assert.match(fixture.stderr, /Desktop UI report could not be written/);
    });

    test("fails reporting when a captured main-window image disappears", () => {
      using fixture = new UiReporterFixture();
      fixture.run(`
        test('missing attachment', async ({}, info) => {
          const fs = require('node:fs');
          const image = info.outputPath('fixture.png');
          fs.writeFileSync(image, 'fixture image');
          await info.attach('main-window', { path: image, contentType: 'image/png' });
          fs.unlinkSync(info.attachments.find(t => t.name === 'main-window').path);
        });
      `);
      assert.equal(fixture.status, 1);
      assert.match(fixture.summary, /\| Status \| failed \|/);
      assert.match(fixture.summary, /ENOENT/);
    });

    test("bounds displayed rows without dropping tests from totals", () => {
      using fixture = new UiReporterFixture();
      fixture.run("for (let index = 0; index < 52; index++) test('case ' + index, () => {});");
      assert.equal(fixture.status, 0, fixture.stdout + fixture.stderr);
      assert.match(fixture.summary, /\| Total \| 52 \|/);
      assert.match(fixture.summary, /Showing 50 of 52 tests/);
    });

    test("bounds global error details and handles a failure before discovery", () => {
      using fixture = new UiReporterFixture();
      fixture.run(`
        test('early failure', async () => {
          const Reporter = (await import(${JSON.stringify(pathToFileURL(path.resolve("scripts/testing/git-hub-ui-reporter.ts")).href)})).default;
          const fs = require('node:fs');
          const original = process.cwd();
          fs.mkdirSync('early');
          process.chdir('early');
          process.env.GITHUB_STEP_SUMMARY = '';
          try {
            const reporter = new Reporter();
            reporter.onError({});
            reporter.onError({ value: 'value-only error' });
            for (let index = 0; index < 10; index++) reporter.onError({ message: '\\u001b[31m' + 'x'.repeat(2100) + '\\n' });
            const result = await reporter.onEnd({ status: 'passed', startTime: new Date(), duration: 10 });
            expect(result.status).toBe('failed');
          } finally { process.chdir(original); }
        });
      `);
      assert.equal(fixture.status, 0, fixture.stdout + fixture.stderr);
      const summary = readFileSync(path.join(fixture.directory, "early/_build/ui-results/summary.md"), "utf8");
      assert.match(summary, /\| Runner errors \| 12 \|/);
      assert.match(summary, /Showing 10 of 12 errors/);
      assert.match(summary, /Error details unavailable/);
      assert.match(summary, /value-only error/);
      assert.match(summary, /&#91;truncated&#93;/);
      assert.ok(!summary.includes("\u001b"));
    });

    test("names the steps still running when a worker crashes or a test times out", () => {
      using fixture = new UiReporterFixture();
      fixture.run(`
        test('passes', async () => { await test.step('finished step', async () => {}); });
        test('fails', async () => { await test.step('failing step', async () => { throw new Error('failure'); }); });
        test('crashes', async () => {
          await test.step('open terminal', async () => {});
          await test.step('close terminal', async () => {
            await test.step('click close', async () => { process.kill(process.pid, 'SIGKILL'); });
          });
        });
        test('times out', async () => { await test.step('waits forever', () => new Promise(() => {})); });
      `);
      assert.equal(fixture.status, 1);
      assert.match(fixture.summary, /worker process exited unexpectedly/);
      const steps = fixture.summary.split("Steps still running when failed tests ended")[1] ?? "";
      assert.match(steps, /- fixture\.spec\.cjs › crashes › close terminal › click close \(started \d+\.\d\d s into the test\)/);
      assert.match(steps, /- fixture\.spec\.cjs › times out › waits forever \(started \d+\.\d\d s into the test\)/);
      assert.doesNotMatch(steps, /open terminal|failing step|finished step|passes/);
    });

    test("bounds the unfinished steps it lists", () => {
      using fixture = new UiReporterFixture();
      fixture.run("test('waits in parallel', () => Promise.all(Array.from({ length: 11 }, (_, index) => test.step('wait ' + index, () => new Promise(() => {})))));");
      assert.equal(fixture.status, 1);
      assert.equal(fixture.summary.match(/^- fixture\.spec\.cjs › waits in parallel › wait \d+ /gm)?.length, 10);
      assert.match(fixture.summary, /Showing 10 of 11 unfinished steps/);
    });
  }
}

GitHubUiReporterTests.register();
