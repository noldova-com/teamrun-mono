/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProtocolVersion } from "@noldova/teamrun-protocol";
import { Endpoint, RuntimeLock } from "@noldova/teamrun-runtime";

@TestClass
export class RuntimeLockTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const lock = new RuntimeLock(12, Endpoint.socket("/tmp/s"), "tok", new ProtocolVersion(0, 1), "1.2.3", "2026-09-10T00:00:00.000Z",
      "build-a", "/opt/teamrun/teamrun");

    const read = RuntimeLock.fromJson(JSON.parse(JSON.stringify(lock.toJson())));

    Assert.areEqual(12, read.processId);
    Assert.areEqual("/tmp/s", read.endpoint.path);
    Assert.areEqual("tok", read.token);
    Assert.isTrue(read.protocolVersion.equals(new ProtocolVersion(0, 1)));
    Assert.areEqual("1.2.3", read.productVersion);
    Assert.areEqual("2026-09-10T00:00:00.000Z", read.startedAt);
    Assert.areEqual("build-a", read.build);
    Assert.areEqual("/opt/teamrun/teamrun", read.executablePath);
  }

  @TestMethod
  public readsALockFromBeforeBuildsWereRecorded(): void {
    const json = {
      processId: 12, endpoint: { kind: "Tcp", port: 4000, path: null }, token: "tok", protocolVersion: { major: 0, minor: 1 }, productVersion: "0.0.7",
      startedAt: "2026-09-10T00:00:00.000Z"
    };

    const read = RuntimeLock.fromJson(json);

    Assert.isUndefined(read.build);
    Assert.isUndefined(read.executablePath);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(read.toJson()));
  }

  @TestMethod
  public validatesItsFields(): void {
    const version = new ProtocolVersion(0, 1);

    Assert.throws(() => new RuntimeLock(0, Endpoint.tcp(1), "t", version, "v", "s"), ArgumentOutOfRangeException);
    Assert.areEqual("token", Assert.throws(() => new RuntimeLock(1, Endpoint.tcp(1), " ", version, "v", "s"), ArgumentException).parameterName);
    Assert.areEqual("productVersion", Assert.throws(() => new RuntimeLock(1, Endpoint.tcp(1), "t", version, "", "s"), ArgumentException).parameterName);
    Assert.areEqual("startedAt", Assert.throws(() => new RuntimeLock(1, Endpoint.tcp(1), "t", version, "v", ""), ArgumentException).parameterName);
    Assert.areEqual("build", Assert.throws(() => new RuntimeLock(1, Endpoint.tcp(1), "t", version, "v", "s", " "), ArgumentException).parameterName);
    Assert.areEqual("executablePath",
      Assert.throws(() => new RuntimeLock(1, Endpoint.tcp(1), "t", version, "v", "s", "b", ""), ArgumentException).parameterName);
  }
}
