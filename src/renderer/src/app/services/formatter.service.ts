/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import {
  AuthStatus,
  type Teammate,
  DetailKind,
  type Message,
  MessageAuthor,
  type MessageDetail,
  MessageStatus,
  type ProviderAccount,
  type ProviderDescriptor
} from "@noldova/teamrun-protocol";

import { SegmentKind } from "../enums/segment-kind";
import { ActivityEntry } from "../models/activity-entry";
import { ReplySegment } from "../models/reply-segment";
import { Resources } from "../resources";
import { DateFormatter } from "./date-formatter.service";
import { PreferencesService } from "./preferences.service";

@Injectable({ providedIn: "root" })
export class Formatter {
  private readonly dates: DateFormatter = inject(DateFormatter);
  private readonly preferences: PreferencesService = inject(PreferencesService);

  public authorIcon(author: MessageAuthor): string {
    switch (author) {
      case MessageAuthor.User:
        return Formatter.icon("user");
      case MessageAuthor.Provider:
        return Formatter.icon("provider");
      default:
        return Formatter.icon("teamRun");
    }
  }

  public authorLabel(message: Message, providers: readonly ProviderDescriptor[]): string {
    switch (message.author) {
      case MessageAuthor.User:
        return Resources.youLabel;
      case MessageAuthor.Provider:
        return message.teammateName ?? this.providerName(message.provenance?.observed.provider ?? message.provenance?.requested.provider ?? null, providers);
      default:
        return Resources.teamRunLabel;
    }
  }

  public providerName(provider: string | null, providers: readonly ProviderDescriptor[]): string {
    return providers.find(t => t.id === provider)?.displayName ?? provider ?? Resources.teamRunLabel;
  }

  public teammateSummary(teammate: Teammate, accounts: readonly ProviderAccount[], providers: readonly ProviderDescriptor[]): string {
    const account = accounts.find(t => t.id === teammate.providerAccountId);
    return [Object.isUndefined(account) ? Resources.unavailableTeammateLabel : this.providerName(account.provider, providers),
      teammate.model ?? Resources.providerDefaultModel, teammate.effort ?? Resources.providerDefaultEffort].join(Resources.titleSeparator);
  }

  public detailIcon(detail: MessageDetail): string {
    const tool = this.toolName(detail);
    if (!Object.isNull(tool))
      return Resources.toolIcons[tool] ?? Formatter.icon("tool");
    switch (detail.kind) {
      case DetailKind.Reasoning:
        return Formatter.icon("reasoning");
      case DetailKind.Command:
        return Formatter.icon("command");
      case DetailKind.FileChange:
        return Formatter.icon("fileChange");
      case DetailKind.Error:
        return Formatter.icon("error");
      case DetailKind.Note:
        return Formatter.icon("note");
      default:
        return Formatter.icon("text");
    }
  }

  public accountIcon(status: AuthStatus): string {
    switch (status) {
      case AuthStatus.LoggedIn:
        return Formatter.icon("loggedIn");
      case AuthStatus.LoggedOut:
      case AuthStatus.Expired:
        return Formatter.icon("loggedOut");
      case AuthStatus.Error:
        return Formatter.icon("error");
      default:
        return Formatter.icon("unknown");
    }
  }

  public isActive(message: Message): boolean {
    return message.status === MessageStatus.Pending || message.status === MessageStatus.Running || message.status === MessageStatus.AwaitingApproval;
  }

  public isWaitingForTurn(message: Message): boolean {
    return message.status === MessageStatus.Pending;
  }

  public isAnswer(detail: MessageDetail): boolean {
    return detail.kind === DetailKind.Text || detail.kind === DetailKind.Error;
  }

  public answers(message: Message): readonly MessageDetail[] {
    return message.details.filter(t => this.isAnswer(t));
  }

  public isGeneratedImage(detail: MessageDetail): boolean {
    const payload = Formatter.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.itemTypeField] === Resources.imageGenerationItemType;
  }

  public isWorkingTreeEvidence(detail: MessageDetail): boolean {
    const payload = Formatter.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.sourceField] === Resources.workingTreeSource;
  }

  public evidenceNotes(message: Message): readonly MessageDetail[] {
    return message.details.filter(t => t.kind === DetailKind.Note && this.isWorkingTreeEvidence(t));
  }

  public segments(message: Message): readonly ReplySegment[] {
    const segments: ReplySegment[] = [];
    let steps: ActivityEntry[] = [];
    const closeActivity = (): void => {
      if (steps.length > 0)
        segments.push(new ReplySegment(SegmentKind.Activity, null, steps));
      steps = [];
    };
    for (const detail of message.details) {
      if (this.isWorkingTreeEvidence(detail))
        continue;
      if (this.isAnswer(detail) || this.isGeneratedImage(detail)) {
        closeActivity();
        segments.push(new ReplySegment(this.isAnswer(detail) ? SegmentKind.Text : SegmentKind.Image, detail, []));
        continue;
      }
      const previous = steps[steps.length - 1];
      if (!Object.isUndefined(previous) && Object.isNull(previous.result) && this.isResultOf(detail, previous.detail)) {
        steps[steps.length - 1] = new ActivityEntry(previous.detail, detail);
        continue;
      }
      steps.push(new ActivityEntry(detail, null));
    }
    closeActivity();

    return segments;
  }

  public activity(message: Message): readonly ActivityEntry[] {
    return this.segments(message).flatMap(t => t.entries);
  }

  public activitySummary(entries: readonly ActivityEntry[]): string {
    const counts = { commands: 0, edits: 0, reads: 0, searches: 0, thoughts: 0, others: 0 };
    for (const entry of entries)
      counts[this.categoryOf(entry.detail)] += 1;
    const parts: string[] = [];
    if (counts.commands > 0)
      parts.push(Resources.formatCommandCount(counts.commands));
    if (counts.edits > 0)
      parts.push(Resources.formatEditCount(counts.edits));
    if (counts.reads > 0)
      parts.push(Resources.formatReadCount(counts.reads));
    if (counts.searches > 0)
      parts.push(Resources.formatSearchCount(counts.searches));
    if (counts.thoughts > 0)
      parts.push(Resources.formatThoughtCount(counts.thoughts));
    if (counts.others > 0)
      parts.push(Resources.formatOtherStepCount(counts.others, parts.length === 0));

    return Resources.formatActivitySummary(parts);
  }

  private categoryOf(detail: MessageDetail): "commands" | "edits" | "reads" | "searches" | "thoughts" | "others" {
    const tool = this.toolName(detail) ?? String.empty;
    if (detail.kind === DetailKind.Command || Resources.commandTools.includes(tool))
      return "commands";
    if (detail.kind === DetailKind.FileChange)
      return "edits";
    if (Resources.readTools.includes(tool))
      return "reads";
    if (Resources.searchTools.includes(tool))
      return "searches";
    if (detail.kind === DetailKind.Reasoning)
      return "thoughts";

    return "others";
  }

  public toolName(detail: MessageDetail): string | null {
    const payload = Formatter.payloadOf(detail);
    if (Object.isNull(payload))
      return null;
    const tool = payload[Resources.toolField];
    return Object.isString(tool) ? tool : null;
  }

  public isErrorResult(detail: MessageDetail): boolean {
    const payload = Formatter.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.isErrorField] === true;
  }

  public title(detail: MessageDetail, rootPath: string | null = null): string {
    const line = detail.text.split(Resources.lineSeparator)[0] ?? detail.text;
    if (Object.isNull(rootPath) || String.isNullOrWhitespace(rootPath))
      return line;

    return line.split(rootPath).join(Resources.projectRootMarker);
  }

  public body(detail: MessageDetail): string | null {
    const index = detail.text.indexOf(Resources.lineSeparator);
    return index < 0 ? null : detail.text.slice(index + 1);
  }

  public modelLine(message: Message): string | null {
    const provenance = message.provenance;
    if (Object.isNull(provenance))
      return null;

    const observed = provenance.observed;
    const requested = provenance.requested;
    const line = Resources.formatProvenance(null, observed.model ?? requested.model, observed.effort ?? requested.effort);
    return String.isNullOrWhitespace(line) ? null : line;
  }

  public duration(message: Message, now: number): string {
    const started = Date.parse(message.createdAt);
    const ended = Object.isNull(message.endedAt) ? now : Date.parse(message.endedAt);
    return Resources.formatDuration(ended - started);
  }

  public activityLabel(message: Message, now: number): string {
    if (this.isWaitingForTurn(message))
      return Resources.waitingForTurnLabel;
    const duration = this.duration(message, now);
    return this.isActive(message) ? Resources.formatWorkingFor(duration) : Resources.formatWorkedFor(duration);
  }

  public accountLine(account: ProviderAccount): string {
    const identity = account.identity;
    const who = Object.isNull(identity) ? null : identity.email ?? identity.organization ?? identity.plan ?? null;
    return Resources.formatAccountLine(account.provider, account.authStatus, who);
  }

  public time(iso: string): string {
    return this.dates.format(iso, this.preferences.timeFormat());
  }

  public dateTime(iso: string): string {
    return this.dates.format(iso, this.preferences.dateTimeFormat());
  }

  public conversationTitle(text: string): string {
    const line = (text.split(Resources.lineSeparator).find(t => !String.isNullOrWhitespace(t)) ?? text).trim();
    return line.length <= Resources.maximumTitleLength ? line : `${line.slice(0, Resources.maximumTitleLength - 1).trimEnd()}${Resources.ellipsis}`;
  }

  private isResultOf(candidate: MessageDetail, step: MessageDetail): boolean {
    if (!Object.isNull(this.toolName(candidate)))
      return false;
    const candidatePayload = Formatter.payloadOf(candidate);
    const stepPayload = Formatter.payloadOf(step);
    if (Object.isNull(candidatePayload) || Object.isNull(stepPayload))
      return false;
    const id = candidatePayload[Resources.toolUseIdField];
    return Object.isString(id) && stepPayload[Resources.toolUseIdField] === id;
  }

  private static payloadOf(detail: MessageDetail): JsonObject | null {
    return Formatter.isJsonObject(detail.payload) ? detail.payload : null;
  }

  private static isJsonObject(value: JsonValue): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private static icon(name: string): string {
    return Resources.icons[name] ?? Resources.icons["unknown"] ?? name;
  }
}
