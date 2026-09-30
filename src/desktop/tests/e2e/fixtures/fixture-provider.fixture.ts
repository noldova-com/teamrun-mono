/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ApprovalAsk, type ForkRequest, type IProviderAdapter, type ITurnListener, SignInCheck,
  TurnDetail, TurnOutcome, type TurnRequest, TurnResult, TurnStart
} from "@noldova/teamrun-core";
import {
  ApprovalKind, ApprovalOption, ApprovalOutcome, AuthStatus, DetailKind, ObservedSettings,
  type ProviderAccount, ProviderAccountIdentity, ProviderDescriptor, ProviderModel
} from "@noldova/teamrun-protocol";

export class FixtureProvider implements IProviderAdapter {
  public static readonly streamedThought: string = "Thinking about how to answer this request carefully.";
  public static readonly streamedAnswer: string = "Here is **bold text**, some `inline code` and [a link](https://example.com/a_b).\n\n| Name | Value |\n|---|---|\n| one | 1 |\n\n"
    + "```ts\nlet x = 1;\n```\n\nAll done, with a last sentence that takes a moment.";
  public static readonly streamInterval: number = 100;
  private static readonly streamSizes: readonly number[] = [7, 31, 4, 58, 12, 3, 44, 20, 9, 60, 5, 30];
  private readonly releases: (() => void)[] = [];
  private awaken: (() => void) | null = null;
  public readonly descriptor = new ProviderDescriptor("codex", "Fixture provider", ["low"], true, true);
  public readonly requests: TurnRequest[] = [];

  public checkSignIn(_account: ProviderAccount): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, new ProviderAccountIdentity("fixture@example.test"), "fixture", null));
  }

  public listModels(_account: ProviderAccount | null): Promise<readonly ProviderModel[]> {
    return Promise.resolve([new ProviderModel("fixture-model", "Fixture model", "UI fixture", ["low"], true, null, true)]);
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    this.requests.push(request);
    const session = "fixture-session";
    const observed = new ObservedSettings("codex", "fixture-model", "low", "fixture", null);
    listener.onStarted(new TurnStart(session, false));
    listener.onObserved(observed);
    if (request.prompt.includes("Request approval")) {
      await listener.onApprovalRequested(new ApprovalAsk("fixture-approval", ApprovalKind.Tool, "fixture", "Fixture approval", null,
        [new ApprovalOption("allow", "Allow fixture", ApprovalOutcome.Approved), new ApprovalOption("deny", "Deny fixture", ApprovalOutcome.Denied)]));
    }
    if (request.prompt.includes("Wait for cancellation")) {
      listener.onDetail(new TurnDetail(DetailKind.Text, "Waiting for Stop.", null, null));
      if (!signal.aborted)
        await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    }
    else if (request.prompt.includes("Stream slowly")) {
      await FixtureProvider.stream(listener, signal, DetailKind.Reasoning, "fixture-thought", FixtureProvider.streamedThought);
      await FixtureProvider.stream(listener, signal, DetailKind.Text, "fixture-answer", FixtureProvider.streamedAnswer);
    }
    else if (request.prompt.includes("Stream stepwise")) {
      await this.streamStepwise(listener, signal, DetailKind.Reasoning, "fixture-thought", FixtureProvider.streamedThought);
      await this.streamStepwise(listener, signal, DetailKind.Text, "fixture-answer", FixtureProvider.streamedAnswer);
    }
    else
      listener.onDetail(new TurnDetail(DetailKind.Text, "Fixture reply completed.", null, null));
    return new TurnResult(signal.aborted ? TurnOutcome.Interrupted : TurnOutcome.Completed, session, observed, null);
  }

  /**
   * Lets a "Stream stepwise" turn send its next batch; the promise resolves once that batch has been handed to the runtime.
   */
  public releaseBatch(): Promise<void> {
    return new Promise<void>(delivered => {
      this.releases.push(delivered);
      this.awaken?.();
    });
  }

  public static batches(text: string): readonly string[] {
    const batches: string[] = [];
    for (let end = 0, index = 0; end < text.length; index++) {
      end = Math.min(text.length, end + (FixtureProvider.streamSizes[index % FixtureProvider.streamSizes.length] ?? 1));
      batches.push(text.slice(0, end));
    }

    return batches;
  }

  public forkSession(_request: ForkRequest): Promise<string> {
    return Promise.resolve("fixture-fork");
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }

  private static async stream(listener: ITurnListener, signal: AbortSignal, kind: DetailKind, id: string, text: string): Promise<void> {
    for (const batch of FixtureProvider.batches(text)) {
      if (signal.aborted)
        return;
      listener.onDetail(new TurnDetail(kind, batch, null, id));
      await new Promise<void>(resolve => setTimeout(resolve, FixtureProvider.streamInterval));
    }
  }

  private async streamStepwise(listener: ITurnListener, signal: AbortSignal, kind: DetailKind, id: string, text: string): Promise<void> {
    for (const batch of FixtureProvider.batches(text)) {
      while (this.releases.length === 0 && !signal.aborted)
        await new Promise<void>(resolve => {
          this.awaken = resolve;
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
      this.awaken = null;
      if (signal.aborted)
        return;
      const delivered = this.releases.shift();
      listener.onDetail(new TurnDetail(kind, batch, null, id));
      delivered?.();
    }
  }
}
