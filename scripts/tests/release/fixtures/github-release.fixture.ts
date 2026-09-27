/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import type ReleaseCandidate from "../../../release/release-candidate.ts";

export default class GitHubReleaseFixture {
  public readonly candidate: ReleaseCandidate;
  public readonly calls: string[] = [];
  public readonly assets: Record<string, unknown>[] = [];
  public release: Record<string, unknown> | null = null;
  public history: unknown = [];
  public intercept?: (url: URL, options: RequestInit) => Promise<Response | undefined>;

  public constructor(candidate: ReleaseCandidate) {
    this.candidate = candidate;
  }

  public seed(draft: boolean = true): void {
    this.release = { id: 42, draft, tag_name: this.candidate.tag, target_commitish: "main", prerelease: false, assets: this.assets };
  }

  public async request(input: string | URL | Request, options?: RequestInit): Promise<Response> {
    assert.ok(options);
    const url = new URL(String(input));
    const method = options.method ?? "GET";
    this.calls.push(`${method} ${url.pathname}${url.search}`);
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer fixture-token");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    const intercepted = await this.intercept?.(url, options);
    if (intercepted)
      return intercepted;
    if (url.pathname.includes("/commits/"))
      return Response.json({ sha: this.candidate.revision });
    if (method === "GET" && url.pathname.endsWith("/releases"))
      return Response.json(Array.isArray(this.history) ? [...this.history, ...(this.release === null ? [] : [this.release])] : this.history);
    if (method === "GET" && url.pathname.includes("/releases/tags/") && this.release?.["draft"] === true)
      return new Response(null, { status: 404 });
    if (method === "GET")
      return this.release === null ? new Response(null, { status: 404 }) : Response.json(this.release);
    if (method === "POST" && url.hostname === "uploads.github.com") {
      assert.ok(options.body instanceof Blob);
      const bytes = Buffer.from(await options.body.arrayBuffer());
      this.assets.push({ id: this.assets.length + 100, name: url.searchParams.get("name"), size: bytes.length,
        state: "uploaded", digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}` });
      return Response.json({});
    }
    if (method === "POST") {
      assert.equal(typeof options.body, "string");
      const data: unknown = JSON.parse(String(options.body));
      assert.ok(typeof data === "object" && data !== null);
      assert.ok("draft" in data && data.draft === true);
      assert.ok("prerelease" in data && data.prerelease === false);
      assert.ok("make_latest" in data && data.make_latest === "false");
      assert.ok(!("target_commitish" in data));
      this.seed();
      return Response.json(this.release);
    }
    if (method === "PATCH") {
      assert.ok(this.release);
      const data: unknown = JSON.parse(String(options.body));
      assert.ok(typeof data === "object" && data !== null && "make_latest" in data);
      assert.equal(data.make_latest, "true");
      this.release["draft"] = false;
      return Response.json(this.release);
    }
    assert.equal(method, "DELETE");
    const id = Number(url.pathname.split("/").at(-1));
    const index = this.assets.findIndex(t => t["id"] === id);
    assert.notEqual(index, -1);
    this.assets.splice(index, 1);
    return new Response(null, { status: 204 });
  }
}
