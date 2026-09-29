/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MatTooltipDefaultOptions, TooltipPosition } from "@angular/material/tooltip";
import { AppUpdateState, AppUpdateStatus, AuthStatus } from "@noldova/teamrun-protocol";

import markDark from "../../../../assets/icons/icon-dark-128.png";
import markLight from "../../../../assets/icons/icon-light-128.png";
import { AccessMode } from "./enums/access-mode";
import { ClockChoice } from "./enums/clock-choice";
import { OpenMode } from "./enums/open-mode";
import { ImageOpenMode } from "./enums/image-open-mode";
import { DockSide } from "./enums/dock-side";
import { PanelEdge } from "./enums/panel-edge";
import { PanelKind } from "./enums/panel-kind";
import { ShortcutAction } from "./enums/shortcut-action";
import { SplitAxis } from "./enums/split-axis";
import { TerminalColor } from "./enums/terminal-color";
import { FontChoice } from "./enums/font-choice";
import { ThemeToken } from "./models/theme-token";
import { AvatarColor } from "./enums/avatar-color";
import { SettingsSection } from "./enums/settings-section";
import { Shortcut } from "./models/shortcut";

export class Resources {
  public static readonly avatarHashOffset: number = 2166136261;
  public static readonly avatarHashPrime: number = 16777619;
  public static readonly avatarColors: readonly AvatarColor[] = [AvatarColor.Teal, AvatarColor.Green, AvatarColor.Lime, AvatarColor.Amber, AvatarColor.Orange, AvatarColor.Red, AvatarColor.Rose, AvatarColor.Pink, AvatarColor.Purple, AvatarColor.Violet, AvatarColor.Indigo, AvatarColor.Cyan];
  public static readonly galleryAvatarIds: readonly string[] = ["avatar-sample-0", "avatar-sample-7", "avatar-sample-6", "avatar-sample-5", "avatar-sample-4", "avatar-sample-18", "avatar-sample-19", "avatar-sample-30", "avatar-sample-31", "avatar-sample-3", "avatar-sample-2", "avatar-sample-1"];
  public static readonly galleryAvatarColorsLabel: string = "Avatar colors";
  public static readonly restartToUpdateLabel: string = "Restart to update";
  public static readonly restartChoiceTitle: string = "Restart to update?";
  public static readonly restartChoiceText: string = "TeamRun can restart once the work finishes, or stop it now.";
  public static readonly restartWhenFinishedLabel: string = "Restart when finished";
  public static readonly stopAndRestartLabel: string = "Stop and restart";
  public static readonly cancelChoiceLabel: string = "Cancel";
  public static readonly cancelRestartLabel: string = "Cancel restart";
  public static readonly installDialogTitle: string = "Installing update";
  public static readonly installDialogText: string = "TeamRun will restart when the installation finishes.";
  public static readonly installStepLabels: Readonly<Record<AppUpdateStatus.Preparing | AppUpdateStatus.Installing, string>> = {
    [AppUpdateStatus.Preparing]: "Saving workspaces and stopping runtimes",
    [AppUpdateStatus.Installing]: "Installing the update"
  };
  public static readonly updateInstallTestFeedLabel: string = "Local test feed";
  public static readonly restartPreparing: string = "Saving workspace before restarting…";
  public static readonly restartPreparationFailed: string = "The workspace could not be saved for restart. Finish pending work or resolve the draft error, then try again.";
  public static readonly draftDatabaseName: string = "teamrun-composer-drafts";
  public static readonly draftDatabaseVersion: number = 1;
  public static readonly draftManifestStore: string = "drafts";
  public static readonly draftFileStore: string = "files";
  public static readonly draftStoreNames: string[] = [Resources.draftManifestStore, Resources.draftFileStore];
  public static readonly draftReadMode: IDBTransactionMode = "readonly";
  public static readonly draftWriteMode: IDBTransactionMode = "readwrite";
  public static readonly draftDurability: IDBTransactionDurability = "strict";
  public static readonly draftConversationField: string = "conversationId";
  public static readonly draftTextField: string = "text";
  public static readonly draftAttachmentIdsField: string = "attachmentIds";
  public static readonly draftInjectionName: string = "COMPOSER_DRAFT_STORE";
  public static readonly draftRetryLabel: string = "Retry";
  public static readonly draftUnreadable: string = "The saved draft could not be restored. Retry before editing so it is not overwritten.";
  public static readonly draftSaveFailed: string = "The draft could not be saved. Keep TeamRun open and retry before restarting.";
  public static readonly draftStoreClosed: string = "The draft store is closed.";
  public static readonly draftStoreBlocked: string = "Another window is holding an older draft database open.";
  public static readonly updatesTitle: string = "Application updates";
  public static readonly checkUpdatesLabel: string = "Check for updates";
  public static readonly downloadUpdateLabel: string = "Download update";
  public static readonly downloadLatestLabel: string = "Download the latest version";
  public static readonly retryDownloadLabel: string = "Retry download";
  public static readonly updateRetryStatusLabel: string = "Retry";
  public static readonly updateLoadingLabel: string = "Reading update status…";
  public static readonly updateDesktopRequired: string = "Update controls are available in the desktop app.";
  public static readonly updateBridgeFailed: string = "Could not read the update status. Please try again.";
  public static readonly updateTestFeedLabel: string = "Local test feed";
  public static readonly updateStatusLabels: Readonly<Record<Exclude<AppUpdateStatus, AppUpdateStatus.Disabled>, string>> = {
    [AppUpdateStatus.Idle]: "Ready to check for updates",
    [AppUpdateStatus.Checking]: "Checking for updates…",
    [AppUpdateStatus.UpToDate]: "TeamRun is up to date",
    [AppUpdateStatus.Available]: "Update available:",
    [AppUpdateStatus.Downloading]: "Downloading:",
    [AppUpdateStatus.Downloaded]: "Downloaded:",
    [AppUpdateStatus.Preparing]: "Preparing restart…",
    [AppUpdateStatus.Installing]: "Installing update…",
    [AppUpdateStatus.Error]: "Update failed"
  };
  public static readonly galleryUpdateStates: readonly AppUpdateState[] = [
    new AppUpdateState(AppUpdateStatus.Available, "0.0.1", "0.0.2", null, null, null, true),
    new AppUpdateState(AppUpdateStatus.Downloading, "0.0.1", "0.0.2", 42, null, null, true),
    new AppUpdateState(AppUpdateStatus.Error, "0.0.1", "0.0.2", null, "The download could not be verified. Try again.", null, true),
    new AppUpdateState(AppUpdateStatus.Downloaded, "0.0.1", "0.0.2", 100, "Download verified. Installation is not enabled in this test build.", null, true)
  ];

  public static formatInstalledVersion(version: string): string {
    return `Installed version: ${version}`;
  }

  public static formatUpdateAvailable(version: string): string {
    return `Update ${version} available`;
  }

  public static formatUpdateDownloading(version: string, percent: number): string {
    return `Downloading update ${version}: ${percent}%`;
  }

  public static formatUpdateReady(version: string): string {
    return `Update ${version} ready to install`;
  }

  public static formatUpdateDownloaded(version: string): string {
    return `Update ${version} downloaded`;
  }

  public static formatUpdateAttention(version: string): string {
    return `Update ${version} needs attention`;
  }

  public static formatUpdateWaiting(version: string, count: number): string {
    return count === 1 ? `Restarts for update ${version} when 1 reply finishes` : `Restarts for update ${version} when ${count} replies finish`;
  }

  public static formatRunningReplies(count: number): string {
    return count === 1 ? "1 reply is still running." : `${count} replies are still running.`;
  }

  public static formatRestartWaiting(count: number): string {
    return count === 1 ? "Restarts when 1 reply finishes" : `Restarts when ${count} replies finish`;
  }

  public static formatUpdateProgress(percent: number): string {
    return `${percent}%`;
  }
  public static readonly defaultSignInLabel: string = "Default sign-in";
  public static readonly unavailableAccountLabel: string = "Saved account unavailable";
  public static readonly accountSelectionHint: string = "Choose an account for this provider. Models depend on the selected account.";
  public static readonly thisComputerLabel: string = "This computer";
  public static formatLocalAccount(label: string): string {
    return `${label} · ${Resources.thisComputerLabel}`;
  }
  public static readonly namedAccountHint: string = "Change this account in Settings → Teammates → Edit.";
  public static formatAccountChoice(provider: string, label: string): string {
    return provider === label ? provider : `${provider} · ${label}`;
  }
  public static readonly addProviderLabel: string = "Add Provider";
  public static readonly removeProviderLabel: string = "Remove provider connection";
  public static readonly providerConnectionsHint: string = "Your connected provider accounts. Add another connection to use a different account.";
  public static readonly noProviderConnections: string = "No provider connections yet. Choose Add Provider to connect an account.";
  public static readonly addProviderHint: string = "Connect one of the supported providers using a local profile. After adding it, use Check sign-in to verify the connection.";
  public static readonly connectionNameLabel: string = "Account name";
  public static readonly connectionNameHint: string = "For example, Personal or Work";
  public static readonly chooseProfileLabel: string = "Choose profile folder";
  public static readonly providerProfileHint: string = "Use the full path to the profile folder. Sign-in is managed by the provider's own application.";
  public static readonly providerProfileHints: Readonly<Record<string, string>> = {
    codex: "Choose the Codex profile that holds your CLI sign-in (usually the .codex folder in your home directory).",
    claude: "Choose your Claude CLI profile folder (usually .claude). A Claude desktop login does not necessarily sign in this CLI profile.",
    grok: "Use TeamRun's managed Grok profile under its data folder: profiles/grok/default. Your regular .grok folder is not supported."
  };
  public static readonly statusColumn: string = "Status";
  public static readonly actionsColumn: string = "Actions";
  public static readonly connectionColumn: string = "Provider / account";
  public static readonly editLabel: string = "Edit";
  public static readonly teammatesSettingsHint: string = "Create and configure teammates here. Add them to a conversation using its member strip or an @mention.";
  public static readonly noConversationTeammates: string = "No teammates in this conversation.";
  public static readonly noActiveConversationTeammates: string = "Open a conversation to see its teammates.";
  public static readonly accountStatusLabels: Readonly<Record<AuthStatus, string>> = {
    [AuthStatus.Unknown]: "Not checked",
    [AuthStatus.LoggedIn]: "Connected",
    [AuthStatus.LoggedOut]: "Sign-in required",
    [AuthStatus.Expired]: "Sign-in expired",
    [AuthStatus.Error]: "Connection error"
  };
  public static formatRemoveProvider(name: string): string {
    return `Remove the connection “${name}”? Its profile folder and sign-in will stay on disk. Teammates using this connection will become unavailable.`;
  }
  public static readonly responderTeammateIdField: string = "responderTeammateId";
  public static readonly teammatesTitle: string = "Teammates";
  public static readonly addTeammateLabel: string = "Add teammate";
  public static readonly editTeammateLabel: string = "Edit teammate";
  public static readonly deleteTeammateLabel: string = "Delete teammate";
  public static readonly newTeammateConversationLabel: string = "New conversation with this teammate";
  public static readonly noTeammates: string = "No teammates yet";
  public static readonly teammateNameLabel: string = "Name";
  public static readonly teammateNameHint: string = "1–32 letters, digits, dashes or underscores";
  public static readonly teammateRoleLabel: string = "Role (optional, Markdown)";
  public static readonly teammateRoleRows: number = 4;
  public static readonly defaultTeammateLabel: string = "Default";
  public static readonly unavailableTeammateLabel: string = "Unavailable";
  public static readonly formerTeammateLabel: string = "Former teammate";
  public static readonly addMemberLabel: string = "Add conversation member";
  public static readonly removeMemberLabel: string = "Remove from conversation";
  public static readonly conversationMembersLabel: string = "Conversation members";
  public static readonly responderLabel: string = "Responder";
  public static readonly otherTeammatesLabel: string = "Other teammates";
  public static readonly noAccountsForTeammate: string = "Add a connection in Settings → Providers first.";
  public static readonly mentionQueryPattern: RegExp = /(?:^|\s|\()@([\p{L}\p{M}\p{Nd}_-]*)$/u;
  public static readonly mentionTailPattern: RegExp = /^[\p{L}\p{M}\p{Nd}_-]*/u;
  public static readonly mentionPrefix: string = "@";
  public static readonly mentionSpace: string = " ";
  public static readonly mentionListId: string = "teammate-completions";
  public static readonly mentionOptionPrefix: string = "teammate-option-";
  public static readonly escapeMentionKey: string = "Escape";
  public static readonly teammateGlyph: string = "person";
  public static readonly galleryTeammateName: string = "Alice";
  public static readonly galleryTeammateId: string = "alice";
  public static readonly galleryUnavailableTeammateId: string = "gallery-unavailable";
  public static readonly galleryMention: string = "@Alice";
  public static formatMentionHtml(label: string, unavailable: boolean): string {
    return `<span class="tr-mention${unavailable ? " tr-teammate-unavailable" : ""}">${label}</span>`;
  }
  public static formatTeammateError(name: string, error: string): string { return `@${name}: ${error}`; }
  public static formatDeleteTeammate(name: string): string {
    return `Delete @${name}? Their memberships will be removed. Existing messages will keep their name.`;
  }
  public static readonly modelCatalogLifetime: number = 300_000;
  public static readonly maximumModelCatalogs: number = 20;
  public static readonly refreshModelsLabel: string = "Refresh models";
  public static readonly modelRefreshIcon: string = "refresh";
  public static readonly loadingModelsLabel: string = "Loading models…";
  public static readonly modelCatalogUnavailable: string = "Models could not be refreshed. Previously loaded choices are kept.";
  public static readonly unavailableChoiceSuffix: string = " (not in the current catalog)";
  public static readonly modelImagesUnsupported: string = "The selected provider/model does not support images.";
  public static readonly tooltipDefaultOptions: MatTooltipDefaultOptions = {
    position: "above", showDelay: 0, hideDelay: 0, touchendHideDelay: 1500
  };
  public static readonly imageOpenModeLabel: string = "Open images";
  public static readonly imageOpenActionLabels: Readonly<Record<ImageOpenMode, string>> = {
    [ImageOpenMode.Popup]: "Open modal",
    [ImageOpenMode.Tab]: "Open in a new tab"
  };
  public static readonly imageOpenActionIcons: Readonly<Record<ImageOpenMode, string>> = {
    [ImageOpenMode.Popup]: "open_in_new",
    [ImageOpenMode.Tab]: "tab"
  };
  public static readonly imageOpenModeHint: string = "Show images in a popup or in a separate tab beside your conversations.";
  public static readonly imageOpenModeField: string = "imageOpenMode";
  public static readonly imageOpenModeLabels: Readonly<Record<ImageOpenMode, string>> = {
    [ImageOpenMode.Popup]: "Popup",
    [ImageOpenMode.Tab]: "Tab"
  };
  public static readonly imageCloseKey: string = "Escape";
  public static readonly imageCloseTabKey: string = "w";
  public static readonly copyImageLabel: string = "Copy Image";
  public static readonly downloadImageLabel: string = "Download Image";
  public static readonly imageCopyFailed: string = "The image could not be copied. Try again.";
  public static readonly clipboardImageMediaType: string = "image/png";
  public static readonly canvasElement: "canvas" = "canvas";
  public static readonly canvasContext: "2d" = "2d";
  public static readonly imageViewerPanelClass: string = "tr-image-viewer-panel";
  public static readonly imageViewerBackdropClass: string = "tr-image-viewer-backdrop";
  public static readonly imageViewerWidth: string = "100vw";
  public static readonly imageViewerHeight: string = "100vh";
  public static readonly imageViewerInitialFocus: string = "[data-image-close]";
  public static readonly imageLoading: string = "Loading image…";
  public static readonly imageLoadFailed: string = "This image could not be loaded.";
  public static readonly previousImageLabel: string = "Previous image";
  public static readonly nextImageLabel: string = "Next image";
  public static readonly zoomInLabel: string = "Zoom in";
  public static readonly zoomOutLabel: string = "Zoom out";
  public static readonly fitImageLabel: string = "Fit image";
  public static readonly imageMinimumZoom: number = 0.1;
  public static readonly imageMaximumZoom: number = 4;
  public static readonly imageZoomStep: number = 1.25;
  public static readonly percentScale: number = 100;
  public static readonly imagePreviousKey: string = "ArrowLeft";
  public static readonly imageNextKey: string = "ArrowRight";
  public static readonly addFilesLabel: string = "Add files";
  public static readonly dropToAttachLabel: string = "Drop to attach";
  public static readonly removeAttachmentLabel: string = "Remove attachment";
  public static readonly attachmentLimitExceeded: string = "Attach up to 10 files: 10 MiB per image and 100 MiB per file.";
  public static readonly attachmentReadFailed: string = "The attachment could not be read. Try adding it again.";
  public static readonly binaryMediaType: string = "application/octet-stream";
  public static readonly dataUrlSeparator: string = ",";
  public static readonly fileDragType: string = "Files";
  public static readonly copyDropEffect: DataTransfer["dropEffect"] = "copy";
  public static readonly noneDropEffect: DataTransfer["dropEffect"] = "none";
  public static readonly replyHistoryLimit: number = 150;
  public static readonly messageHistoryLimit: number = 150;
  public static readonly replyRefreshDelay: number = 120;
  public static readonly replyHistoryRowSelector: string = "tr-reply-history-row";
  public static readonly replyHistoryLoading: string = "Loading…";
  public static readonly replyHistoryRetry: string = "Retry";
  public static readonly latestRepliesLabel: string = "Go to latest";
  public static readonly latestRepliesIcon: string = "arrow_upward";
  public static readonly applicationName: string = "TeamRun";
  public static readonly markDarkPath: string = markDark;
  public static readonly markLightPath: string = markLight;
  public static readonly changeEvent: "change" = "change";
  public static readonly resizeEvent: "resize" = "resize";
  public static readonly iconFontClass: string = "material-symbols-rounded";
  public static readonly requestIdPrefix: string = "ui";
  public static readonly bridgeMissing: string = "The desktop bridge is not available. Start TeamRun from the desktop application.";
  public static readonly responseMismatch: string = "The response does not answer the request.";
  public static readonly projectsTitle: string = "Projects";
  public static readonly accountsTitle: string = "Accounts";
  public static readonly settingsTitle: string = "Settings";
  public static readonly openProjectLabel: string = "Open folder";
  public static readonly forgetProjectLabel: string = "Forget project";
  public static readonly newConversationLabel: string = "New conversation";
  public static readonly newConversationTitle: string = "New conversation";
  public static readonly renameConversationLabel: string = "Rename";
  public static readonly deleteConversationLabel: string = "Delete";
  public static readonly sendLabel: string = "Send";
  public static readonly cancelLabel: string = "Stop";
  public static readonly closeLabel: string = "Close";
  public static readonly saveLabel: string = "Save";
  public static readonly addAccountLabel: string = "Add account";
  public static readonly checkAccountLabel: string = "Check sign-in";
  public static readonly removeAccountLabel: string = "Remove";
  public static readonly providerLabel: string = "Provider";
  public static readonly modelLabel: string = "Model";
  public static readonly effortLabel: string = "Effort";
  public static readonly accountLabel: string = "Account";
  public static readonly labelLabel: string = "Label";
  public static readonly profileDirectoryLabel: string = "Profile folder";
  public static readonly settingsLabel: string = "Provider, model, effort, and account";
  public static readonly composerPlaceholder: string = "Describe the work. Enter sends, Shift+Enter adds a line.";
  public static readonly composerBackdropTag: string = "div";
  public static readonly composerBackdropClass: string = "tr-composer-text tr-composer-highlight px-1";
  public static readonly composerCodeTag: string = "span";
  public static readonly composerCodeClass: string = "tr-composer-inline-code";
  public static readonly composerDelimiterClass: string = "tr-composer-code-delimiter";
  public static readonly composerLineEnd: string = "\u200b";
  public static readonly markdownCodeSpanType: string = "codespan";
  public static readonly markdownListType: string = "list";
  public static readonly markdownTableType: string = "table";
  public static readonly markdownBacktick: string = "`";
  public static readonly providerDefaultModel: string = "Default model";
  public static readonly providerDefaultEffort: string = "Default effort";
  public static readonly accountDefaultOption: string = "Any signed-in account";
  public static readonly noProjects: string = "Open a folder to start.";
  public static readonly noConversations: string = "No conversations yet.";
  public static readonly noConversation: string = "Choose or create a conversation.";
  public static readonly noMessages: string = "Say what you need; the team replies here.";
  public static readonly noAccounts: string = "No accounts yet. Add one per provider profile folder, or leave this empty to use the provider's own sign-in.";
  public static readonly renameTitle: string = "Rename conversation";
  public static readonly renameFieldLabel: string = "Title";
  public static readonly deleteTitle: string = "Delete conversation";
  public static readonly forgetTitle: string = "Forget project";
  public static readonly forgetConfirmLabel: string = "Forget";
  public static readonly dismissLabel: string = "Dismiss";
  public static readonly approvalTitle: string = "Approval needed";
  public static readonly identityMissing: string = "identity unknown";
  public static readonly untitledConversation: string = "Untitled";
  public static readonly youLabel: string = "You";
  public static readonly teamRunLabel: string = "TeamRun";
  public static readonly workingLabel: string = "Working";
  public static readonly waitingForTurnLabel: string = "Waiting for its turn";
  public static readonly showMoreLabel: string = "Show more";
  public static readonly showLessLabel: string = "Show less";
  public static readonly dateTimeLocale: string = "en-GB";
  public static readonly defaultTimeFormat: string = "HH:mm";
  public static readonly defaultDateTimeFormat: string = "d MMM yyyy, HH:mm";
  public static readonly twelveHourTimeFormat: string = "h:mm a";
  public static readonly twelveHourDateTimeFormat: string = "MMM d, yyyy, h:mm a";
  public static readonly meridiemToken: string = "a";
  public static readonly morningMarker: string = "AM";
  public static readonly afternoonMarker: string = "PM";
  public static readonly formatTokenPattern: RegExp = /'[^']*'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|ss|a/g;
  public static readonly quoteMark: string = "'";
  public static readonly timeFormatField: string = "timeFormat";
  public static readonly dateTimeFormatField: string = "dateTimeFormat";
  public static readonly hideSidebarLabel: string = "Hide the sidebar";
  public static readonly showSidebarLabel: string = "Show the sidebar";
  public static readonly resizeHandleLabel: string = "Drag or use the arrow keys to resize; double-click or press Enter to reset";
  public static readonly resizeStep: number = 16;
  public static readonly verticalOrientation: string = "vertical";
  public static readonly horizontalOrientation: string = "horizontal";
  public static readonly primaryButton: number = 0;
  public static readonly middleButton: number = 1;
  public static readonly historyLimit: number = 50;
  public static readonly historyBackLabel: string = "Back";
  public static readonly historyForwardLabel: string = "Forward";
  public static readonly searchLabel: string = "Search conversations";
  public static readonly rowMenuLabel: string = "More";
  public static readonly searchPlaceholder: string = "Search titles and messages";
  public static readonly searchEmpty: string = "Nothing found.";
  public static readonly searchHint: string = "Type to search; Enter or a click opens the conversation.";
  public static readonly searchLimit: number = 20;
  public static readonly searchDialogWidth: string = "600px";
  public static readonly searchDialogTop: string = "6px";
  public static readonly quickInputPanelClass: string = "tr-quick-input";
  public static readonly quickInputBackdropClass: string = "tr-quick-input-backdrop";
  public static readonly flashClass: string = "tr-flash";
  public static readonly layoutStorageKey: string = "teamrun.layout";
  public static readonly docksField: string = "docks";
  public static readonly documentsField: string = "documents";
  public static readonly collapsedProjectsField: string = "collapsedProjects";
  public static readonly pinnedConversationsField: string = "pinnedConversations";
  public static readonly projectOrderField: string = "projectOrder";
  public static readonly conversationOrderField: string = "conversationOrder";
  public static readonly conversationListIdPrefix: string = "tr-conversations-";
  public static readonly panelsField: string = "panels";
  public static readonly activePanelField: string = "activePanel";
  public static readonly sizeField: string = "size";
  public static readonly collapsedField: string = "collapsed";
  public static readonly openField: string = "open";
  public static readonly activeField: string = "active";
  public static readonly previewField: string = "preview";
  public static readonly rootField: string = "root";
  public static readonly middleField: string = "middle";
  public static readonly documentsGroupField: string = "documentsGroup";
  public static readonly axisField: string = "axis";
  public static readonly childrenField: string = "children";
  public static readonly weightsField: string = "weights";
  public static readonly invalidSplitMessage: string = "A split needs two or more parts, each with a weight.";
  public static readonly missingDocumentsGroupMessage: string = "The middle of the window needs the conversations group.";
  public static readonly repeatedPanelMessage: string = "A panel can be in only one place.";
  public static readonly panelInstanceMessage: string = "A panel names an instance exactly when its kind opens more than once.";
  public static readonly panelKeySeparator: string = ":";
  public static readonly dockMinimumSize: number = 160;
  public static readonly dockMaximumSize: number = 900;
  public static readonly dockStripSize: number = 44;
  public static readonly shellGap: number = 4;
  public static readonly shellPadding: number = 4;
  public static readonly documentMinimumSize: number = 220;
  public static readonly windowRowHeight: number = 35;
  public static readonly guideSize: number = 40;
  public static readonly guideInset: number = 8;
  public static readonly compassSize: number = 132;
  public static readonly closePanelLabel: string = "Close";
  public static readonly collapseDockLabel: string = "Hide the panel";
  public static readonly noChangesText: string = "No files were edited in this conversation.";
  public static readonly noActivityText: string = "No activity in this conversation.";
  public static readonly closeTabLabel: string = "Close the tab";
  public static readonly openDocumentsLabel: string = "Open conversations";
  public static readonly activeTabSelector: string = ".tr-tab-active";
  public static readonly closeAllLabel: string = "Close all";
  public static readonly dragThreshold: number = 6;
  public static readonly draggingBodyClass: string = "tr-dragging-body";
  public static readonly ghostOffset: number = 12;
  public static readonly pointerMoveEvent: "pointermove" = "pointermove";
  public static readonly pointerUpEvent: "pointerup" = "pointerup";
  public static readonly pointerCancelEvent: "pointercancel" = "pointercancel";
  public static readonly dropSideData: string = "dropSide";
  public static readonly tabIndexData: string = "tabIndex";
  public static readonly dropSideSelector: string = "[data-drop-side]";
  public static readonly tabIndexSelector: string = "[data-tab-index]";
  public static readonly panelData: string = "panel";
  public static readonly panelTabSelector: string = ".tr-tab[data-panel]";
  public static readonly terminalSelector: string = ".tr-terminal";
  public static readonly newTerminalLabel: string = "New terminal";
  public static readonly restartTerminalLabel: string = "Restart";
  public static readonly defaultTerminalColumns: number = 80;
  public static readonly defaultTerminalRows: number = 24;
  public static readonly terminalScrollback: number = 1000;
  public static readonly terminalLineHeight: number = 1.3;
  public static readonly terminalAcknowledgeBatch: number = 16 * 1024;
  public static readonly conptyBackend: "conpty" = "conpty";
  public static readonly deviceAttributesFinal: string = "c";
  public static readonly transparentBackgrounds: readonly string[] = ["", "transparent", "rgba(0, 0, 0, 0)"];
  public static readonly terminalRestartReset: string = "\u001b[?1047l\u001b[!p\u001b[?1000l\u001b[?1002l\u001b[?1003l\u001b[?1006l\u001b[?2004l\r";
  public static readonly terminalLineFeed: string = "\n";
  public static readonly terminalHome: string = "\u001b[H";
  public static readonly dropGroupData: string = "dropGroup";
  public static readonly dropEdgeData: string = "dropEdge";
  public static readonly dropGroupSelector: string = "[data-drop-group]";
  public static readonly dropEdgeSelector: string = "[data-drop-edge]";
  public static readonly dropCenterSelector: string = "[data-drop-center]";
  public static readonly dropTabsSelector: string = "[data-drop-tabs]";
  public static readonly addAsTabLabel: string = "Add as a tab";
  public static readonly addAsTabIcon: string = "tab";
  public static readonly panelActionsLabel: string = "Panel actions";
  public static readonly panelMenuKey: string = "F10";
  public static readonly contextMenuEvent: "contextmenu" = "contextmenu";
  public static readonly moveToLabel: string = "Move to";
  public static readonly splitLabel: string = "Split";
  public static readonly dockLabel: string = "Dock";
  public static readonly documentsGroupLabel: string = "Conversations";
  public static readonly groupLabelJoiner: string = ", ";
  public static readonly panelsMenuLabel: string = "Panels";
  public static readonly resetLayoutLabel: string = "Reset the layout";
  public static readonly panelShortcutActions: Readonly<Partial<Record<PanelKind, ShortcutAction>>> = {
    [PanelKind.Explorer]: ShortcutAction.ToggleExplorer,
    [PanelKind.Changes]: ShortcutAction.ToggleChanges,
    [PanelKind.Activity]: ShortcutAction.ToggleActivity
  };

  public static readonly dockGuideLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Dock on the left",
    [DockSide.Right]: "Dock on the right",
    [DockSide.Bottom]: "Dock at the bottom"
  };
  public static readonly dockGuideIcons: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "dock_to_left",
    [DockSide.Right]: "dock_to_right",
    [DockSide.Bottom]: "dock_to_bottom"
  };
  public static readonly splitGuideLabels: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "Split to the left",
    [PanelEdge.Right]: "Split to the right",
    [PanelEdge.Top]: "Split above",
    [PanelEdge.Bottom]: "Split below"
  };
  public static readonly splitGuideIcons: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "splitscreen_left",
    [PanelEdge.Right]: "splitscreen_right",
    [PanelEdge.Top]: "splitscreen_top",
    [PanelEdge.Bottom]: "splitscreen_bottom"
  };
  public static readonly flashDuration: number = 1600;
  public static readonly arrowLeftKey: string = "ArrowLeft";
  public static readonly arrowRightKey: string = "ArrowRight";
  public static readonly clockLabel: string = "Clock";
  public static readonly openModeLabel: string = "Open conversations";
  public static readonly openModeHint: string = "A single click keeps the conversation's tab, or shows it in one preview tab that a double click keeps.";
  public static readonly clockHint: string = "Sets both formats below to the usual shape for that clock.";
  public static readonly timeFormatLabel: string = "Time format";
  public static readonly timeFormatHint: string = "Shown beside every message.";
  public static readonly dateTimeFormatLabel: string = "Date and time format";
  public static readonly dateTimeFormatHint: string = "Shown where the date matters: message tooltips, recent conversations.";
  public static readonly formatTokensHint: string =
    "Tokens: yyyy yy MMMM MMM MM M dd d EEEE EEE HH H hh h mm ss a. Punctuation and spaces stay; put other text in single quotes, as in 'at' HH:mm.";
  public static readonly enterKey: string = "Enter";
  public static readonly backquoteKey: string = "`";
  public static readonly backquoteCode: string = "Backquote";
  public static readonly copyKey: string = "c";
  public static readonly pasteKey: string = "v";
  public static readonly commaCode: string = "Comma";
  public static readonly slashCode: string = "Slash";
  public static readonly lineSeparator: string = "\n";
  public static readonly titleSeparator: string = " · ";
  public static readonly ellipsis: string = "…";
  public static readonly maximumTitleLength: number = 60;
  public static readonly previewLineCount: number = 6;
  public static readonly toolField: string = "tool";
  public static readonly toolUseIdField: string = "toolUseId";
  public static readonly isErrorField: string = "isError";
  public static readonly dialogWidth: string = "440px";
  public static readonly projectRootMarker: string = ".";
  public static readonly clockIntervalMilliseconds: number = 1000;
  public static readonly pinnedTitle: string = "Pinned";
  public static readonly pinLabel: string = "Pin";
  public static readonly unpinLabel: string = "Unpin";
  public static readonly recentCount: number = 5;
  public static readonly projectConversationCount: number = 10;
  public static readonly collapseProjectLabel: string = "Collapse";
  public static readonly expandProjectLabel: string = "Expand";
  public static readonly accessLabel: string = "Provider approvals";
  public static readonly accessHint: string = "The provider applies its permissions. Some edits run automatically; remaining requests wait for you.";
  public static readonly fullAccessLabel: string = "Auto-approve requests";
  public static readonly fullAccessHint: string = "While this window is open, approve requests from all conversations automatically. Provider restrictions still apply.";
  public static readonly accessMenuLabel: string = "Access";
  public static readonly copyMessageLabel: string = "Copy message";
  public static readonly rewindLabel: string = "Rewind to here";
  public static readonly rewindTitle: string = "Rewind the conversation";
  public static readonly rewindText: string =
    "This message and everything after it will be removed. The next reply starts a fresh provider session that is told what was said before.";
  public static readonly restoreFilesLabel: string = "Also put the project's files back to before this message (git projects, when a snapshot exists)";
  public static readonly rewindConfirmLabel: string = "Rewind";
  public static readonly paragraphSeparator: string = "\n\n";
  public static readonly scrollDownLabel: string = "Scroll to the latest message";
  public static readonly scrollAwayThreshold: number = 120;
  public static readonly messagePageSize: number = 50;
  public static readonly loadPageThreshold: number = 400;
  public static readonly messageHeightEstimate: number = 120;
  public static readonly windowMargin: number = 600;
  public static readonly messageCardSelector: string = "tr-message-card";
  public static readonly messageIdDataKey: string = "messageId";
  public static readonly shownFileCount: number = 3;
  public static readonly imageDimensionCacheLimit: number = 256;
  public static readonly codeLabel: string = "Code";
  public static readonly copyLabel: string = "Copy";
  public static readonly copiedLabel: string = "Copied";
  public static readonly copyButtonSelector: string = ".tr-copy";
  public static readonly copyIcon: string = "content_copy";
  public static readonly copiedIcon: string = "check";
  public static readonly copiedClass: string = "tr-copied";
  public static readonly copiedDuration: number = 1500;
  public static readonly wordWrapLabel: string = "Word wrap";
  public static readonly enableWordWrapLabel: string = "Enable word wrap";
  public static readonly disableWordWrapLabel: string = "Disable word wrap";
  public static readonly wordWrapIcon: string = "wrap_text";
  public static readonly wrapButtonSelector: string = ".tr-wrap-toggle";
  public static readonly wrappedClass: string = "tr-wrap";
  public static readonly expandDiffLabel: string = "Expand diff";
  public static readonly collapseDiffLabel: string = "Collapse diff";
  public static readonly busyBarDelay: number = 300;
  public static readonly codeBlockSelector: string = ".tr-code";
  public static readonly codeSelector: string = "pre code";
  public static readonly space: string = " ";
  public static readonly slash: string = "/";
  public static readonly backslash: string = "\\";
  public static readonly changesField: string = "changes";
  public static readonly itemTypeField: string = "itemType";
  public static readonly imageGenerationItemType: string = "imageGeneration";
  public static readonly savedPathField: string = "savedPath";
  public static readonly storedPathField: string = "storedPath";
  public static readonly sourceField: string = "source";
  public static readonly workingTreeSource: string = "workingTree";
  public static readonly imageDataField: string = "imageData";
  public static readonly mediaTypeField: string = "mediaType";
  public static readonly generatedImageLabel: string = "Generated image";
  public static readonly dataUrlPrefix: string = "data:";
  public static readonly base64Marker: string = ";base64,";
  public static readonly pathField: string = "path";
  public static readonly kindField: string = "kind";
  public static readonly diffField: string = "diff";
  public static readonly inputField: string = "input";
  public static readonly filePathField: string = "file_path";
  public static readonly oldStringField: string = "old_string";
  public static readonly newStringField: string = "new_string";
  public static readonly contentField: string = "content";
  public static readonly editsField: string = "edits";
  public static readonly editTool: string = "Edit";
  public static readonly multiEditTool: string = "MultiEdit";
  public static readonly writeTool: string = "Write";
  public static readonly commandTools: readonly string[] = ["Bash", "PowerShell"];
  public static readonly readTools: readonly string[] = ["Read"];
  public static readonly searchTools: readonly string[] = ["Glob", "Grep", "WebSearch", "WebFetch"];
  public static readonly updateKind: string = "update";
  public static readonly addKind: string = "add";
  public static readonly moveKind: string = "move";
  public static readonly jsonObjectStart: string = "{";
  public static readonly diffAddedPrefix: string = "+";
  public static readonly diffRemovedPrefix: string = "-";
  public static readonly diffContextPrefix: string = " ";
  public static readonly diffAddedFilePrefix: string = "+++";
  public static readonly diffRemovedFilePrefix: string = "---";
  public static readonly diffHunkPrefix: string = "@@";
  public static readonly imagePathPattern: RegExp = /\.(?:png|jpe?g|gif|webp)$/i;
  public static readonly imagePathSearch: RegExp = /(?:[A-Za-z]:\\|\/)[^\s"'<>|*?]+?\.(?:png|jpe?g|gif|webp)\b/gi;

  public static readonly generalTitle: string = "General";
  public static readonly appearanceTitle: string = "Appearance";
  public static readonly providersTitle: string = "Providers";
  public static readonly aboutTitle: string = "About";
  public static readonly galleryTitle: string = "Gallery";
  public static readonly galleryHint: string = "Every control in every state a page can show, in the theme in effect and in the other one.";
  public static readonly galleryThemeInEffect: string = "Theme in effect";
  public static readonly galleryOtherTheme: string = "The other theme";
  public static readonly galleryButtonsTitle: string = "Buttons";
  public static readonly galleryFieldsTitle: string = "Fields";
  public static readonly galleryChoicesTitle: string = "Choices";
  public static readonly gallerySettingTitle: string = "Settings item";
  public static readonly galleryRowsTitle: string = "Rows, headers, and badges";
  public static readonly galleryCardsTitle: string = "Cards, tabs, and messages";
  public static readonly galleryOverlaysTitle: string = "Overlays";
  public static readonly galleryProgressTitle: string = "Progress";
  public static readonly galleryPrimary: string = "Primary";
  public static readonly gallerySecondary: string = "Secondary";
  public static readonly galleryText: string = "Text";
  public static readonly galleryDisabled: string = "Disabled";
  public static readonly galleryIconButton: string = "Icon button";
  public static readonly galleryValue: string = "Value";
  public static readonly galleryPlaceholder: string = "Placeholder";
  public static readonly galleryLabel: string = "Label";
  public static readonly galleryChecked: string = "Checked";
  public static readonly galleryClear: string = "Clear";
  public static readonly galleryPills: readonly string[] = ["One", "Two", "Three"];
  public static readonly galleryOptions: readonly string[] = ["First", "Second", "Third"];
  public static readonly galleryMenuLabel: string = "Open menu";
  public static readonly galleryMenuSection: string = "Section";
  public static readonly galleryHoverLabel: string = "Hover";
  public static readonly galleryHoverText: string = "A hover, as VS Code shows one";
  public static readonly galleryDialogLabel: string = "Open dialog";
  public static readonly galleryDialogTitle: string = "A sample title";
  public static readonly gallerySearchLabel: string = "Open search";
  public static readonly galleryBadge: string = "Badge";
  public static readonly galleryKey: string = "Ctrl+K";
  public static readonly galleryLink: string = "Link";
  public static readonly galleryMuted: string = "Muted";
  public static readonly galleryError: string = "Error";
  public static readonly galleryRow: string = "Row";
  public static readonly gallerySelectedRow: string = "Selected row";
  public static readonly galleryHeader: string = "Header";
  public static readonly galleryTabActive: string = "Active";
  public static readonly galleryTabInactive: string = "Inactive";
  public static readonly galleryBubble: string = "A message with `inline code` from the user";
  public static readonly galleryInlineCode: string = "Try `inline code` while typing.";
  public static readonly galleryAttachmentFile: string = "notes.txt";
  public static readonly galleryAttachmentImage: string = "diagram.png";
  public static readonly galleryAttachmentPreview: string = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='60'%3E%3Cpath fill='%23193f74' d='M0 0h100v60H0z'/%3E%3Cpath fill='%23ffd42a' d='M50 8 30 46h40z'/%3E%3C/svg%3E";
  public static readonly galleryCard: string = "A raised card inside a message";
  public static readonly galleryCode: string = "```typescript\nconst message = 'Toggle word wrap to keep a long line inside this code block while preserving its original text.';\n```";
  public static readonly gallerySettingLabel: string = "A setting";
  public static readonly gallerySettingHint: string = "What it does, in a sentence.";
  public static readonly shortcutsTitle: string = "Shortcuts";
  public static readonly shortcutsText: string =
    "The shortcuts work wherever the focus is, except while a dialog or a menu is open. On a Mac, Cmd stands in for Ctrl.";
  public static readonly composerShortcutsTitle: string = "In the message box";
  public static readonly controlKeyLabel: string = "Ctrl";
  public static readonly shiftKeyLabel: string = "Shift";
  public static readonly altKeyLabel: string = "Alt";
  public static readonly keyJoiner: string = " + ";
  public static readonly escapeKey: string = "Escape";
  public static readonly arrowUpKey: string = "ArrowUp";
  public static readonly arrowDownKey: string = "ArrowDown";
  public static readonly keydownEvent: "keydown" = "keydown";
  public static readonly dataDirectoryLabel: string = "Data folder";
  public static readonly dataDirectoryHint: string = "Where TeamRun keeps its database. The command-line client uses the same folder.";
  public static readonly versionLabel: string = "Version";
  public static readonly platformLabel: string = "Platform";
  public static readonly runtimeLabel: string = "Runtime";
  public static readonly runtimeConnected: string = "Connected";
  public static readonly runtimeUnavailable: string = "Not reachable";
  public static readonly desktopInfoUnavailable: string = "Not available outside the desktop application.";
  public static readonly themeLabel: string = "Theme";
  public static readonly themeHint: string = "Follow the system, or pick a theme.";
  public static readonly systemThemeLabel: string = "System";
  public static readonly interfaceFontLabel: string = "Interface font";
  public static readonly interfaceFontHint: string = "The font of menus, the sidebar, and the chat.";
  public static readonly codeFontLabel: string = "Code font";
  public static readonly codeFontHint: string = "The font of code, commands, and file paths.";
  public static readonly panelTextSizeLabel: string = "Panels";
  public static readonly panelTextSizeHint: string = "Menus, the sidebar, the tabs, and the settings.";
  public static readonly messageTextSizeLabel: string = "Messages";
  public static readonly messageTextSizeHint: string = "The conversation, its cards, and the composer.";
  public static readonly codeTextSizeLabel: string = "Code";
  public static readonly codeTextSizeHint: string = "Code blocks, commands, and file paths.";
  public static readonly textSizeOptions: readonly number[] = [12, 13, 14, 15, 16, 17, 18];
  public static readonly defaultPanelTextSize: number = 13;
  public static readonly defaultMessageTextSize: number = 14;
  public static readonly defaultCodeTextSize: number = 14;
  public static readonly spinnerDiameter: number = 16;
  public static readonly minimumTextSize: number = 12;
  public static readonly maximumTextSize: number = 18;
  public static readonly defaultsTitle: string = "Defaults for new conversations";
  public static readonly defaultsHint: string = "What the composer starts with. Each conversation remembers its own choice afterwards.";
  public static readonly registeredProvidersTitle: string = "Registered providers";
  public static readonly effortLevelsLabel: string = "Effort levels";
  public static readonly noEffortLevels: string = "none";
  public static readonly resumeLabel: string = "Resumes sessions";
  public static readonly signInCheckLabel: string = "Sign-in check";
  public static readonly yesLabel: string = "yes";
  public static readonly noLabel: string = "no";
  public static readonly aboutText: string = "AI coding agents working as a team. Open source under the MIT license.";
  public static readonly licensesTitle: string = "Licenses";
  public static readonly licensesText: string = [
    "Electron, Angular, Angular Material, Tailwind, marked, highlight.js, and Material Symbols under their own licenses.",
    "Noldova Sans and Noldova Mono are SIL Open Font License derivatives of Inter and Inconsolata."
  ].join(" ");
  public static readonly websiteLabel: string = "teamrun.ai";
  public static readonly websiteUrl: string = "https://teamrun.ai";
  public static readonly releasesUrl: string = "https://github.com/noldova-com/teamrun/releases/latest";


  public static readonly fontLabels: Readonly<Record<FontChoice, string>> = {
    [FontChoice.Noldova]: "Noldova",
    [FontChoice.System]: "System"
  };

  public static readonly singlePanelKinds: readonly PanelKind[] = [PanelKind.Explorer, PanelKind.Changes, PanelKind.Activity];

  public static readonly defaultDockSides: Readonly<Record<PanelKind, DockSide>> = {
    [PanelKind.Explorer]: DockSide.Left,
    [PanelKind.Changes]: DockSide.Right,
    [PanelKind.Activity]: DockSide.Bottom,
    [PanelKind.Terminal]: DockSide.Bottom
  };

  public static readonly defaultCollapsedDocks: readonly DockSide[] = [DockSide.Bottom];

  public static readonly dockHandleEdges: Readonly<Record<DockSide, PanelEdge>> = {
    [DockSide.Left]: PanelEdge.Right,
    [DockSide.Right]: PanelEdge.Left,
    [DockSide.Bottom]: PanelEdge.Top
  };

  public static readonly dockEdges: Readonly<Record<DockSide, PanelEdge>> = {
    [DockSide.Left]: PanelEdge.Left,
    [DockSide.Right]: PanelEdge.Right,
    [DockSide.Bottom]: PanelEdge.Bottom
  };

  public static readonly edgeAxes: Readonly<Record<PanelEdge, SplitAxis>> = {
    [PanelEdge.Left]: SplitAxis.Horizontal,
    [PanelEdge.Right]: SplitAxis.Horizontal,
    [PanelEdge.Top]: SplitAxis.Vertical,
    [PanelEdge.Bottom]: SplitAxis.Vertical
  };

  public static readonly leadingEdges: readonly PanelEdge[] = [PanelEdge.Left, PanelEdge.Top];

  public static readonly splitHandleEdges: Readonly<Record<SplitAxis, PanelEdge>> = {
    [SplitAxis.Horizontal]: PanelEdge.Right,
    [SplitAxis.Vertical]: PanelEdge.Bottom
  };

  public static readonly groupMinimumLengths: Readonly<Record<SplitAxis, number>> = {
    [SplitAxis.Horizontal]: 160,
    [SplitAxis.Vertical]: 100
  };

  public static readonly dockCollapseIcons: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "left_panel_close",
    [DockSide.Right]: "right_panel_close",
    [DockSide.Bottom]: "bottom_panel_close"
  };

  public static readonly dockTooltipPositions: Readonly<Record<DockSide, TooltipPosition>> = {
    [DockSide.Left]: "right",
    [DockSide.Right]: "left",
    [DockSide.Bottom]: "above"
  };

  public static readonly defaultDockSizes: Readonly<Record<DockSide, number>> = {
    [DockSide.Left]: 416,
    [DockSide.Right]: 400,
    [DockSide.Bottom]: 260
  };

  public static readonly panelLabels: Readonly<Record<PanelKind, string>> = {
    [PanelKind.Explorer]: "Explorer",
    [PanelKind.Changes]: "Changes",
    [PanelKind.Activity]: "Activity",
    [PanelKind.Terminal]: "Terminal"
  };

  public static readonly panelIcons: Readonly<Record<PanelKind, string>> = {
    [PanelKind.Explorer]: "folder_open",
    [PanelKind.Changes]: "difference",
    [PanelKind.Activity]: "list_alt",
    [PanelKind.Terminal]: "terminal"
  };

  public static readonly openModeLabels: Readonly<Record<OpenMode, string>> = {
    [OpenMode.SingleClick]: "Single click",
    [OpenMode.DoubleClick]: "Double click"
  };

  public static readonly clockLabels: Readonly<Record<ClockChoice, string>> = {
    [ClockChoice.TwentyFourHour]: "24-hour",
    [ClockChoice.TwelveHour]: "12-hour"
  };

  public static readonly clockFormats: Readonly<Record<ClockChoice, { time: string; dateTime: string }>> = {
    [ClockChoice.TwentyFourHour]: { time: Resources.defaultTimeFormat, dateTime: Resources.defaultDateTimeFormat },
    [ClockChoice.TwelveHour]: { time: Resources.twelveHourTimeFormat, dateTime: Resources.twelveHourDateTimeFormat }
  };

  public static readonly keyLabels: Readonly<Record<string, string>> = {
    Escape: "Esc",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Enter: "Enter"
  };

  public static readonly shortcutLabels: Readonly<Record<ShortcutAction, string>> = {
    [ShortcutAction.NewConversation]: "New conversation",
    [ShortcutAction.OpenFolder]: "Open folder",
    [ShortcutAction.OpenSettings]: "Settings",
    [ShortcutAction.ShowShortcuts]: "Show shortcuts",
    [ShortcutAction.ToggleSidebar]: "Hide or show the sidebar",
    [ShortcutAction.Back]: "Back to the conversation shown before",
    [ShortcutAction.Forward]: "Forward again",
    [ShortcutAction.Search]: "Search conversations",
    [ShortcutAction.ToggleExplorer]: "Show or hide the Explorer",
    [ShortcutAction.ToggleChanges]: "Show or hide the Changes",
    [ShortcutAction.ToggleActivity]: "Show or hide the Activity",
    [ShortcutAction.ToggleBottomDock]: "Hide or show the bottom dock",
    [ShortcutAction.ToggleTerminal]: "Show the terminal, or leave it and hide its dock",
    [ShortcutAction.NewTerminal]: "Open a new terminal",
    [ShortcutAction.CloseDocument]: "Close the conversation's tab",
    [ShortcutAction.FocusComposer]: "Go to the message box",
    [ShortcutAction.StopOrBack]: "Stop the running reply, or back to the chat from settings",
    [ShortcutAction.PreviousConversation]: "Previous recent conversation",
    [ShortcutAction.NextConversation]: "Next recent conversation",
    [ShortcutAction.Send]: "Send",
    [ShortcutAction.NewLine]: "New line"
  };

  public static readonly shortcuts: readonly Shortcut[] = [
    new Shortcut(ShortcutAction.NewConversation, "n", true, false, false, true),
    new Shortcut(ShortcutAction.OpenFolder, "o", true, false, false, true),
    new Shortcut(ShortcutAction.OpenSettings, ",", true, false, false, true, Resources.commaCode),
    new Shortcut(ShortcutAction.ShowShortcuts, "/", true, false, false, true, Resources.slashCode),
    new Shortcut(ShortcutAction.ToggleSidebar, "b", true, false, false, true),
    new Shortcut(ShortcutAction.Back, Resources.arrowLeftKey, false, false, true, true),
    new Shortcut(ShortcutAction.Forward, Resources.arrowRightKey, false, false, true, true),
    new Shortcut(ShortcutAction.Search, "k", true, false, false, true),
    new Shortcut(ShortcutAction.ToggleExplorer, "e", true, true, false, true),
    new Shortcut(ShortcutAction.ToggleChanges, "d", true, true, false, true),
    new Shortcut(ShortcutAction.ToggleActivity, "a", true, true, false, true),
    new Shortcut(ShortcutAction.ToggleBottomDock, "j", true, false, false, true),
    new Shortcut(ShortcutAction.ToggleTerminal, Resources.backquoteKey, true, false, false, true, Resources.backquoteCode),
    new Shortcut(ShortcutAction.NewTerminal, Resources.backquoteKey, true, true, false, true, Resources.backquoteCode),
    new Shortcut(ShortcutAction.CloseDocument, "w", true, false, false, true),
    new Shortcut(ShortcutAction.FocusComposer, "l", true, false, false, true),
    new Shortcut(ShortcutAction.StopOrBack, Resources.escapeKey, false, false, false, true),
    new Shortcut(ShortcutAction.PreviousConversation, Resources.arrowUpKey, false, false, true, true),
    new Shortcut(ShortcutAction.NextConversation, Resources.arrowDownKey, false, false, true, true),
    new Shortcut(ShortcutAction.Send, Resources.enterKey, false, false, false, false),
    new Shortcut(ShortcutAction.NewLine, Resources.enterKey, false, true, false, false)
  ];

  public static readonly sectionLabels: Readonly<Record<SettingsSection, string>> = {
    [SettingsSection.General]: Resources.generalTitle,
    [SettingsSection.Appearance]: Resources.appearanceTitle,
    [SettingsSection.Providers]: Resources.providersTitle,
    [SettingsSection.Teammates]: Resources.teammatesTitle,
    [SettingsSection.Shortcuts]: Resources.shortcutsTitle,
    [SettingsSection.Gallery]: Resources.galleryTitle,
    [SettingsSection.About]: Resources.aboutTitle
  };

  public static readonly sectionIcons: Readonly<Record<SettingsSection, string>> = {
    [SettingsSection.General]: "settings",
    [SettingsSection.Appearance]: "palette",
    [SettingsSection.Providers]: "smart_toy",
    [SettingsSection.Teammates]: "group",
    [SettingsSection.Shortcuts]: "keyboard",
    [SettingsSection.Gallery]: "widgets",
    [SettingsSection.About]: "info"
  };

  public static readonly preferencesStorageKey: string = "teamrun.preferences";
  public static readonly settingsHash: string = "#settings";
  public static readonly themeField: string = "theme";
  public static readonly accessModeField: string = "accessMode";
  public static readonly openModeField: string = "openMode";
  public static readonly interfaceFontField: string = "interfaceFont";
  public static readonly codeFontField: string = "codeFont";
  public static readonly panelTextSizeField: string = "panelTextSize";
  public static readonly messageTextSizeField: string = "messageTextSize";
  public static readonly codeTextSizeField: string = "codeTextSize";
  public static readonly defaultComposerField: string = "defaultComposer";
  public static readonly composerByConversationField: string = "composerByConversation";
  public static readonly providerField: string = "provider";
  public static readonly modelField: string = "model";
  public static readonly effortField: string = "effort";
  public static readonly providerAccountIdField: string = "providerAccountId";
  public static readonly dataDirectoryField: string = "dataDirectory";
  public static readonly productVersionField: string = "productVersion";
  public static readonly platformField: string = "platform";
  public static readonly macPlatform: string = "darwin";
  public static readonly macClass: string = "tr-mac";
  public static readonly panelTextSizeVariable: string = "--tr-text-panel";
  public static readonly messageTextSizeVariable: string = "--tr-text-message";
  public static readonly codeTextSizeVariable: string = "--tr-text-code";
  public static readonly sansFontVariable: string = "--tr-font-sans";
  public static readonly monoFontVariable: string = "--tr-font-mono";
  public static readonly noldovaSansStack: string = "\"Noldova Sans\", system-ui, \"Segoe UI\", Roboto, sans-serif";
  public static readonly systemSansStack: string = "system-ui, \"Segoe UI\", Roboto, sans-serif";
  public static readonly noldovaMonoStack: string = "\"Noldova Mono\", ui-monospace, \"Cascadia Mono\", Consolas, monospace";
  public static readonly systemMonoStack: string = "ui-monospace, \"Cascadia Mono\", Consolas, monospace";
  public static readonly lightScheme: string = "light";
  public static readonly darkScheme: string = "dark";
  public static readonly darkSchemeQuery: string = "(prefers-color-scheme: dark)";
  public static readonly systemThemeId: string = "system";
  public static readonly darkModernThemeId: string = "dark-modern";
  public static readonly lightModernThemeId: string = "light-modern";
  public static readonly themeNameField: string = "name";
  public static readonly themeTypeField: string = "type";
  public static readonly themeColorsField: string = "colors";
  public static readonly lightThemeType: string = "light";
  public static readonly themeColorPattern: RegExp = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  public static readonly titleBarBackground: ThemeToken = new ThemeToken("--tr-title-bar", "titleBar.activeBackground", "sideBar.background");
  public static readonly panelBackground: ThemeToken = new ThemeToken("--tr-panel", "editor.background");
  public static readonly titleBarForeground: ThemeToken = new ThemeToken("--tr-title-bar-text", "titleBar.activeForeground", "foreground");
  public static readonly terminalShortcutActions: readonly ShortcutAction[] = [ShortcutAction.ToggleTerminal, ShortcutAction.NewTerminal];

  public static readonly terminalColorTokens: Readonly<Record<TerminalColor, ThemeToken>> = {
    [TerminalColor.Foreground]: new ThemeToken("--tr-terminal-foreground", "terminal.foreground", "foreground"),
    [TerminalColor.Cursor]: new ThemeToken("--tr-terminal-cursor", "terminalCursor.foreground", "terminal.foreground"),
    [TerminalColor.SelectionBackground]: new ThemeToken("--tr-terminal-selection", "terminal.selectionBackground", "editor.selectionBackground"),
    [TerminalColor.Black]: new ThemeToken("--tr-terminal-black", "terminal.ansiBlack"),
    [TerminalColor.Red]: new ThemeToken("--tr-terminal-red", "terminal.ansiRed"),
    [TerminalColor.Green]: new ThemeToken("--tr-terminal-green", "terminal.ansiGreen"),
    [TerminalColor.Yellow]: new ThemeToken("--tr-terminal-yellow", "terminal.ansiYellow"),
    [TerminalColor.Blue]: new ThemeToken("--tr-terminal-blue", "terminal.ansiBlue"),
    [TerminalColor.Magenta]: new ThemeToken("--tr-terminal-magenta", "terminal.ansiMagenta"),
    [TerminalColor.Cyan]: new ThemeToken("--tr-terminal-cyan", "terminal.ansiCyan"),
    [TerminalColor.White]: new ThemeToken("--tr-terminal-white", "terminal.ansiWhite"),
    [TerminalColor.BrightBlack]: new ThemeToken("--tr-terminal-bright-black", "terminal.ansiBrightBlack"),
    [TerminalColor.BrightRed]: new ThemeToken("--tr-terminal-bright-red", "terminal.ansiBrightRed"),
    [TerminalColor.BrightGreen]: new ThemeToken("--tr-terminal-bright-green", "terminal.ansiBrightGreen"),
    [TerminalColor.BrightYellow]: new ThemeToken("--tr-terminal-bright-yellow", "terminal.ansiBrightYellow"),
    [TerminalColor.BrightBlue]: new ThemeToken("--tr-terminal-bright-blue", "terminal.ansiBrightBlue"),
    [TerminalColor.BrightMagenta]: new ThemeToken("--tr-terminal-bright-magenta", "terminal.ansiBrightMagenta"),
    [TerminalColor.BrightCyan]: new ThemeToken("--tr-terminal-bright-cyan", "terminal.ansiBrightCyan"),
    [TerminalColor.BrightWhite]: new ThemeToken("--tr-terminal-bright-white", "terminal.ansiBrightWhite")
  };

  public static readonly themeTokens: readonly ThemeToken[] = [
    ...Object.values(Resources.terminalColorTokens),
    new ThemeToken("--tr-avatar-default-background", "teamrun.avatar.default.background"),
    new ThemeToken("--tr-avatar-default-foreground", "teamrun.avatar.default.foreground"),
    new ThemeToken("--tr-avatar-teal-background", "teamrun.avatar.teal.background"),
    new ThemeToken("--tr-avatar-teal-foreground", "teamrun.avatar.teal.foreground"),
    new ThemeToken("--tr-avatar-green-background", "teamrun.avatar.green.background"),
    new ThemeToken("--tr-avatar-green-foreground", "teamrun.avatar.green.foreground"),
    new ThemeToken("--tr-avatar-lime-background", "teamrun.avatar.lime.background"),
    new ThemeToken("--tr-avatar-lime-foreground", "teamrun.avatar.lime.foreground"),
    new ThemeToken("--tr-avatar-amber-background", "teamrun.avatar.amber.background"),
    new ThemeToken("--tr-avatar-amber-foreground", "teamrun.avatar.amber.foreground"),
    new ThemeToken("--tr-avatar-orange-background", "teamrun.avatar.orange.background"),
    new ThemeToken("--tr-avatar-orange-foreground", "teamrun.avatar.orange.foreground"),
    new ThemeToken("--tr-avatar-red-background", "teamrun.avatar.red.background"),
    new ThemeToken("--tr-avatar-red-foreground", "teamrun.avatar.red.foreground"),
    new ThemeToken("--tr-avatar-rose-background", "teamrun.avatar.rose.background"),
    new ThemeToken("--tr-avatar-rose-foreground", "teamrun.avatar.rose.foreground"),
    new ThemeToken("--tr-avatar-pink-background", "teamrun.avatar.pink.background"),
    new ThemeToken("--tr-avatar-pink-foreground", "teamrun.avatar.pink.foreground"),
    new ThemeToken("--tr-avatar-purple-background", "teamrun.avatar.purple.background"),
    new ThemeToken("--tr-avatar-purple-foreground", "teamrun.avatar.purple.foreground"),
    new ThemeToken("--tr-avatar-violet-background", "teamrun.avatar.violet.background"),
    new ThemeToken("--tr-avatar-violet-foreground", "teamrun.avatar.violet.foreground"),
    new ThemeToken("--tr-avatar-indigo-background", "teamrun.avatar.indigo.background"),
    new ThemeToken("--tr-avatar-indigo-foreground", "teamrun.avatar.indigo.foreground"),
    new ThemeToken("--tr-avatar-cyan-background", "teamrun.avatar.cyan.background"),
    new ThemeToken("--tr-avatar-cyan-foreground", "teamrun.avatar.cyan.foreground"),
    Resources.titleBarBackground,
    Resources.titleBarForeground,
    new ThemeToken("--tr-window", "sideBar.background"),
    Resources.panelBackground,
    new ThemeToken("--tr-raised", "teamrun.raisedBackground", "editorWidget.background"),
    new ThemeToken("--tr-text", "foreground"),
    new ThemeToken("--tr-text-muted", "teamrun.mutedForeground", "descriptionForeground"),
    new ThemeToken("--tr-icon-color", "icon.foreground", "foreground"),
    new ThemeToken("--tr-card-border", "surface.border", "widget.border"),
    new ThemeToken("--tr-border", "sideBarSectionHeader.border", "widget.border"),
    new ThemeToken("--tr-accent", "focusBorder"),
    new ThemeToken("--tr-hover", "list.hoverBackground"),
    new ThemeToken("--tr-selected", "list.inactiveSelectionBackground", "list.activeSelectionBackground"),
    new ThemeToken("--tr-toolbar-hover", "toolbar.hoverBackground"),
    new ThemeToken("--tr-scrollbar", "scrollbarSlider.background"),
    new ThemeToken("--tr-error", "errorForeground"),
    new ThemeToken("--tr-link", "textLink.foreground"),
    new ThemeToken("--tr-added", "gitDecoration.addedResourceForeground"),
    new ThemeToken("--tr-removed", "gitDecoration.deletedResourceForeground"),
    new ThemeToken("--tr-added-background", "diffEditor.insertedTextBackground"),
    new ThemeToken("--tr-removed-background", "diffEditor.removedTextBackground"),
    new ThemeToken("--tr-input", "input.background"),
    new ThemeToken("--tr-input-border", "input.border"),
    new ThemeToken("--tr-input-text", "input.foreground", "foreground"),
    new ThemeToken("--tr-placeholder", "input.placeholderForeground", "descriptionForeground"),
    new ThemeToken("--tr-button", "button.background", "focusBorder"),
    new ThemeToken("--tr-button-text", "button.foreground"),
    new ThemeToken("--tr-button-hover", "button.hoverBackground", "button.background"),
    new ThemeToken("--tr-button-secondary", "button.secondaryBackground"),
    new ThemeToken("--tr-button-secondary-text", "button.secondaryForeground", "foreground"),
    new ThemeToken("--tr-button-secondary-hover", "button.secondaryHoverBackground", "list.hoverBackground"),
    new ThemeToken("--tr-dropdown", "dropdown.background", "input.background"),
    new ThemeToken("--tr-dropdown-border", "dropdown.border", "input.border"),
    new ThemeToken("--tr-menu", "menu.background", "editorWidget.background"),
    new ThemeToken("--tr-menu-text", "menu.foreground", "foreground"),
    new ThemeToken("--tr-menu-border", "menu.border", "widget.border"),
    new ThemeToken("--tr-menu-selected", "menu.selectionBackground", "focusBorder"),
    new ThemeToken("--tr-menu-selected-text", "menu.selectionForeground", "button.foreground"),
    new ThemeToken("--tr-checkbox", "checkbox.background", "input.background"),
    new ThemeToken("--tr-checkbox-border", "checkbox.border", "input.border"),
    new ThemeToken("--tr-badge", "badge.background"),
    new ThemeToken("--tr-badge-text", "badge.foreground"),
    new ThemeToken("--tr-progress", "progressBar.background", "focusBorder"),
    new ThemeToken("--tr-notification", "notifications.background", "editorWidget.background"),
    new ThemeToken("--tr-notification-border", "notifications.border", "widget.border"),
    new ThemeToken("--mat-sys-primary", "focusBorder"),
    new ThemeToken("--mat-sys-on-primary", "button.foreground"),
    new ThemeToken("--mat-sys-surface", "editor.background"),
    new ThemeToken("--mat-sys-background", "editor.background"),
    new ThemeToken("--mat-sys-on-surface", "foreground"),
    new ThemeToken("--mat-sys-on-background", "foreground"),
    new ThemeToken("--mat-sys-on-surface-variant", "descriptionForeground"),
    new ThemeToken("--mat-sys-secondary", "descriptionForeground"),
    new ThemeToken("--mat-sys-outline", "input.border"),
    new ThemeToken("--mat-sys-outline-variant", "sideBarSectionHeader.border"),
    new ThemeToken("--mat-sys-surface-container-lowest", "sideBar.background"),
    new ThemeToken("--mat-sys-surface-container-low", "sideBar.background"),
    new ThemeToken("--mat-sys-surface-container", "teamrun.raisedBackground", "editorWidget.background"),
    new ThemeToken("--mat-sys-surface-container-high", "input.background"),
    new ThemeToken("--mat-sys-secondary-container", "input.background"),
    new ThemeToken("--mat-sys-on-secondary-container", "foreground"),
    new ThemeToken("--mat-sys-error", "errorForeground"),
    new ThemeToken("--tr-button-border", "button.border"),
    new ThemeToken("--tr-dropdown-list", "dropdown.listBackground", "dropdown.background"),
    new ThemeToken("--tr-setting-title", "settings.headerForeground", "foreground"),
    new ThemeToken("--tr-list-active", "list.activeSelectionBackground", "list.inactiveSelectionBackground"),
    new ThemeToken("--tr-list-active-text", "list.activeSelectionForeground", "foreground"),
    new ThemeToken("--tr-hover-widget", "editorHoverWidget.background", "editorWidget.background"),
    new ThemeToken("--tr-hover-widget-border", "editorHoverWidget.border", "widget.border"),
    new ThemeToken("--tr-quick-input", "quickInput.background", "editorWidget.background"),
    new ThemeToken("--tr-menu-separator", "menu.separatorBackground", "widget.border"),
    new ThemeToken("--tr-widget-shadow", "widget.shadow"),
    new ThemeToken("--tr-widget-border", "widget.border", "surface.border"),
    new ThemeToken("--tr-dialog", "dialog.background", "editorWidget.background"),
    new ThemeToken("--tr-code", "teamrun.codeBackground", "sideBar.background"),
    new ThemeToken("--tr-code-header", "teamrun.codeHeaderBackground", "editorWidget.background")
  ];

  public static readonly icons: Readonly<Record<string, string>> = {
    image: "image",
    download: "download",
    update: "system_update_alt",
    zoomIn: "add",
    zoomOut: "remove",
    attachment: "attach_file",
    hideSidebar: "left_panel_close",
    showSidebar: "left_panel_open",
    close: "close",
    forward: "arrow_forward",
    panels: "dashboard",
    resetLayout: "restart_alt",
    restartTerminal: "refresh",
    more: "more_vert",
    search: "search",
    folderOpen: "folder_open",
    folder: "folder",
    forget: "delete",
    pin: "keep",
    unpin: "keep_off",
    add: "add",
    send: "arrow_upward",
    stop: "stop",
    edit: "edit",
    settings: "settings",
    back: "arrow_back",
    check: "sync",
    remove: "person_remove",
    user: "person",
    provider: "smart_toy",
    reasoning: "psychology",
    command: "terminal",
    fileChange: "edit_document",
    note: "info",
    error: "error",
    text: "notes",
    approval: "gavel",
    loggedIn: "verified_user",
    loggedOut: "person_off",
    unknown: "help",
    expandMore: "expand_more",
    expandLess: "expand_less",
    selected: "check",
    unselected: "radio_button_unchecked",
    currentStep: "progress_activity",
    tool: "build",
    openExternal: "open_in_new",
    newChat: "edit_square",
    chevronRight: "chevron_right",
    arrowDown: "arrow_downward",
    shield: "shield",
    fullAccess: "bolt",
    copy: "content_copy",
    rewind: "history",
    openDocuments: "more_horiz",
    panelActions: "more_horiz",
    moveTo: "tab_move",
    split: "splitscreen",
    dock: "dock_to_right"
  };

  public static readonly accessModeLabels: Readonly<Record<AccessMode, string>> = {
    [AccessMode.Ask]: Resources.accessLabel,
    [AccessMode.Full]: Resources.fullAccessLabel
  };

  public static readonly accessModeHints: Readonly<Record<AccessMode, string>> = {
    [AccessMode.Ask]: Resources.accessHint,
    [AccessMode.Full]: Resources.fullAccessHint
  };

  public static readonly toolIcons: Readonly<Record<string, string>> = {
    Read: "description",
    Glob: "search",
    Grep: "search",
    WebSearch: "travel_explore",
    WebFetch: "public",
    Bash: "terminal",
    PowerShell: "terminal",
    Edit: "edit_document",
    Write: "edit_document",
    Task: "account_tree"
  };

  public static formatMessageSelector(messageId: string): string {
    return `[data-message-id="${messageId}"]`;
  }

  public static formatDeleteText(title: string): string {
    return `"${title}" and its messages are removed. This cannot be undone.`;
  }

  public static formatForgetText(name: string): string {
    return `"${name}" and every conversation under it are removed from TeamRun. The folder itself stays.`;
  }

  public static formatShowMore(count: number): string {
    return `Show ${count} more`;
  }

  public static formatThemeUnreadable(id: string): string {
    return `The built-in theme "${id}" could not be read.`;
  }

  public static formatTerminalExit(exitCode: number): string {
    return `The shell exited with code ${exitCode}.`;
  }

  public static formatFontLoad(size: number, family: string): string {
    return `${size}px ${family}`;
  }

  public static formatPixelSize(value: number): string {
    return `${value} pixels`;
  }

  public static formatPixels(value: number): string {
    return `${value}px`;
  }

  public static formatWithKeys(label: string, keys: string): string {
    return String.isNullOrWhitespace(keys) ? label : `${label} (${keys})`;
  }

  public static formatEditedFiles(count: number): string {
    return count === 1 ? "Edited 1 file" : `Edited ${count} files`;
  }

  public static formatShowMoreFiles(count: number): string {
    return count === 1 ? "Show 1 more file" : `Show ${count} more files`;
  }

  public static formatCodeBlock(language: string, inner: string): string {
    const label = `aria-label="${Resources.copyLabel}" title="${Resources.copyLabel}"`;
    const copy = `<span class="tr-copy tr-code-action ${Resources.iconFontClass}" role="button" tabindex="0" ${label}>${Resources.copyIcon}</span>`;
    const wrap = `<span class="tr-wrap-toggle tr-code-action ${Resources.iconFontClass}" role="button" tabindex="0" aria-label="${Resources.wordWrapLabel}" aria-pressed="false" title="${Resources.enableWordWrapLabel}">${Resources.wordWrapIcon}</span>`;
    const header = `<div class="tr-code-header"><span>${language}</span><span class="tr-code-actions">${wrap}${copy}</span></div>`;
    return `<div class="tr-code">${header}${inner}</div>`;
  }

  public static formatHighlightedCode(language: string, html: string): string {
    return `<pre><code class="hljs language-${language}">${html}${Resources.lineSeparator}</code></pre>`;
  }

  public static formatRequestId(sequence: number): string {
    return `${Resources.requestIdPrefix}-${sequence}`;
  }

  public static formatProvenance(provider: string | null, model: string | null, effort: string | null): string {
    return [provider, model, effort].filter(t => t !== null).join(Resources.titleSeparator);
  }

  public static formatAccountLine(provider: string, status: string, identity: string | null): string {
    return `${provider}${Resources.titleSeparator}${status}${Resources.titleSeparator}${identity ?? Resources.identityMissing}`;
  }

  public static formatWorkedFor(duration: string): string {
    return `Worked for ${duration}`;
  }

  public static formatWorkingFor(duration: string): string {
    return `${Resources.workingLabel} for ${duration}`;
  }

  public static formatCommandCount(count: number): string {
    return count === 1 ? "ran 1 command" : `ran ${count} commands`;
  }

  public static formatEditCount(count: number): string {
    return count === 1 ? "edited 1 file" : `edited ${count} files`;
  }

  public static formatReadCount(count: number): string {
    return count === 1 ? "read 1 file" : `read ${count} files`;
  }

  public static formatSearchCount(count: number): string {
    return count === 1 ? "searched once" : `searched ${count} times`;
  }

  public static formatThoughtCount(count: number): string {
    return count === 1 ? "thought once" : `thought ${count} times`;
  }

  public static formatOtherStepCount(count: number, alone: boolean): string {
    if (alone)
      return Resources.formatSteps(count);
    return count === 1 ? "1 more step" : `${count} more steps`;
  }

  public static formatActivitySummary(parts: readonly string[]): string {
    const joined = parts.join(", ");
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  }

  public static formatSteps(count: number): string {
    return count === 1 ? "1 step" : `${count} steps`;
  }

  public static formatDuration(milliseconds: number): string {
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    if (seconds < 60)
      return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
      return `${minutes}m ${seconds % 60}s`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
}
