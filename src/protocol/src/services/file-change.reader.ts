/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import { DetailKind } from "../enums/detail-kind.js";
import { DiffLineKind } from "../enums/diff-line-kind.js";
import { DiffLine } from "../models/diff-line.js";
import { FileEdit } from "../models/file-edit.js";
import type { Message } from "../models/message.js";
import type { MessageDetail } from "../models/message-detail.js";
import { Resources } from "../resources.js";

export class FileChangeReader {
  public editsOf(message: Message): readonly FileEdit[] {
    return this.editsIn(message.details);
  }

  public editsIn(details: readonly MessageDetail[]): readonly FileEdit[] {
    const edits: FileEdit[] = [];
    for (const detail of details) {
      if (!FileChangeReader.isJsonObject(detail.payload))
        continue;
      const changes = FileChangeReader.arrayOf(detail.payload[Resources.changesField]);
      if (detail.kind === DetailKind.FileChange && !Object.isNull(changes))
        edits.push(...FileChangeReader.readCodexChanges(changes));
      else
        edits.push(...FileChangeReader.readClaudeTool(detail.payload));
    }

    return FileChangeReader.merge(edits);
  }

  private static readCodexChanges(changes: readonly JsonValue[]): FileEdit[] {
    const edits: FileEdit[] = [];
    for (const change of changes) {
      if (!FileChangeReader.isJsonObject(change))
        continue;
      const path = change[Resources.pathField];
      if (!Object.isString(path) || String.isNullOrWhitespace(path))
        continue;
      const kind = change[Resources.kindField];
      const diff = change[Resources.diffField];
      const lines = Object.isString(diff) ? FileChangeReader.parseUnifiedDiff(diff) : [];
      edits.push(new FileEdit(path, FileChangeReader.kindOf(Object.isString(kind) ? kind : null), lines));
    }

    return edits;
  }

  private static readClaudeTool(payload: JsonObject): FileEdit[] {
    const tool = payload[Resources.toolField];
    const input = payload[Resources.inputField];
    if (!Object.isString(tool) || !FileChangeReader.isJsonObject(input))
      return [];
    const path = input[Resources.filePathField];
    if (!Object.isString(path) || String.isNullOrWhitespace(path))
      return [];
    switch (tool) {
      case Resources.editTool:
        return [new FileEdit(path, Resources.updateKind, FileChangeReader.replacementLines(input[Resources.oldStringField], input[Resources.newStringField]))];
      case Resources.multiEditTool:
        return [new FileEdit(path, Resources.updateKind, FileChangeReader.multiEditLines(FileChangeReader.arrayOf(input[Resources.editsField])))];
      case Resources.writeTool:
        return [new FileEdit(path, Resources.addKind, FileChangeReader.replacementLines(undefined, input[Resources.contentField]))];
      default:
        return [];
    }
  }

  private static multiEditLines(edits: readonly JsonValue[] | null): DiffLine[] {
    if (Object.isNull(edits))
      return [];

    return edits.flatMap(t => FileChangeReader.isJsonObject(t) ? FileChangeReader.replacementLines(t[Resources.oldStringField], t[Resources.newStringField]) : []);
  }

  private static replacementLines(before: JsonValue | undefined, after: JsonValue | undefined): DiffLine[] {
    const removed = Object.isString(before) ? before.split(Resources.lineSeparator).map(t => new DiffLine(DiffLineKind.Removed, t)) : [];
    const added = Object.isString(after) ? after.split(Resources.lineSeparator).map(t => new DiffLine(DiffLineKind.Added, t)) : [];

    return [...removed, ...added];
  }

  private static parseUnifiedDiff(diff: string): DiffLine[] {
    return diff.split(Resources.lineSeparator).filter(t => t.length > 0).map(line => {
      if (line.startsWith(Resources.diffAddedFilePrefix) || line.startsWith(Resources.diffRemovedFilePrefix) || line.startsWith(Resources.diffHunkPrefix))
        return new DiffLine(DiffLineKind.Meta, line);
      if (line.startsWith(Resources.diffAddedPrefix))
        return new DiffLine(DiffLineKind.Added, line.slice(1));
      if (line.startsWith(Resources.diffRemovedPrefix))
        return new DiffLine(DiffLineKind.Removed, line.slice(1));
      return new DiffLine(DiffLineKind.Context, line.startsWith(Resources.diffContextPrefix) ? line.slice(1) : line);
    });
  }

  private static kindOf(kind: string | null): string {
    if (Object.isNull(kind))
      return Resources.updateKind;
    return kind.startsWith(Resources.jsonObjectStart) ? Resources.moveKind : kind;
  }

  private static merge(edits: readonly FileEdit[]): readonly FileEdit[] {
    const merged = new Map<string, FileEdit>();
    for (const edit of edits) {
      const previous = merged.get(edit.path);
      merged.set(edit.path, Object.isUndefined(previous) ? edit : new FileEdit(edit.path, previous.kind, [...previous.lines, ...edit.lines]));
    }

    return [...merged.values()];
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private static arrayOf(value: JsonValue | undefined): readonly JsonValue[] | null {
    return Array.isArray(value) ? value : null;
  }
}
