/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode, TerminalLine, TerminalLinePage, TerminalLineRange } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources.js";
import { TerminalHistorySegment } from "./terminal-history-segment.js";

export class TerminalHistory {
  private readonly paths: readonly [string, string];
  private readonly segmentLimit: number;
  private readonly onWritten: () => void;
  private queue: Promise<void> = Promise.resolve();
  private older: TerminalHistorySegment | null = null;
  private newer: TerminalHistorySegment;
  private dropped: number = 0;
  private unwritten: number = 0;
  private failure: ServiceException | null = null;

  public constructor(paths: readonly [string, string], limit: number, onWritten: () => void) {
    this.paths = paths;
    this.segmentLimit = Math.floor(limit / 2);
    this.onWritten = onWritten;
    this.newer = new TerminalHistorySegment(paths[0], 0);
  }

  public get stored(): TerminalLineRange {
    return new TerminalLineRange(this.older?.first ?? this.newer.first, this.newer.end, this.dropped);
  }

  public get backlog(): number {
    return this.unwritten;
  }

  public append(line: TerminalLine): void {
    if (!Object.isNull(this.failure))
      return;

    const text = `${JSON.stringify(line.toJson())}${Resources.lineSeparator}`;
    const bytes = Buffer.byteLength(text, Resources.utf8Encoding);
    if (this.newer.size > 0 && this.newer.size + bytes > this.segmentLimit)
      this.rotate();
    const segment = this.newer;
    if (!segment.hasBatch)
      void this.enqueue(() => this.write(segment));
    segment.append(text, bytes);
    this.unwritten += bytes;
  }

  public clear(): void {
    const end = this.newer.end;
    if (!Object.isNull(this.older))
      this.discard(this.older);
    this.discard(this.newer);
    this.older = null;
    this.newer = new TerminalHistorySegment(this.paths[0], end);
    this.dropped = 0;
  }

  public read(start: number, limit: number): Promise<TerminalLinePage> {
    return this.enqueue(() => this.readPage(start, limit));
  }

  public close(): Promise<void> {
    if (!Object.isNull(this.older))
      this.discard(this.older);
    this.unwritten -= this.newer.discard();
    return this.enqueue(() => this.newer.remove());
  }

  private rotate(): void {
    const path = Object.isNull(this.older) ? this.paths[1] : this.older.path;
    if (!Object.isNull(this.older)) {
      this.dropped += this.older.end - this.older.first;
      this.discard(this.older);
    }
    this.older = this.newer;
    this.newer = new TerminalHistorySegment(path, this.older.end);
  }

  private discard(segment: TerminalHistorySegment): void {
    this.unwritten -= segment.discard();
    void this.enqueue(() => segment.remove()).catch((error: unknown) => this.fail(error));
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private write(segment: TerminalHistorySegment): Promise<void> {
    return this.store(segment, segment.take());
  }

  private async store(segment: TerminalHistorySegment, buffer: Buffer): Promise<void> {
    if (buffer.length === 0)
      return;

    try {
      await segment.write(buffer);
    }
    catch (error) {
      this.fail(error);
    }
    this.unwritten -= buffer.length;
    this.onWritten();
  }

  private fail(error: unknown): void {
    this.failure = new ServiceException(ErrorCode.Unavailable, Resources.storedLinesFailed, [], new ExceptionOptions(error));
  }

  private async readPage(start: number, limit: number): Promise<TerminalLinePage> {
    const stored = this.stored;
    const segments = Object.isNull(this.older) ? [this.newer] : [this.older, this.newer];
    const pending = segments.map(t => [t, t.take()] as const);
    for (const [segment, buffer] of pending)
      await this.store(segment, buffer);
    if (!Object.isNull(this.failure))
      throw this.failure;

    const first = Math.min(Math.max(start, stored.start), stored.end);
    const last = Math.min(first + limit, stored.end);
    const lines: TerminalLine[] = [];
    for (const segment of segments) {
      const from = Math.min(Math.max(first, segment.first), segment.end);
      lines.push(...await segment.read(from, Math.max(Math.min(last, segment.end) - from, 0)));
    }
    return new TerminalLinePage(first, lines, stored);
  }
}
