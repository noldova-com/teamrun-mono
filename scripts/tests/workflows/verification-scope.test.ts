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
      assert.equal(new VerificationScope(false, "Only Markdown documentation changed.").summary,
        "Code builds and tests are not required. Only Markdown documentation changed.");
    });
  }
}

VerificationScopeTests.register();
