/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  ApiKeySource,
  EffortLevel,
  SDKAssistantMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKStatusMessage,
  SDKSystemMessage,
  SDKThinkingTokensMessage,
  SDKUserMessage
} from "@anthropic-ai/claude-agent-sdk";
import type {
  BetaContentBlock,
  BetaRawContentBlockDeltaEvent,
  BetaTextBlock,
  BetaThinkingBlock,
  BetaToolUseBlock,
  BetaUsage
} from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import type { ContentBlockParam, ImageBlockParam, TextBlockParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources";

type Uuid = SDKAssistantMessage["uuid"];
type ResultUsage = SDKResultMessage["usage"];

export class SdkMessages {
  private static readonly VERSION: string = "2.1.263";
  private static readonly MODEL: string = "claude-sonnet-5";
  private static readonly ZERO_UUID: Uuid = "00000000-0000-0000-0000-000000000000";

  public static init(sessionId: string, apiKeySource: ApiKeySource, effort: EffortLevel | null, servers: readonly { name: string; status: string }[]): SDKSystemMessage {
    const message: SDKSystemMessage = {
      type: "system",
      subtype: "init",
      apiKeySource,
      claude_code_version: SdkMessages.VERSION,
      cwd: "D:/work",
      tools: ["Read", "Bash"],
      mcp_servers: [...servers],
      model: SdkMessages.MODEL,
      permissionMode: "acceptEdits",
      slash_commands: [],
      output_style: "default",
      skills: [],
      plugins: [],
      uuid: SdkMessages.ZERO_UUID,
      session_id: sessionId
    };
    if (effort !== null)
      message.effort = effort;

    return message;
  }

  public static assistant(uuid: Uuid, content: readonly BetaContentBlock[], model: string, parentToolUseId: string | null = null): SDKAssistantMessage {
    return {
      type: "assistant",
      message: {
        id: "msg-1",
        container: null,
        content: [...content],
        context_management: null,
        diagnostics: null,
        model,
        role: "assistant",
        stop_details: null,
        stop_reason: "end_turn",
        stop_sequence: null,
        type: "message",
        usage: SdkMessages.usage()
      },
      parent_tool_use_id: parentToolUseId,
      uuid,
      session_id: "s"
    };
  }

  public static text(text: string): BetaTextBlock {
    return { type: "text", text, citations: null };
  }

  public static thinking(thinking: string): BetaThinkingBlock {
    return { type: "thinking", thinking, signature: "sig" };
  }

  public static toolUse(id: string, name: string, input: unknown): BetaToolUseBlock {
    return { type: "tool_use", id, name, input };
  }

  public static user(uuid: Uuid | undefined, content: string | readonly ContentBlockParam[], parentToolUseId: string | null = null): SDKUserMessage {
    const message: SDKUserMessage = {
      type: "user",
      message: { role: "user", content: typeof content === "string" ? content : [...content] },
      parent_tool_use_id: parentToolUseId,
      session_id: "s"
    };
    if (uuid !== undefined)
      message.uuid = uuid;

    return message;
  }

  public static toolResult(toolUseId: string, content: string | readonly (TextBlockParam | ImageBlockParam)[] | undefined, isError?: boolean): ToolResultBlockParam {
    const block: ToolResultBlockParam = { type: "tool_result", tool_use_id: toolUseId };
    if (isError !== undefined)
      block.is_error = isError;
    if (content !== undefined)
      block.content = typeof content === "string" ? content : [...content];

    return block;
  }

  public static textParam(text: string): TextBlockParam {
    return { type: "text", text };
  }

  public static imageParam(): ImageBlockParam {
    return { type: "image", source: { type: "base64", media_type: "image/png", data: "AA==" } };
  }

  public static messageStart(sessionId: string, uuid: Uuid): SDKPartialAssistantMessage {
    return {
      type: "stream_event",
      event: { type: "message_start", message: SdkMessages.assistant(uuid, [], "claude-opus-5").message },
      parent_tool_use_id: null,
      uuid,
      session_id: sessionId
    };
  }

  public static textDelta(sessionId: string, uuid: Uuid, index: number, text: string, parentToolUseId: string | null = null): SDKPartialAssistantMessage {
    const event: BetaRawContentBlockDeltaEvent = { type: "content_block_delta", index, delta: { type: "text_delta", text } };
    return { type: "stream_event", event, parent_tool_use_id: parentToolUseId, uuid, session_id: sessionId };
  }

  public static thinkingDelta(sessionId: string, uuid: Uuid, index: number, thinking: string): SDKPartialAssistantMessage {
    const event: BetaRawContentBlockDeltaEvent = { type: "content_block_delta", index, delta: { type: "thinking_delta", thinking, estimated_tokens: null } };
    return { type: "stream_event", event, parent_tool_use_id: null, uuid, session_id: sessionId };
  }

  public static otherDelta(sessionId: string, uuid: Uuid, index: number): SDKPartialAssistantMessage {
    const event: BetaRawContentBlockDeltaEvent = { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: "{" } };
    return { type: "stream_event", event, parent_tool_use_id: null, uuid, session_id: sessionId };
  }

  public static blockStop(sessionId: string, uuid: Uuid, index: number): SDKPartialAssistantMessage {
    return { type: "stream_event", event: { type: "content_block_stop", index }, parent_tool_use_id: null, uuid, session_id: sessionId };
  }

  public static status(sessionId: string): SDKStatusMessage {
    return { type: "system", subtype: "status", status: "compacting", uuid: SdkMessages.ZERO_UUID, session_id: sessionId };
  }

  public static thinkingTokens(sessionId: string, estimated: number): SDKThinkingTokensMessage {
    return { type: "system", subtype: "thinking_tokens", estimated_tokens: estimated, estimated_tokens_delta: 20, uuid: SdkMessages.ZERO_UUID, session_id: sessionId };
  }

  public static success(sessionId: string, result: string): SDKResultMessage {
    return {
      type: "result",
      subtype: "success",
      duration_ms: 1,
      duration_api_ms: 1,
      is_error: false,
      num_turns: 1,
      result,
      stop_reason: "end_turn",
      total_cost_usd: 0,
      usage: SdkMessages.resultUsage(),
      modelUsage: {},
      permission_denials: [],
      uuid: SdkMessages.ZERO_UUID,
      session_id: sessionId
    };
  }

  public static failure(sessionId: string, subtype: "error_during_execution" | "error_max_turns", errors: readonly string[]): SDKResultMessage {
    return {
      type: "result",
      subtype,
      duration_ms: 1,
      duration_api_ms: 1,
      is_error: true,
      num_turns: 1,
      stop_reason: null,
      total_cost_usd: 0,
      usage: SdkMessages.resultUsage(),
      modelUsage: {},
      permission_denials: [],
      errors: [...errors],
      uuid: SdkMessages.ZERO_UUID,
      session_id: sessionId
    };
  }

  private static usage(): BetaUsage {
    return {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      fallback_credit: null,
      inference_geo: null,
      input_tokens: 1,
      iterations: null,
      output_tokens: 1,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
      speed: null
    };
  }

  private static resultUsage(): ResultUsage {
    return {
      cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      fallback_credit: { status: { type: "redeemed" } },
      inference_geo: "us",
      input_tokens: 1,
      iterations: [],
      output_tokens: 1,
      output_tokens_details: { thinking_tokens: 0 },
      server_tool_use: { web_fetch_requests: 0, web_search_requests: 0 },
      service_tier: "standard",
      speed: "standard"
    };
  }
}
