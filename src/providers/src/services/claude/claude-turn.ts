/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  PermissionResult,
  SDKAssistantMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKUserMessage,
  SDKUserMessageReplay
} from "@anthropic-ai/claude-agent-sdk";
import type { BetaContentBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import type { ContentBlockParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources";

import "@noldova/teamrun-foundation-core";
import { JsonReader, type JsonValue } from "@noldova/teamrun-foundation-json";
import { ApprovalAsk, type ITurnListener, TurnDetail, TurnOutcome, TurnResult, TurnStart } from "@noldova/teamrun-core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, DetailKind, ObservedSettings, ProviderAccountIdentity } from "@noldova/teamrun-protocol";

import type { IClaudeQuery } from "../../interfaces/i-claude-query.js";
import { Resources } from "../../resources.js";
import type { RoleApplication } from "@noldova/teamrun-protocol";
import type { DeltaStream } from "../delta-stream.js";
import { FailureDescriber } from "../failure-describer.js";

export class ClaudeTurn {
  private readonly listener: ITurnListener;
  private readonly resumeNativeSessionId: string | null;
  private currentSessionId: string | null = null;
  private currentObserved: ObservedSettings = new ObservedSettings(Resources.claudeProviderId, null, null, null, null);
  private currentOutcome: TurnOutcome | null = null;
  private currentError: string | null = null;
  private interrupted: boolean = false;
  private approvalCounter: number = 0;
  private readonly stream: DeltaStream;
  private readonly streamBlockIds: Map<number, string> = new Map();
  private streamOrdinal: number = 0;
  private deliveredBlocks: number = 0;
  private readonly roleApplied: RoleApplication | null;

  public constructor(listener: ITurnListener, resumeNativeSessionId: string | null, stream: DeltaStream, roleApplied: RoleApplication | null = null) {
    this.listener = listener;
    this.resumeNativeSessionId = resumeNativeSessionId;
    this.stream = stream;
    this.roleApplied = roleApplied;
  }

  public get sessionId(): string | null {
    return this.currentSessionId;
  }

  public get observed(): ObservedSettings {
    return this.currentObserved;
  }

  public get outcome(): TurnOutcome | null {
    return this.currentOutcome;
  }

  public get isInterrupted(): boolean {
    return this.interrupted;
  }

  public async consume(query: IClaudeQuery): Promise<void> {
    for await (const message of query)
      await this.handle(message, query);
    if (Object.isNull(this.currentOutcome))
      this.settle(TurnOutcome.Failed, Resources.claudeNoResult);
  }

  public markInterrupted(): void {
    this.interrupted = true;
  }

  public fail(error: string): void {
    this.settle(TurnOutcome.Failed, error);
  }

  public async decide(toolName: string, input: Record<string, unknown>): Promise<PermissionResult> {
    const payload = JsonReader.toJsonValue(input, Resources.toolInputPath);
    this.approvalCounter += 1;
    const requestId = [this.currentSessionId ?? Resources.pendingSessionId, String(this.approvalCounter)].join(Resources.requestIdSeparator);
    const summary = ClaudeTurn.summarize(toolName, payload);
    const ask = new ApprovalAsk(requestId, ClaudeTurn.classify(toolName), toolName, summary, { tool: toolName, input: payload }, ClaudeTurn.decisions());
    const decision = await this.listener.onApprovalRequested(ask);
    if (decision === Resources.claudeAllowDecision)
      return { behavior: Resources.allowBehavior, updatedInput: input };

    return { behavior: Resources.denyBehavior, message: Resources.claudeDenied };
  }

  public toResult(): TurnResult {
    const outcome = this.currentOutcome ?? TurnOutcome.Failed;
    const error = outcome === TurnOutcome.Failed ? this.currentError ?? Resources.claudeNoResult : null;

    return new TurnResult(outcome, this.currentSessionId, this.currentObserved, error);
  }

  private async handle(message: SDKMessage, query: IClaudeQuery): Promise<void> {
    if (message.type === Resources.systemMessageType) {
      if (message.subtype === Resources.initSubtype)
        await this.handleInit(message, query);
      return;
    }
    if (message.type === Resources.streamEventType) {
      this.handleStreamEvent(message);
      return;
    }
    this.stream.flush();
    if (message.type === Resources.assistantMessageType)
      this.handleAssistant(message);
    else if (message.type === Resources.userMessageType)
      this.handleUser(message);
    else if (message.type === Resources.resultMessageType)
      this.handleResult(message);
  }

  private handleStreamEvent(message: SDKPartialAssistantMessage): void {
    if (!Object.isNull(message.parent_tool_use_id))
      return;

    const event = message.event;
    if (event.type === Resources.messageStartEventType) {
      this.streamOrdinal += 1;
      this.streamBlockIds.clear();
      this.deliveredBlocks = 0;
      return;
    }
    if (event.type !== Resources.contentBlockDeltaEventType)
      return;

    const separator = Resources.requestIdSeparator;
    const id = `${message.session_id}${separator}${Resources.streamIdPrefix}${this.streamOrdinal}${separator}${event.index}`;
    if (event.delta.type === Resources.textDeltaType) {
      this.streamBlockIds.set(event.index, id);
      this.stream.append(id, DetailKind.Text, event.delta.text);
    }
    else if (event.delta.type === Resources.thinkingDeltaType) {
      this.streamBlockIds.set(event.index, id);
      this.stream.append(id, DetailKind.Reasoning, event.delta.thinking);
    }
  }

  private async handleInit(message: SDKSystemMessage, query: IClaudeQuery): Promise<void> {
    this.currentSessionId = message.session_id;
    const authMethod = message.apiKeySource === Resources.claudeApiKeySourceNone
      ? Resources.claudeSignedInMethod
      : Resources.formatApiKeySource(message.apiKeySource);
    const identity = new ProviderAccountIdentity(undefined, undefined, undefined, authMethod);
    this.currentObserved = new ObservedSettings(Resources.claudeProviderId, message.model, message.effort ?? null, message.claude_code_version, identity);
    this.listener.onStarted(new TurnStart(message.session_id, message.session_id === this.resumeNativeSessionId, this.roleApplied));
    this.listener.onObserved(this.currentObserved);
    const servers = message.mcp_servers.length === 0
      ? Resources.claudeNoMcpServers
      : message.mcp_servers.map(t => Resources.formatClaudeServer(t.name, t.status)).join(Resources.listSeparator);
    const text = Resources.formatClaudeSession(message.tools.join(Resources.listSeparator), servers, message.permissionMode);
    this.listener.onDetail(new TurnDetail(DetailKind.Note, text, null, `${message.session_id}${Resources.requestIdSeparator}${Resources.initSubtype}`));
    await this.readAccount(query, authMethod);
  }

  private async readAccount(query: IClaudeQuery, authMethod: string): Promise<void> {
    try {
      const info = await query.accountInfo();
      const observed = this.currentObserved;
      const identity = new ProviderAccountIdentity(info.email, info.subscriptionType, info.organization, authMethod);
      this.currentObserved = new ObservedSettings(observed.provider, observed.model, observed.effort, observed.harnessVersion, identity);
      this.listener.onObserved(this.currentObserved);
    }
    catch (error) {
      this.listener.onDetail(new TurnDetail(DetailKind.Note, Resources.formatAccountInfoUnavailable(FailureDescriber.describe(error)), null, null));
    }
  }

  private handleAssistant(message: SDKAssistantMessage): void {
    if (!Object.isNull(message.parent_tool_use_id))
      return;

    message.message.content.forEach((block, index) => {
      const position = this.deliveredBlocks + index;
      const streamed = this.streamBlockIds.get(position);
      this.handleBlock(block, streamed ?? `${message.uuid}${Resources.requestIdSeparator}${index}`);
      if (!Object.isUndefined(streamed)) {
        this.stream.forget(streamed);
        this.streamBlockIds.delete(position);
      }
    });
    this.deliveredBlocks += message.message.content.length;
    if (message.message.model !== this.currentObserved.model) {
      const observed = this.currentObserved;
      this.currentObserved = new ObservedSettings(observed.provider, message.message.model, observed.effort, observed.harnessVersion, observed.identity);
      this.listener.onObserved(this.currentObserved);
    }
  }

  private handleBlock(block: BetaContentBlock, id: string): void {
    if (block.type === Resources.textBlockType) {
      if (!String.isNullOrWhitespace(block.text))
        this.listener.onDetail(new TurnDetail(DetailKind.Text, block.text, null, id));
      return;
    }
    if (block.type === Resources.thinkingBlockType) {
      if (!String.isNullOrWhitespace(block.thinking))
        this.listener.onDetail(new TurnDetail(DetailKind.Reasoning, block.thinking.slice(0, Resources.maximumReasoningLength), null, id));
      return;
    }
    if (block.type === Resources.toolUseBlockType) {
      const input = JsonReader.toJsonValue(block.input, Resources.toolInputPath);
      const kind = ClaudeTurn.classify(block.name) === ApprovalKind.Tool ? DetailKind.Note : ClaudeTurn.toDetailKind(block.name);
      this.listener.onDetail(new TurnDetail(kind, ClaudeTurn.summarize(block.name, input), { tool: block.name, input, toolUseId: block.id }, id));
    }
  }

  private handleUser(message: SDKUserMessage | SDKUserMessageReplay): void {
    if (!Object.isNull(message.parent_tool_use_id))
      return;

    const content = message.message.content;
    if (Object.isString(content))
      return;

    content.forEach((block, index) =>
      this.handleUserBlock(block, Object.isUndefined(message.uuid) ? null : `${message.uuid}${Resources.requestIdSeparator}${index}`));
  }

  private handleUserBlock(block: ContentBlockParam, id: string | null): void {
    if (block.type !== Resources.toolResultBlockType)
      return;

    const text = ClaudeTurn.readToolResult(block).slice(0, Resources.maximumToolResultLength);
    if (String.isNullOrWhitespace(text))
      return;

    this.listener.onDetail(new TurnDetail(DetailKind.Note, text, { toolUseId: block.tool_use_id, isError: block.is_error ?? false }, id));
  }

  private handleResult(message: SDKResultMessage): void {
    this.currentSessionId = message.session_id;
    if (message.subtype === Resources.successSubtype) {
      this.settle(TurnOutcome.Completed, null);
      return;
    }

    this.settle(TurnOutcome.Failed, Resources.formatClaudeFailure(message.subtype, message.errors));
  }

  private settle(outcome: TurnOutcome, error: string | null): void {
    if (!Object.isNull(this.currentOutcome))
      return;
    if (outcome === TurnOutcome.Failed && this.interrupted) {
      this.listener.onDetail(new TurnDetail(DetailKind.Note, String(error), null, null));
      this.currentOutcome = TurnOutcome.Interrupted;
      return;
    }

    this.currentOutcome = outcome;
    this.currentError = error;
  }

  private static readToolResult(block: ToolResultBlockParam): string {
    const content = block.content;
    if (Object.isUndefined(content))
      return String.empty;
    if (Object.isString(content))
      return content;

    return content.map(t => t.type === Resources.textBlockType ? t.text : String.empty).join(Resources.lineSeparator);
  }

  private static classify(toolName: string): ApprovalKind {
    if (Resources.claudeCommandTools.includes(toolName))
      return ApprovalKind.Command;

    return Resources.claudeEditToolPattern.test(toolName) ? ApprovalKind.FileChange : ApprovalKind.Tool;
  }

  private static toDetailKind(toolName: string): DetailKind {
    return ClaudeTurn.classify(toolName) === ApprovalKind.Command ? DetailKind.Command : DetailKind.FileChange;
  }

  private static summarize(toolName: string, input: JsonValue): string {
    if (!Object.isObject(input) || Array.isArray(input))
      return toolName;

    const reader = JsonReader.fromValue(input, Resources.toolInputPath);
    const command = reader.hasField(Resources.claudeInputCommandKey) ? reader.readValue(Resources.claudeInputCommandKey) : null;
    if (Object.isString(command))
      return Resources.formatToolWithCommand(toolName, command.slice(0, Resources.maximumSummaryLength));

    for (const key of Resources.claudeInputPathKeys) {
      const path = reader.hasField(key) ? reader.readValue(key) : null;
      if (Object.isString(path))
        return Resources.formatToolWithCommand(toolName, path);
    }

    const keys = Object.keys(input).slice(0, Resources.maximumInputKeys).join(Resources.listSeparator);
    return keys.length === 0 ? toolName : Resources.formatToolWithKeys(toolName, keys);
  }

  private static decisions(): readonly ApprovalOption[] {
    return [
      new ApprovalOption(Resources.claudeAllowDecision, Resources.allowLabel, ApprovalOutcome.Approved),
      new ApprovalOption(Resources.claudeDenyDecision, Resources.denyLabel, ApprovalOutcome.Denied)
    ];
  }
}
