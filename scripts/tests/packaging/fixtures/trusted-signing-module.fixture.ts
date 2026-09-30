/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageScriptFixture from "../../fixtures/package-script.fixture.ts";
import TrustedSigningModule from "../../../packaging/trusted-signing-module.ts";

export default class TrustedSigningModuleFixture extends TrustedSigningModule {
  public static readonly preparations: number[] = [];

  public override async prepareAsync(): Promise<void> {
    TrustedSigningModuleFixture.preparations.push(PackageScriptFixture.npmCommands.length);
  }
}
