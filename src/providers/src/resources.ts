/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";

export class Resources {
  public static readonly grokBase64Encoding: BufferEncoding = "base64";
  public static readonly grokExecutableName: string = "grok";
  public static readonly grokWindowsExecutableName: string = "grok.exe";
  public static readonly grokDirectoryName: string = ".grok";
  public static readonly sessionIdField: string = "sessionId";
  public static readonly nameField: string = "name";
  public static readonly titleField: string = "title";
  public static readonly optionsField: string = "options";
  public static readonly contentField: string = "content";
  public static readonly grokNotFound: string = "Grok CLI was not found. Install it from https://x.ai/cli and restart TeamRun.";
  public static readonly grokImagesUnavailable: string = "This Grok ACP integration does not support image attachments. Use a provider that supports images.";
  public static readonly grokAgentArguments: readonly string[] = ["--no-auto-update", "--permission-mode", "default", "--no-subagents", "--disallowed-tools", "search_tool,use_tool"];
  public static readonly grokStdioArguments: readonly string[] = ["agent", "--no-leader", "stdio"];
  public static readonly grokModelArgument: string = "--model";
  public static readonly grokEffortArgument: string = "--reasoning-effort";
  public static readonly grokInitialize: string = "initialize";
  public static readonly grokAuthenticate: string = "authenticate";
  public static readonly grokSessionNew: string = "session/new";
  public static readonly grokSessionLoad: string = "session/load";
  public static readonly grokSessionPrompt: string = "session/prompt";
  public static readonly grokSessionCancel: string = "session/cancel";
  public static readonly grokSessionSetModel: string = "session/set_model";
  public static readonly grokModelsField: string = "models";
  public static readonly grokStopReasonField: string = "stopReason";
  public static readonly grokEndTurn: string = "end_turn";
  public static readonly grokRefusal: string = "refusal";
  public static readonly grokProviderId: string = "grok";
  public static readonly grokDisplayName: string = "Grok";
  public static readonly grokMetaField: string = "_meta";
  public static readonly grokModelStateField: string = "modelState";
  public static readonly grokCurrentModelField: string = "currentModelId";
  public static readonly grokModelIdField: string = "modelId";
  public static readonly grokAvailableModelsField: string = "availableModels";
  public static readonly grokCapabilitiesField: string = "agentCapabilities";
  public static readonly grokPromptCapabilitiesField: string = "promptCapabilities";
  public static readonly grokImageCapabilityField: string = "image";
  public static readonly grokReasoningEffortsField: string = "reasoningEfforts";
  public static readonly grokValueField: string = "value";
  public static readonly grokAgentVersionField: string = "agentVersion";
  public static readonly grokAuthMethodsField: string = "authMethods";
  public static readonly grokCachedAuthMethod: string = "cached_token";
  public static readonly grokSessionUpdate: string = "session/update";
  public static readonly grokUpdateField: string = "update";
  public static readonly grokSessionUpdateField: string = "sessionUpdate";
  public static readonly grokMessageChunk: string = "agent_message_chunk";
  public static readonly grokThoughtChunk: string = "agent_thought_chunk";
  public static readonly grokToolCall: string = "tool_call";
  public static readonly grokToolUpdate: string = "tool_call_update";
  public static readonly grokRequestPermission: string = "session/request_permission";
  public static readonly grokToolCallField: string = "toolCall";
  public static readonly grokToolCallIdField: string = "toolCallId";
  public static readonly grokOptionIdField: string = "optionId";
  public static readonly grokLocationsField: string = "locations";
  public static readonly grokToolTitle: string = "Grok tool";
  public static readonly grokOtherKind: string = "other";
  public static readonly grokExecuteKind: string = "execute";
  public static readonly grokEditKind: string = "edit";
  public static readonly grokCompletedStatus: string = "completed";
  public static readonly grokDiffType: string = "diff";
  public static readonly grokOldTextField: string = "oldText";
  public static readonly grokNewTextField: string = "newText";
  public static readonly addChangeKind: string = "add";
  public static readonly updateChangeKind: string = "update";
  public static readonly diffRemovedPrefix: string = "-";
  public static readonly diffAddedPrefix: string = "+";
  public static readonly grokAllowOnce: string = "allow_once";
  public static readonly grokRejectOnce: string = "reject_once";
  public static readonly grokSelected: string = "selected";
  public static readonly grokCancelled: string = "cancelled";
  public static readonly acpJsonRpcVersion: string = "2.0";
  public static readonly acpMaximumPending: number = 128;
  public static readonly acpMaximumBufferedCharacters: number = 16 * 1024 * 1024;
  public static readonly acpKillWait: number = 5000;
  public static readonly acpAlreadyStarted: string = "The ACP client is already started.";
  public static readonly acpDisconnected: string = "The ACP agent connection is closed.";
  public static readonly acpTooManyRequests: string = "The ACP request limit was reached.";
  public static readonly acpDidNotStop: string = "The ACP agent did not stop within the shutdown timeout.";
  public static readonly acpFrameTooLarge: string = "The ACP agent exceeded the message size limit.";
  public static readonly acpInvalidFrame: string = "The ACP agent returned an invalid message.";
  public static readonly acpUnsupportedRequest: string = "This ACP request is not supported by TeamRun.";
  public static readonly acpUnsupportedCode: number = -32601;
  public static readonly spawnEvent: string = "spawn";
  public static readonly grokProfileAbsolute: string = "The dedicated Grok profile must use an absolute path.";
  public static readonly grokProfileParameter: string = "profileDirectory";
  public static readonly grokProfileNotManaged: string = "Grok requires a dedicated TeamRun profile. Select an empty directory; an existing CLI profile will not be changed.";
  public static readonly grokProfileMarker: string = ".teamrun-managed-profile";
  public static readonly grokProfileMarkerValue: string = "TeamRun Grok profile v1\n";
  public static readonly grokHostHomeDirectory: string = "host-home";
  public static readonly grokConfigFile: string = "config.toml";
  public static readonly grokRequirementsFile: string = "requirements.toml";
  public static readonly grokProfileRequirements: string = "allow_managed_mcp_servers_only = true\nallowed_mcp_servers = []\nenable_all_project_mcp_servers = false\n";
  public static readonly grokProfileConfig: string = "[cli]\nauto_update = false\nuse_leader = false\n[features]\nsupport_permission = true\nmanaged_config = false\ncodebase_indexing = false\n[session]\nload_envrc = false\n[managed_mcps]\nenabled = false\ngateway_tools_enabled = false\n[subagents]\nenabled = false\n[ui]\ndefault_selected_permission = 'reject'\nremember_tool_approvals = false\n[compat.claude]\nmcps = false\nhooks = false\nskills = false\nagents = false\nsessions = false\n[compat.cursor]\nmcps = false\nhooks = false\nskills = false\nagents = false\nsessions = false\n";
  public static readonly grokExcludedEnvironment: RegExp = /(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)|^(?:GROK|XAI|CODEX|CLAUDE|ANTHROPIC|OPENAI|AWS|AZURE|GOOGLE|GIT_CONFIG|GIT_ASKPASS|SSH_ASKPASS)(?:_|$)/i;
  public static readonly grokHomeVariable: string = "GROK_HOME";
  public static readonly homeVariable: string = "HOME";
  public static readonly userProfileVariable: string = "USERPROFILE";
  public static readonly appDataVariable: string = "APPDATA";
  public static readonly localAppDataVariable: string = "LOCALAPPDATA";
  public static readonly xdgConfigVariable: string = "XDG_CONFIG_HOME";
  public static readonly xdgDataVariable: string = "XDG_DATA_HOME";
  public static readonly grokRoamingDirectory: string = "AppData/Roaming";
  public static readonly grokLocalDirectory: string = "AppData/Local";
  public static readonly grokXdgConfigDirectory: string = ".config";
  public static readonly grokXdgDataDirectory: string = ".local/share";
  public static readonly grokDisabledValue: string = "0";
  public static readonly grokFolderTrustVariable: string = "GROK_FOLDER_TRUST";
  public static readonly grokPermissionVariable: string = "GROK_DEFAULT_SELECTED_PERMISSION";
  public static readonly grokRejectPermission: string = "reject";
  public static readonly grokDisabledFeatures: readonly string[] = ["GROK_SUBAGENTS", "GROK_WORKFLOWS", "GROK_MANAGED_MCPS_ENABLED", "GROK_MANAGED_MCP_GATEWAY_TOOLS_ENABLED", "GROK_CURSOR_MCPS_ENABLED", "GROK_CLAUDE_MCPS_ENABLED", "GROK_CURSOR_HOOKS_ENABLED", "GROK_CLAUDE_HOOKS_ENABLED", "GROK_CURSOR_SKILLS_ENABLED", "GROK_CLAUDE_SKILLS_ENABLED", "GROK_CURSOR_AGENTS_ENABLED", "GROK_CLAUDE_AGENTS_ENABLED", "GROK_CURSOR_SESSIONS_ENABLED", "GROK_CLAUDE_SESSIONS_ENABLED"];
  public static readonly modelDisplayNameField: string = "displayName";
  public static readonly modelDescriptionField: string = "description";
  public static readonly modelIsDefaultField: string = "isDefault";
  public static readonly supportedReasoningEffortsField: string = "supportedReasoningEfforts";
  public static readonly inputModalitiesField: string = "inputModalities";
  public static readonly nextCursorField: string = "nextCursor";
  public static readonly cursorField: string = "cursor";
  public static readonly maximumModelPages: number = 20;
  public static readonly modelCatalogTooLarge: string = "The provider model catalog exceeded its pagination limit.";
  public static readonly modelDiscoveryTimedOut: string = "The provider did not return its model catalog in time.";
  public static readonly claudeDefaultModel: string = "default";
  public static readonly localImageInputType: string = "localImage";
  public static readonly imageInputType = "image";
  public static readonly base64SourceType = "base64";
  public static readonly pngMediaType = "image/png";
  public static readonly jpegMediaType = "image/jpeg";
  public static readonly gifMediaType = "image/gif";
  public static readonly webpMediaType = "image/webp";
  public static readonly codexProviderId: string = "codex";
  public static readonly codexDisplayName: string = "Codex";
  public static readonly codexEffortLevels: readonly string[] = ["low", "medium", "high", "xhigh", "max", "ultra"];
  public static readonly claudeProviderId: string = "claude";
  public static readonly claudeDisplayName: string = "Claude Code";
  public static readonly claudeEffortLevels: readonly string[] = ["low", "medium", "high", "xhigh", "max"];

  public static readonly windowsPlatform: string = "win32";
  public static readonly codexExecutableName: string = "codex";
  public static readonly codexWindowsExecutableName: string = "codex.exe";
  public static readonly codexWindowsShimName: string = "codex.cmd";
  public static readonly claudeExecutableName: string = "claude";
  public static readonly claudeWindowsExecutableName: string = "claude.exe";
  public static readonly claudeWindowsShimName: string = "claude.cmd";
  public static readonly localDirectoryName: string = ".local";
  public static readonly binDirectoryName: string = "bin";
  public static readonly libDirectoryName: string = "lib";
  public static readonly nodeModulesDirectoryName: string = "node_modules";
  public static readonly openAiScopeName: string = "@openai";
  public static readonly codexPackageName: string = "codex";
  public static readonly codexPlatformPackagePrefix: string = "codex-";
  public static readonly vendorDirectoryName: string = "vendor";
  public static readonly platformArchitectureSeparator: string = "-";
  public static readonly codexTargetTriples: ReadonlyMap<string, string> = new Map([
    ["win32-x64", "x86_64-pc-windows-msvc"],
    ["win32-arm64", "aarch64-pc-windows-msvc"],
    ["darwin-x64", "x86_64-apple-darwin"],
    ["darwin-arm64", "aarch64-apple-darwin"],
    ["linux-x64", "x86_64-unknown-linux-musl"],
    ["linux-arm64", "aarch64-unknown-linux-musl"]
  ]);

  public static readonly versionArgument: string = "--version";
  public static readonly appServerArgument: string = "app-server";
  public static readonly authArgument: string = "auth";
  public static readonly statusArgument: string = "status";
  public static readonly jsonArgument: string = "--json";
  public static readonly taskkillExecutable: string = "taskkill";
  public static readonly taskkillProcessIdArgument: string = "/pid";
  public static readonly taskkillTreeArgument: string = "/T";
  public static readonly taskkillForceArgument: string = "/F";
  public static readonly terminateSignal: NodeJS.Signals = "SIGTERM";
  public static readonly versionPattern: RegExp = /\d+\.\d+\.\d+/;
  public static readonly userAgentVersionPattern: RegExp = /\/(\d+\.\d+\.\d+)/;

  public static readonly openAiApiKeyVariable: string = "OPENAI_API_KEY";
  public static readonly codexApiKeyVariable: string = "CODEX_API_KEY";
  public static readonly codexHomeVariable: string = "CODEX_HOME";
  public static readonly claudeConfigDirVariable: string = "CLAUDE_CONFIG_DIR";
  public static readonly claudeClientAppVariable: string = "CLAUDE_AGENT_SDK_CLIENT_APP";
  public static readonly disableAutoupdaterVariable: string = "DISABLE_AUTOUPDATER";
  public static readonly enabledValue: string = "1";
  public static readonly claudeCredentialVariablePattern: RegExp = /^(CLAUDE_|CLAUDEPID$|ANTHROPIC_)/i;
  public static readonly claudeRoutingVariables: ReadonlySet<string> = new Set([
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "CLAUDE_CODE_SKIP_BEDROCK_AUTH",
    "CLAUDE_CODE_SKIP_VERTEX_AUTH",
    "ANTHROPIC_BEDROCK_BASE_URL",
    "ANTHROPIC_VERTEX_BASE_URL",
    "ANTHROPIC_FOUNDRY_BASE_URL"
  ]);
  public static readonly clientAppPrefix: string = "teamrun/";

  public static readonly lineSeparator: string = "\n";
  public static readonly listSeparator: string = ", ";
  public static readonly requestIdSeparator: string = ":";
  public static readonly ellipsis: string = "…";
  public static readonly jsonObjectStart: string = "{";
  public static readonly maximumOutputLength: number = 512 * 1024;
  public static readonly maximumStderrChunks: number = 50;
  public static readonly maximumSummaryLength: number = 500;
  public static readonly maximumReasoningLength: number = 4000;
  public static readonly maximumCommandOutputLength: number = 4000;
  public static readonly maximumToolResultLength: number = 6000;
  public static readonly maximumInputKeys: number = 4;
  public static readonly claudeMaximumTurns: number = 400;
  public static readonly claudeThinkingDisplayArgument: string = "thinking-display";
  public static readonly claudeSummarizedThinkingDisplay: string = "summarized";
  public static readonly projectInstructionsFileName: string = "CLAUDE.md";
  public static readonly importPrefix: string = "@";
  public static readonly maximumInstructionsLength: number = 65_536;
  public static readonly space: string = " ";

  public static readonly versionTimeout: number = 20_000;
  public static readonly signInCheckTimeout: number = 30_000;
  public static readonly initializeTimeout: number = 60_000;
  public static readonly requestTimeout: number = 120_000;
  public static readonly interruptTimeout: number = 20_000;
  public static readonly interruptGrace: number = 30_000;
  public static readonly stopGrace: number = 3_000;
  public static readonly claudeAbortGrace: number = 8_000;
  public static readonly streamInterval: number = 100;
  public static readonly resumeRetryDelay: number = 1000;

  public static readonly idField: string = "id";
  public static readonly methodField: string = "method";
  public static readonly paramsField: string = "params";
  public static readonly resultField: string = "result";
  public static readonly errorField: string = "error";
  public static readonly codeField: string = "code";
  public static readonly messageField: string = "message";
  public static readonly dataField: string = "data";
  public static readonly userAgentField: string = "userAgent";
  public static readonly accountField: string = "account";
  public static readonly typeField: string = "type";
  public static readonly emailField: string = "email";
  public static readonly planTypeField: string = "planType";
  public static readonly modelField: string = "model";
  public static readonly hiddenField: string = "hidden";
  public static readonly threadField: string = "thread";
  public static readonly threadIdField: string = "threadId";
  public static readonly turnField: string = "turn";
  public static readonly reasoningEffortField: string = "reasoningEffort";
  public static readonly cwdField: string = "cwd";
  public static readonly textField: string = "text";
  public static readonly itemField: string = "item";
  public static readonly itemIdField: string = "itemId";
  public static readonly statusField: string = "status";
  public static readonly summaryField: string = "summary";
  public static readonly commandField: string = "command";
  public static readonly exitCodeField: string = "exitCode";
  public static readonly aggregatedOutputField: string = "aggregatedOutput";
  public static readonly changesField: string = "changes";
  public static readonly pathField: string = "path";
  public static readonly kindField: string = "kind";
  public static readonly diffField: string = "diff";
  public static readonly maximumItemJsonLength: number = 4000;
  public static readonly savedPathField: string = "savedPath";
  public static readonly revisedPromptField: string = "revisedPrompt";
  public static readonly failureField: string = "failure";
  public static readonly imageDataField: string = "imageData";
  public static readonly mediaTypeField: string = "mediaType";
  public static readonly maximumImageDataLength: number = 12_000_000;
  public static readonly base64Pattern: RegExp = /^[A-Za-z0-9+/]+=*$/;
  public static readonly imageSignatures: Readonly<Record<string, string>> = {
    iVBORw0KGgo: "image/png", "/9j/": "image/jpeg", R0lGOD: "image/gif", UklGR: "image/webp"
  };
  public static readonly imageNotSaved: string = "not saved";
  public static readonly serverField: string = "server";
  public static readonly toolField: string = "tool";
  public static readonly queryField: string = "query";
  public static readonly fromModelField: string = "fromModel";
  public static readonly toModelField: string = "toModel";
  public static readonly reasonField: string = "reason";
  public static readonly willRetryField: string = "willRetry";
  public static readonly grantRootField: string = "grantRoot";
  public static readonly loggedInField: string = "loggedIn";
  public static readonly subscriptionTypeField: string = "subscriptionType";
  public static readonly organizationNameField: string = "orgName";
  public static readonly authMethodField: string = "authMethod";

  public static readonly initializeMethod: string = "initialize";
  public static readonly initializedMethod: string = "initialized";
  public static readonly accountReadMethod: string = "account/read";
  public static readonly modelListMethod: string = "model/list";
  public static readonly threadStartMethod: string = "thread/start";
  public static readonly threadResumeMethod: string = "thread/resume";
  public static readonly threadUnarchiveMethod: string = "thread/unarchive";
  public static readonly threadForkMethod: string = "thread/fork";
  public static readonly lastTurnIdField: string = "lastTurnId";
  public static readonly forkNotSupported: string = "Claude Code sessions cannot be forked; a rewind continues with the transcript.";
  public static readonly archivedMarker: string = "is archived";
  public static readonly activeWriterMarker: string = "active writer";
  public static readonly resumeRetryCount: number = 3;
  public static readonly unknownProcessId: number = 0;
  public static readonly turnStartMethod: string = "turn/start";
  public static readonly turnInterruptMethod: string = "turn/interrupt";
  public static readonly itemStartedNotification: string = "item/started";
  public static readonly itemCompletedNotification: string = "item/completed";
  public static readonly agentMessageDeltaNotification: string = "item/agentMessage/delta";
  public static readonly deltaField: string = "delta";
  public static readonly turnCompletedNotification: string = "turn/completed";
  public static readonly modelReroutedNotification: string = "model/rerouted";
  public static readonly errorNotification: string = "error";
  public static readonly commandApprovalRequest: string = "item/commandExecution/requestApproval";
  public static readonly fileChangeApprovalRequest: string = "item/fileChange/requestApproval";
  public static readonly userInputRequest: string = "item/tool/requestUserInput";

  public static readonly chatGptAccountType: string = "chatgpt";
  public static readonly workspaceWriteSandbox: string = "workspace-write";
  public static readonly onRequestApprovalPolicy: string = "on-request";
  public static readonly textInputType = "text";
  public static readonly completedTurnStatus: string = "completed";
  public static readonly interruptedTurnStatus: string = "interrupted";
  public static readonly agentMessageItemType: string = "agentMessage";
  public static readonly reasoningItemType: string = "reasoning";
  public static readonly userMessageItemType: string = "userMessage";
  public static readonly planItemType: string = "plan";
  public static readonly commandExecutionItemType: string = "commandExecution";
  public static readonly fileChangeItemType: string = "fileChange";
  public static readonly mcpToolCallItemType: string = "mcpToolCall";
  public static readonly dynamicToolCallItemType: string = "dynamicToolCall";
  public static readonly webSearchItemType: string = "webSearch";
  public static readonly contextCompactionItemType: string = "contextCompaction";
  public static readonly imageGenerationItemType: string = "imageGeneration";
  public static readonly acceptDecision: string = "accept";
  public static readonly acceptForSessionDecision: string = "acceptForSession";
  public static readonly declineDecision: string = "decline";
  public static readonly allowLabel: string = "Allow";
  public static readonly allowForSessionLabel: string = "Allow for this session";
  public static readonly denyLabel: string = "Deny";
  public static readonly unsupportedServerRequestCode: number = -32601;
  public static readonly serverRequestFailedCode: number = -32000;

  public static readonly claudeAllowDecision: string = "allow";
  public static readonly claudeDenyDecision: string = "deny";
  public static readonly claudeCommandTools: readonly string[] = ["Bash", "PowerShell"];
  public static readonly claudeEditToolPattern: RegExp = /Edit|Write/;
  public static readonly claudeMcpToolPattern: string = "mcp__*";
  public static readonly claudeInputCommandKey: string = "command";
  public static readonly claudeInputPathKeys: readonly string[] = ["file_path", "path", "notebook_path"];
  public static readonly claudeSignedInMethod: string = "claude.ai login";
  public static readonly claudeApiKeySourceNone: string = "none";
  public static readonly claudeNoMcpServers: string = "none";

  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly dataEvent: string = "data";
  public static readonly errorEvent: string = "error";
  public static readonly closeEvent: string = "close";
  public static readonly abortEvent: string = "abort";
  public static readonly pathVariable: string = "PATH";
  public static readonly parentDirectory: string = "..";
  public static readonly codexCredentialVariables: readonly string[] = [Resources.openAiApiKeyVariable, Resources.codexApiKeyVariable];
  public static readonly defaultProfileKey: string = "default";
  public static readonly modelReasoningEffortSetting: string = "model_reasoning_effort";
  public static readonly startedSuffix: string = "started";
  public static readonly pendingSessionId: string = "pending";
  public static readonly unknownCommand: string = "(unknown command)";
  public static readonly errorPath: string = "$.error";
  public static readonly paramsPath: string = "$.params";
  public static readonly resultPath: string = "$.result";
  public static readonly signInStatusPath: string = "$.status";
  public static readonly toolInputPath: string = "$.input";

  public static readonly systemMessageType: "system" = "system";
  public static readonly assistantMessageType: "assistant" = "assistant";
  public static readonly userMessageType: "user" = "user";
  public static readonly resultMessageType: "result" = "result";
  public static readonly initSubtype: "init" = "init";
  public static readonly thinkingTokensSubtype: "thinking_tokens" = "thinking_tokens";
  public static readonly successSubtype: "success" = "success";
  public static readonly textBlockType: "text" = "text";
  public static readonly thinkingBlockType: "thinking" = "thinking";
  public static readonly toolUseBlockType: "tool_use" = "tool_use";
  public static readonly streamEventType: "stream_event" = "stream_event";
  public static readonly messageStartEventType: "message_start" = "message_start";
  public static readonly contentBlockDeltaEventType: "content_block_delta" = "content_block_delta";
  public static readonly textDeltaType: "text_delta" = "text_delta";
  public static readonly thinkingDeltaType: "thinking_delta" = "thinking_delta";
  public static readonly streamIdPrefix: string = "stream";
  public static readonly toolResultBlockType: "tool_result" = "tool_result";
  public static readonly allowBehavior: "allow" = "allow";
  public static readonly denyBehavior: "deny" = "deny";
  public static readonly presetSystemPromptType: "preset" = "preset";
  public static readonly claudeCodePreset: "claude_code" = "claude_code";
  public static readonly acceptEditsPermissionMode: PermissionMode = "acceptEdits";

  public static readonly executableParameterName: string = "executable";
  public static readonly pathParameterName: string = "path";
  public static readonly nameParameterName: string = "name";
  public static readonly titleParameterName: string = "title";
  public static readonly versionParameterName: string = "version";
  public static readonly userAgentParameterName: string = "userAgent";
  public static readonly threadIdParameterName: string = "threadId";
  public static readonly modelParameterName: string = "model";
  public static readonly timeoutParameterName: string = "timeoutMilliseconds";
  public static readonly delayParameterName: string = "delayMilliseconds";
  public static readonly maximumLengthParameterName: string = "maximumLength";
  public static readonly maximumCountParameterName: string = "maximumCount";
  public static readonly turnIdParameterName: string = "turnId";
  public static readonly versionTimeoutParameterName: string = "versionTimeout";
  public static readonly signInCheckTimeoutParameterName: string = "signInCheckTimeout";
  public static readonly initializeTimeoutParameterName: string = "initializeTimeout";
  public static readonly requestTimeoutParameterName: string = "requestTimeout";
  public static readonly interruptTimeoutParameterName: string = "interruptTimeout";
  public static readonly interruptGraceParameterName: string = "interruptGrace";
  public static readonly stopGraceParameterName: string = "stopGrace";
  public static readonly abortGraceParameterName: string = "abortGrace";
  public static readonly streamIntervalParameterName: string = "streamInterval";
  public static readonly resumeRetryDelayParameterName: string = "resumeRetryDelay";

  public static readonly codexNotFound: string = "The Codex CLI was not found. Install it with `npm install -g @openai/codex` and sign in once with `codex login`.";
  public static readonly claudeNotFound: string = "The Claude Code executable was not found. Install Claude Code and sign in once with `claude auth login`.";
  public static readonly appServerAlreadyStarted: string = "The Codex app-server was already started.";
  public static readonly appServerNoRequestHandler: string = "TeamRun has no handler for server requests.";
  public static readonly appServerExitedDuringTurn: string = "The Codex app-server exited during the turn.";
  public static readonly claudeNoResult: string = "Claude Code ended without a result message.";
  public static readonly turnNotSettled: string = "The turn has not ended yet, so it has no result.";
  public static readonly claudeDenied: string = "Denied by the TeamRun user.";
  public static readonly contextCompacted: string = "Codex compacted its context.";
  public static readonly planPrefix: string = "Plan:";
  public static readonly runningPrefix: string = "Running: ";
  public static readonly commandPrompt: string = "$ ";
  public static readonly runCommandPrefix: string = "Run command: ";
  public static readonly applyFileChanges: string = "Apply file changes";
  public static readonly retryableErrorPrefix: string = "Retryable error: ";
  public static readonly errorPrefix: string = "Error: ";
  public static readonly stderrHeading: string = "[stderr]";

  public static formatAppServerError(method: string, message: string, code: number): string {
    return `${method}: ${message} (code ${code})`;
  }

  public static formatAppServerNotRunning(method: string): string {
    return `The Codex app-server is not running (${method}).`;
  }

  public static formatAppServerTimedOut(method: string): string {
    return `The Codex app-server did not answer ${method} within the timeout.`;
  }

  public static formatAppServerExited(code: number | null, signal: string | null, stderr: string): string {
    const suffix = String.isNullOrWhitespace(stderr) ? String.empty : `: ${stderr}`;
    return `The Codex app-server exited (code ${String(code)}, signal ${String(signal)})${suffix}`;
  }

  public static formatTurnStatus(status: string): string {
    return `The turn ended with status "${status}".`;
  }

  public static formatUnsupportedServerRequest(method: string): string {
    return `TeamRun does not handle the server request ${method}.`;
  }

  public static formatUnknownEffort(effort: string, provider: string): string {
    return `The effort "${effort}" is not one ${provider} accepts.`;
  }

  public static formatProjectInstructions(content: string): string {
    return `The project's CLAUDE.md, loaded by TeamRun (the project's settings, MCP servers, plugins, and hooks stay off):\n\n${content}`;
  }

  public static formatResumeFailed(error: string): string {
    return `The native session could not be resumed, so a fresh one was started: ${error}`;
  }

  public static formatAccountUnavailable(error: string): string {
    return `The account could not be read: ${error}`;
  }

  public static formatAccountInfoUnavailable(error: string): string {
    return `The account details could not be read: ${error}`;
  }

  public static formatCommandStatus(command: string, output: string, exitCode: number | null): string {
    const suffix = Object.isNull(exitCode) ? String.empty : `${Resources.lineSeparator}(exit ${exitCode})`;
    return `${Resources.commandPrompt}${command}${Resources.lineSeparator}${output}${suffix}`;
  }

  public static formatUnknownItem(type: string): string {
    return `Codex item ${type}`;
  }

  public static formatGeneratedImage(status: string, path: string | null): string {
    return `Generated image (${status}): ${path ?? Resources.imageNotSaved}`;
  }

  public static formatFileChanges(status: string, changes: string): string {
    return `File changes (${status}): ${changes}`;
  }

  public static formatFileChange(kind: string, path: string): string {
    return `${kind} ${path}`;
  }

  public static formatMcpToolCall(server: string, tool: string, status: string): string {
    return `MCP tool ${server}/${tool} (${status})`;
  }

  public static formatToolCall(tool: string, status: string): string {
    return `Tool ${tool} (${status})`;
  }

  public static formatWebSearch(query: string): string {
    return `Web search: ${query}`;
  }

  public static formatModelRerouted(fromModel: string, toModel: string, reason: string): string {
    return `Codex rerouted the model from ${fromModel} to ${toModel} (${reason}).`;
  }

  public static formatFileChangeApproval(reason: string | null, grantRoot: string | null): string {
    const reasonText = Object.isNull(reason) ? String.empty : `: ${reason}`;
    const rootText = Object.isNull(grantRoot) ? String.empty : ` (grant root ${grantRoot})`;
    return `${Resources.applyFileChanges}${reasonText}${rootText}`;
  }

  public static formatUnexpectedSignInOutput(output: string): string {
    return `Unexpected output from the sign-in check: ${output}`;
  }

  public static formatApiKeySource(source: string): string {
    return `api key (${source})`;
  }

  public static formatClaudeSession(tools: string, servers: string, permissionMode: string): string {
    return `Session tools: ${tools}. MCP servers: ${servers}. Permission mode: ${permissionMode}.`;
  }

  public static formatClaudeServer(name: string, status: string): string {
    return `${name} (${status})`;
  }

  public static formatClaudeFailure(subtype: string, errors: readonly string[]): string {
    return errors.length === 0 ? subtype : `${subtype}: ${errors.join("; ")}`;
  }

  public static formatToolWithCommand(tool: string, command: string): string {
    return `${tool}: ${command}`;
  }

  public static formatToolWithKeys(tool: string, keys: string): string {
    return `${tool} (${keys})`;
  }

  public static formatAcpTimeout(method: string): string {
    return `The ACP agent did not answer ${method} in time.`;
  }

  public static formatGrokSignIn(directory: string): string {
    return `Sign in to the dedicated TeamRun Grok profile at ${directory}. The regular CLI profile is separate.`;
  }

  public static formatGrokModelUnavailable(model: string): string {
    return `Grok did not advertise the selected model: ${model}. Refresh the model catalog.`;
  }

  public static formatGrokStopped(reason: string): string {
    return `Grok stopped before completing the turn: ${reason}.`;
  }

  public static formatRolePrompt(instructions: string | null, prompt: string): string {
    const role = instructions ?? "No additional teammate role instructions.";
    return `TeamRun teammate role for this turn (replaces any previous teammate role):\n${role}\n\nTask:\n\n${prompt}`;
  }
}
