/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { mock, test } from "node:test";

import ReleaseFile from "../../release/release-file.ts";
import GitHubReleaseFixture from "./fixtures/github-release.fixture.ts";
import ReleaseFixture from "./fixtures/release.fixture.ts";

const delays: number[] = [];
mock.module("node:timers/promises", { exports: { setTimeout: async (delay: number): Promise<void> => { delays.push(delay); } } });
const { default: ReleasePublisher } = await import("../../release/release-publisher.ts");

class ReleasePublisherTests {
  public static register(): void {
    test("finds drafts through paginated release listings and keeps the ID returned by creation", async t => {
      const fixture = await ReleaseFixture.create();
      t.after(() => fixture.close());
      const filename = path.join(fixture.directory, "installer.exe");
      await writeFile(filename, "fixture bytes");
      const file = await ReleaseFile.read(filename);
      for (const scenario of ["existing", "later-page", "creation-response", "duplicate", "published-history-limit", "published-history-entry", "published-history-object"]) {
        const github = new GitHubReleaseFixture(fixture.candidate);
        if (["existing", "later-page", "duplicate"].includes(scenario))
          github.seed();
        if (scenario === "duplicate")
          github.history = [github.release];
        let listings = 0;
        github.intercept = async (url, options) => {
          if (url.pathname.endsWith("/releases") && options.method === undefined) {
            listings++;
            if (scenario === "creation-response")
              return Response.json([]);
            if (scenario === "later-page")
              return Response.json(url.searchParams.get("page") === "1" ? Array(100).fill({ tag_name: "v0.0.0", draft: true }) : [github.release]);
            if (scenario === "published-history-limit")
              return Response.json(listings === 1 ? [] : Array(100).fill({ tag_name: "v0.0.0", draft: false }));
            if (scenario === "published-history-entry")
              return Response.json(listings === 1 ? [] : [{ tag_name: "v0.0.0" }]);
            if (scenario === "published-history-object")
              return Response.json(listings === 1 ? [] : {});
          }
          return undefined;
        };
        const operation = new ReleasePublisher(fixture.candidate, "fixture-token", github.request.bind(github)).publish([file], "Notes");
        if (scenario === "duplicate")
          await assert.rejects(operation, /Multiple releases/);
        else if (scenario === "published-history-limit")
          await assert.rejects(operation, /verification limit/);
        else if (scenario === "published-history-entry")
          await assert.rejects(operation, /Invalid release list entry/);
        else if (scenario === "published-history-object")
          await assert.rejects(operation, /Invalid release list/);
        else {
          await operation;
          assert.equal(github.release?.["draft"], false);
        }
        assert.equal(github.calls.filter(t => t === "POST /repos/noldova-com/teamrun/releases").length, scenario === "creation-response" ? 1 : 0);
        assert.ok(!github.calls.some(t => t.includes("/releases/tags/")));
      }
    });

    test("publishes numbered releases as latest after verifying digests, and safely repeats a completed publication", async t => {
      for (const version of ["0.0.1", "0.0.2"]) {
        const fixture = await ReleaseFixture.create(version);
        t.after(() => fixture.close());
        const filename = path.join(fixture.directory, "installer.exe");
        await writeFile(filename, "fixture bytes");
        const file = await ReleaseFile.read(filename);
        const github = new GitHubReleaseFixture(fixture.candidate);
        github.history = [{ tag_name: "v0.0.0", draft: false }, { tag_name: "v3.0.0", draft: true }];
        const publisher = new ReleasePublisher(fixture.candidate, "fixture-token", github.request.bind(github));
        await publisher.publish([file], "Release notes");
        assert.equal(github.release?.["draft"], false);
        assert.equal(github.assets[0]?.["digest"], `sha256:${file.sha256}`);
        const writes = github.calls.filter(t => !t.startsWith("GET"));
        await publisher.publish([file], "Release notes");
        assert.deepEqual(github.calls.filter(t => !t.startsWith("GET")), writes);
        assert.throws(() => new ReleasePublisher(fixture.candidate, " "), /token/);
        t.mock.method(globalThis, "fetch", github.request.bind(github));
        await new ReleasePublisher(fixture.candidate, "fixture-token").publish([file], "Release notes");
      }
    });

    test("resumes partial drafts, removes only empty failed uploads and verifies uncertain mutation outcomes", async t => {
      const fixture = await ReleaseFixture.create();
      t.after(() => fixture.close());
      const filename = path.join(fixture.directory, "installer.exe");
      await writeFile(filename, "fixture bytes");
      const file = await ReleaseFile.read(filename);
      for (const scenario of ["partial", "starter", "create-lost", "upload-lost", "publish-lost", "already-published", "delete-lost"]) {
        const github = new GitHubReleaseFixture(fixture.candidate);
        if (["partial", "starter", "delete-lost"].includes(scenario))
          github.seed();
        if (scenario === "partial")
          github.assets.push({ id: 100, name: file.name, state: "uploaded", size: file.size, digest: `sha256:${file.sha256}` });
        if (["starter", "delete-lost"].includes(scenario))
          github.assets.push({ id: 100, name: file.name, state: "starter", size: 0 });
        github.intercept = async (url, options) => {
          if (scenario === "create-lost" && options.method === "POST" && url.hostname === "api.github.com") {
            github.seed();
            return new Response(null, { status: 500 });
          }
          if (scenario === "upload-lost" && url.hostname === "uploads.github.com") {
            github.assets.push({ id: 100, name: file.name, state: "uploaded", size: file.size, digest: `sha256:${file.sha256}` });
            throw new TypeError("Connection reset");
          }
          if (scenario === "publish-lost" && options.method === "PATCH") {
            assert.ok(github.release);
            github.release["draft"] = false;
            return new Response(null, { status: 503 });
          }
          if (scenario === "already-published" && url.pathname.endsWith("/releases") && options.method === undefined && github.assets.length > 0) {
            assert.ok(github.release);
            github.release["draft"] = false;
          }
          if (scenario === "delete-lost" && options.method === "DELETE") {
            github.assets.length = 0;
            return new Response(null, { status: 502 });
          }
          return undefined;
        };
        await new ReleasePublisher(fixture.candidate, "fixture-token", github.request.bind(github)).publish([file], "Notes");
        assert.equal(github.release?.["draft"], false, scenario);
        assert.equal(github.assets.length, 1, scenario);
      }
    });

    test("bounds transient retries and leaves failed publication in a draft", async t => {
      const fixture = await ReleaseFixture.create();
      t.after(() => fixture.close());
      const filename = path.join(fixture.directory, "installer.exe");
      await writeFile(filename, "fixture bytes");
      const file = await ReleaseFile.read(filename);
      for (const scenario of ["create", "upload", "delete", "publish", "timeout", "recover-upload", "recover-create"]) {
        const github = new GitHubReleaseFixture(fixture.candidate);
        if (scenario === "delete") {
          github.seed();
          github.assets.push({ id: 100, name: file.name, state: "starter", size: 0 });
        }
        let failures = 0;
        github.intercept = async (url, options) => {
          const applies = (scenario.includes("create") && options.method === "POST" && url.hostname === "api.github.com")
            || (scenario.includes("upload") || scenario === "timeout") && url.hostname === "uploads.github.com"
            || scenario === "publish" && options.method === "PATCH"
            || scenario === "delete" && options.method === "DELETE";
          if (!applies || scenario.startsWith("recover") && failures > 0)
            return undefined;
          failures++;
          if (scenario === "timeout")
            throw new DOMException("Request timed out", "TimeoutError");
          return new Response(null, { status: 504 });
        };
        delays.length = 0;
        const operation = new ReleasePublisher(fixture.candidate, "fixture-token", github.request.bind(github)).publish([file], "Notes");
        const checked = scenario.startsWith("recover") ? operation : assert.rejects(operation, /did not complete/);
        await checked;
        assert.equal(failures, scenario.startsWith("recover") ? 1 : 3, scenario);
        assert.deepEqual(delays, scenario.startsWith("recover") ? [2000] : [2000, 4000]);
        if (!scenario.startsWith("recover"))
          assert.notEqual(github.release?.["draft"], false);
      }
    });

    test("refuses remote tag drift, changed or incomplete published assets, malformed metadata and non-transient errors", async t => {
      const fixture = await ReleaseFixture.create();
      t.after(() => fixture.close());
      const filename = path.join(fixture.directory, "installer.exe");
      await writeFile(filename, "fixture bytes");
      const file = await ReleaseFile.read(filename);
      for (const scenario of ["tag-null", "tag-number", "tag-missing", "tag-moved", "get-failed", "get-network", "post-denied", "post-error", "post-thrown",
        "unexpected", "changed", "missing-state", "missing-size", "wrong-size", "missing-digest", "starter-size", "published-empty", "published-changed", "mid-upload-published",
        "history-object", "history-null", "history-number", "history-missing", "history-draft", "history-tag", "history-tag-number", "history-newer",
        "history-limit", "final-incomplete", "mid-upload-changed"]) {
        const github = new GitHubReleaseFixture(fixture.candidate);
        const asset: Record<string, unknown> = { id: 100, name: file.name, state: "uploaded", size: file.size, digest: `sha256:${file.sha256}` };
        if (["unexpected", "changed", "missing-state", "missing-size", "wrong-size", "missing-digest", "starter-size", "published-empty", "published-changed"].includes(scenario)) {
          github.seed(!scenario.startsWith("published"));
          if (scenario !== "published-empty")
            github.assets.push(asset);
          if (scenario === "unexpected") asset["name"] = "other.exe";
          if (["changed", "published-changed"].includes(scenario)) asset["digest"] = "sha256:wrong";
          if (scenario === "missing-state") delete asset["state"];
          if (scenario === "missing-size") delete asset["size"];
          if (scenario === "wrong-size") asset["size"] = -1;
          if (scenario === "missing-digest") delete asset["digest"];
          if (scenario === "starter-size") { asset["state"] = "starter"; asset["size"] = 1; }
        }
        if (scenario === "history-object") github.history = {};
        if (scenario === "history-null") github.history = [null];
        if (scenario === "history-number") github.history = [1];
        if (scenario === "history-missing") github.history = [{}];
        if (scenario === "history-draft") github.history = [{ draft: "no", tag_name: "v1.0.0" }];
        if (scenario === "history-tag") github.history = [{ draft: false }, { draft: false, tag_name: 1 }];
        if (scenario === "history-tag-number") github.history = [{ draft: false, tag_name: 1 }];
        if (scenario === "history-newer") github.history = [{ draft: false, tag_name: "v2.0.0" }];
        if (scenario === "history-limit") github.history = Array(100).fill({ draft: false, tag_name: "v1.0.0" });
        let reads = 0;
        github.intercept = async (url, options) => {
          if (url.pathname.includes("/commits/")) {
            if (scenario === "tag-null") return Response.json(null);
            if (scenario === "tag-number") return Response.json(1);
            if (scenario === "tag-missing") return Response.json({});
            if (scenario === "tag-moved") return Response.json({ sha: "wrong" });
            if (scenario === "get-failed") return new Response(null, { status: 403 });
            if (scenario === "get-network") throw new TypeError("network");
          }
          if (options.method === "POST") {
            if (scenario === "post-denied") return new Response(null, { status: 403 });
            if (scenario === "post-error") throw new Error("unexpected");
            if (scenario === "post-thrown") throw "unexpected";
          }
          if (url.pathname.endsWith("/releases/42") && options.method === undefined) {
            reads++;
            if (scenario === "mid-upload-published") { assert.ok(github.release); github.release["draft"] = false; }
            if (scenario === "mid-upload-changed") github.assets.push({ ...asset, digest: "changed" });
            if (scenario === "final-incomplete" && reads >= 3) github.assets.length = 0;
          }
          return undefined;
        };
        await assert.rejects(new ReleasePublisher(fixture.candidate, "fixture-token", github.request.bind(github)).publish([file], "Notes"), scenario);
        assert.ok(!github.calls.some(t => t.startsWith("PATCH")), scenario);
      }
    });

    test("names a refused request and GitHub's bounded reason without exposing the token", async t => {
      const fixture = await ReleaseFixture.create();
      t.after(() => fixture.close());
      const filename = path.join(fixture.directory, "installer.exe");
      await writeFile(filename, "fixture bytes");
      const file = await ReleaseFile.read(filename);
      const releases = "/repos/noldova-com/teamrun/releases";
      const reason = JSON.stringify({ message: "Resource not accessible\n  by integration", documentation_url: "https://docs.github.com" });
      for (const [status, body, detail] of [[403, reason, ": Resource not accessible by integration"],
        [422, JSON.stringify({ message: "x".repeat(600) }), `: ${"x".repeat(500)}`], [403, JSON.stringify({ message: " " }), "."],
        [403, JSON.stringify({ message: 1 }), "."], [403, JSON.stringify({ documentation_url: "https://docs.github.com" }), "."],
        [403, "null", "."], [403, "1", "."], [404, "<html>Not Found</html>", "."], [403, null, "."]] as const) {
        const github = new GitHubReleaseFixture(fixture.candidate);
        github.intercept = async (_url, options) => options.method === "POST" ? new Response(body, { status }) : undefined;
        await assert.rejects(new ReleasePublisher(fixture.candidate, "fixture-token", github.request.bind(github)).publish([file], "Notes"),
          { message: `Release request failed: HTTP ${status} for POST ${releases}${detail}` });
      }
      const github = new GitHubReleaseFixture(fixture.candidate);
      github.intercept = async url => url.pathname.endsWith("/releases") ? new Response(null, { status: 404 }) : undefined;
      await assert.rejects(new ReleasePublisher(fixture.candidate, "fixture-token", github.request.bind(github)).publish([file], "Notes"),
        { message: `Release request failed: HTTP 404 for GET ${releases}?per_page=100&page=1.` });
    });
  }
}

ReleasePublisherTests.register();
