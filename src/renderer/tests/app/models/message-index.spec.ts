/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Message, MessageAuthor, MessagePage, MessageStatus } from "@noldova/teamrun-protocol";

import { SampleData } from "../../fixtures/sample-data";
import { MessageControlState } from "../../../src/app/models/message-control-state";
import { MessageIndex } from "../../../src/app/models/message-index";

describe("MessageIndex", () => {
  const message = (sequence: number): Message => new Message(`m${sequence}`, "c1", sequence, MessageAuthor.User, null,
    MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);

  it("preserves geometry and controls while reconciling pages and rewind", () => {
    const index = new MessageIndex();
    index.rememberPage(new MessagePage([message(2), message(3)], true, true));
    const entry = index.find("m2");
    if (!entry)
      throw new Error("Missing index entry");
    entry.height = 340;
    entry.controls = new MessageControlState();
    entry.controls.wrappingFor(0).add(1);
    expect(entry.controls.hasChanges).toBe(true);
    index.rememberPage(new MessagePage([message(1), message(2)], true, true));
    expect(index.entries.map(t => t.sequence)).toEqual([1, 2, 3]);
    expect(index.find("m2")).toBe(entry);
    index.rememberMessage(message(4));
    index.rememberMessage(message(4));
    expect(index.entries).toHaveLength(4);
    index.removeFrom(3);
    expect(index.entries.map(t => t.sequence)).toEqual([1, 2]);
    expect(index.find("m2")?.height).toBe(340);
    expect(index.find("m2")?.controls?.wrappingFor(0).has(1)).toBe(true);
    index.rememberPage(new MessagePage([], false, false));
    expect(index.entries).toHaveLength(0);
  });

  it("starts a separate range for a distant search and removes stale records in refreshed ranges", () => {
    const index = new MessageIndex();
    index.rememberPage(new MessagePage([message(10), message(11)], true, true));
    index.rememberPage(new MessagePage([message(100), message(101)], true, true));
    expect(index.entries.map(t => t.sequence)).toEqual([100, 101]);
    index.rememberPage(new MessagePage([message(0), message(1)], false, true));
    expect(index.entries.map(t => t.sequence)).toEqual([0, 1]);
    index.rememberPage(new MessagePage([message(1), message(2), message(3)], true, true));
    index.rememberPage(new MessagePage([message(1), message(3)], false, false));
    expect(index.entries.map(t => t.sequence)).toEqual([1, 3]);
  });
});
