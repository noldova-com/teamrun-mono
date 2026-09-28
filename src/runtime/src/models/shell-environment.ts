/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ShellEnvironment {
  private readonly ignoresCase: boolean;
  private readonly variables: Map<string, readonly [string, string]> = new Map();

  public constructor(ignoresCase: boolean) {
    this.ignoresCase = ignoresCase;
  }

  public get(name: string): string | undefined {
    return this.variables.get(this.keyOf(name))?.[1];
  }

  public set(name: string, value: string): void {
    this.variables.set(this.keyOf(name), [name, value]);
  }

  public delete(name: string): void {
    this.variables.delete(this.keyOf(name));
  }

  public toRecord(): Record<string, string> {
    return Object.fromEntries(this.variables.values());
  }

  private keyOf(name: string): string {
    return this.ignoresCase ? name.toUpperCase() : name;
  }
}
