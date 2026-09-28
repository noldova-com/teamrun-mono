/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MethodName } from "@noldova/teamrun-protocol";

@TestClass
export class MethodNameTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("ProviderList", MethodName.ProviderList);
    Assert.areEqual("ProviderListModels", MethodName.ProviderListModels);
    Assert.areEqual("ProviderAccountList", MethodName.ProviderAccountList);
    Assert.areEqual("ProviderAccountCreate", MethodName.ProviderAccountCreate);
    Assert.areEqual("ProviderAccountCheck", MethodName.ProviderAccountCheck);
    Assert.areEqual("ProviderAccountDelete", MethodName.ProviderAccountDelete);
    Assert.areEqual("ProjectList", MethodName.ProjectList);
    Assert.areEqual("ProjectOpen", MethodName.ProjectOpen);
    Assert.areEqual("ProjectForget", MethodName.ProjectForget);
    Assert.areEqual("ConversationList", MethodName.ConversationList);
    Assert.areEqual("ConversationCreate", MethodName.ConversationCreate);
    Assert.areEqual("ConversationRename", MethodName.ConversationRename);
    Assert.areEqual("ConversationDelete", MethodName.ConversationDelete);
    Assert.areEqual("ConversationRewind", MethodName.ConversationRewind);
    Assert.areEqual("ConversationSearch", MethodName.ConversationSearch);
    Assert.areEqual("MessageList", MethodName.MessageList);
    Assert.areEqual("MessageSend", MethodName.MessageSend);
    Assert.areEqual("MessageCancel", MethodName.MessageCancel);
    Assert.areEqual("ApprovalList", MethodName.ApprovalList);
    Assert.areEqual("ApprovalDecide", MethodName.ApprovalDecide);
    Assert.areEqual("TerminalList", MethodName.TerminalList);
    Assert.areEqual("TerminalOpen", MethodName.TerminalOpen);
    Assert.areEqual("TerminalInput", MethodName.TerminalInput);
    Assert.areEqual("TerminalResize", MethodName.TerminalResize);
    Assert.areEqual("TerminalRestart", MethodName.TerminalRestart);
    Assert.areEqual("TerminalClose", MethodName.TerminalClose);
    Assert.areEqual("TerminalScreen", MethodName.TerminalScreen);
    Assert.areEqual("TerminalLines", MethodName.TerminalLines);
    Assert.areEqual("TerminalAcknowledge", MethodName.TerminalAcknowledge);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(MethodName);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
