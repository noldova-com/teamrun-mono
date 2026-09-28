/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { TerminalLineRange } from "./terminal-line-range.js";
import { TerminalSize } from "./terminal-size.js";

export class TerminalState {
  public readonly id: string;
  public readonly projectId: string;
  public readonly shell: string;
  public readonly conptyBuild: number | null;
  public readonly size: TerminalSize;
  public readonly exitCode: number | null;
  public readonly restartCount: number;
  public readonly sequence: number;
  public readonly stored: TerminalLineRange;

  public constructor(
    id: string,
    projectId: string,
    shell: string,
    conptyBuild: number | null,
    size: TerminalSize,
    exitCode: number | null,
    restartCount: number,
    sequence: number,
    stored: TerminalLineRange) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);
    ArgumentException.throwIfNullOrWhitespace(shell, Resources.shellField);
    if (!Object.isNull(conptyBuild) && (!Number.isInteger(conptyBuild) || conptyBuild < 1))
      throw new ArgumentOutOfRangeException(Resources.conptyBuildField, conptyBuild);
    if (!Object.isNull(exitCode) && !Number.isInteger(exitCode))
      throw new ArgumentOutOfRangeException(Resources.exitCodeField, exitCode);
    if (!Number.isInteger(restartCount) || restartCount < 0)
      throw new ArgumentOutOfRangeException(Resources.restartCountField, restartCount);
    if (!Number.isInteger(sequence) || sequence < 0)
      throw new ArgumentOutOfRangeException(Resources.sequenceField, sequence);

    this.id = id;
    this.projectId = projectId;
    this.shell = shell;
    this.conptyBuild = conptyBuild;
    this.size = size;
    this.exitCode = exitCode;
    this.restartCount = restartCount;
    this.sequence = sequence;
    this.stored = stored;
  }

  public static fromJson(value: unknown, path?: string): TerminalState {
    const reader = JsonReader.fromValue(value, path);
    const size = reader.readObject(Resources.sizeField);
    const stored = reader.readObject(Resources.storedField);
    return new TerminalState(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.projectIdField),
      reader.readNonBlankString(Resources.shellField),
      reader.readNullableInteger(Resources.conptyBuildField),
      TerminalSize.fromJson(size.toJson(), size.path),
      reader.readNullableInteger(Resources.exitCodeField),
      reader.readInteger(Resources.restartCountField),
      reader.readInteger(Resources.sequenceField),
      TerminalLineRange.fromJson(stored.toJson(), stored.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.projectIdField]: this.projectId,
      [Resources.shellField]: this.shell,
      [Resources.conptyBuildField]: this.conptyBuild,
      [Resources.sizeField]: this.size.toJson(),
      [Resources.exitCodeField]: this.exitCode,
      [Resources.restartCountField]: this.restartCount,
      [Resources.sequenceField]: this.sequence,
      [Resources.storedField]: this.stored.toJson()
    };
  }
}
