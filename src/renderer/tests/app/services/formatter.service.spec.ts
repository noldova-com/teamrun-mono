/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { AuthStatus, DetailKind, Message, MessageAuthor, MessageDetail, MessageStatus, ProviderAccount, ProviderAccountIdentity } from "@noldova/teamrun-protocol";

import { SampleData } from "../../fixtures/sample-data";
import { ClockChoice } from "../../../src/app/enums/clock-choice";
import { Resources } from "../../../src/app/resources";
import { PreferencesService } from "../../../src/app/services/preferences.service";
import { Formatter } from "../../../src/app/services/formatter.service";

describe("Formatter", () => {
  const formatter = (): Formatter => TestBed.inject(Formatter);
  const detail = (sequence: number, kind: DetailKind, text: string, payload: Record<string, unknown> | null = null): MessageDetail =>
    new MessageDetail(sequence, kind, text, payload === null ? null : JSON.parse(JSON.stringify(payload)), SampleData.timestamp);
  const reply = (details: readonly MessageDetail[], status: MessageStatus = MessageStatus.Completed): Message =>
    SampleData.withStatus(SampleData.reply, status, details);

  it("names authors and providers", () => {
    const providers = [SampleData.codex, SampleData.claude];

    expect(formatter().authorLabel(SampleData.userMessage, providers)).toBe(Resources.youLabel);
    expect(formatter().authorLabel(SampleData.reply, providers)).toBe("Codex");
    expect(formatter().authorLabel(new Message("m3", "c1", 2, MessageAuthor.TeamRun, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp), providers))
      .toBe(Resources.teamRunLabel);
    expect(formatter().providerName("other", providers)).toBe("other");
    expect(formatter().providerName(null, providers)).toBe(Resources.teamRunLabel);
  });

  it("splits a reply into answer and activity, joining tool results to their steps", () => {
    const message = reply([
      detail(0, DetailKind.Note, "Session tools: Read"),
      detail(1, DetailKind.Note, "Read: D:\\repo\\README.md", { tool: "Read", toolUseId: "t1" }),
      detail(2, DetailKind.Note, "# Demo", { toolUseId: "t1", isError: false }),
      detail(3, DetailKind.Command, "> ls\nfile.txt", { tool: "Bash", toolUseId: "t2" }),
      detail(4, DetailKind.Note, "boom", { toolUseId: "t2", isError: true }),
      detail(5, DetailKind.Note, "unrelated", { toolUseId: "t9" }),
      detail(6, DetailKind.Text, "Done."),
      detail(7, DetailKind.Error, "failed")
    ]);

    const activity = formatter().activity(message);
    const answers = formatter().answers(message);

    expect(answers.map(t => t.sequence)).toEqual([6, 7]);
    expect(activity.map(t => t.detail.sequence)).toEqual([0, 1, 3, 5]);
    expect(activity[1]?.result?.sequence).toBe(2);
    expect(activity[2]?.result?.sequence).toBe(4);
    expect(activity[3]?.result).toBeNull();
    expect(formatter().isErrorResult(activity[2]!.result!)).toBe(true);
    expect(formatter().toolName(activity[1]!.detail)).toBe("Read");
    expect(formatter().toolName(activity[0]!.detail)).toBeNull();
    expect(formatter().detailIcon(activity[1]!.detail)).toBe("description");
    expect(formatter().detailIcon(activity[2]!.detail)).toBe("terminal");
    expect(formatter().detailIcon(detail(9, DetailKind.Reasoning, "hmm"))).toBe("psychology");
    expect(formatter().detailIcon(detail(9, DetailKind.FileChange, "x"))).toBe("edit_document");
    expect(formatter().detailIcon(detail(9, DetailKind.Error, "x"))).toBe("error");
    expect(formatter().detailIcon(detail(9, DetailKind.Text, "x"))).toBe("notes");
    expect(formatter().detailIcon(detail(9, DetailKind.Note, "x", { tool: "Mystery" }))).toBe("build");
    expect(formatter().title(activity[1]!.detail, "D:\\repo")).toBe("Read: .\\README.md");
    expect(formatter().title(activity[2]!.detail, null)).toBe("> ls");
    expect(formatter().body(activity[2]!.detail)).toBe("file.txt");
    expect(formatter().body(activity[1]!.detail)).toBeNull();
  });

  it("splits a reply into segments in order and summarises a run of steps", () => {
    const message = reply([
      detail(0, DetailKind.Note, "Session tools: Read"),
      detail(1, DetailKind.Note, "Read: D:\\repo\\README.md", { tool: "Read", toolUseId: "t1" }),
      detail(2, DetailKind.Note, "# Demo", { toolUseId: "t1", isError: false }),
      detail(3, DetailKind.Text, "Looking."),
      detail(4, DetailKind.Command, "> ls", { tool: "Bash", toolUseId: "t2" }),
      detail(5, DetailKind.FileChange, "Edit: a.ts", { tool: "Edit", toolUseId: "t3", input: { file_path: "a.ts", old_string: "a", new_string: "b" } }),
      detail(6, DetailKind.Note, "Generated image (completed): out.png",
        { itemType: "imageGeneration", savedPath: "out.png", imageData: "AA", mediaType: "image/png" }),
      detail(7, DetailKind.Reasoning, "hmm"),
      detail(8, DetailKind.Note, "Glob: *.ts", { tool: "Glob", toolUseId: "t4" }),
      detail(9, DetailKind.Text, "Done."),
      detail(10, DetailKind.FileChange, "Files changed in the working tree: a.ts", { files: ["/repo/a.ts"], source: "workingTree", changes: [] }),
      detail(11, DetailKind.Note, "Git evidence may omit changes.", { source: "workingTree" })
    ]);

    const segments = formatter().segments(message);

    expect(segments.map(t => `${t.kind}:${t.key}:${t.entries.length}`))
      .toEqual(["Activity:0:2", "Text:3:0", "Activity:4:2", "Image:6:0", "Activity:7:2", "Text:9:0"]);
    expect(formatter().activity(message).map(t => t.detail.sequence)).toEqual([0, 1, 4, 5, 7, 8]);
    expect(formatter().evidenceNotes(message).map(t => t.sequence)).toEqual([11]);
    expect(formatter().activitySummary(segments[0]!.entries)).toBe("Read 1 file, 1 more step");
    expect(formatter().activitySummary(segments[2]!.entries)).toBe("Ran 1 command, edited 1 file");
    expect(formatter().activitySummary(segments[4]!.entries)).toBe("Searched once, thought once");
    expect(formatter().activitySummary([])).toBe("");
    expect(formatter().activitySummary(formatter().activity(reply([detail(0, DetailKind.Note, "a"), detail(1, DetailKind.Note, "b")])))).toBe("2 steps");
    const commands = reply([detail(0, DetailKind.Command, "> a"), detail(1, DetailKind.Command, "> b")]);
    expect(formatter().activitySummary(formatter().activity(commands))).toBe("Ran 2 commands");
    expect(formatter().isGeneratedImage(message.details[6]!)).toBe(true);
    expect(formatter().isGeneratedImage(message.details[0]!)).toBe(false);
    expect(formatter().isWorkingTreeEvidence(message.details[10]!)).toBe(true);
    expect(formatter().isWorkingTreeEvidence(message.details[11]!)).toBe(true);
    expect(formatter().isWorkingTreeEvidence(message.details[5]!)).toBe(false);
  });

  it("counts the distinct files that the replies' changes read as edited, like the Changes panel", () => {
    const edit = (sequence: number, path: string): MessageDetail =>
      detail(sequence, DetailKind.FileChange, `Edit: ${path}`, { tool: "Edit", toolUseId: `t${sequence}`, input: { file_path: path, old_string: "a", new_string: "b" } });
    const activity = formatter().activity(reply([
      edit(0, "a.ts"),
      edit(1, "a.ts"),
      detail(2, DetailKind.FileChange, "Edit", { changes: [{ path: "b.ts", kind: "add", diff: "+b" }] }),
      detail(3, DetailKind.FileChange, "Edit: unreadable", { tool: "edit" }),
      detail(4, DetailKind.Command, "> ls")
    ]));

    expect(formatter().activitySummary(activity)).toBe("Ran 1 command, edited 2 files");
    expect(formatter().activitySummary(activity, 5)).toBe("Ran 1 command, edited 5 files");
    expect(formatter().activitySummary(activity.slice(3))).toBe("Ran 1 command");
  });

  it("labels activity with the duration and the step count", () => {
    const running = reply([], MessageStatus.Running);
    const start = Date.parse(SampleData.timestamp);

    expect(formatter().activityLabel(running, start + 12_000)).toBe(Resources.formatWorkingFor("12s"));
    expect(formatter().activityLabel(SampleData.withStatus(SampleData.reply, MessageStatus.Completed), start)).toBe(Resources.formatWorkedFor("0s"));
    expect(Resources.formatDuration(65_000)).toBe("1m 5s");
    expect(Resources.formatDuration(3_600_000 * 2 + 60_000)).toBe("2h 1m");
    expect(Resources.formatSteps(3)).toBe("3 steps");
  });

  it("labels a reply waiting for its turn without a duration", () => {
    const pending = reply([], MessageStatus.Pending);

    expect(formatter().isWaitingForTurn(pending)).toBe(true);
    expect(formatter().isWaitingForTurn(reply([], MessageStatus.Running))).toBe(false);
    expect(formatter().activityLabel(pending, Date.parse(SampleData.timestamp) + 12_000)).toBe("Waiting for its turn");
  });

  it("measures a reply from its start, not from the message it answers", () => {
    const sent = Date.parse(SampleData.timestamp);
    const at = (offset: number): string => new Date(sent + offset).toISOString();
    const waited = (status: MessageStatus, startedAt: string | null, endedAt: string | null): Message =>
      new Message("m9", "c1", 2, MessageAuthor.Provider, "m1", status, [], SampleData.provenance, SampleData.timestamp, startedAt, endedAt);

    expect(formatter().activityLabel(waited(MessageStatus.Running, at(30_000), null), sent + 40_000)).toBe("Working for 10s");
    expect(formatter().activityLabel(waited(MessageStatus.Completed, at(30_000), at(42_000)), sent + 90_000)).toBe("Worked for 12s");
    expect(formatter().activityLabel(waited(MessageStatus.Cancelled, null, at(30_000)), sent + 90_000)).toBe("Did not start");
  });

  it("renders times through the preferred formats", () => {
    const iso = new Date(2026, 8, 10, 13, 5, 0).toISOString();
    expect(formatter().time(iso)).toBe("13:05");
    expect(formatter().dateTime(iso)).toBe("10 Sept 2026, 13:05");

    TestBed.inject(PreferencesService).setClock(ClockChoice.TwelveHour);
    expect(formatter().time(iso)).toBe("1:05 PM");
    expect(formatter().dateTime(iso)).toBe("Sept 10, 2026, 1:05 PM");
  });

  it("describes models, accounts, and titles", () => {
    expect(formatter().modelLine(SampleData.reply)).toBe("gpt-5 · high");
    expect(formatter().modelLine(SampleData.userMessage)).toBeNull();
    expect(formatter().accountLine(SampleData.account)).toBe(Resources.formatAccountLine("codex", AuthStatus.LoggedIn, null));
    const identified = new ProviderAccount("a3", "claude", "Home", "D:\\h", AuthStatus.LoggedIn, new ProviderAccountIdentity("me@example.com"), null, null, null, SampleData.timestamp);
    expect(formatter().accountLine(identified)).toContain("me@example.com");
    expect(formatter().accountIcon(AuthStatus.LoggedIn)).toBe("verified_user");
    expect(formatter().accountIcon(AuthStatus.Expired)).toBe("person_off");
    expect(formatter().accountIcon(AuthStatus.Error)).toBe("error");
    expect(formatter().accountIcon(AuthStatus.Unknown)).toBe("help");
    expect(formatter().conversationTitle("  Fix the login bug\nand more")).toBe("Fix the login bug");
    expect(formatter().conversationTitle("x".repeat(80))).toHaveLength(Resources.maximumTitleLength);
    expect(formatter().conversationTitle("x".repeat(80)).endsWith(Resources.ellipsis)).toBe(true);
  });
});
