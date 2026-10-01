/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { DetailKind, MessageDetail, MessageStatus, MethodName, ReplyPanel, ReplySummary } from "@noldova/teamrun-protocol";

import { SampleData } from "../../../fixtures/sample-data";
import { ReplyHistoryItem } from "../../../../src/app/models/reply-history-item";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ReplyHistoryRowComponent } from "../../../../src/app/components/reply-history-row/reply-history-row.component";

describe("ReplyHistoryRowComponent", () => {
  it("finishes an expansion with current output when the reply changes during its first read", async () => {
    const before = SampleData.withStatus(SampleData.reply, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Command, "Run\nold output", null, SampleData.timestamp)]);
    const after = before.withDetails([new MessageDetail(0, DetailKind.Command, "Run\nnew output", null, SampleData.timestamp)]);
    let release: (value: JsonValue) => void = () => undefined;
    let requests = 0;
    const bridge = SampleData.createBridge().answer(MethodName.MessageDetails, () => {
      requests += 1;
      return requests === 1 ? new Promise<JsonValue>(resolve => release = resolve) : after.toJson();
    });
    TestBed.configureTestingModule({ imports: [ReplyHistoryRowComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const fixture = TestBed.createComponent(ReplyHistoryRowComponent);
    const item = new ReplyHistoryItem(ReplySummary.fromMessage(before));
    fixture.componentRef.setInput("item", item);
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>(".tr-step")?.click();
    fixture.detectChanges();
    fixture.componentRef.setInput("item", new ReplyHistoryItem(ReplySummary.fromMessage(after), item.expansion));
    fixture.detectChanges();
    release(before.toJson());
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector("pre")?.textContent).toBe("new output");
    });
    expect(requests).toBe(2);
    expect(item.expansion.activity().has(0)).toBe(true);
    fixture.destroy();
  });

  it("counts the edited files the Changes panel lists, before the reply's details are read", () => {
    const edit = (sequence: number, path: string): MessageDetail => new MessageDetail(sequence, DetailKind.FileChange, `Edit ${path}`,
      { tool: "edit", changes: [{ path, kind: "update", diff: "-a\n+b" }] }, SampleData.timestamp);
    const reply = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [edit(0, "a.cs"), edit(1, "a.cs"), edit(2, "b.cs")]);
    TestBed.configureTestingModule({ imports: [ReplyHistoryRowComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(ReplyHistoryRowComponent);
    fixture.componentRef.setInput("item", new ReplyHistoryItem(ReplySummary.fromMessage(reply)));
    fixture.componentRef.setInput("panel", ReplyPanel.Activity);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector(".tr-activity-summary")?.textContent).toBe("Edited 2 files");
  });
});
