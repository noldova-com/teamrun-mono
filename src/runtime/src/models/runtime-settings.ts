/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { EndpointKind } from "../enums/endpoint-kind.js";
import { Resources } from "../resources.js";

export class RuntimeSettings {
  public readonly dataDirectory: string;
  public readonly productVersion: string;
  public readonly endpointKind: EndpointKind;
  public readonly socketPath: string;
  public readonly idleGraceMilliseconds: number | null;

  public constructor(dataDirectory: string, productVersion: string, endpointKind: EndpointKind, socketPath: string, idleGraceMilliseconds: number | null) {
    ArgumentException.throwIfNullOrWhitespace(dataDirectory, Resources.dataDirectoryParameterName);
    if (!isAbsolute(dataDirectory))
      throw new ArgumentException(Resources.dataDirectoryNotAbsolute, Resources.dataDirectoryParameterName);
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersionParameterName);
    ArgumentException.throwIfNullOrWhitespace(socketPath, Resources.socketPathParameterName);
    if (!Object.isNull(idleGraceMilliseconds))
      ArgumentOutOfRangeException.throwIfNotPositiveInteger(idleGraceMilliseconds, Resources.idleGraceParameterName);

    this.dataDirectory = dataDirectory;
    this.productVersion = productVersion;
    this.endpointKind = endpointKind;
    this.socketPath = socketPath;
    this.idleGraceMilliseconds = idleGraceMilliseconds;
  }

  public static forPlatform(platform: string, dataDirectory: string, productVersion: string, idleGraceMilliseconds: number | null): RuntimeSettings {
    const windows = platform === Resources.windowsPlatform;
    const kind = windows ? EndpointKind.Tcp : EndpointKind.Socket;
    return new RuntimeSettings(dataDirectory, productVersion, kind, RuntimeSettings.createSocketPath(windows, dataDirectory), idleGraceMilliseconds);
  }

  public static createSocketPath(windows: boolean, dataDirectory: string): string {
    if (!windows)
      return join(dataDirectory, Resources.socketFileName);

    const hash = createHash(Resources.pipeHashAlgorithm).update(dataDirectory).digest(Resources.hexEncoding).slice(0, Resources.pipeHashLength);
    return `${Resources.windowsPipePrefix}${hash}`;
  }

  public get lockPath(): string {
    return join(this.dataDirectory, Resources.lockFileName);
  }

  public get processesPath(): string {
    return join(this.dataDirectory, Resources.processesFileName);
  }

  public get terminalsPath(): string {
    return join(this.dataDirectory, Resources.terminalsDirectoryName);
  }

}
