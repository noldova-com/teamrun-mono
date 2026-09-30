/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

export class UpdateSignatureException extends Exception {
  public constructor(message: string, cause?: unknown) {
    super(message, new ExceptionOptions(cause));
  }
}
