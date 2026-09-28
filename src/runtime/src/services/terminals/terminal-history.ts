/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FileHandle, open, rm } from "node:fs/promises";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode, TerminalLine, TerminalLinePage, TerminalLineRange } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources.js";

export class TerminalHistory {
  private readonly path: string;
  private readonly onWritten: () => void;
  private handle: FileHandle | null = null;
  private queue: Promise<void> = Promise.resolve();
  private batch: string[] | null = null;
  private blockOffsets: number[] = [];
  private start: number = 0;
  private end: number = 0;
  private size: number = 0;
  private written: number = 0;
  private unwritten: number = 0;
  private failure: ServiceException | null = null;

  public constructor(path: string, onWritten: () => void) {
    this.path = path;
    this.onWritten = onWritten;
  }

  public get stored(): TerminalLineRange {
    return new TerminalLineRange(this.start, this.end);
  }

  public get backlog(): number {
    return this.unwritten;
  }

  public append(line: TerminalLine): void {
    if (!Object.isNull(this.failure))
      return;

    const text = `${JSON.stringify(line.toJson())}${Resources.lineSeparator}`;
    const bytes = Buffer.byteLength(text, Resources.utf8Encoding);
    if ((this.end - this.start) % Resources.terminalHistoryBlockLines === 0)
      this.blockOffsets.push(this.size);
    this.size += bytes;
    this.unwritten += bytes;
    this.end += 1;
    if (Object.isNull(this.batch)) {
      const batch: string[] = [];
      this.batch = batch;
      void this.enqueue(() => this.write(batch));
    }
    this.batch.push(text);
  }

  public clear(): void {
    if (!Object.isNull(this.batch)) {
      this.unwritten -= Buffer.byteLength(this.batch.join(String.empty), Resources.utf8Encoding);
      this.batch.length = 0;
      this.batch = null;
    }
    this.start = this.end;
    this.size = 0;
    this.blockOffsets = [];
    void this.enqueue(() => this.truncate());
  }

  public read(start: number, limit: number): Promise<TerminalLinePage> {
    return this.enqueue(() => this.readPage(start, limit));
  }

  public close(): Promise<void> {
    if (!Object.isNull(this.batch)) {
      this.batch.length = 0;
      this.batch = null;
    }
    return this.enqueue(() => this.remove());
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async write(batch: string[]): Promise<void> {
    if (this.batch === batch)
      this.batch = null;
    const text = batch.join(String.empty);
    batch.length = 0;
    if (text.length === 0)
      return;

    const buffer = Buffer.from(text, Resources.utf8Encoding);
    try {
      await (await this.file()).write(buffer, 0, buffer.length, this.written);
      this.written += buffer.length;
    }
    catch (error) {
      this.fail(error);
    }
    this.unwritten -= buffer.length;
    this.onWritten();
  }

  private async truncate(): Promise<void> {
    try {
      await (await this.file()).truncate(0);
    }
    catch (error) {
      this.fail(error);
    }
    this.written = 0;
  }

  private async readPage(start: number, limit: number): Promise<TerminalLinePage> {
    const stored = this.stored;
    const offsets = this.blockOffsets;
    if (!Object.isNull(this.batch))
      await this.write(this.batch);
    if (!Object.isNull(this.failure))
      throw this.failure;

    const first = Math.min(Math.max(start, stored.start), stored.end);
    const count = Math.min(limit, stored.end - first);
    const lines: TerminalLine[] = [];
    const relative = first - stored.start;
    const block = Math.floor(relative / Resources.terminalHistoryBlockLines);
    let skip = relative - block * Resources.terminalHistoryBlockLines;
    let position = offsets[block] ?? this.written;
    let pending = Buffer.alloc(0);
    const chunk = Buffer.alloc(Resources.terminalHistoryReadBytes);
    while (lines.length < count) {
      const { bytesRead } = await (await this.file()).read(chunk, 0, chunk.length, position);
      if (bytesRead === 0)
        throw new ServiceException(ErrorCode.Internal, Resources.storedLinesDamaged);
      position += bytesRead;
      let data = Buffer.concat([pending, chunk.subarray(0, bytesRead)]);
      let newline = data.indexOf(Resources.lineFeedByte);
      while (newline >= 0 && lines.length < count) {
        if (skip > 0)
          skip -= 1;
        else
          lines.push(TerminalLine.fromJson(JSON.parse(data.subarray(0, newline).toString(Resources.utf8Encoding))));
        data = data.subarray(newline + 1);
        newline = data.indexOf(Resources.lineFeedByte);
      }
      pending = data;
    }

    return new TerminalLinePage(first, lines, stored);
  }

  private async remove(): Promise<void> {
    if (!Object.isNull(this.handle))
      await this.handle.close();
    this.handle = null;
    await rm(this.path, { force: true });
  }

  private fail(error: unknown): void {
    this.failure = new ServiceException(ErrorCode.Unavailable, Resources.storedLinesFailed, [], new ExceptionOptions(error));
  }

  private async file(): Promise<FileHandle> {
    if (Object.isNull(this.handle))
      this.handle = await open(this.path, Resources.terminalHistoryFlags, Resources.terminalHistoryMode);
    return this.handle;
  }
}
