/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetailKind, Message, MessageAttachment, MessageAuthor, MessageDetail, MessageStatus, ObservedSettings, Provenance, RequestedSettings } from "@noldova/teamrun-protocol";

@TestClass
export class MessageAttachmentTests {
  @TestMethod
  public preservesMetadataAcrossMessageUpdatesAndStorage(): void {
    const image = new MessageAttachment("picture.png", "image/png", 10, "/picture.png");
    Assert.isTrue(image.isImage);
    Assert.isFalse(new MessageAttachment("data.csv", "text/csv", 0, "/data.csv").isImage);
    const provenance = new Provenance(null, new RequestedSettings("codex", null, null), new ObservedSettings(null, null, null, null, null), null, false);
    const detail = new MessageDetail(0, DetailKind.Text, "text", null, "now");
    const message = new Message("message", "conversation", 0, MessageAuthor.Provider, null, MessageStatus.Completed, [], provenance, "now", "now", "now", [image]);
    for (const updated of [message, message.withStatus(MessageStatus.Completed, "later"), message.withDetails([detail]),
      message.withDetail(detail), message.withProvenance(provenance), Message.fromJson(message.toJson())])
      Assert.areEqual(JSON.stringify(image.toJson()), JSON.stringify(updated.attachments[0]?.toJson()));
    Assert.areEqual(JSON.stringify(image.toJson()), JSON.stringify(MessageAttachment.fromJson(image.toJson()).toJson()));
  }

  @TestMethod
  public rejectsInvalidByteSizes(): void {
    for (const size of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      Assert.throws(() => new MessageAttachment("a", "text/plain", size, "/a"), ArgumentOutOfRangeException);
  }
}
