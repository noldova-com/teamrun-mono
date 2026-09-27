/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ReleaseResponse from "../../release/release-response.ts";

class ReleaseResponseTests {
  public static register(): void {
    test("validates numbered release identity and unique asset identities at the API boundary", () => {
      const valid = { id: 42, draft: true, tag_name: "v1.2.3", prerelease: false, assets: [] };
      const parse = (value: unknown): ReleaseResponse => new ReleaseResponse(value, "v1.2.3");
      const release = parse(valid);
      assert.equal(release.id, 42);
      assert.equal(release.isDraft, true);
      assert.deepEqual(release.assets, []);
      for (const target of ["main", "a".repeat(40)])
        assert.equal(parse({ ...valid, target_commitish: target }).id, 42);
      const invalid: unknown[] = [null, 1];
      for (const key of Object.keys(valid)) {
        const value: Record<string, unknown> = { ...valid };
        delete value[key];
        invalid.push(value);
      }
      for (const [key, value] of [["id", "42"], ["id", 1.5], ["id", 0], ["draft", "true"], ["tag_name", "v1.2.4"],
        ["prerelease", true], ["assets", {}], ["assets", Array(101).fill(null)]] as const)
        invalid.push({ ...valid, [key]: value });
      for (const value of invalid)
        assert.throws(() => parse(value), /metadata does not match/);
      for (const asset of [null, 1, {}, { name: 1 }, { name: "file" }, { name: "file", id: "1" }, { name: "file", id: 1.5 }, { name: "file", id: 0 }])
        assert.throws(() => parse({ ...valid, assets: [asset] }), /Invalid or duplicated/);
      const asset = { name: "file", id: 1 };
      assert.deepEqual(parse({ ...valid, assets: [asset] }).assets, [asset]);
      assert.throws(() => parse({ ...valid, assets: [asset, asset] }), /duplicated/);
    });
  }
}

ReleaseResponseTests.register();
