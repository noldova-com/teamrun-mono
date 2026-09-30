/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class TerminalHistoryFiles {
  public static in(directory: TemporaryDirectory, name: string): [string, string] {
    return [directory.resolve(`${name}-1.jsonl`), directory.resolve(`${name}-2.jsonl`)];
  }
}
