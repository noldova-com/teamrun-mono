/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { openAsBlob } from "node:fs";
import { setTimeout } from "node:timers/promises";

import PackageException from "../packaging/package.exception.ts";
import ReleaseCandidate from "./release-candidate.ts";
import type ReleaseFile from "./release-file.ts";
import ReleaseResponse from "./release-response.ts";
import ReleaseVersion from "./release-version.ts";

export default class ReleasePublisher {
  private static readonly API: string = `https://api.github.com/repos/${ReleaseCandidate.REPOSITORY}`;
  private static readonly UPLOADS: string = `https://uploads.github.com/repos/${ReleaseCandidate.REPOSITORY}`;
  private static readonly API_VERSION: string = "2026-03-10";
  private static readonly REQUEST_TIMEOUT: number = 120_000;
  private static readonly ATTEMPTS: number = 3;
  private static readonly RETRY_DELAY: number = 2_000;
  private static readonly TRANSIENT_STATUSES: readonly number[] = [500, 502, 503, 504];
  private static readonly ERROR_MESSAGE_LIMIT: number = 500;
  private static readonly PAGE_SIZE: number = 100;
  private static readonly MAX_PAGES: number = 10;
  private static readonly TOKEN_REQUIRED: string = "A GitHub publication token is required.";
  private static readonly DRAFT_FAILED: string = "Draft creation did not complete; no release was published.";
  private static readonly PUBLICATION_FAILED: string = "Publication did not complete. Inspect the release before retrying.";
  private static readonly PUBLISHED_IMMUTABLE: string = "A published release is immutable; assets will not be changed.";
  private static readonly ASSET_MISMATCH: string = "The remote release contains an unexpected or changed asset.";
  private static readonly INCOMPLETE_RELEASE: string = "The remote release is incomplete.";
  private static readonly REVISION_MISMATCH: string = "The remote tag changed from the validated revision.";
  private static readonly INVALID_RELEASE_LIST: string = "Invalid release list.";
  private static readonly INVALID_RELEASE_ENTRY: string = "Invalid release list entry.";
  private static readonly VERSION_NOT_NEWER: string = "The candidate must be newer than published versions.";
  private static readonly HISTORY_LIMIT: string = "Release history exceeds the publication verification limit.";
  private static readonly DUPLICATE_RELEASE: string = "Multiple releases use this tag. Resolve the duplicate drafts before retrying publication.";

  private readonly token: string;
  private readonly candidate: ReleaseCandidate;
  private readonly request: typeof fetch;

  public constructor(candidate: ReleaseCandidate, token: string, request: typeof fetch = fetch) {
    if (!token.trim())
      throw new PackageException(ReleasePublisher.TOKEN_REQUIRED);

    this.candidate = candidate;
    this.token = token;
    this.request = request;
  }

  public async publish(files: readonly ReleaseFile[], notes: string): Promise<void> {
    await this.assertRevision();
    let release = await this.findRelease();
    if (release === null) {
      await this.assertNewer();
      for (let attempt = 0; attempt < ReleasePublisher.ATTEMPTS && release === null; attempt++) {
        const response = await this.send(`${ReleasePublisher.API}/releases`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag_name: this.candidate.tag, name: `TeamRun ${this.candidate.version.value}`, body: notes,
          draft: true, prerelease: false, make_latest: "false" }) }, true);
        release = response === null ? await this.findRelease() : this.parse(await response.json());
        if (release === null)
          await this.delay(attempt);
      }
      if (release === null)
        throw new PackageException(ReleasePublisher.DRAFT_FAILED);
    }
    this.assertAssets(release, files, false);
    if (!release.isDraft) {
      this.assertAssets(release, files, true);
      return;
    }
    for (const file of files)
      await this.upload(release.id, file);
    await this.assertNewer();
    for (let attempt = 0; attempt < ReleasePublisher.ATTEMPTS; attempt++) {
      await this.assertRevision();
      const current = await this.getRelease(release.id);
      this.assertAssets(current, files, true);
      if (!current.isDraft)
        return;
      await this.mutate(`${ReleasePublisher.API}/releases/${release.id}`, "PATCH", JSON.stringify({ draft: false, make_latest: "true" }));
      const published = await this.getRelease(release.id);
      this.assertAssets(published, files, true);
      if (!published.isDraft)
        return;
      await this.delay(attempt);
    }
    throw new PackageException(ReleasePublisher.PUBLICATION_FAILED);
  }

  private async upload(releaseId: number, file: ReleaseFile): Promise<void> {
    for (let attempt = 0; attempt < ReleasePublisher.ATTEMPTS; attempt++) {
      const release = await this.getRelease(releaseId);
      const existing = release.assets.find(t => "name" in t && t.name === file.name);
      if (existing && this.matches(existing, file))
        return;
      if (!release.isDraft)
        throw new PackageException(ReleasePublisher.PUBLISHED_IMMUTABLE);
      if (existing) {
        if (!("state" in existing) || existing.state !== "starter" || !("size" in existing) || existing.size !== 0)
          throw new PackageException(`An existing asset differs from the verified build: ${file.name}`);
        if ("id" in existing)
          await this.mutate(`${ReleasePublisher.API}/releases/assets/${existing.id}`, "DELETE");
        if ((await this.getRelease(releaseId)).assets.some(t => "name" in t && t.name === file.name)) {
          await this.delay(attempt);
          continue;
        }
      }
      await this.mutate(`${ReleasePublisher.UPLOADS}/releases/${releaseId}/assets?name=${encodeURIComponent(file.name)}`, "POST",
        await openAsBlob(file.path), "application/octet-stream");
      const uploaded = (await this.getRelease(releaseId)).assets.find(t => "name" in t && t.name === file.name);
      if (uploaded && this.matches(uploaded, file))
        return;
      await this.delay(attempt);
    }
    throw new PackageException(`Asset upload did not complete; the release remains a draft: ${file.name}`);
  }

  private assertAssets(release: ReleaseResponse, files: readonly ReleaseFile[], complete: boolean): void {
    for (const asset of release.assets) {
      const file = files.find(t => "name" in asset && t.name === asset.name);
      if (!file || !this.matches(asset, file) && (complete || !("state" in asset) || asset.state !== "starter" || !("size" in asset) || asset.size !== 0))
        throw new PackageException(ReleasePublisher.ASSET_MISMATCH);
    }
    if (complete && release.assets.length !== files.length)
      throw new PackageException(ReleasePublisher.INCOMPLETE_RELEASE);
  }

  private matches(asset: object, file: ReleaseFile): boolean {
    return "state" in asset && asset.state === "uploaded" && "size" in asset && asset.size === file.size
      && "digest" in asset && asset.digest === `sha256:${file.sha256}`;
  }

  private async assertRevision(): Promise<void> {
    const response = await this.send(`${ReleasePublisher.API}/commits/${this.candidate.tag}`);
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null || !("sha" in value) || value.sha !== this.candidate.revision)
      throw new PackageException(ReleasePublisher.REVISION_MISMATCH);
  }

  private async assertNewer(): Promise<void> {
    for (let page = 1; page <= ReleasePublisher.MAX_PAGES; page++) {
      const response = await this.send(`${ReleasePublisher.API}/releases?per_page=${ReleasePublisher.PAGE_SIZE}&page=${page}`);
      const value: unknown = await response.json();
      if (!Array.isArray(value))
        throw new PackageException(ReleasePublisher.INVALID_RELEASE_LIST);
      const entries: readonly unknown[] = value;
      for (const entry of entries) {
        if (typeof entry !== "object" || entry === null || !("draft" in entry) || typeof entry.draft !== "boolean"
          || !("tag_name" in entry) || typeof entry.tag_name !== "string")
          throw new PackageException(ReleasePublisher.INVALID_RELEASE_ENTRY);
        if (!entry.draft && entry.tag_name !== this.candidate.tag
          && this.candidate.version.compare(new ReleaseVersion(entry.tag_name.replace(/^v/, ""))) <= 0)
          throw new PackageException(ReleasePublisher.VERSION_NOT_NEWER);
      }
      if (entries.length < ReleasePublisher.PAGE_SIZE)
        return;
    }
    throw new PackageException(ReleasePublisher.HISTORY_LIMIT);
  }

  private async findRelease(): Promise<ReleaseResponse | null> {
    let match: ReleaseResponse | null = null;
    for (let page = 1; page <= ReleasePublisher.MAX_PAGES; page++) {
      const response = await this.send(`${ReleasePublisher.API}/releases?per_page=${ReleasePublisher.PAGE_SIZE}&page=${page}`);
      const value: unknown = await response.json();
      if (!Array.isArray(value))
        throw new PackageException(ReleasePublisher.INVALID_RELEASE_LIST);
      const entries: readonly unknown[] = value;
      for (const entry of entries) {
        if (typeof entry !== "object" || entry === null || !("tag_name" in entry) || typeof entry.tag_name !== "string")
          throw new PackageException(ReleasePublisher.INVALID_RELEASE_ENTRY);
        if (entry.tag_name !== this.candidate.tag)
          continue;
        if (match !== null)
          throw new PackageException(ReleasePublisher.DUPLICATE_RELEASE);
        match = this.parse(entry);
      }
      if (entries.length < ReleasePublisher.PAGE_SIZE)
        return match;
    }
    throw new PackageException(ReleasePublisher.HISTORY_LIMIT);
  }

  private async getRelease(id: number): Promise<ReleaseResponse> {
    const response = await this.send(`${ReleasePublisher.API}/releases/${id}`);
    return this.parse(await response.json());
  }

  private parse(value: unknown): ReleaseResponse {
    return new ReleaseResponse(value, this.candidate.tag);
  }

  private async mutate(url: string, method: string, body?: string | Blob, contentType: string = "application/json"): Promise<void> {
    const response = await this.send(url, { method, ...(body === undefined ? {} : { body }), headers: { "Content-Type": contentType } }, true);
    if (response !== null)
      await response.arrayBuffer();
  }

  private async send(url: string, options?: RequestInit, allowTransient?: false): Promise<Response>;
  private async send(url: string, options: RequestInit, allowTransient: true): Promise<Response | null>;
  private async send(url: string, options: RequestInit = {}, allowTransient: boolean = false): Promise<Response | null> {
    let response: Response;
    try {
      response = await this.request(url, { ...options, headers: { ...options.headers, Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`, "X-GitHub-Api-Version": ReleasePublisher.API_VERSION },
      signal: AbortSignal.timeout(ReleasePublisher.REQUEST_TIMEOUT), redirect: "error" });
    }
    catch (error) {
      if (!allowTransient || !(error instanceof Error) || !["TypeError", "TimeoutError"].includes(error.name))
        throw error;
      console.error(`Release request interrupted (${error.name}); verifying remote state before retry.`);
      return null;
    }
    if (response.ok)
      return response;
    const message = await this.errorMessage(response);
    if (allowTransient && ReleasePublisher.TRANSIENT_STATUSES.includes(response.status)) {
      console.error(`Release request returned HTTP ${response.status}; verifying remote state before retry.`);
      return null;
    }
    const target = new URL(url);
    throw new PackageException(`Release request failed: HTTP ${response.status} for ${options.method ?? "GET"} ${target.pathname}${target.search}`
      + (message === null ? "." : `: ${message}`));
  }

  private async errorMessage(response: Response): Promise<string | null> {
    let value: unknown;
    try {
      value = JSON.parse(await response.text());
    }
    catch {
      return null;
    }
    if (typeof value !== "object" || value === null || !("message" in value) || typeof value.message !== "string")
      return null;
    const message = value.message.replace(/\s+/g, " ").trim();
    return message ? message.slice(0, ReleasePublisher.ERROR_MESSAGE_LIMIT) : null;
  }

  private async delay(attempt: number): Promise<void> {
    if (attempt + 1 < ReleasePublisher.ATTEMPTS)
      await setTimeout(ReleasePublisher.RETRY_DELAY * (attempt + 1));
  }
}
