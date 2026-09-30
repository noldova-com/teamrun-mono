/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class VerifiedRevisions {
  private static readonly API: string = "https://api.github.com/repos";
  private static readonly WORKFLOW_FILE: string = "build-and-test.yml";
  private static readonly BRANCH: string = "main";
  private static readonly PUSH_EVENT: string = "push";
  private static readonly MERGE_GROUP_EVENT: string = "merge_group";
  private static readonly STATUS: string = "success";
  private static readonly API_VERSION: string = "2026-03-10";
  private static readonly PAGE_SIZE: number = 100;
  private static readonly REQUEST_TIMEOUT: number = 30_000;
  private static readonly REPOSITORY_PATTERN: RegExp = /^[\w.-]+\/[\w.-]+$/;
  private static readonly OBJECT_PATTERN: RegExp = /^[0-9a-f]{40}$/;
  private static readonly REPOSITORY_REQUIRED: string = "GITHUB_REPOSITORY must name the repository as owner/name.";
  private static readonly TOKEN_REQUIRED: string = "A GitHub token is required to find the last verified revision.";
  private static readonly INVALID_RUN_LIST: string = "Invalid workflow run list.";
  private static readonly INVALID_RUN_ENTRY: string = "Invalid workflow run list entry.";

  private readonly repository: string;
  private readonly token: string;
  private readonly request: typeof fetch;

  public constructor(repository: string, token: string, request: typeof fetch = fetch) {
    if (!VerifiedRevisions.REPOSITORY_PATTERN.test(repository))
      throw new Error(VerifiedRevisions.REPOSITORY_REQUIRED);
    if (!token.trim())
      throw new Error(VerifiedRevisions.TOKEN_REQUIRED);

    this.repository = repository;
    this.token = token;
    this.request = request;
  }

  /**
   * Lists the revisions whose Build and test runs for pushes to main completed successfully, newest first.
   */
  public async listAsync(): Promise<readonly string[]> {
    const runs = await this.listRunsAsync(VerifiedRevisions.PUSH_EVENT, VerifiedRevisions.BRANCH);
    return runs.map(run => VerifiedRevisions.readObjectName(run, "head_sha"));
  }

  /**
   * Lists the trees of the merge group commits whose Build and test runs completed successfully, newest first, as GitHub reports each
   * run's head commit.
   */
  public async listQueueTreesAsync(): Promise<readonly string[]> {
    const runs = await this.listRunsAsync(VerifiedRevisions.MERGE_GROUP_EVENT, null);
    return runs.map(run => VerifiedRevisions.readObjectName(typeof run === "object" && run !== null ? Reflect.get(run, "head_commit") : undefined, "tree_id"));
  }

  private async listRunsAsync(event: string, branch: string | null): Promise<readonly unknown[]> {
    const url = new URL(`${VerifiedRevisions.API}/${this.repository}/actions/workflows/${VerifiedRevisions.WORKFLOW_FILE}/runs`);
    if (branch !== null)
      url.searchParams.set("branch", branch);
    url.searchParams.set("event", event);
    url.searchParams.set("status", VerifiedRevisions.STATUS);
    url.searchParams.set("per_page", String(VerifiedRevisions.PAGE_SIZE));
    const response = await this.request(url, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.token}`, "X-GitHub-Api-Version": VerifiedRevisions.API_VERSION },
      signal: AbortSignal.timeout(VerifiedRevisions.REQUEST_TIMEOUT)
    });
    if (!response.ok)
      throw new Error(`Listing the successful workflow runs failed with HTTP ${response.status}.`);

    const body: unknown = await response.json();
    const runs: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "workflow_runs") : undefined;
    if (!Array.isArray(runs))
      throw new Error(VerifiedRevisions.INVALID_RUN_LIST);
    return runs;
  }

  private static readObjectName(value: unknown, field: string): string {
    const name: unknown = typeof value === "object" && value !== null ? Reflect.get(value, field) : undefined;
    if (typeof name !== "string" || !VerifiedRevisions.OBJECT_PATTERN.test(name))
      throw new Error(VerifiedRevisions.INVALID_RUN_ENTRY);
    return name;
  }
}
