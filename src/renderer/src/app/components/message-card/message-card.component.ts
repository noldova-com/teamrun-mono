/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, type OnInit, type Signal, type WritableSignal, computed, effect, inject, input, signal, untracked } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";
import { type Approval, DetailKind, type Message, MessageAuthor, MessageStatus } from "@noldova/teamrun-protocol";

import { SegmentKind } from "../../enums/segment-kind";
import type { ActivityEntry } from "../../models/activity-entry";
import type { FileEdit } from "../../models/file-edit";
import { ImageSource } from "../../models/image-source";
import type { ReplySegment } from "../../models/reply-segment";
import { MessageControlState } from "../../models/message-control-state";
import { Resources } from "../../resources";
import { ChangeReader } from "../../services/change-reader.service";
import { ChatStore } from "../../services/chat-store.service";
import { DraftService } from "../../services/draft.service";
import { Formatter } from "../../services/formatter.service";
import { ActivityBlockComponent } from "../activity-block/activity-block.component";
import { ApprovalCardComponent } from "../approval-card/approval-card.component";
import { EditedFilesCardComponent } from "../edited-files-card/edited-files-card.component";
import { ImagePreviewComponent } from "../image-preview/image-preview.component";
import { MarkdownComponent } from "../markdown/markdown.component";
import { RewindDialogComponent } from "../rewind-dialog/rewind-dialog.component";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";

@Component({
  selector: "tr-message-card",
  host: { "[attr.data-message-id]": "message().id", "[style.min-height.px]": "waitingForImages() ? reservedHeight() : null" },
  imports: [
    ActivityBlockComponent, ApprovalCardComponent, EditedFilesCardComponent, ImagePreviewComponent, MarkdownComponent, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule, NgTemplateOutlet, TeammateAvatarComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./message-card.component.html"
})
export class MessageCardComponent implements OnInit {
  protected readonly authorUnavailable = computed(() => {
    const id = this.message().teammateId;
    return !Object.isNull(id) && this.store.isTeammateUnavailable(id);
  });
  protected readonly unavailableMentions = computed(() => this.message().mentions
    .filter(t => this.store.isTeammateUnavailable(t.teammateId)).map(t => t.teammateId));
  protected readonly authorDescription = computed(() => {
    const message = this.message();
    const former = !Object.isNull(message.teammateId) && Object.isNull(this.store.teammate(message.teammateId));
    return [message.teammateName ?? Resources.defaultTeammateLabel,
      this.formatter.providerName(message.provenance?.observed.provider ?? message.provenance?.requested.provider ?? null, this.store.providers()),
      this.formatter.modelLine(message), ...(former ? [Resources.formerTeammateLabel] : this.authorUnavailable() ? [Resources.unavailableTeammateLabel] : [])]
      .filter(t => !Object.isNull(t)).join(Resources.titleSeparator);
  });
  public readonly message = input.required<Message>();
  public readonly controls = input<MessageControlState | null>(null);
  public readonly reservedHeight = input(0);

  protected readonly resources: typeof Resources = Resources;
  protected readonly store: ChatStore = inject(ChatStore);
  protected readonly formatter: Formatter = inject(Formatter);
  protected readonly errorKind: DetailKind = DetailKind.Error;
  protected readonly providerAuthor: MessageAuthor = MessageAuthor.Provider;
  protected readonly textKind: SegmentKind = SegmentKind.Text;
  protected readonly imageKind: SegmentKind = SegmentKind.Image;
  private readonly changes: ChangeReader = inject(ChangeReader);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly drafts: DraftService = inject(DraftService);
  private readonly now: WritableSignal<number> = signal(Date.now());
  private readonly isTimed: Signal<boolean> = computed(() => this.isActive() && !this.formatter.isWaitingForTurn(this.message()));
  private readonly localControls = new MessageControlState();
  private readonly readyImages = signal<ReadonlySet<string | number>>(new Set());
  private initialKeys: ReadonlySet<number> = new Set();
  protected readonly state = computed(() => this.controls() ?? this.localControls);
  protected readonly copied: WritableSignal<boolean> = signal(false);
  private copiedTimer: number | null = null;

  protected readonly isUser: Signal<boolean> = computed(() => this.message().author === MessageAuthor.User);
  protected readonly isActive: Signal<boolean> = computed(() => this.formatter.isActive(this.message()));
  protected readonly isFailed: Signal<boolean> = computed(() => this.message().status === MessageStatus.Failed);
  protected readonly answers = computed(() => this.formatter.answers(this.message()));
  protected readonly segments: Signal<readonly ReplySegment[]> = computed(() => this.formatter.segments(this.message()));
  protected readonly activity: Signal<readonly ActivityEntry[]> = computed(() => this.segments().flatMap(t => t.entries));
  protected readonly activityLabel: Signal<string> = computed(() => this.formatter.activityLabel(this.message(), this.now()));
  protected readonly approvals: Signal<readonly Approval[]> = computed(() => this.store.pendingApprovals().filter(t => t.messageId === this.message().id));
  protected readonly rootPath: Signal<string | null> = computed(() => this.store.selectedProject()?.rootPath ?? null);
  protected readonly edits: Signal<readonly FileEdit[]> = computed(() => this.changes.editsOf(this.message()));
  protected readonly evidenceNotes = computed(() => this.formatter.evidenceNotes(this.message()));
  protected readonly imageFiles: Signal<readonly ImageSource[]> = computed(() => this.changes.imageFilesOf(this.message(), this.rootPath()));
  protected readonly attachedImages: Signal<readonly ImageSource[]> = computed(() => this.message().attachments.filter(t => t.isImage)
    .map(t => new ImageSource(t.path, t.name, t.path, null)));
  protected readonly waitingForImages = computed(() => this.segments().filter(t => t.kind === SegmentKind.Image && !Object.isNull(this.imageOf(t))).some(t => !this.readyImages().has(t.key))
    || this.imageFiles().some(t => !this.readyImages().has(t.key)) || this.attachedImages().some(t => !this.readyImages().has(t.key)));
  protected readonly statusLabel: Signal<string | null> = computed(() => {
    const status = this.message().status;
    return status === MessageStatus.Completed || status === MessageStatus.Running ? null : status;
  });

  public constructor() {
    effect(() => {
      const id = this.message().id;
      const state = this.state();
      state.hasChanges;
      untracked(() => this.store.rememberMessageControls(id, state));
    });
    inject(DestroyRef).onDestroy(() => {
      if (!Object.isNull(this.copiedTimer))
        window.clearTimeout(this.copiedTimer);
    });
    effect(onCleanup => {
      if (!this.isTimed())
        return;
      this.now.set(Date.now());
      const timer = setInterval(() => this.now.set(Date.now()), Resources.clockIntervalMilliseconds);
      onCleanup(() => clearInterval(timer));
    });
  }

  public ngOnInit(): void {
    this.initialKeys = new Set(this.segments().map(t => t.key));
  }

  protected isEntering(segment: ReplySegment): boolean {
    return !this.initialKeys.has(segment.key);
  }

  protected rewind(): void {
    const dialog = this.dialog.open<RewindDialogComponent, void, boolean>(RewindDialogComponent, { width: Resources.dialogWidth });
    const text = this.answers().map(t => t.text).join(Resources.paragraphSeparator);
    const attachments = this.message().attachments;
    dialog.afterClosed().subscribe(restoreFiles => {
      if (Object.isUndefined(restoreFiles))
        return;
      void this.store.rewind(this.message().id, restoreFiles).then(result => {
        if (!Object.isNull(result))
          this.drafts.offer(text, attachments);
      });
    });
  }

  protected copy(): void {
    void navigator.clipboard?.writeText(this.answers().map(t => t.text).join(Resources.paragraphSeparator));
    if (!Object.isNull(this.copiedTimer))
      window.clearTimeout(this.copiedTimer);
    this.copied.set(true);
    this.copiedTimer = window.setTimeout(() => {
      this.copiedTimer = null;
      this.copied.set(false);
    }, Resources.copiedDuration);
  }

  protected isInterim(segment: ReplySegment): boolean {
    if (this.isActive())
      return true;
    const segments = this.segments();
    return segments.slice(segments.indexOf(segment) + 1).some(t => t.kind !== SegmentKind.Text);
  }

  protected isActivityOpen(): boolean {
    return this.state().activityChoice() ?? this.isActive();
  }

  protected toggleActivity(): void {
    this.state().activityChoice.set(!this.isActivityOpen());
  }

  protected imageOf(segment: ReplySegment): ImageSource | null {
    return Object.isNull(segment.detail) ? null : this.changes.imageOf(segment.detail);
  }

  protected imageReady(key: string | number): void {
    this.readyImages.update(ready => new Set([...ready, key]));
  }

  protected rememberControls(): void {
    this.store.rememberMessageControls(this.message().id, this.state());
  }
}
