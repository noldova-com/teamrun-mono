/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";
import { ApprovalAsk, type ITurnListener, TurnDetail, TurnStart } from "@noldova/teamrun-core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, DetailKind, ObservedSettings } from "@noldova/teamrun-protocol";

import type { IAcpClientListener } from "../../interfaces/i-acp-client-listener.js";
import { Resources } from "../../resources.js";
import type { RoleApplication } from "@noldova/teamrun-protocol";
import { DeltaStream } from "../delta-stream.js";

export class GrokTurn implements IAcpClientListener {
  private readonly listener: ITurnListener;
  private readonly signal: AbortSignal;
  private readonly stream: DeltaStream;
  private readonly tools: Map<string, JsonObject> = new Map();
  private sessionId: string | null = null;
  private active: boolean = false;
  private contentKind: string | null = null;
  private contentId: string | null = null;
  private ordinal: number = 0;

  public constructor(listener: ITurnListener, signal: AbortSignal, streamInterval: number) {
    this.listener = listener;
    this.signal = signal;
    this.stream = new DeltaStream(listener, streamInterval);
  }

  public begin(sessionId: string, resumed: boolean, observed: ObservedSettings, roleApplied: RoleApplication | null = null): void {
    this.sessionId = sessionId;
    this.active = true;
    this.listener.onStarted(new TurnStart(sessionId, resumed, roleApplied));
    this.listener.onObserved(observed);
  }

  public finish(): void {
    this.flushContent();
    this.active = false;
    this.tools.clear();
  }

  public onNotification(method: string, params: JsonReader): void {
    if (!this.active || method !== Resources.grokSessionUpdate || params.readNullableString(Resources.sessionIdField) !== this.sessionId)
      return;
    const update = params.readObject(Resources.grokUpdateField);
    const kind = update.readNonBlankString(Resources.grokSessionUpdateField);
    if (kind === Resources.grokMessageChunk || kind === Resources.grokThoughtChunk) {
      const content = update.readObject(Resources.contentField);
      if (content.readNonBlankString(Resources.typeField) !== Resources.textInputType)
        return;
      if (this.contentKind !== kind) {
        this.flushContent();
        this.contentKind = kind;
        this.contentId = `${Resources.grokProviderId}-${++this.ordinal}`;
      }
      this.stream.append(this.contentId!, kind === Resources.grokThoughtChunk ? DetailKind.Reasoning : DetailKind.Text, content.readString(Resources.textField));
    }
    else if (kind === Resources.grokToolCall || kind === Resources.grokToolUpdate) {
      this.flushContent();
      this.recordTool(update);
    }
  }

  public async onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue> {
    if (method !== Resources.grokRequestPermission)
      throw new Error(Resources.acpUnsupportedRequest);
    if (!this.active || this.signal.aborted || params.readNonBlankString(Resources.sessionIdField) !== this.sessionId)
      return { outcome: { outcome: Resources.grokCancelled } };
    const tool = params.readObject(Resources.grokToolCallField);
    const title = tool.readOptionalString(Resources.titleField) ?? Resources.grokToolTitle;
    const kind = tool.readOptionalString(Resources.kindField) ?? Resources.grokOtherKind;
    const options = params.readObjectArray(Resources.optionsField).filter(t => {
      const kind = t.readNonBlankString(Resources.kindField);
      return kind === Resources.grokAllowOnce || kind === Resources.grokRejectOnce;
    }).map(t => new ApprovalOption(t.readNonBlankString(Resources.grokOptionIdField), t.readNonBlankString(Resources.nameField),
      t.readNonBlankString(Resources.kindField) === Resources.grokAllowOnce ? ApprovalOutcome.Approved : ApprovalOutcome.Denied));
    if (options.length === 0)
      throw new Error(Resources.acpUnsupportedRequest);
    const choice = await this.listener.onApprovalRequested(new ApprovalAsk(`${this.sessionId}:${id}`,
      kind === Resources.grokExecuteKind ? ApprovalKind.Command : ApprovalKind.Tool, kind, title, params.toJson(), options));
    if (this.signal.aborted || !this.active || !options.some(t => t.id === choice))
      return { outcome: { outcome: Resources.grokCancelled } };
    return { outcome: { outcome: Resources.grokSelected, optionId: choice } };
  }

  public onExit(): void {
    this.finish();
  }

  public onResponse(method: string): void {
    if (method === Resources.grokSessionPrompt)
      this.finish();
  }

  private flushContent(): void {
    this.stream.flush();
    if (!Object.isNull(this.contentId))
      this.stream.forget(this.contentId);
    this.contentKind = null;
    this.contentId = null;
  }

  private static readChange(diff: JsonReader): JsonObject {
    const before = diff.hasField(Resources.grokOldTextField) ? diff.readNullableString(Resources.grokOldTextField) : null;
    const after = diff.readString(Resources.grokNewTextField);
    const lines = [
      ...String.isNullOrEmpty(before) ? [] : before.split(Resources.lineSeparator).map(t => `${Resources.diffRemovedPrefix}${t}`),
      ...after.length === 0 ? [] : after.split(Resources.lineSeparator).map(t => `${Resources.diffAddedPrefix}${t}`)
    ];
    return {
      [Resources.pathField]: diff.readNonBlankString(Resources.pathField),
      [Resources.kindField]: String.isNullOrEmpty(before) ? Resources.addChangeKind : Resources.updateChangeKind,
      [Resources.diffField]: lines.join(Resources.lineSeparator)
    };
  }

  private recordTool(update: JsonReader): void {
    const id = update.readNonBlankString(Resources.grokToolCallIdField);
    const merged = { ...this.tools.get(id), ...update.toJson() };
    this.tools.set(id, merged);
    if (this.tools.size > Resources.acpMaximumPending)
      this.tools.delete(this.tools.keys().next().value!);
    const tool = JsonReader.fromValue(merged);
    const kind = tool.readOptionalString(Resources.kindField) ?? Resources.grokOtherKind;
    const title = (tool.readOptionalString(Resources.titleField) ?? Resources.grokToolTitle).slice(0, Resources.maximumSummaryLength);
    const paths = tool.hasField(Resources.grokLocationsField)
      ? tool.readObjectArray(Resources.grokLocationsField).map(t => t.readNonBlankString(Resources.pathField)) : [];
    const changes = tool.readOptionalString(Resources.statusField) === Resources.grokCompletedStatus && tool.hasField(Resources.contentField)
      ? tool.readObjectArray(Resources.contentField).filter(t => t.readOptionalString(Resources.typeField) === Resources.grokDiffType).map(t => GrokTurn.readChange(t))
      : [];
    const payload = { ...merged, files: paths, tool: kind, ...(changes.length > 0 ? { [Resources.changesField]: changes } : {}) };
    const detailKind = kind === Resources.grokExecuteKind ? DetailKind.Command : kind === Resources.grokEditKind ? DetailKind.FileChange : DetailKind.Note;
    this.listener.onDetail(new TurnDetail(detailKind, title, payload, `${Resources.grokProviderId}-tool-${id}`));
  }
}
