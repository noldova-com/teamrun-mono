/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import "@noldova/teamrun-foundation-core";
import {
  type ApprovalAsk,
  type ForkRequest,
  type IProviderAdapter,
  type ITurnListener,
  SignInCheck,
  TurnDetail,
  type TurnRequest,
  TurnResult,
  TurnStart,
  TurnOutcome
} from "@noldova/teamrun-core";
import { AuthStatus, DetailKind, ObservedSettings, type ProviderAccount, ProviderAccountIdentity, ProviderDescriptor, ProviderModel } from "@noldova/teamrun-protocol";
import { RoleApplication } from "@noldova/teamrun-protocol";

export class FakeProviderAdapter implements IProviderAdapter {
  public readonly descriptor: ProviderDescriptor;
  public readonly requests: TurnRequest[] = [];
  public lastListener: ITurnListener | null = null;
  public readonly checkedAccounts: ProviderAccount[] = [];
  public signInCheck: SignInCheck = new SignInCheck(AuthStatus.LoggedIn, new ProviderAccountIdentity("dev@example.com", "plus"), "1.0.0", null);
  public models: readonly string[] = ["fake-small", "fake-large"];
  public listModelsFailure: unknown = null;
  public detailTexts: readonly string[] = ["Working"];
  public streamedTexts: readonly string[] = [];
  public thinkingBeforeDetails: number = 0;
  public thinkingAfterDetails: number = 0;
  public approvalAsk: ApprovalAsk | null = null;
  public approvalAsks: readonly ApprovalAsk[] = [];
  public afterDetails: (() => void) | null = null;
  public outcome: TurnOutcome = TurnOutcome.Completed;
  public error: string | null = null;
  public failWith: unknown = null;
  public failBeforeStart: boolean = false;
  public holdUntilAbort: boolean = false;
  public writeFiles: Readonly<Record<string, string>> = {};
  public extraDetails: readonly TurnDetail[] = [];
  public shutdowns: number = 0;
  public readonly forkRequests: ForkRequest[] = [];
  public forkFailure: unknown = null;
  public reportsTurnIds: boolean = true;

  public constructor(id: string = "fake", supportsFork: boolean = false) {
    this.descriptor = new ProviderDescriptor(id, "Fake provider", ["low", "high"], true, true, supportsFork);
  }

  public forkSession(request: ForkRequest): Promise<string> {
    this.forkRequests.push(request);
    if (!Object.isNull(this.forkFailure))
      return Promise.reject(this.forkFailure);

    return Promise.resolve(`fork-${this.forkRequests.length}`);
  }

  public checkSignIn(account: ProviderAccount): Promise<SignInCheck> {
    this.checkedAccounts.push(account);
    return Promise.resolve(this.signInCheck);
  }

  public listModels(_account: ProviderAccount | null): Promise<readonly ProviderModel[]> {
    if (!Object.isNull(this.listModelsFailure))
      return Promise.reject(this.listModelsFailure);

    return Promise.resolve(this.models.map((id, index) => new ProviderModel(id, id, "Fixture", ["medium", "high"], index === 0, null, true)));
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    this.lastListener = listener;
    this.requests.push(request);
    if (this.failBeforeStart)
      throw new Error("Fixture failed before starting a session");
    const sessionId = request.resumeNativeSessionId ?? `session-${this.requests.length}`;
    const turnId = this.reportsTurnIds ? `turn-${this.requests.length}` : null;
    const observed = new ObservedSettings(this.descriptor.id, "fake-large", "high", "1.0.0", null);
    listener.onStarted(new TurnStart(sessionId, !Object.isNull(request.resumeNativeSessionId),
      Object.isNull(request.instructions) ? null : RoleApplication.Instructions));
    listener.onObserved(observed);
    if (!Object.isNull(this.failWith))
      throw this.failWith;
    for (const [name, content] of Object.entries(this.writeFiles)) {
      const path = join(request.workingDirectory, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    for (let index = 0; index < this.thinkingBeforeDetails; index++)
      listener.onThinking();
    for (const detail of this.extraDetails)
      listener.onDetail(detail);
    for (const text of this.detailTexts)
      listener.onDetail(new TurnDetail(DetailKind.Text, text, null, null));
    for (const text of this.streamedTexts)
      listener.onDetail(new TurnDetail(DetailKind.Text, text, null, "streamed-item"));
    for (let index = 0; index < this.thinkingAfterDetails; index++)
      listener.onThinking();
    if (!Object.isNull(this.approvalAsk)) {
      const optionId = await listener.onApprovalRequested(this.approvalAsk);
      listener.onDetail(new TurnDetail(DetailKind.Note, `decided ${optionId}`, null, null));
    }
    await Promise.all(this.approvalAsks.map(async t => {
      const optionId = await listener.onApprovalRequested(t);
      listener.onDetail(new TurnDetail(DetailKind.Note, `${t.providerRequestId}: ${optionId}`, null, null));
    }));
    this.afterDetails?.();
    if (this.holdUntilAbort)
      await FakeProviderAdapter.waitForAbort(signal);
    if (signal.aborted)
      return new TurnResult(TurnOutcome.Interrupted, sessionId, observed, null, turnId);

    return new TurnResult(this.outcome, sessionId, observed, this.error, turnId);
  }

  public shutdown(): Promise<void> {
    this.shutdowns += 1;
    return Promise.resolve();
  }

  private static waitForAbort(signal: AbortSignal): Promise<void> {
    if (signal.aborted)
      return Promise.resolve();

    return new Promise(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  }
}
