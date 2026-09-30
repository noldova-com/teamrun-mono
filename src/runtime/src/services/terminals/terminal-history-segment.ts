/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FileHandle, open, rm } from "node:fs/promises";

import "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode, TerminalLine } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources.js";

export class TerminalHistorySegment {
  public readonly path: string;
  public readonly first: number;
  private readonly blockOffsets: number[] = [];
  private handle: FileHandle | null = null;
  private batch: string[] = [];
  private lines: number = 0;
  private bytes: number = 0;
  private batchBytes: number = 0;
  private written: number = 0;

  public constructor(path: string, first: number) {
    this.path = path;
    this.first = first;
  }

  public get end(): number {
    return this.first + this.lines;
  }

  public get size(): number {
    return this.bytes;
  }

  public get hasBatch(): boolean {
    return this.batch.length > 0;
  }

  public append(text: string, bytes: number): void {
    if (this.lines % Resources.terminalHistoryBlockLines === 0)
      this.blockOffsets.push(this.bytes);
    this.lines += 1;
    this.bytes += bytes;
    this.batchBytes += bytes;
    this.batch.push(text);
  }

  public discard(): number {
    const bytes = this.batchBytes;
    this.batch = [];
    this.batchBytes = 0;
    return bytes;
  }

  public take(): Buffer {
    const buffer = Buffer.from(this.batch.join(String.empty), Resources.utf8Encoding);
    this.discard();
    return buffer;
  }

  public async write(buffer: Buffer): Promise<void> {
    await (await this.file()).write(buffer, 0, buffer.length, this.written);
    this.written += buffer.length;
  }

  public async read(start: number, count: number): Promise<TerminalLine[]> {
    const lines: TerminalLine[] = [];
    const relative = start - this.first;
    const block = Math.floor(relative / Resources.terminalHistoryBlockLines);
    let skip = relative - block * Resources.terminalHistoryBlockLines;
    let position = this.blockOffsets[block] ?? this.written;
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
    return lines;
  }

  public async remove(): Promise<void> {
    if (!Object.isNull(this.handle))
      await this.handle.close();
    this.handle = null;
    await rm(this.path, { force: true });
  }

  private async file(): Promise<FileHandle> {
    if (Object.isNull(this.handle))
      this.handle = await open(this.path, Resources.terminalHistoryFlags, Resources.terminalHistoryMode);
    return this.handle;
  }
}
