/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import TrustedSigningModule from "./trusted-signing-module.ts";

export default function windowsSignHook(configuration: { readonly path: string }): Promise<void> {
  return new TrustedSigningModule().signFileAsync(configuration.path);
}
