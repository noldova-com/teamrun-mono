/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from "@angular/cdk/drag-drop";
import { ChangeDetectionStrategy, Component, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";
import type { Conversation, Project } from "@noldova/teamrun-protocol";

import { ConfirmRequest } from "../../models/confirm-request";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { DocumentsService } from "../../services/documents.service";
import { Formatter } from "../../services/formatter.service";
import { LayoutService } from "../../services/layout.service";
import { NavigationService } from "../../services/navigation.service";
import { PreferencesService } from "../../services/preferences.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { RenameDialogComponent } from "../rename-dialog/rename-dialog.component";
import { TeammatesPanelComponent } from "../teammates-panel/teammates-panel.component";

@Component({
  selector: "tr-sidebar",
  imports: [CdkDrag, CdkDragHandle, CdkDropList, MatButtonModule, MatIconModule, MatMenuModule, MatProgressSpinnerModule, MatTooltipModule, NgTemplateOutlet, TeammatesPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "flex h-full flex-col" },
  templateUrl: "./sidebar.component.html"
})
export class SidebarComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly store: ChatStore = inject(ChatStore);
  protected readonly layout: LayoutService = inject(LayoutService);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly formatter: Formatter = inject(Formatter);
  private readonly documents: DocumentsService = inject(DocumentsService);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly preferences: PreferencesService = inject(PreferencesService);
  private readonly unfoldedProjects: WritableSignal<ReadonlySet<string>> = signal(new Set());
  protected readonly pinnedConversations: Signal<readonly Conversation[]> = computed(() =>
    this.layout.pinnedConversations().map(id => this.store.conversation(id)).filter((t): t is Conversation => !Object.isNull(t)));
  protected readonly orderedProjects: Signal<readonly Project[]> = computed(() => {
    const projects = this.store.projects();
    const order = this.layout.projectOrder();
    const named = order.map(id => projects.find(t => t.id === id)).filter((t): t is Project => !Object.isUndefined(t));
    return [...named, ...projects.filter(t => !order.includes(t.id))];
  });

  protected open(conversationId: string): void {
    this.navigation.showChat();
    void this.documents.open(conversationId, this.preferences.openMode());
  }

  protected keepOpen(conversationId: string): void {
    this.navigation.showChat();
    void this.documents.keepOpen(conversationId);
  }

  protected startConversation(): void {
    this.navigation.showChat();
    void this.store.startConversation();
  }

  protected isPinned(conversationId: string): boolean {
    return this.layout.layout().isPinned(conversationId);
  }

  protected dropPin(event: CdkDragDrop<unknown>): void {
    const ids = this.pinnedConversations().map(t => t.id);
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.layout.orderPins(ids);
  }

  protected dropProject(event: CdkDragDrop<unknown>): void {
    const ids = this.orderedProjects().map(t => t.id);
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.layout.orderProjects(ids);
  }

  protected isCollapsed(projectId: string): boolean {
    return this.layout.layout().isProjectCollapsed(projectId);
  }

  protected readonly listIds: Signal<string[]> = computed(() => this.orderedProjects().map(t => this.listIdOf(t.id)));

  protected listIdOf(projectId: string): string {
    return `${Resources.conversationListIdPrefix}${projectId}`;
  }

  protected shownConversationsOf(projectId: string): readonly Conversation[] {
    const all = this.orderedConversationsOf(projectId);
    return this.unfoldedProjects().has(projectId) ? all : all.slice(0, Resources.projectConversationCount);
  }

  private orderedConversationsOf(projectId: string): readonly Conversation[] {
    const pinned = this.layout.pinnedConversations();
    const newest = this.store.newestConversationsOf(projectId).filter(t => !pinned.includes(t.id));
    const order = this.layout.layout().conversationOrderOf(projectId);
    const named = order.map(id => newest.find(t => t.id === id)).filter((t): t is Conversation => !Object.isUndefined(t));
    return [...named, ...newest.filter(t => !order.includes(t.id))];
  }

  protected dropConversation(event: CdkDragDrop<string, string, string>): void {
    const conversationId = event.item.data;
    const from = event.previousContainer.data;
    const to = event.container.data;
    const shown = this.shownConversationsOf(to).map(t => t.id);
    const hidden = this.orderedConversationsOf(to).map(t => t.id).filter(t => !shown.includes(t));
    if (from === to) {
      moveItemInArray(shown, event.previousIndex, event.currentIndex);
      this.layout.orderConversations(to, [...shown, ...hidden]);
      return;
    }
    shown.splice(event.currentIndex, 0, conversationId);
    this.layout.orderConversations(to, [...shown, ...hidden]);
    this.layout.orderConversations(from, this.orderedConversationsOf(from).map(t => t.id).filter(t => t !== conversationId));
    void this.store.moveConversation(conversationId, to);
  }

  protected hiddenCountOf(projectId: string): number {
    return this.orderedConversationsOf(projectId).length - this.shownConversationsOf(projectId).length;
  }

  protected showAll(projectId: string): void {
    this.unfoldedProjects.update(set => new Set(set).add(projectId));
  }

  protected projectNameOf(conversation: Conversation): string {
    const name = this.store.projects().find(t => t.id === conversation.projectId)?.name ?? String.empty;
    return `${name}${Resources.titleSeparator}${this.formatter.dateTime(conversation.updatedAt)}`;
  }

  protected rename(conversationId: string, title: string): void {
    const dialog = this.dialog.open<RenameDialogComponent, string, string>(RenameDialogComponent, { data: title, width: Resources.dialogWidth });
    dialog.afterClosed().subscribe(next => {
      if (!Object.isUndefined(next) && !String.isNullOrWhitespace(next))
        void this.store.renameConversation(conversationId, next);
    });
  }

  protected remove(conversationId: string, title: string): void {
    const shown = String.isNullOrWhitespace(title) ? Resources.untitledConversation : title;
    const request = new ConfirmRequest(Resources.deleteTitle, Resources.formatDeleteText(shown), Resources.deleteConversationLabel);
    this.confirm(request, () => this.store.deleteConversation(conversationId));
  }

  protected forget(projectId: string, name: string): void {
    const request = new ConfirmRequest(Resources.forgetTitle, Resources.formatForgetText(name), Resources.forgetConfirmLabel);
    this.confirm(request, () => this.store.forgetProject(projectId));
  }

  private confirm(request: ConfirmRequest, action: () => Promise<void>): void {
    const dialog = this.dialog.open<ConfirmDialogComponent, ConfirmRequest, boolean>(ConfirmDialogComponent, { data: request, width: Resources.dialogWidth });
    dialog.afterClosed().subscribe(confirmed => {
      if (confirmed === true)
        void action();
    });
  }
}
