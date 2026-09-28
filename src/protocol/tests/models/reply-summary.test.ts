/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetailKind, FileChangeSummary, Message, MessageAuthor, MessageDetail, MessageStatus, ObservedSettings, Provenance,
  ReplyPage, ReplyPanel, ReplySummary, RequestedSettings } from "@noldova/teamrun-protocol";

@TestClass
export class ReplySummaryTests {
  @TestMethod
  public omitsBodiesAndImageDataButKeepsTitlesToolIdentityAndFileCounts(): void {
    const large = "body-content".repeat(10000);
    const message = ReplySummaryTests.message([
      new MessageDetail(0, DetailKind.Text, large, null, "t"),
      new MessageDetail(1, DetailKind.Command, `$ run\n${large}`, { tool: "Bash", toolUseId: "t1", isError: false, output: large }, "t"),
      new MessageDetail(2, DetailKind.Note, "Image", { itemType: "imageGeneration", imageData: large }, "t"),
      new MessageDetail(3, DetailKind.FileChange, "Edited a.ts", { changes: [{ path: "a.ts", kind: "update", diff: "@@ h\n-old\n+new\n+again" }] }, "t"),
      new MessageDetail(4, DetailKind.Reasoning, "x".repeat(1000), [1, 2], "t"),
      new MessageDetail(5, DetailKind.Note, "Note", { tool: 3, source: "s".repeat(700) }, "t"),
      new MessageDetail(6, DetailKind.Note, "Plain", null, "t")
    ]);
    const summary = ReplySummary.fromMessage(message);
    const page = new ReplyPage([summary], true, false);
    const restored = ReplyPage.fromJson(page.toJson());
    const json = JSON.stringify(page.toJson());
    Assert.isFalse(json.includes(large));
    Assert.isFalse(json.includes("imageData"));
    Assert.isFalse(json.includes("@@ h"));
    Assert.areEqual(6, summary.preview.details.length);
    Assert.areEqual("$ run", summary.preview.details[0]?.text);
    Assert.areEqual(512, summary.preview.details[3]?.text.length);
    Assert.areEqual(2, summary.files[0]?.additions);
    Assert.areEqual(1, summary.files[0]?.deletions);
    Assert.isTrue(summary.files[0]?.hasDiff ?? false);
    Assert.areEqual(json, JSON.stringify(restored.toJson()));
    Assert.isTrue(restored.hasEarlier);
    Assert.isFalse(restored.hasLater);
    Assert.isTrue(summary.matches(ReplyPanel.Activity));
    Assert.isTrue(summary.matches(ReplyPanel.Changes));
    Assert.areEqual(large, message.details[0]?.text);
  }

  @TestMethod
  public distinguishesActivityFromAnswersImagesAndWorkingTreeEvidence(): void {
    const details = [new MessageDetail(0, DetailKind.Text, "answer", null, "t"), new MessageDetail(1, DetailKind.Error, "error", null, "t"),
      new MessageDetail(2, DetailKind.Note, "image", { itemType: "imageGeneration" }, "t"),
      new MessageDetail(3, DetailKind.FileChange, "report", { source: "workingTree", changes: [{ path: "x", diff: "+a" }] }, "t"),
      new MessageDetail(4, DetailKind.Note, "incomplete", { source: "workingTree" }, "t")];
    const summary = ReplySummary.fromMessage(ReplySummaryTests.message(details));
    Assert.isFalse(summary.matches(ReplyPanel.Activity));
    Assert.isTrue(summary.matches(ReplyPanel.Changes));
    Assert.isFalse(ReplySummary.fromMessage(ReplySummaryTests.message([])).matches(ReplyPanel.Changes));
    const unprojected = new ReplySummary(ReplySummaryTests.message([...details.slice(0, 1), new MessageDetail(4, DetailKind.Note, "plain", null, "t")]), []);
    Assert.isTrue(unprojected.matches(ReplyPanel.Activity));
    const note = new ReplySummary(ReplySummaryTests.message([new MessageDetail(5, DetailKind.Note, "array", [], "t")]), []);
    Assert.isTrue(note.matches(ReplyPanel.Activity));
  }

  @TestMethod
  public rejectsInvalidWireFieldsAndCounts(): void {
    Assert.throws(() => new FileChangeSummary(" ", "update", 0, 0, false), ArgumentException);
    Assert.throws(() => new FileChangeSummary("a", "update", -1, 0, true), ArgumentOutOfRangeException);
    Assert.throws(() => new FileChangeSummary("a", "update", 0, 1.5, true), ArgumentOutOfRangeException);
    const value = new FileChangeSummary("a", "add", 1, 0, true).toJson();
    Assert.throws(() => FileChangeSummary.fromJson({ ...value, hasDiff: "yes" }), JsonException);
    Assert.throws(() => ReplySummary.fromJson({ preview: {}, files: [] }), JsonException);
    Assert.throws(() => ReplyPage.fromJson({ replies: [], hasEarlier: false }), JsonException);
  }

  private static message(details: readonly MessageDetail[]): Message {
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null, null), null, false);
    return new Message("r1", "c1", 1, MessageAuthor.Provider, null, MessageStatus.Completed, details, provenance, "t", "t2");
  }
}
