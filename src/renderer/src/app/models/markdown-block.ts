/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MarkdownBlock {
  public readonly html: string;
  public readonly count: number;

  public constructor(html: string, count: number) {
    this.html = html;
    this.count = count;
  }
}
