/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import VerifiedRevisions from "../../workflows/verified-revisions.ts";

class VerifiedRevisionsTests {
  private static readonly REVISION: string = "a".repeat(40);

  public static register(): void {
    test("lists the revisions of successful Build and test runs for pushes to main with the token, newest first", async () => {
      const requests: { url: string; headers: HeadersInit | undefined }[] = [];
      const revisions = new VerifiedRevisions("noldova-com/teamrun", "fixture-token", async (url, options) => {
        requests.push({ url: String(url), headers: options?.headers });
        return Response.json({ workflow_runs: [{ head_sha: VerifiedRevisionsTests.REVISION }, { head_sha: "b".repeat(40) }] });
      });

      assert.deepEqual(await revisions.listAsync(), [VerifiedRevisionsTests.REVISION, "b".repeat(40)]);
      const url = new URL(requests[0]!.url);
      assert.equal(url.origin + url.pathname, "https://api.github.com/repos/noldova-com/teamrun/actions/workflows/build-and-test.yml/runs");
      assert.deepEqual(Object.fromEntries(url.searchParams), { branch: "main", event: "push", status: "success", per_page: "100" });
      assert.deepEqual(requests[0]!.headers, { Accept: "application/vnd.github+json", Authorization: "Bearer fixture-token", "X-GitHub-Api-Version": "2026-03-10" });
    });

    test("lists the head commit trees of successful Build and test runs for merge groups, as GitHub reports them", async () => {
      const urls: URL[] = [];
      const revisions = new VerifiedRevisions("noldova-com/teamrun", "fixture-token", async url => {
        urls.push(new URL(String(url)));
        return Response.json({ workflow_runs: [{ head_sha: "c".repeat(40), head_commit: { id: "c".repeat(40), tree_id: VerifiedRevisionsTests.REVISION } }] });
      });

      assert.deepEqual(await revisions.listQueueTreesAsync(), [VerifiedRevisionsTests.REVISION]);
      assert.equal(urls[0]!.pathname, "/repos/noldova-com/teamrun/actions/workflows/build-and-test.yml/runs");
      assert.deepEqual(Object.fromEntries(urls[0]!.searchParams), { event: "merge_group", status: "success", per_page: "100" });
    });

    test("requires a repository and a token and rejects failed requests and malformed run lists", async () => {
      const respond = (body: unknown, status: number = 200): VerifiedRevisions =>
        new VerifiedRevisions("noldova-com/teamrun", "fixture-token", async () => Response.json(body, { status }));

      assert.throws(() => new VerifiedRevisions("teamrun", "fixture-token"), /owner\/name/);
      assert.throws(() => new VerifiedRevisions("noldova-com/teamrun", " "), /GitHub token/);
      await assert.rejects(respond({ message: "Forbidden" }, 403).listAsync(), /HTTP 403/);
      for (const body of [null, {}, { workflow_runs: {} }])
        await assert.rejects(respond(body).listAsync(), /Invalid workflow run list\./, JSON.stringify(body));
      for (const run of [null, {}, { head_sha: "abc" }, { head_sha: 7 }])
        await assert.rejects(respond({ workflow_runs: [run] }).listAsync(), /Invalid workflow run list entry/, JSON.stringify(run));
      for (const run of [null, {}, { head_commit: null }, { head_commit: { tree_id: "abc" } }])
        await assert.rejects(respond({ workflow_runs: [run] }).listQueueTreesAsync(), /Invalid workflow run list entry/, JSON.stringify(run));
    });
  }
}

VerifiedRevisionsTests.register();
