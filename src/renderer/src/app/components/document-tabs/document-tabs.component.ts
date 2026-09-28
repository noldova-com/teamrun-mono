/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type ElementRef, type Signal, afterRenderEffect, computed, inject, viewChild } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";

import { AppView } from "../../enums/app-view";
import type { Panel } from "../../models/panel";
import type { TabGroup } from "../../models/tab-group";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { DocumentsService } from "../../services/documents.service";
import { LayoutService } from "../../services/layout.service";
import { NavigationService } from "../../services/navigation.service";
import { PanelDragService } from "../../services/panel-drag.service";
import { PanelLabels } from "../../services/panel-labels.service";
import { ViewportService } from "../../services/viewport.service";
import { PanelMenuComponent } from "../panel-menu/panel-menu.component";

@Component({
  selector: "tr-document-tabs",
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatProgressSpinnerModule, MatTooltipModule, PanelMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block shrink-0", "[class.hidden]": "isEmpty()" },
  templateUrl: "./document-tabs.component.html"
})
export class DocumentTabsComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly store: ChatStore = inject(ChatStore);
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly documents: DocumentsService = inject(DocumentsService);
  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly drag: PanelDragService = inject(PanelDragService);
  protected readonly labels: PanelLabels = inject(PanelLabels);
  protected readonly settingsView: AppView = AppView.Settings;
  protected readonly group: Signal<TabGroup> = computed(() => this.layout.arrangement().documents);
  protected readonly isEmpty: Signal<boolean> = computed(() => this.layout.documents().length === 0 && !this.navigation.settingsOpen() &&
    this.navigation.images().length === 0 && this.group().panels.length === 0);
  private readonly viewport: ViewportService = inject(ViewportService);
  private readonly strip = viewChild<ElementRef<HTMLElement>>("strip");

  public constructor() {
    afterRenderEffect(() => {
      this.layout.documents();
      this.store.selectedConversationId();
      this.navigation.view();
      this.navigation.activeImage();
      this.navigation.panel();
      this.viewport.width();
      this.reveal();
    });
  }

  protected isShown(conversationId: string): boolean {
    return this.navigation.view() === AppView.Chat && conversationId === this.store.selectedConversationId();
  }

  protected show(conversationId: string): void {
    this.navigation.showChat();
    void this.documents.show(conversationId);
  }

  protected isImageShown(id: number): boolean {
    return this.navigation.view() === AppView.Image && this.navigation.activeImage()?.id === id;
  }

  protected closeImage(event: globalThis.Event, id: number): void {
    event.stopPropagation();
    this.navigation.closeImage(id);
  }

  protected onImageAuxClick(event: MouseEvent, id: number): void {
    if (event.button !== Resources.middleButton)
      return;
    event.preventDefault();
    this.closeImage(event, id);
  }

  protected closePanel(event: globalThis.Event, panel: Panel): void {
    event.stopPropagation();
    this.layout.closePanel(panel);
  }

  protected onPanelAuxClick(event: MouseEvent, panel: Panel): void {
    if (event.button !== Resources.middleButton)
      return;
    event.preventDefault();
    this.closePanel(event, panel);
  }

  protected closeAll(): void {
    this.documents.closeAll();
    this.navigation.closeImages();
    this.navigation.closeSettingsTab();
  }

  protected keepOpen(conversationId: string): void {
    void this.documents.keepOpen(conversationId);
  }

  protected onWheel(event: WheelEvent): void {
    const strip = this.strip()?.nativeElement;
    if (Object.isUndefined(strip) || event.deltaY === 0 || event.deltaX !== 0)
      return;

    strip.scrollLeft += event.deltaY;
    event.preventDefault();
  }

  private reveal(): void {
    const strip = this.strip()?.nativeElement;
    if (Object.isUndefined(strip))
      return;

    const active = strip.querySelector(Resources.activeTabSelector);
    if (!Object.isNull(active) && Object.isFunction(active.scrollIntoView))
      active.scrollIntoView({ inline: "nearest", block: "nearest" });
  }

  protected titleOf(conversationId: string): string {
    const title = this.store.conversation(conversationId)?.title ?? String.empty;
    return String.isNullOrWhitespace(title) ? Resources.untitledConversation : title;
  }

  protected projectNameOf(conversationId: string): string {
    const projectId = this.store.conversation(conversationId)?.projectId ?? null;
    return this.store.projects().find(t => t.id === projectId)?.name ?? String.empty;
  }

  protected closeSettings(event: globalThis.Event): void {
    event.stopPropagation();
    this.navigation.closeSettingsTab();
  }

  protected onTabMouseDown(event: MouseEvent): void {
    if (event.button === Resources.middleButton)
      event.preventDefault();
  }

  protected onTabAuxClick(event: MouseEvent, conversationId: string | null): void {
    if (event.button !== Resources.middleButton)
      return;
    event.preventDefault();
    if (Object.isNull(conversationId))
      this.closeSettings(event);
    else
      this.close(event, conversationId);
  }

  protected close(event: globalThis.Event, conversationId: string): void {
    event.stopPropagation();
    void this.documents.close(conversationId);
  }
}
