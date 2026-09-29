/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { RuntimeAlreadyRunningException } from "../../exceptions/runtime-already-running.exception.js";
import { RuntimeLock } from "../../models/runtime-lock.js";
import { Resources } from "../../resources.js";
import type { ProcessProbe } from "./process-probe.js";

export class LockFile implements Disposable {
  public readonly path: string;
  private readonly probe: ProcessProbe;
  private ownership: DatabaseSync | null = null;

  public constructor(path: string, probe: ProcessProbe) {
    ArgumentException.throwIfNullOrWhitespace(path, Resources.pathParameterName);

    this.path = path;
    this.probe = probe;
  }

  public read(): RuntimeLock | null {
    let text: string;
    try {
      text = readFileSync(this.path, Resources.utf8Encoding);
    }
    catch {
      return null;
    }
    try {
      return RuntimeLock.fromJson(JSON.parse(text));
    }
    catch {
      return null;
    }
  }

  public readLive(): RuntimeLock | null {
    const lock = this.read();
    return !Object.isNull(lock) && this.probe.isAlive(lock.processId) ? lock : null;
  }

  public isHeld(): boolean {
    const ownership = new DatabaseSync(`${this.path}${Resources.ownershipFileSuffix}`);
    try {
      ownership.exec(Resources.acquireOwnershipStatement);
      ownership.exec(Resources.releaseOwnershipStatement);
      return false;
    }
    catch (error) {
      if (Object.isObject(error) && Resources.sqliteErrorCodeField in error && error[Resources.sqliteErrorCodeField] === Resources.sqliteBusyCode)
        return true;
      throw error;
    }
    finally {
      ownership.close();
    }
  }

  public claim(): void {
    if (!Object.isNull(this.ownership))
      return;

    mkdirSync(dirname(this.path), { recursive: true });
    const ownership = new DatabaseSync(`${this.path}${Resources.ownershipFileSuffix}`);
    try {
      ownership.exec(Resources.acquireOwnershipStatement);
      const existing = this.readLive();
      if (!Object.isNull(existing))
        throw new RuntimeAlreadyRunningException(existing);
      this.ownership = ownership;
    }
    catch (error) {
      ownership.close();
      const existing = this.readLive();
      if (!Object.isNull(existing))
        throw new RuntimeAlreadyRunningException(existing);
      throw error;
    }
  }

  public acquire(lock: RuntimeLock): void {
    this.claim();
    const existing = this.readLive();
    if (!Object.isNull(existing) && (existing.processId !== lock.processId || existing.token !== lock.token))
      throw new RuntimeAlreadyRunningException(existing);

    mkdirSync(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}${Resources.lockTemporarySuffix}`;
    const text = `${JSON.stringify(lock.toJson())}${Resources.lineSeparator}`;
    writeFileSync(temporaryPath, text, { encoding: Resources.utf8Encoding, mode: Resources.lockFileMode });
    renameSync(temporaryPath, this.path);
  }

  public discard(lock: RuntimeLock): void {
    const current = this.read();
    if (!Object.isNull(current) && current.processId === lock.processId && current.token === lock.token)
      rmSync(this.path, { force: true });
  }

  public release(processId: number): void {
    const lock = this.read();
    if (!Object.isNull(lock) && lock.processId === processId) {
      rmSync(this.path, { force: true });
      this[Symbol.dispose]();
    }
  }

  public [Symbol.dispose](): void {
    this.ownership?.close();
    this.ownership = null;
  }
}
