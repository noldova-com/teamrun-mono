/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import VerificationScope from "../../workflows/verification-scope.ts";

class VerificationScopeTests {
  public static register(): void {
    test("summarizes the selected verification with its reason", () => {
      assert.equal(new VerificationScope(true, "Manual runs verify everything.").summary, "Full build and test verification selected. Manual runs verify everything.");
      assert.equal(new VerificationScope(false, "Compared with the merge base.").summary,
        "Only Markdown documentation changed; code builds and tests are not required. Compared with the merge base.");
    });
  }
}

VerificationScopeTests.register();
