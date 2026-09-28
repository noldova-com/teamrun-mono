/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { EventName } from "@noldova/teamrun-protocol";

@TestClass
export class EventNameTests {
  @TestMethod
  public usesMemberNamesAsValues(): void {
    Assert.areEqual("MessageCreated", EventName.MessageCreated);
    Assert.areEqual("MessageUpdated", EventName.MessageUpdated);
    Assert.areEqual("DetailAppended", EventName.DetailAppended);
    Assert.areEqual("DetailUpdated", EventName.DetailUpdated);
    Assert.areEqual("ApprovalCreated", EventName.ApprovalCreated);
    Assert.areEqual("ApprovalUpdated", EventName.ApprovalUpdated);
    Assert.areEqual("ProviderAccountUpdated", EventName.ProviderAccountUpdated);
    Assert.areEqual("ConversationRewound", EventName.ConversationRewound);
    Assert.areEqual("TerminalOutput", EventName.TerminalOutput);
    Assert.areEqual("TerminalChanged", EventName.TerminalChanged);
  }

  @TestMethod
  public valuesAreDistinct(): void {
    const values = Object.values(EventName);

    Assert.areEqual(values.length, new Set(values).size);
  }
}
