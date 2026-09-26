/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RendererCheckpoint } from "@noldova/teamrun-desktop";
import { UpdateCheckpointResult } from "@noldova/teamrun-protocol";

import { FakeBridgeHost } from "../fixtures/fake-bridge-host.fixture.js";

@TestClass
export class RendererCheckpointTests {
  @TestMethod
  public async requiresAllWindowsAndRejectsDuplicateStaleOrForeignAcknowledgements(): Promise<void> {
    const host = new FakeBridgeHost();
    host.windows.push(2);
    const checkpoint = new RendererCheckpoint(host, 1000);
    const ready = checkpoint.prepare("op");
    Assert.isTrue(ready === checkpoint.prepare("op"));
    Assert.isFalse(await checkpoint.prepare("other"));
    Assert.isFalse(checkpoint.acknowledge(99, new UpdateCheckpointResult("op", true)));
    Assert.isFalse(checkpoint.acknowledge(1, new UpdateCheckpointResult("old", true)));
    Assert.isTrue(checkpoint.acknowledge(1, new UpdateCheckpointResult("op", true)));
    Assert.isFalse(checkpoint.isPrepared);
    Assert.isFalse(checkpoint.acknowledge(1, new UpdateCheckpointResult("op", true)));
    Assert.isTrue(checkpoint.acknowledge(2, new UpdateCheckpointResult("op", true)));
    Assert.isTrue(await ready);
    Assert.isTrue(await checkpoint.prepare("op"));
    checkpoint.resume("other");
    Assert.isTrue(checkpoint.isFrozen);
    checkpoint.dispose();
    Assert.isFalse(checkpoint.isFrozen);
    checkpoint.dispose();
  }

  @TestMethod
  public async resumesAfterAWindowFailsOrNeverAcknowledges(): Promise<void> {
    const host = new FakeBridgeHost();
    const checkpoint = new RendererCheckpoint(host, 20);
    const failed = checkpoint.prepare("failure");
    checkpoint.acknowledge(1, new UpdateCheckpointResult("failure", false));
    Assert.isFalse(await failed);
    Assert.isFalse(await checkpoint.prepare("timeout"));
    Assert.isFalse(checkpoint.isFrozen);
    host.windows.length = 0;
    Assert.isFalse(await checkpoint.prepare("no-window"));
  }

  @TestMethod
  public async closesWhenNoWindowCanAnswerButNotAfterAFailedSave(): Promise<void> {
    const host = new FakeBridgeHost();
    const checkpoint = new RendererCheckpoint(host, 20);
    const refused = checkpoint.prepareToClose("refused");
    Assert.isFalse(await checkpoint.prepareToClose("other"));
    checkpoint.acknowledge(1, new UpdateCheckpointResult("refused", false));
    Assert.isFalse(await refused);
    Assert.isTrue(await checkpoint.prepareToClose("silent"));
    Assert.isFalse(checkpoint.isPrepared);
    Assert.isFalse(checkpoint.isFrozen);
    const saved = checkpoint.prepareToClose("saved");
    checkpoint.acknowledge(1, new UpdateCheckpointResult("saved", true));
    Assert.isTrue(await saved);
    Assert.isTrue(checkpoint.isPrepared);
    checkpoint.resume("saved");
    host.windows.length = 0;
    Assert.isTrue(await checkpoint.prepareToClose("no-window"));
    Assert.isFalse(await checkpoint.prepare("no-window-update"));
  }
}
