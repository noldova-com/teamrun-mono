/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";

@TestClass
export class CodexModelReaderTests {
  @TestMethod
  public async followsModelPagesWithoutDuplicatingRepeatedModels(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODEL_PAGES: JSON.stringify([
      { data: [{ model: "first", hidden: false }], nextCursor: "1" },
      { data: [{ model: "first", hidden: false }, { model: "second", hidden: false }], nextCursor: null }
    ]) });
    try {
      Assert.areEqual("first,second", (await adapter.listModels(null)).map(t => t.id).join(","));
    }
    finally {
      await adapter.shutdown();
    }
  }
  @TestMethod
  public async preservesDiscoveredCapabilitiesAndUnknownFields(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const older = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: [{ model: "future", hidden: false }], nextCursor: null }) });
    const invalid = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: [{ model: "bad", hidden: false, supportedReasoningEfforts: "high" }] }) });
    const looping = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: [], nextCursor: "repeat" }) });
    try {
      const models = await adapter.listModels(null);
      Assert.areEqual(1, models.length);
      Assert.areEqual("Sol", models[0]?.displayName);
      Assert.areEqual("high,xhigh", models[0]?.effortLevels?.join(","));
      Assert.isTrue(models[0]?.supportsImages ?? false);
      Assert.isTrue(models[0]?.isDefault ?? false);
      const legacy = (await older.listModels(null))[0];
      Assert.areEqual("future", legacy?.displayName);
      Assert.isNull(legacy?.effortLevels);
      Assert.isNull(legacy?.supportsImages);
      await Assert.throwsAsync(() => invalid.listModels(null), JsonException);
      const error = await Assert.throwsAsync(() => looping.listModels(null), Error);
      Assert.isTrue(error.message.includes("pagination limit"));
    }
    finally {
      await Promise.all([adapter.shutdown(), older.shutdown(), invalid.shutdown(), looping.shutdown()]);
    }
  }
}
