/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BridgeGateway, DesktopInfo, Resources, RuntimeConnection, SenderInfo, SenderPolicy, UpdateService, UpdateSettings } from "@noldova/teamrun-desktop";
import { AppUpdateCommand, AppUpdateState, AppUpdateStatus, ErrorCode, Event, EventName, MethodName, Request, Response } from "@noldova/teamrun-protocol";

import { DesktopTestHost } from "../fixtures/desktop-test-host.fixture.js";
import { FakeBridgeHost } from "../fixtures/fake-bridge-host.fixture.js";
import { RecordingForwarder } from "../fixtures/recording-forwarder.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";
import { FakeUpdateBackend } from "../fixtures/fake-update-backend.fixture.js";

@TestClass
export class BridgeGatewayTests {
  @TestMethod
  public acceptsOnlyTrustedUpdateCommandsWithoutAttachingToTheRuntime(): Promise<void> {
    return this.run(async (host, gateway, sender) => {
      Assert.isNull(await gateway.update(new SenderInfo("https://example.com/", true), AppUpdateCommand.Check));
      Assert.isNull(await gateway.update(sender, "unsupported"));
      Assert.isNull(await gateway.update(sender, { command: "check", url: "https://example.com/" }));
      Assert.areEqual(AppUpdateStatus.Disabled, AppUpdateState.fromJson(await gateway.update(sender, AppUpdateCommand.Status)).status);
      Assert.areEqual(0, host.attachCount);
    });
  }
  @TestMethod
  public forwardsTrustedRequestsToTheRuntime(): Promise<void> {
    return this.run(async (host, gateway, sender) => {
      await host.startRuntime();

      const success = Response.fromJson(await gateway.invoke(sender, new Request("r1", MethodName.ProviderList, null).toJson()));
      const failure = Response.fromJson(await gateway.invoke(sender, new Request("r2", "nothing/here", null).toJson()));

      Assert.areEqual("r1", success.id);
      Assert.isFalse(success.hasErrors);
      Assert.areEqual("r2", failure.id);
      Assert.isTrue(failure.hasErrors);
      Assert.isNotNull(failure.info);
      Assert.areEqual(ErrorCode.UnknownMethod, failure.info.name);
    });
  }

  @TestMethod
  public refusesUntrustedSendersAndMalformedRequests(): Promise<void> {
    return this.run(async (host, gateway, sender) => {
      const stranger = new SenderInfo("https://example.com/", true);
      const untrusted = Response.fromJson(await gateway.invoke(stranger, new Request("r1", MethodName.ProviderList, null).toJson()));
      const malformed = Response.fromJson(await gateway.invoke(sender, { kind: "Request" }));

      Assert.isNull(untrusted.id);
      Assert.isNotNull(untrusted.info);
      Assert.areEqual(ErrorCode.Unauthorized, untrusted.info.name);
      Assert.areEqual(Resources.untrustedSender, untrusted.info.message);
      Assert.isNull(malformed.id);
      Assert.isNotNull(malformed.info);
      Assert.areEqual(ErrorCode.InvalidParams, malformed.info.name);
      Assert.areEqual(0, host.attachCount);
    });
  }

  @TestMethod
  public reportsAnUnreachableRuntimeAsAFailure(): Promise<void> {
    return this.run(async (host, gateway, sender) => {
      host.failNextAttach = new Error("boom");

      const response = Response.fromJson(await gateway.invoke(sender, new Request("r1", MethodName.ProviderList, null).toJson()));

      Assert.areEqual("r1", response.id);
      Assert.isNotNull(response.info);
      Assert.areEqual(ErrorCode.Unavailable, response.info.name);
      Assert.areEqual(Resources.formatRuntimeFailure("boom"), response.info.message);
    });
  }

  @TestMethod
  public opensOnlyWebUrlsForTrustedSenders(): Promise<void> {
    return this.run(async (host, gateway, sender, bridgeHost) => {
      Assert.isTrue(await gateway.openExternal(sender, "https://teamrun.ai/docs"));
      Assert.isTrue(await gateway.openExternal(sender, "http://localhost:8080/"));
      Assert.isFalse(await gateway.openExternal(sender, "file:///etc/passwd"));
      Assert.isFalse(await gateway.openExternal(sender, "javascript:alert(1)"));
      Assert.isFalse(await gateway.openExternal(sender, "not a url"));
      Assert.isFalse(await gateway.openExternal(sender, 42));
      Assert.isFalse(await gateway.openExternal(new SenderInfo("https://example.com/", true), "https://teamrun.ai/"));

      Assert.areEqual("https://teamrun.ai/docs,http://localhost:8080/", bridgeHost.openedUrls.join(","));
      Assert.areEqual(0, host.attachCount);
    });
  }

  @TestMethod
  public picksDirectoriesForTrustedSendersOnly(): Promise<void> {
    return this.run(async (_host, gateway, sender, bridgeHost) => {
      bridgeHost.pickedDirectory = "D:\\repo";

      Assert.areEqual("D:\\repo", await gateway.pickDirectory(sender));
      Assert.isNull(await gateway.pickDirectory(new SenderInfo("https://example.com/", true)));
      Assert.areEqual(1, bridgeHost.pickCount);
    });
  }

  @TestMethod
  public describesItselfToTrustedSendersOnly(): Promise<void> {
    return this.run(async (host, gateway, sender) => {
      const described = await gateway.describe(sender);
      const refused = await gateway.describe(new SenderInfo("https://example.com/", true));

      Assert.isTrue(Object.isObject(described));
      const expected = new DesktopInfo(host.directory.resolve("data"), DesktopTestHost.PRODUCT_VERSION, process.platform);
      Assert.areEqual(JSON.stringify(expected.toJson()), JSON.stringify(described));
      Assert.isNull(refused);
    });
  }

  @TestMethod
  public recoloursTheTitleBarForTrustedSendersWithValidColours(): Promise<void> {
    return this.run(async (_host, gateway, sender, bridgeHost) => {
      Assert.isTrue(await gateway.setTitleBar(sender, "#1a1b1f", "#E3E2E6"));
      Assert.isFalse(await gateway.setTitleBar(sender, "red", "#e3e2e6"));
      Assert.isFalse(await gateway.setTitleBar(sender, "#1a1b1f", 12));
      Assert.isFalse(await gateway.setTitleBar(new SenderInfo("https://example.com/", true), "#1a1b1f", "#e3e2e6"));

      Assert.areEqual(1, bridgeHost.titleBars.length);
      Assert.areEqual("#1a1b1f", bridgeHost.titleBars[0]?.color);
    });
  }

  @TestMethod
  public servesImagesOnlyFromInsideKnownProjects(): Promise<void> {
    return this.run(async (host, gateway, sender) => {
      await host.startRuntime();
      const repo = host.directory.resolve("repo");
      mkdirSync(repo, { recursive: true });
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
      writeFileSync(join(repo, "shot.png"), png);
      writeFileSync(join(repo, "notes.txt"), "text");
      writeFileSync(join(repo, "huge.png"), Buffer.alloc(Resources.maximumImageBytes + 1));
      writeFileSync(host.directory.resolve("outside.png"), png);
      const opened = Response.fromJson(await gateway.invoke(sender, new Request("r1", MethodName.ProjectOpen, { rootPath: repo }).toJson()));
      Assert.isFalse(opened.hasErrors);

      Assert.areEqual(`data:image/png;base64,${png.toString("base64")}`, await gateway.readImage(sender, join(repo, "shot.png")));
      Assert.isNull(await gateway.readImage(sender, join(repo, "notes.txt")));
      Assert.isNull(await gateway.readImage(sender, join(repo, "huge.png")));
      Assert.isNull(await gateway.readImage(sender, join(repo, "missing.png")));
      Assert.isNull(await gateway.readImage(sender, host.directory.resolve("outside.png")));
      const outside = host.directory.resolve("outside");
      mkdirSync(outside);
      writeFileSync(join(outside, "hidden.png"), png);
      symlinkSync(outside, join(repo, "linked"), process.platform === "win32" ? "junction" : "dir");
      Assert.isNull(await gateway.readImage(sender, join(repo, "linked", "hidden.png")));
      mkdirSync(host.directory.resolve("data", "images"), { recursive: true });
      writeFileSync(host.directory.resolve("data", "images", "stored.png"), png);
      const stored = host.directory.resolve("data", "images", "stored.png");
      Assert.areEqual(`data:image/png;base64,${png.toString("base64")}`, await gateway.readImage(sender, stored));
      mkdirSync(host.directory.resolve("data", "attachments"), { recursive: true });
      const attachment = host.directory.resolve("data", "attachments", "attached.png");
      writeFileSync(attachment, png);
      Assert.areEqual(`data:image/png;base64,${png.toString("base64")}`, await gateway.readImage(sender, attachment));
      symlinkSync(outside, host.directory.resolve("data", "attachments", "linked"), process.platform === "win32" ? "junction" : "dir");
      Assert.isNull(await gateway.readImage(sender, host.directory.resolve("data", "attachments", "linked", "hidden.png")));
      Assert.isNull(await gateway.readImage(sender, host.directory.resolve("data", "teamrun.png")));
      Assert.isNull(await gateway.readImage(sender, repo));
      Assert.isNull(await gateway.readImage(sender, "relative/shot.png"));
      Assert.isNull(await gateway.readImage(sender, 42));
      Assert.isNull(await gateway.readImage(new SenderInfo("https://example.com/", true), join(repo, "shot.png")));
    });
  }

  @TestMethod
  public refusesImagesWhenTheRuntimeIsUnavailable(): Promise<void> {
    return this.run(async (host, gateway, sender) => {
      host.failNextAttach = new Error("down");
      Assert.isNull(await gateway.readImage(sender, host.directory.resolve("shot.png")));
    });
  }

  @TestMethod
  public broadcastsRuntimeEventsThroughTheHost(): Promise<void> {
    return this.run(async (host, gateway, sender, bridgeHost) => {
      await host.startRuntime();
      const open = new Request("r1", MethodName.ProjectOpen, { rootPath: host.directory.resolve("repo") });
      const opened = Response.fromJson(await gateway.invoke(sender, open.toJson()));
      Assert.isFalse(opened.hasErrors);

      for (const client of host.clients)
        client.close();
      await Wait.until(() => host.clients.every(t => !t.isConnected));
      gateway.forward(new Event(EventName.MessageCreated, { id: "m1" }));

      Assert.areEqual(Resources.eventChannel, bridgeHost.broadcasts[0]?.channel);
      Assert.areEqual(EventName.MessageCreated, Event.fromJson(bridgeHost.broadcasts.at(-1)?.payload).name);
    });
  }

  private async run(body: (host: DesktopTestHost, gateway: BridgeGateway, sender: SenderInfo, bridgeHost: FakeBridgeHost) => Promise<void>): Promise<void> {
    await using host = new DesktopTestHost();
    const settings = host.createSettings();
    const bridgeHost = new FakeBridgeHost();
    const connection = new RuntimeConnection(host, new RecordingForwarder(), "desktop-test");
    const info = new DesktopInfo(settings.dataDirectory, settings.productVersion, process.platform);
    const updates = new UpdateService(UpdateSettings.fromEnvironment({}, false, process.platform, process.arch, true), "0.0.1", new FakeUpdateBackend(), () => undefined);
    const gateway = new BridgeGateway(new SenderPolicy(settings), connection, bridgeHost, info, updates);
    const forwarding = new RuntimeConnection(host, gateway, "desktop-forwarding");
    const forwardingGateway = new BridgeGateway(new SenderPolicy(settings), forwarding, bridgeHost, info, updates);
    try {
      await body(host, forwardingGateway, new SenderInfo(pathToFileURL(settings.rendererIndexPath).href, true), bridgeHost);
    }
    finally {
      connection.close();
      forwarding.close();
      updates.dispose();
    }
  }
}
