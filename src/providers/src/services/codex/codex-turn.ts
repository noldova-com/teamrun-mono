/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonReader, JsonValue } from "@noldova/teamrun-foundation-json";
import { ApprovalAsk, type ITurnListener, TurnDetail, TurnOutcome, TurnResult } from "@noldova/teamrun-core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, DetailKind, ObservedSettings } from "@noldova/teamrun-protocol";

import { InvalidOperationException } from "../../exceptions/invalid-operation.exception.js";
import { UnsupportedServerRequestException } from "../../exceptions/unsupported-server-request.exception.js";
import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import type { IServerRequestHandler } from "../../interfaces/i-server-request-handler.js";
import { Resources } from "../../resources.js";
import type { DeltaStream } from "../delta-stream.js";
import type { CodexItemReader } from "./codex-item.reader.js";

export class CodexTurn implements INotificationHandler, IServerRequestHandler {
  public readonly threadId: string;
  private readonly listener: ITurnListener;
  private readonly itemReader: CodexItemReader;
  private readonly stream: DeltaStream;
  private readonly completion: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private currentObserved: ObservedSettings;
  private currentTurnId: string | null = null;
  private currentOutcome: TurnOutcome | null = null;
  private currentError: string | null = null;
  private approvalCounter: number = 0;

  public constructor(threadId: string, listener: ITurnListener, observed: ObservedSettings, itemReader: CodexItemReader, stream: DeltaStream) {
    ArgumentException.throwIfNullOrWhitespace(threadId, Resources.threadIdParameterName);

    this.threadId = threadId;
    this.listener = listener;
    this.currentObserved = observed;
    this.itemReader = itemReader;
    this.stream = stream;
  }

  public get turnId(): string | null {
    return this.currentTurnId;
  }

  public get observed(): ObservedSettings {
    return this.currentObserved;
  }

  public get outcome(): TurnOutcome | null {
    return this.currentOutcome;
  }

  public get error(): string | null {
    return this.currentError;
  }

  public get isComplete(): boolean {
    return !Object.isNull(this.currentOutcome);
  }

  public begin(turnId: string): void {
    ArgumentException.throwIfNullOrWhitespace(turnId, Resources.turnIdParameterName);

    this.currentTurnId = turnId;
  }

  public waitForCompletion(): Promise<void> {
    return this.completion.promise;
  }

  public fail(error: string): void {
    this.settle(TurnOutcome.Failed, error);
  }

  public interrupt(): void {
    this.settle(TurnOutcome.Interrupted, null);
  }

  public toResult(aborted: boolean): TurnResult {
    if (Object.isNull(this.currentOutcome))
      throw new InvalidOperationException(Resources.turnNotSettled);

    const outcome = aborted && this.currentOutcome !== TurnOutcome.Completed ? TurnOutcome.Interrupted : this.currentOutcome;
    return new TurnResult(outcome, this.threadId, this.currentObserved, outcome === TurnOutcome.Failed ? this.currentError : null, this.currentTurnId);
  }

  public handleNotification(method: string, params: JsonReader): void {
    if (!this.belongsToThread(params))
      return;

    switch (method) {
      case Resources.itemStartedNotification:
        this.handleStarted(params.readObject(Resources.itemField));
        break;
      case Resources.itemCompletedNotification:
        this.stream.flush();
        this.report(this.itemReader.readCompleted(params.readObject(Resources.itemField)));
        break;
      case Resources.agentMessageDeltaNotification:
        this.stream.append(params.readNonBlankString(Resources.itemIdField), DetailKind.Text, params.readString(Resources.deltaField));
        break;
      case Resources.modelReroutedNotification:
        this.handleReroute(params);
        break;
      case Resources.errorNotification:
        this.handleError(params);
        break;
      case Resources.turnCompletedNotification:
        this.stream.flush();
        this.handleCompleted(params.readObject(Resources.turnField));
        break;
      default:
        break;
    }
  }

  public async handleServerRequest(method: string, params: JsonReader): Promise<JsonValue> {
    switch (method) {
      case Resources.commandApprovalRequest:
        return { decision: await this.listener.onApprovalRequested(this.createCommandAsk(params)) };
      case Resources.fileChangeApprovalRequest:
        return { decision: await this.listener.onApprovalRequested(this.createFileChangeAsk(params)) };
      case Resources.userInputRequest:
        return { answers: {} };
      default:
        throw new UnsupportedServerRequestException(method);
    }
  }

  private belongsToThread(params: JsonReader): boolean {
    return params.hasField(Resources.threadIdField) && params.readValue(Resources.threadIdField) === this.threadId;
  }

  private handleStarted(item: JsonReader): void {
    if (item.readNonBlankString(Resources.typeField) === Resources.reasoningItemType)
      this.listener.onThinking();
    else
      this.report(this.itemReader.readStarted(item));
  }

  private report(detail: TurnDetail | null): void {
    if (!Object.isNull(detail))
      this.listener.onDetail(detail);
  }

  private handleReroute(params: JsonReader): void {
    const fromModel = params.readString(Resources.fromModelField);
    const toModel = params.readString(Resources.toModelField);
    const reason = params.readString(Resources.reasonField);
    const observed = this.currentObserved;
    this.currentObserved = new ObservedSettings(observed.provider, toModel, observed.effort, observed.harnessVersion, observed.identity);
    this.listener.onObserved(this.currentObserved);
    this.listener.onDetail(new TurnDetail(DetailKind.Note, Resources.formatModelRerouted(fromModel, toModel, reason), null, null));
  }

  private handleError(params: JsonReader): void {
    const message = params.readObject(Resources.errorField).readString(Resources.messageField);
    const willRetry = params.readBoolean(Resources.willRetryField);
    const text = `${willRetry ? Resources.retryableErrorPrefix : Resources.errorPrefix}${message}`;
    this.listener.onDetail(new TurnDetail(willRetry ? DetailKind.Note : DetailKind.Error, text, null, null));
  }

  private handleCompleted(turn: JsonReader): void {
    if (!Object.isNull(this.currentTurnId) && turn.readString(Resources.idField) !== this.currentTurnId)
      return;

    const status = turn.readString(Resources.statusField);
    if (status === Resources.completedTurnStatus) {
      this.settle(TurnOutcome.Completed, null);
      return;
    }
    if (status === Resources.interruptedTurnStatus) {
      this.settle(TurnOutcome.Interrupted, null);
      return;
    }

    const error = turn.hasField(Resources.errorField) ? turn.readNullableObject(Resources.errorField) : null;
    this.settle(TurnOutcome.Failed, Object.isNull(error) ? Resources.formatTurnStatus(status) : error.readString(Resources.messageField));
  }

  private settle(outcome: TurnOutcome, error: string | null): void {
    if (this.isComplete)
      return;

    this.currentOutcome = outcome;
    this.currentError = error;
    this.completion.resolve();
  }

  private createCommandAsk(params: JsonReader): ApprovalAsk {
    const command = params.hasField(Resources.commandField) ? params.readNullableString(Resources.commandField) : null;
    const cwd = params.hasField(Resources.cwdField) ? params.readValue(Resources.cwdField) : null;
    const reason = params.hasField(Resources.reasonField) ? params.readNullableString(Resources.reasonField) : null;
    const summary = `${Resources.runCommandPrefix}${command ?? Resources.unknownCommand}`.slice(0, Resources.maximumSummaryLength);

    return new ApprovalAsk(
      this.nextRequestId(params),
      ApprovalKind.Command,
      Resources.commandApprovalRequest,
      summary,
      { command, cwd, reason },
      CodexTurn.decisions());
  }

  private createFileChangeAsk(params: JsonReader): ApprovalAsk {
    const reason = params.hasField(Resources.reasonField) ? params.readNullableString(Resources.reasonField) : null;
    const grantRoot = params.hasField(Resources.grantRootField) ? params.readNullableString(Resources.grantRootField) : null;
    const summary = Resources.formatFileChangeApproval(reason, grantRoot).slice(0, Resources.maximumSummaryLength);

    return new ApprovalAsk(
      this.nextRequestId(params),
      ApprovalKind.FileChange,
      Resources.fileChangeApprovalRequest,
      summary,
      { reason, grantRoot },
      CodexTurn.decisions());
  }

  private nextRequestId(params: JsonReader): string {
    const itemId = params.readString(Resources.itemIdField);
    this.approvalCounter += 1;

    return [this.threadId, itemId, String(this.approvalCounter)].join(Resources.requestIdSeparator);
  }

  private static decisions(): readonly ApprovalOption[] {
    return [
      new ApprovalOption(Resources.acceptDecision, Resources.allowLabel, ApprovalOutcome.Approved),
      new ApprovalOption(Resources.acceptForSessionDecision, Resources.allowForSessionLabel, ApprovalOutcome.Approved),
      new ApprovalOption(Resources.declineDecision, Resources.denyLabel, ApprovalOutcome.Denied)
    ];
  }
}
