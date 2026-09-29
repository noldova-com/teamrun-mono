/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";
import { ProtocolVersion } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";
import { Endpoint } from "./endpoint.js";

export class RuntimeLock {
  public readonly processId: number;
  public readonly endpoint: Endpoint;
  public readonly token: string;
  public readonly protocolVersion: ProtocolVersion;
  public readonly productVersion: string;
  public readonly startedAt: string;
  public readonly build?: string;
  public readonly executablePath?: string;

  public constructor(
    processId: number,
    endpoint: Endpoint,
    token: string,
    protocolVersion: ProtocolVersion,
    productVersion: string,
    startedAt: string,
    build?: string,
    executablePath?: string) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(processId, Resources.processIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenParameterName);
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersionParameterName);
    ArgumentException.throwIfNullOrWhitespace(startedAt, Resources.startedAtField);
    if (!Object.isUndefined(build))
      ArgumentException.throwIfNullOrWhitespace(build, Resources.buildField);
    if (!Object.isUndefined(executablePath))
      ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);

    this.processId = processId;
    this.endpoint = endpoint;
    this.token = token;
    this.protocolVersion = protocolVersion;
    this.productVersion = productVersion;
    this.startedAt = startedAt;
    if (!Object.isUndefined(build))
      this.build = build;
    if (!Object.isUndefined(executablePath))
      this.executablePath = executablePath;
  }

  public static fromJson(value: unknown, path?: string): RuntimeLock {
    const reader = JsonReader.fromValue(value, path);
    const endpoint = reader.readObject(Resources.endpointField);
    const version = reader.readObject(Resources.protocolVersionField);

    return new RuntimeLock(
      reader.readInteger(Resources.processIdField),
      Endpoint.fromJson(endpoint.toJson(), endpoint.path),
      reader.readNonBlankString(Resources.tokenField),
      ProtocolVersion.fromJson(version.toJson(), version.path),
      reader.readNonBlankString(Resources.productVersionField),
      reader.readNonBlankString(Resources.startedAtField),
      reader.readOptionalString(Resources.buildField),
      reader.readOptionalString(Resources.executablePathField));
  }

  public toJson(): JsonObject {
    const fields: Record<string, JsonValue> = {
      [Resources.processIdField]: this.processId,
      [Resources.endpointField]: this.endpoint.toJson(),
      [Resources.tokenField]: this.token,
      [Resources.protocolVersionField]: this.protocolVersion.toJson(),
      [Resources.productVersionField]: this.productVersion,
      [Resources.startedAtField]: this.startedAt
    };
    if (!Object.isUndefined(this.build))
      fields[Resources.buildField] = this.build;
    if (!Object.isUndefined(this.executablePath))
      fields[Resources.executablePathField] = this.executablePath;
    return fields;
  }
}
