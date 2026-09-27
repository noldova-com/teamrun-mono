/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageException from "../packaging/package.exception.ts";

export default class ReleaseResponse {
  private static readonly MAX_ASSETS: number = 100;
  private static readonly INVALID_RELEASE: string = "Release metadata does not match the candidate.";
  private static readonly INVALID_ASSET: string = "Invalid or duplicated release asset metadata.";

  public readonly id: number;
  public readonly isDraft: boolean;
  public readonly assets: readonly object[];

  public constructor(value: unknown, tag: string) {
    if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "number" || !Number.isSafeInteger(value.id)
      || value.id <= 0 || !("draft" in value) || typeof value.draft !== "boolean" || !("tag_name" in value) || value.tag_name !== tag
      || !("prerelease" in value) || value.prerelease !== false || !("assets" in value) || !Array.isArray(value.assets)
      || value.assets.length > ReleaseResponse.MAX_ASSETS)
      throw new PackageException(ReleaseResponse.INVALID_RELEASE);
    const assets: unknown[] = value.assets;
    const names = new Set<string>();
    const checked: object[] = [];
    for (const asset of assets) {
      if (typeof asset !== "object" || asset === null || !("name" in asset) || typeof asset.name !== "string" || names.has(asset.name)
        || !("id" in asset) || typeof asset.id !== "number" || !Number.isSafeInteger(asset.id) || asset.id <= 0)
        throw new PackageException(ReleaseResponse.INVALID_ASSET);
      names.add(asset.name);
      checked.push(asset);
    }

    this.id = value.id;
    this.isDraft = value.draft;
    this.assets = checked;
  }
}
