/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetailKind, FileChangeReader, Message, MessageAuthor, MessageDetail, MessageStatus } from "@noldova/teamrun-protocol";

@TestClass
export class FileChangeReaderTests {
  @TestMethod
  public mergesCodexChangesAndPreservesLineClassification(): void {
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { changes: [{ path: "a", kind: "update", diff: "--- a\n+++ b\n@@ h\n context\n-old\n+new\n+more\nplain\n" },
        { path: "b", kind: "{move}" }, { path: "c" }, { path: "" }, "junk"] },
      { changes: [{ path: "a", diff: "+again" }] }, null, [], { changes: {} }
    ]));
    Assert.areEqual("a,b,c", edits.map(t => t.path).join(","));
    Assert.areEqual(3, edits[0]?.additions);
    Assert.areEqual(1, edits[0]?.deletions);
    Assert.areEqual("Meta,Meta,Meta,Context,Removed,Added,Added,Context,Added", edits[0]?.lines.map(t => t.kind).join(","));
    Assert.areEqual("context", edits[0]?.lines[3]?.text);
    Assert.isTrue(edits[0]?.hasDiff ?? false);
    Assert.isFalse(edits[1]?.hasDiff ?? true);
    Assert.areEqual("move", edits[1]?.kind);
    Assert.areEqual("update", edits[2]?.kind);
  }

  @TestMethod
  public readsClaudeToolsAndIgnoresUnsupportedPayloads(): void {
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { tool: "Edit", input: { file_path: "a", old_string: "one\ntwo", new_string: "uno" } },
      { tool: "Write", input: { file_path: "b", content: "a\nb\nc" } },
      { tool: "MultiEdit", input: { file_path: "c", edits: [{ old_string: "x", new_string: "y" }, 5, { new_string: "z" }] } },
      { tool: "MultiEdit", input: { file_path: "d" } },
      { tool: "Read", input: { file_path: "a" } }, { tool: "Bash", input: { command: "ls" } },
      { tool: "Edit", input: { file_path: " " } }, { tool: "Edit", input: "text" }, { toolUseId: "x" },
      { tool: "Edit", input: { file_path: "deleted", old_string: "gone" } }
    ]));
    Assert.areEqual("a:update:1:2,b:add:3:0,c:update:2:1,d:update:0:0,deleted:update:0:1", edits.map(t => `${t.path}:${t.kind}:${t.additions}:${t.deletions}`).join(","));
  }

  private static message(payloads: readonly JsonValue[]): Message {
    return new Message("m", "c", 0, MessageAuthor.User, null, MessageStatus.Completed,
      payloads.map((payload, i) => new MessageDetail(i, DetailKind.FileChange, "change", payload, "t")), null, "t", null, "t");
  }
}
