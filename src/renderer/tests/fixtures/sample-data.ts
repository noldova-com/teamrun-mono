/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  AttachmentInput,
  MessageAttachment,
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalStatus,
  AuthStatus,
  Conversation,
  DetailKind,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus,
  MethodName,
  ObservedSettings,
  Project,
  Provenance,
  ProviderAccount,
  ProviderDescriptor,
  ProviderModel,
  ProjectIdParams,
  RequestedSettings,
  TerminalLineRange,
  TerminalShell,
  TerminalShellKind,
  TerminalSize,
  TerminalState
} from "@noldova/teamrun-protocol";

import { FakeTeamRunBridge } from "./fake-teamrun-bridge";

export class SampleData {
  public static readonly timestamp: string = "2026-09-10T08:00:00.000Z";
  public static readonly codex: ProviderDescriptor = new ProviderDescriptor("codex", "Codex", ["low", "high"], true, true);
  public static readonly claude: ProviderDescriptor = new ProviderDescriptor("claude", "Claude Code", [], true, true);
  public static readonly account: ProviderAccount =
    new ProviderAccount("a1", "codex", "Work", "D:\\profiles\\codex", AuthStatus.LoggedIn, null, "1.0", SampleData.timestamp, null, SampleData.timestamp);
  public static readonly project: Project = new Project("p1", "repo", "D:\\repo", SampleData.timestamp);
  public static readonly otherProject: Project = new Project("p2", "other", "D:\\other", SampleData.timestamp);
  public static readonly shells: readonly TerminalShell[] = [
    new TerminalShell("pwsh", "PowerShell", TerminalShellKind.PowerShell, true),
    new TerminalShell("cmd", "Command Prompt", TerminalShellKind.CommandPrompt, false)
  ];
  public static readonly conversation: Conversation = new Conversation("c1", "p1", "First", SampleData.timestamp, SampleData.timestamp);
  public static readonly userMessage: Message =
    new Message("m1", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "hello")], null, SampleData.timestamp, null,
      SampleData.timestamp);
  public static readonly provenance: Provenance =
    new Provenance("a1", new RequestedSettings("codex", "gpt-5", "high"), new ObservedSettings("codex", "gpt-5", null, "1.0", null), "s1", false);
  public static readonly reply: Message =
    new Message("m2", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
  public static readonly approval: Approval = new Approval(
    "ap1",
    "m2",
    ApprovalKind.Command,
    "exec",
    "run tests",
    null,
    [new ApprovalOption("yes", "Approve", ApprovalOutcome.Approved), new ApprovalOption("no", "Deny", ApprovalOutcome.Denied)],
    ApprovalStatus.Pending,
    null,
    SampleData.timestamp,
    null);

  public static detail(sequence: number, kind: DetailKind, text: string): MessageDetail {
    return new MessageDetail(sequence, kind, text, null, SampleData.timestamp);
  }

  public static createBridge(): FakeTeamRunBridge {
    return new FakeTeamRunBridge()
      .answer(MethodName.AttachmentPrepare, payload => {
        const input = AttachmentInput.fromJson(payload);
        return new MessageAttachment(input.name, input.mediaType, 0, `D:/data/attachments/drafts/${input.name}`).toJson();
      })
      .answer(MethodName.AttachmentDiscard, () => null)
      .answer(MethodName.ProviderList, () => [SampleData.codex.toJson(), SampleData.claude.toJson()])
      .answer(MethodName.ProviderAccountList, () => [SampleData.account.toJson()])
      .answer(MethodName.TeammateList, () => [])
      .answer(MethodName.ConversationListMembers, () => [])
      .answer(MethodName.ProjectList, () => [SampleData.project.toJson()])
      .answer(MethodName.TerminalList, () => [])
      .answer(MethodName.TerminalShells, () => SampleData.shells.map(t => t.toJson()))
      .answer(MethodName.ConversationList, payload => ProjectIdParams.fromJson(payload).projectId === SampleData.project.id ? [SampleData.conversation.toJson()] : [])
      .answer(MethodName.MessageList, () => [SampleData.userMessage.toJson(), SampleData.reply.toJson()])
      .answer(MethodName.MessageListOpen, () => [])
      .answer(MethodName.ApprovalListPending, () => [])
      .answer(MethodName.ApprovalList, () => [SampleData.approval.toJson()])
      .answer(MethodName.ProviderListModels, () => ["gpt-5", "gpt-5-mini"])
      .answer(MethodName.ProviderModelCatalog, () => ["gpt-5", "gpt-5-mini"].map((id, index) => new ProviderModel(id, id, "Fixture", ["medium", "high"], index === 0, null, true).toJson()));
  }

  public static terminal(id: string, sequence: number = 0, exitCode: number | null = null, restartCount: number = 0): TerminalState {
    return new TerminalState(id, SampleData.project.id, "PowerShell", TerminalShellKind.PowerShell, null, new TerminalSize(80, 24), exitCode, restartCount, sequence,
      new TerminalLineRange(0, 0));
  }

  public static withStatus(message: Message, status: MessageStatus, details: readonly MessageDetail[] = message.details): Message {
    const active = status === MessageStatus.Pending || status === MessageStatus.Running || status === MessageStatus.AwaitingApproval;
    const endedAt = active ? null : SampleData.timestamp;
    const startedAt = message.author !== MessageAuthor.Provider || status === MessageStatus.Pending ? null : message.startedAt ?? message.createdAt;
    return new Message(message.id, message.conversationId, message.sequence, message.author, message.inReplyTo, status, details, message.provenance,
      message.createdAt, startedAt, endedAt);
  }
}
