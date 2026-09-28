/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import * as api from "@noldova/teamrun-protocol";

@TestClass
export class ProtocolApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    Assert.isDefined(api.UpdateCheckpoint);
    Assert.isDefined(api.UpdateCheckpointPhase);
    Assert.isDefined(api.UpdateCheckpointResult);
    Assert.isDefined(api.UpdateOperation);
    Assert.isDefined(api.AppUpdateState);
    Assert.isDefined(api.AppUpdateStatus);
    Assert.isDefined(api.AppUpdateCommand);
    Assert.isDefined(api.Teammate);
    Assert.isDefined(api.TeammateCreateParams);
    Assert.isDefined(api.TeammateUpdateParams);
    Assert.isDefined(api.TeammateIdParams);
    Assert.isDefined(api.ConversationMemberParams);
    Assert.isDefined(api.ConversationMember);
    Assert.isDefined(api.TeammateMention);
    Assert.isDefined(api.Harness);
    Assert.isDefined(api.TeammateName);
    Assert.isDefined(api.MentionResolver);
    Assert.isDefined(api.MentionSpan);
    Assert.isDefined(api.RoleApplication);
    Assert.isDefined(api.Approval);
    Assert.isDefined(api.ApprovalDecideParams);
    Assert.isDefined(api.ApprovalKind);
    Assert.isDefined(api.ApprovalOption);
    Assert.isDefined(api.ApprovalOutcome);
    Assert.isDefined(api.ApprovalStatus);
    Assert.isDefined(api.AuthStatus);
    Assert.isDefined(api.Conversation);
    Assert.isDefined(api.ConversationCreateParams);
    Assert.isDefined(api.ConversationIdParams);
    Assert.isDefined(api.ConversationRenameParams);
    Assert.isDefined(api.ConversationRewindParams);
    Assert.isDefined(api.ConversationRewindResult);
    Assert.isDefined(api.ConversationSearchHit);
    Assert.isDefined(api.ConversationSearchParams);
    Assert.isDefined(api.ConversationSearchResult);
    Assert.isDefined(api.ConversationRewoundPayload);
    Assert.isDefined(api.DetailEventPayload);
    Assert.isDefined(api.DetailKind);
    Assert.isDefined(api.ErrorCode);
    Assert.isDefined(api.Event);
    Assert.isDefined(api.EventName);
    Assert.isDefined(api.Hello);
    Assert.isDefined(api.Message);
    Assert.isDefined(api.AttachmentInput);
    Assert.isDefined(api.MessageAttachment);
    Assert.isDefined(api.MessageAuthor);
    Assert.isDefined(api.MessageDetail);
    Assert.isDefined(api.MessageIdParams);
    Assert.isDefined(api.MessageListParams);
    Assert.isDefined(api.MessageSendParams);
    Assert.isDefined(api.MessageSendResult);
    Assert.isDefined(api.MessageStatus);
    Assert.isDefined(api.MethodName);
    Assert.isDefined(api.ReplySummary);
    Assert.isDefined(api.ReplyPage);
    Assert.isDefined(api.ReplyPanel);
    Assert.isDefined(api.FileChangeSummary);
    Assert.isDefined(api.FileChangeReader);
    Assert.isDefined(api.FileEdit);
    Assert.isDefined(api.DiffLine);
    Assert.isDefined(api.DiffLineKind);
    Assert.isDefined(api.ObservedSettings);
    Assert.isDefined(api.Project);
    Assert.isDefined(api.ProjectIdParams);
    Assert.isDefined(api.ProjectOpenParams);
    Assert.isDefined(api.ProtocolVersion);
    Assert.isDefined(api.Provenance);
    Assert.isDefined(api.ProviderAccount);
    Assert.isDefined(api.ProviderAccountCreateParams);
    Assert.isDefined(api.ProviderAccountIdParams);
    Assert.isDefined(api.ProviderAccountIdentity);
    Assert.isDefined(api.ProviderDescriptor);
    Assert.isDefined(api.ProviderModel);
    Assert.isDefined(api.ProviderListModelsParams);
    Assert.isDefined(api.Request);
    Assert.isDefined(api.RequestedSettings);
    Assert.isDefined(api.Resources);
    Assert.isDefined(api.Response);
    Assert.isDefined(api.WireDecoder);
    Assert.isDefined(api.WireMessage);
    Assert.isDefined(api.WireMessageKind);
    Assert.isDefined(api.TerminalTextStyle);
    Assert.isDefined(api.TerminalLine);
    Assert.isDefined(api.TerminalLineRange);
    Assert.isDefined(api.TerminalSize);
    Assert.isDefined(api.TerminalState);
    Assert.isDefined(api.TerminalTextRun);
    Assert.isDefined(api.TerminalAcknowledgeParams);
    Assert.isDefined(api.TerminalIdParams);
    Assert.isDefined(api.TerminalInputParams);
    Assert.isDefined(api.TerminalLinePage);
    Assert.isDefined(api.TerminalLinesParams);
    Assert.isDefined(api.TerminalOpenParams);
    Assert.isDefined(api.TerminalResizeParams);
    Assert.isDefined(api.TerminalScreen);
    Assert.isDefined(api.TerminalOutputPayload);
  }
}
