/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  type Signal,
  type WritableSignal,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";
import { AttachmentInput, type MessageAttachment, Resources as ProtocolResources,
  type Teammate, TeammateMention, TeammateUpdateParams, MentionResolver } from "@noldova/teamrun-protocol";

import { InlineCodeDirective } from "../../directives/inline-code.directive";
import { ComposerSettings } from "../../models/composer-settings";
import { AccountChoice } from "../../models/account-choice";
import { MentionCompletion } from "../../models/mention-completion";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";
import { ModelCatalog } from "../../models/model-catalog";
import { ModelCatalogService } from "../../services/model-catalog.service";
import { ComposerAttachment } from "../../models/composer-attachment";
import { ImagePreviewComponent } from "../image-preview/image-preview.component";
import { AccessMode } from "../../enums/access-mode";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { Formatter } from "../../services/formatter.service";
import { PreferencesService } from "../../services/preferences.service";
import { DocumentsService } from "../../services/documents.service";
import { DraftService } from "../../services/draft.service";
import { ComposerDraftsService } from "../../services/composer-drafts.service";
import { RestartPreparationService } from "../../services/restart-preparation.service";
import { ShortcutsService } from "../../services/shortcuts.service";

@Component({
  selector: "tr-composer",
  imports: [FormsModule, InlineCodeDirective, ImagePreviewComponent, MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatTooltipModule, TeammateAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./composer.component.html"
})
export class ComposerComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly store: ChatStore = inject(ChatStore);
  protected readonly formatter: Formatter = inject(Formatter);
  protected readonly savedDrafts: ComposerDraftsService = inject(ComposerDraftsService);
  protected readonly text = this.savedDrafts.text;
  protected readonly attachments = this.savedDrafts.attachments;
  protected readonly attachmentImages = computed(() => this.attachments().flatMap(t => Object.isNull(t.image) ? [] : [t.image]));
  protected readonly attachmentError: WritableSignal<string | null> = signal(null);
  protected readonly preparing = this.savedDrafts.preparing;
  protected readonly provider: WritableSignal<string | null> = signal(null);
  protected readonly model: WritableSignal<string | null> = signal(null);
  protected readonly effort: WritableSignal<string | null> = signal(null);
  protected readonly accountId: WritableSignal<string | null> = signal(null);
  protected readonly responderId = signal<string | null>(null);
  protected readonly activeResponderId = computed(() => {
    const id = this.responderId();
    return !Object.isNull(id) && this.store.isTeammateUnavailable(id) ? null : id;
  });
  protected readonly responder = computed(() => this.store.teammate(this.activeResponderId()));
  protected readonly memberTeammates = computed(() => this.store.membersOf(this.store.selectedConversationId())
    .map(t => this.store.teammate(t.teammateId)).filter((t): t is Teammate => !Object.isNull(t)));
  protected readonly chosenModel = computed(() => this.responder() ? this.responder()!.model : this.model());
  protected readonly chosenEffort = computed(() => this.responder() ? this.responder()!.effort : this.effort());
  protected readonly chosenAccount = computed(() => this.responder()?.providerAccountId ?? this.accountId());
  protected readonly chosenProvider = computed(() => this.responder()
    ? this.store.accounts().find(t => t.id === this.responder()!.providerAccountId)?.provider ?? null : this.provider());
  private readonly caret = signal(0);
  private readonly completionClosed = signal(true);
  protected readonly completionIndex = signal(0);
  protected readonly completion = computed(() => this.completionClosed() ? null : MentionCompletion.at(this.text(), this.caret(),
    [...this.memberTeammates(), ...this.store.teammates().filter(t => !this.isMember(t.id))]));
  private readonly modelCatalogs: ModelCatalogService = inject(ModelCatalogService);
  protected readonly catalog: WritableSignal<ModelCatalog | null> = signal(null);
  protected readonly models = computed(() => this.catalog()?.models ?? []);
  protected readonly modelsLoading = signal(false);
  protected readonly selectedModel = computed(() => this.models().find(t => t.matches(this.chosenModel())));
  protected readonly imagesUnsupported = computed(() => this.selectedModel()?.supportsImages === false && this.attachmentImages().length > 0
    && MentionResolver.resolve(this.text(), this.store.teammates().map(t => new TeammateMention(t.id, t.name))).length === 0);
  protected readonly preferences: PreferencesService = inject(PreferencesService);
  protected readonly accessMode: Signal<AccessMode> = this.preferences.accessMode;
  protected readonly accessModes: readonly AccessMode[] = Object.values(AccessMode);
  protected readonly fullAccess: AccessMode = AccessMode.Full;
  private readonly box: Signal<ElementRef<HTMLTextAreaElement>> = viewChild.required<ElementRef<HTMLTextAreaElement>>("box");
  private readonly shortcuts: ShortcutsService = inject(ShortcutsService);
  private readonly drafts: DraftService = inject(DraftService);
  private readonly documents: DocumentsService = inject(DocumentsService);
  private readonly restart: RestartPreparationService = inject(RestartPreparationService);

  protected readonly effortLevels: Signal<readonly string[]> = computed(() => this.selectedModel()?.effortLevels ?? []);
  protected readonly accounts = computed(() => [...AccountChoice.saved(this.store.accounts(), this.store.providers()), ...AccountChoice.native(this.store.providers())]
    .filter(t => t.provider === this.chosenProvider()));
  protected readonly selectedAccount = computed(() => this.accounts().find(t => t.provider === this.chosenProvider() && t.accountId === this.chosenAccount()));
  private catalogGeneration: number = 0;
  private reconcileAccount: string | null = null;
  public readonly canCompose: Signal<boolean> =
    computed(() => !this.preparing() && this.savedDrafts.isReadyFor(this.store.selectedConversationId()) && Object.isNull(this.store.runningReply()));
  protected readonly canSend: Signal<boolean> =
    computed(() => this.canCompose() && !this.store.isBusy() && !this.modelsLoading() && !this.imagesUnsupported() && !Object.isNull(this.provider())
      && (!String.isNullOrWhitespace(this.text()) || this.attachments().length > 0));
  protected readonly summary: Signal<string> = computed(() => {
    const parts = [this.responder()?.name ?? this.selectedAccount()?.fullLabel ?? this.formatter.providerName(this.provider(), this.store.providers())];
    const model = this.chosenModel();
    const effort = this.chosenEffort();
    if (!Object.isNull(model))
      parts.push(this.selectedModel()?.displayName ?? model);
    if (!Object.isNull(effort))
      parts.push(effort);
    if (!Object.isNull(this.responder()) && !Object.isUndefined(this.selectedAccount()))
      parts.push(this.selectedAccount()!.fullLabel);
    return parts.join(Resources.titleSeparator);
  });

  public constructor() {
    this.restart.attachComposer(() => this.captureForRestart());
    effect(() => {
      const id = this.store.selectedConversationId();
      untracked(() => void this.savedDrafts.select(id));
    });
    effect(() => {
      this.chosenProvider();
      this.chosenAccount();
      untracked(() => this.loadModels());
    });
    effect(() => {
      const draft = this.drafts.pending();
      if (Object.isNull(draft) || this.savedDrafts.loading())
        return;
      untracked(() => {
        this.text.set(draft);
        this.clearAttachments();
        this.attachments.set(this.drafts.attachments().map(t => ComposerAttachment.fromSaved(t)));
        this.drafts.clear();
      });
      queueMicrotask(() => this.box().nativeElement.focus());
    });
    afterNextRender(() => this.shortcuts.attachComposer(() => this.box().nativeElement.focus()));
    inject(DestroyRef).onDestroy(() => {
      this.restart.attachComposer(null);
      this.shortcuts.attachComposer(null);
    });
    effect(() => {
      const conversationId = this.store.selectedConversationId();
      const first = this.store.providers()[0];
      const remembered = Object.isNull(conversationId) ? null : this.preferences.composerFor(conversationId);
      untracked(() => {
        const chosen = remembered ?? this.preferences.defaultComposer();
        if (!Object.isNull(chosen) && this.store.providers().some(t => t.id === chosen.provider))
          this.applySettings(chosen);
        else if (Object.isNull(this.provider()) && !Object.isUndefined(first))
          this.selectProvider(first.id);
      });
    });
    effect(() => {
      const id = this.responderId();
      if (!Object.isNull(id) && !this.memberTeammates().some(t => t.id === id))
        untracked(() => this.selectResponder(null));
    });
  }

  private async captureForRestart(): Promise<boolean> {
    if (this.preparing() || this.savedDrafts.loading())
      return false;
    const conversationId = this.store.selectedConversationId();
    const provider = this.provider();
    if (!Object.isNull(conversationId) && !Object.isNull(provider) && !this.modelsLoading() && this.savedDrafts.isLoadedFor(conversationId))
      this.preferences.rememberComposer(conversationId,
        new ComposerSettings(provider, this.model(), this.effort(), this.accountId(), this.responderId()));
    return this.savedDrafts.flush();
  }

  protected selectProvider(provider: string): void {
    if (provider === this.provider())
      return;

    this.catalog.set(null);
    this.modelsLoading.set(true);
    this.applySettings(new ComposerSettings(provider, null, null, null));
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing)
      return;
    const completion = this.completion();
    if (!Object.isNull(completion)) {
      if (event.key === Resources.escapeMentionKey) {
        event.preventDefault();
        this.closeCompletion();
        return;
      }
      if (event.key === Resources.arrowDownKey || event.key === Resources.arrowUpKey) {
        event.preventDefault();
        const step = event.key === Resources.arrowDownKey ? 1 : -1;
        this.completionIndex.set((this.completionIndex() + step + completion.choices.length) % completion.choices.length);
        queueMicrotask(() => this.box().nativeElement.ownerDocument.getElementById(Resources.mentionOptionPrefix + this.completionIndex())
          ?.scrollIntoView({ block: "nearest" }));
        return;
      }
      if (event.key === Resources.enterKey && !event.shiftKey) {
        event.preventDefault();
        this.insertMention(completion.choices[this.completionIndex()] ?? completion.choices[0]!);
        return;
      }
    }
    if (event.key !== Resources.enterKey || event.shiftKey)
      return;

    event.preventDefault();
    void this.send();
  }

  protected submit(event: globalThis.Event): Promise<void> {
    event.preventDefault();
    return this.send();
  }

  protected pickFiles(input: HTMLInputElement): void {
    this.addFiles(Array.from(input.files ?? []));
    input.value = String.empty;
  }

  protected paste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0)
      return;
    event.preventDefault();
    this.addFiles(files);
  }

  protected removeAttachment(attachment: ComposerAttachment): void {
    attachment.dispose();
    this.attachments.update(items => items.filter(t => t !== attachment));
    this.attachmentError.set(null);
  }

  public addFiles(files: readonly File[]): void {
    if (!this.canCompose() || files.length === 0)
      return;
    const existing = this.attachments();
    if (existing.length + files.length > ProtocolResources.maximumAttachments
      || files.some(t => t.size > ProtocolResources.maximumAttachmentBytes
        || (ProtocolResources.attachmentImageMediaTypes.includes(t.type) && t.size > ProtocolResources.maximumAttachmentImageBytes))) {
      this.attachmentError.set(Resources.attachmentLimitExceeded);
      return;
    }
    this.attachments.set([...existing, ...files.map(t => ComposerAttachment.fromFile(t))]);
    this.attachmentError.set(null);
  }

  private clearAttachments(): void {
    for (const attachment of this.attachments())
      attachment.dispose();
    this.attachments.set([]);
    this.attachmentError.set(null);
  }

  private applySettings(settings: ComposerSettings): void {
    this.reconcileAccount = null;
    this.provider.set(settings.provider);
    this.model.set(settings.model);
    this.effort.set(settings.effort);
    this.accountId.set(settings.providerAccountId);
    this.responderId.set(settings.responderTeammateId);
  }

  protected selectModel(model: string | null): void {
    const teammate = this.responder();
    if (!Object.isNull(teammate)) {
      void this.saveNamedSettings(teammate, model, this.catalog()?.resolveEffort(model, teammate.effort) ?? null);
      return;
    }
    this.model.set(model);
    this.effort.set(this.catalog()?.resolveEffort(model, this.effort()) ?? null);
  }

  protected loadModels(refresh: boolean = false): void {
    const generation = ++this.catalogGeneration;
    const provider = this.chosenProvider();
    const account = this.chosenAccount();
    if (!refresh)
      this.catalog.set(null);
    if (Object.isNull(provider))
      return this.modelsLoading.set(false);
    this.modelsLoading.set(true);
    void this.modelCatalogs.load(provider, account, refresh).then(catalog => {
      if (generation === this.catalogGeneration && provider === this.chosenProvider() && account === this.chosenAccount()) {
        this.catalog.set(catalog);
        this.modelsLoading.set(false);
        if (!catalog.failed && Object.isNull(this.responder()) && this.reconcileAccount === this.selectedAccount()?.key) {
          const previous = this.model();
          const model = catalog.resolveModel(previous);
          this.model.set(model);
          this.effort.set(model === previous ? catalog.resolveEffort(model, this.effort()) : null);
          this.reconcileAccount = null;
        }
      }
    });
  }

  private async send(): Promise<void> {
    const provider = this.provider();
    const conversationId = this.store.selectedConversationId();
    if (!this.canSend() || Object.isNull(provider) || Object.isNull(conversationId))
      return;

    const draft = this.text();
    const draftAttachments = this.attachments();
    const text = draft.trim();
    const settings = new ComposerSettings(provider, this.model(), this.effort(), this.accountId(), this.responderId());
    const mentions = MentionResolver.resolve(text, this.store.teammates().map(t => new TeammateMention(t.id, t.name)));
    const prepared: MessageAttachment[] = [];
    this.preparing.set(true);
    try {
      const attachments: AttachmentInput[] = [];
      for (const draftAttachment of draftAttachments) {
        const input = await draftAttachment.toInput();
        if (Object.isNull(input.data)) {
          attachments.push(input);
          continue;
        }
        const saved = await this.store.prepareAttachment(input);
        prepared.push(saved);
        attachments.push(new AttachmentInput(saved.name, saved.mediaType, null, saved.path));
      }
      this.preferences.rememberComposer(conversationId, settings);
      await this.documents.keepOpen(conversationId);
      if (await this.store.send(text, settings, conversationId, attachments, mentions.map(t => t.teammateId), this.activeResponderId())) {
        const lastMention = mentions.at(-1);
        if (!Object.isUndefined(lastMention))
          this.continueWith(conversationId, lastMention.teammateId);
        this.closeCompletion();
        await this.savedDrafts.sent(conversationId, draft, draftAttachments);
      }
    }
    catch {
      this.attachmentError.set(Resources.attachmentReadFailed);
    }
    finally {
      this.preparing.set(false);
      for (const attachment of prepared)
        await this.store.discardAttachment(attachment);
    }
  }

  protected isMember(id: string): boolean {
    return this.store.membersOf(this.store.selectedConversationId()).some(t => t.teammateId === id);
  }

  protected updateCompletion(): void {
    this.caret.set(this.box().nativeElement.selectionStart);
    this.completionClosed.set(false);
    this.completionIndex.set(0);
  }

  protected moveCaret(event: KeyboardEvent): void {
    if (![Resources.enterKey, Resources.escapeMentionKey, Resources.arrowDownKey, Resources.arrowUpKey].includes(event.key))
      this.updateCompletion();
  }

  protected closeCompletion(): void {
    this.completionClosed.set(true);
  }

  protected insertMention(teammate: Teammate): void {
    const completion = this.completion();
    if (Object.isNull(completion))
      return;
    const inserted = Resources.mentionPrefix + teammate.name + Resources.mentionSpace;
    this.text.set(this.text().slice(0, completion.start) + inserted + this.text().slice(completion.end));
    this.closeCompletion();
    queueMicrotask(() => {
      const box = this.box().nativeElement;
      box.value = this.text();
      box.focus();
      box.setSelectionRange(completion.start + inserted.length, completion.start + inserted.length);
    });
  }

  protected selectResponder(id: string | null): void {
    this.responderId.set(id);
    const conversation = this.store.selectedConversationId();
    const provider = this.provider();
    if (!Object.isNull(conversation) && !Object.isNull(provider))
      this.preferences.rememberComposer(conversation, new ComposerSettings(provider, this.model(), this.effort(), this.accountId(), id));
  }

  private continueWith(conversationId: string, teammateId: string): void {
    if (conversationId === this.store.selectedConversationId()) {
      this.selectResponder(teammateId);
      return;
    }
    const remembered = this.preferences.composerFor(conversationId);
    if (!Object.isNull(remembered))
      this.preferences.rememberComposer(conversationId, new ComposerSettings(remembered.provider, remembered.model, remembered.effort,
        remembered.providerAccountId, teammateId));
  }

  protected selectAccount(choice: AccountChoice): void {
    if (choice.key === this.selectedAccount()?.key)
      return;
    this.reconcileAccount = choice.key;
    this.catalog.set(null);
    this.modelsLoading.set(true);
    this.provider.set(choice.provider);
    this.accountId.set(choice.accountId);
  }

  protected selectEffort(effort: string | null): void {
    const teammate = this.responder();
    if (Object.isNull(teammate))
      this.effort.set(effort);
    else
      void this.saveNamedSettings(teammate, teammate.model, effort);
  }

  private async saveNamedSettings(teammate: Teammate, model: string | null, effort: string | null): Promise<void> {
    await this.store.saveTeammate(new TeammateUpdateParams(teammate.id, teammate.name, teammate.role,
      teammate.providerAccountId, teammate.harness, model, effort));
  }
}
