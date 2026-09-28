/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy, Component, type OnDestroy, type OnInit, type Signal, type WritableSignal, effect, inject, signal, untracked
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatTooltipModule } from "@angular/material/tooltip";

import { ComposerComponent } from "./components/composer/composer.component";
import { ConversationMembersComponent } from "./components/conversation-members/conversation-members.component";
import { MessageListComponent } from "./components/message-list/message-list.component";
import { SettingsPageComponent } from "./components/settings-page/settings-page.component";
import { DockComponent } from "./components/dock/dock.component";
import { DockGuidesComponent } from "./components/dock-guides/dock-guides.component";
import { DocumentTabsComponent } from "./components/document-tabs/document-tabs.component";
import { PanelContentComponent } from "./components/panel-content/panel-content.component";
import { ResizeHandleComponent } from "./components/resize-handle/resize-handle.component";
import { TabGroupComponent } from "./components/tab-group/tab-group.component";
import { WindowControlsComponent } from "./components/window-controls/window-controls.component";
import { FileDropDirective } from "./directives/file-drop.directive";
import { AppView } from "./enums/app-view";
import { DockSide } from "./enums/dock-side";
import type { ShellGeometry } from "./models/shell-geometry";
import { TabGroup } from "./models/tab-group";
import { Resources } from "./resources";
import { ImageViewerComponent } from "./components/image-viewer/image-viewer.component";
import { ChatStore } from "./services/chat-store.service";
import { DocumentsService } from "./services/documents.service";
import { RestartPreparationService } from "./services/restart-preparation.service";
import { LayoutService } from "./services/layout.service";
import { NavigationService } from "./services/navigation.service";
import { PlatformService } from "./services/platform.service";
import { ShellService } from "./services/shell.service";
import { ShortcutsService } from "./services/shortcuts.service";
import { TitleBarService } from "./services/title-bar.service";

@Component({
  selector: "tr-app",
  imports: [
    ComposerComponent, DockComponent, DockGuidesComponent, DocumentTabsComponent, MatButtonModule, MatIconModule, MatProgressBarModule,
    MatTooltipModule, MessageListComponent, PanelContentComponent, ResizeHandleComponent, SettingsPageComponent, TabGroupComponent,
    WindowControlsComponent, ImageViewerComponent, FileDropDirective, ConversationMembersComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./app.component.html"
})
export class AppComponent implements OnInit, OnDestroy {
  protected readonly restart = inject(RestartPreparationService);
  protected readonly resources: typeof Resources = Resources;
  protected readonly shell: ShellService = inject(ShellService);
  protected readonly store: ChatStore = inject(ChatStore);
  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly settingsView: AppView = AppView.Settings;
  protected readonly imageView: AppView = AppView.Image;
  protected readonly chatView: AppView = AppView.Chat;
  protected readonly titleBar: TitleBarService = inject(TitleBarService);
  protected readonly platform: PlatformService = inject(PlatformService);
  protected readonly leftSide: DockSide = DockSide.Left;
  protected readonly rightSide: DockSide = DockSide.Right;
  protected readonly bottomSide: DockSide = DockSide.Bottom;
  protected readonly documentsId: number = TabGroup.documentsId;
  protected readonly geometry: Signal<ShellGeometry> = this.shell.geometry;
  private readonly shortcuts: ShortcutsService = inject(ShortcutsService);
  protected readonly layout: LayoutService = inject(LayoutService);
  private readonly documents: DocumentsService = inject(DocumentsService);
  protected readonly busyShown: WritableSignal<boolean> = signal(false);
  private busyTimer: number | null = null;

  public constructor() {
    effect(() => {
      const busy = this.store.isBusy();
      untracked(() => this.onBusy(busy));
    });
  }

  public ngOnInit(): void {
    this.shortcuts.start();
    void this.store.initialize().then(() => this.documents.restore());
  }

  public ngOnDestroy(): void {
    this.shortcuts.stop();
    this.store.dispose();
    this.onBusy(false);
  }

  private onBusy(busy: boolean): void {
    if (!Object.isNull(this.busyTimer)) {
      window.clearTimeout(this.busyTimer);
      this.busyTimer = null;
    }
    if (!busy) {
      this.busyShown.set(false);
      return;
    }
    this.busyTimer = window.setTimeout(() => {
      this.busyTimer = null;
      this.busyShown.set(true);
    }, Resources.busyBarDelay);
  }
}
