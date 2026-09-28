/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { TerminalTextStyle } from "@noldova/teamrun-protocol";

@TestClass
export class TerminalTextStyleTests {
  @TestMethod
  public usesOneBitPerStyle(): void {
    const values = [
      TerminalTextStyle.Bold, TerminalTextStyle.Dim, TerminalTextStyle.Italic, TerminalTextStyle.Underline, TerminalTextStyle.Blink,
      TerminalTextStyle.Inverse, TerminalTextStyle.Invisible, TerminalTextStyle.Strikethrough, TerminalTextStyle.Overline
    ];

    Assert.areEqual("1,2,4,8,16,32,64,128,256", values.join(","));
    Assert.areEqual(0x1ff, values.reduce((all, t) => all | t, 0));
  }
}
