/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum EventName {
  StateInvalidated = "StateInvalidated",
  StateResyncRequested = "StateResyncRequested",
  MessageCreated = "MessageCreated",
  MessageUpdated = "MessageUpdated",
  DetailAppended = "DetailAppended",
  DetailUpdated = "DetailUpdated",
  ApprovalCreated = "ApprovalCreated",
  ApprovalUpdated = "ApprovalUpdated",
  ProviderAccountUpdated = "ProviderAccountUpdated",
  ConversationRewound = "ConversationRewound",
  TerminalOutput = "TerminalOutput",
  TerminalChanged = "TerminalChanged"
}
