/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { AccessMode } from "../enums/access-mode";
import { OpenMode } from "../enums/open-mode";
import { ImageOpenMode } from "../enums/image-open-mode";
import { FontChoice } from "../enums/font-choice";
import { Resources } from "../resources";
import { ComposerSettings } from "./composer-settings";

export class Preferences {
  public readonly theme: string;
  public readonly interfaceFont: FontChoice;
  public readonly codeFont: FontChoice;
  public readonly panelTextSize: number;
  public readonly messageTextSize: number;
  public readonly codeTextSize: number;
  public readonly defaultComposer: ComposerSettings | null;
  public readonly composerByConversation: ReadonlyMap<string, ComposerSettings>;
  public readonly accessMode: AccessMode;
  public readonly timeFormat: string;
  public readonly dateTimeFormat: string;
  public readonly openMode: OpenMode;
  public readonly imageOpenMode: ImageOpenMode;
  public readonly defaultShellId: string | null;
  public readonly terminalOutputLimit: number;

  public constructor(
    theme: string,
    interfaceFont: FontChoice,
    codeFont: FontChoice,
    panelTextSize: number,
    messageTextSize: number,
    codeTextSize: number,
    defaultComposer: ComposerSettings | null,
    composerByConversation: ReadonlyMap<string, ComposerSettings>,
    accessMode: AccessMode = AccessMode.Ask,
    timeFormat: string = Resources.defaultTimeFormat,
    dateTimeFormat: string = Resources.defaultDateTimeFormat,
    openMode: OpenMode = OpenMode.DoubleClick,
    imageOpenMode: ImageOpenMode = ImageOpenMode.Popup,
    defaultShellId: string | null = null,
    terminalOutputLimit: number = Resources.defaultTerminalOutputLimit) {
    this.theme = theme;
    this.interfaceFont = interfaceFont;
    this.codeFont = codeFont;
    this.panelTextSize = panelTextSize;
    this.messageTextSize = messageTextSize;
    this.codeTextSize = codeTextSize;
    this.defaultComposer = defaultComposer;
    this.composerByConversation = composerByConversation;
    this.accessMode = accessMode;
    this.timeFormat = timeFormat;
    this.dateTimeFormat = dateTimeFormat;
    this.openMode = openMode;
    this.imageOpenMode = imageOpenMode;
    this.defaultShellId = defaultShellId;
    this.terminalOutputLimit = terminalOutputLimit;
  }

  public static createDefault(): Preferences {
    return new Preferences(Resources.systemThemeId, FontChoice.Noldova, FontChoice.Noldova,
      Resources.defaultPanelTextSize, Resources.defaultMessageTextSize, Resources.defaultCodeTextSize, null, new Map());
  }

  public static fromJson(value: unknown): Preferences {
    const defaults = Preferences.createDefault();
    if (!Object.isObject(value) || Array.isArray(value))
      return defaults;
    const record: Record<string, unknown> = { ...value };
    const composers = new Map<string, ComposerSettings>();
    const stored = record[Resources.composerByConversationField];
    if (Object.isObject(stored) && !Array.isArray(stored))
      for (const [conversationId, composer] of Object.entries(stored)) {
        const parsed = Preferences.readComposer(composer);
        if (!Object.isNull(parsed))
          composers.set(conversationId, parsed);
      }

    return new Preferences(
      Preferences.readTheme(record[Resources.themeField], defaults.theme),
      Preferences.readChoice(record[Resources.interfaceFontField], Object.values(FontChoice), defaults.interfaceFont),
      Preferences.readChoice(record[Resources.codeFontField], Object.values(FontChoice), defaults.codeFont),
      Preferences.readSize(record[Resources.panelTextSizeField], defaults.panelTextSize),
      Preferences.readSize(record[Resources.messageTextSizeField], defaults.messageTextSize),
      Preferences.readSize(record[Resources.codeTextSizeField], defaults.codeTextSize),
      Preferences.readComposer(record[Resources.defaultComposerField]),
      composers,
      Preferences.readChoice(record[Resources.accessModeField], Object.values(AccessMode), defaults.accessMode),
      Preferences.readOptionalString(record[Resources.timeFormatField]) ?? defaults.timeFormat,
      Preferences.readOptionalString(record[Resources.dateTimeFormatField]) ?? defaults.dateTimeFormat,
      Preferences.readChoice(record[Resources.openModeField], Object.values(OpenMode), defaults.openMode),
      Preferences.readChoice(record[Resources.imageOpenModeField], Object.values(ImageOpenMode), defaults.imageOpenMode),
      Preferences.readOptionalString(record[Resources.defaultShellIdField]),
      Preferences.readTerminalOutputLimit(record[Resources.terminalOutputLimitField], defaults.terminalOutputLimit));
  }

  public static isTerminalOutputLimit(value: unknown): value is number {
    return Object.isNumber(value) && Number.isInteger(value) && value >= Resources.minimumTerminalOutputLimit && value <= Resources.maximumTerminalOutputLimit;
  }

  public toJson(): Record<string, unknown> {
    const composers: Record<string, unknown> = {};
    for (const [conversationId, composer] of this.composerByConversation)
      composers[conversationId] = Preferences.writeComposer(composer);

    return {
      [Resources.themeField]: this.theme,
      [Resources.interfaceFontField]: this.interfaceFont,
      [Resources.codeFontField]: this.codeFont,
      [Resources.panelTextSizeField]: this.panelTextSize,
      [Resources.messageTextSizeField]: this.messageTextSize,
      [Resources.codeTextSizeField]: this.codeTextSize,
      [Resources.defaultComposerField]: Object.isNull(this.defaultComposer) ? null : Preferences.writeComposer(this.defaultComposer),
      [Resources.composerByConversationField]: composers,
      [Resources.accessModeField]: this.accessMode,
      [Resources.timeFormatField]: this.timeFormat,
      [Resources.dateTimeFormatField]: this.dateTimeFormat,
      [Resources.openModeField]: this.openMode,
      [Resources.imageOpenModeField]: this.imageOpenMode,
      [Resources.defaultShellIdField]: this.defaultShellId,
      [Resources.terminalOutputLimitField]: this.terminalOutputLimit
    };
  }

  public with(changes: Partial<Preferences>): Preferences {
    return new Preferences(
      changes.theme ?? this.theme,
      changes.interfaceFont ?? this.interfaceFont,
      changes.codeFont ?? this.codeFont,
      changes.panelTextSize ?? this.panelTextSize,
      changes.messageTextSize ?? this.messageTextSize,
      changes.codeTextSize ?? this.codeTextSize,
      Object.isUndefined(changes.defaultComposer) ? this.defaultComposer : changes.defaultComposer,
      changes.composerByConversation ?? this.composerByConversation,
      changes.accessMode ?? this.accessMode,
      changes.timeFormat ?? this.timeFormat,
      changes.dateTimeFormat ?? this.dateTimeFormat,
      changes.openMode ?? this.openMode,
      changes.imageOpenMode ?? this.imageOpenMode,
      changes.defaultShellId ?? this.defaultShellId,
      changes.terminalOutputLimit ?? this.terminalOutputLimit);
  }

  private static readTheme(value: unknown, fallback: string): string {
    return Object.isString(value) && !String.isNullOrWhitespace(value) ? value : fallback;
  }

  private static readChoice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.find(t => t === value) ?? fallback;
  }

  private static readSize(value: unknown, fallback: number): number {
    return Object.isNumber(value) && Number.isInteger(value) && value >= Resources.minimumTextSize && value <= Resources.maximumTextSize
      ? value
      : fallback;
  }

  private static readTerminalOutputLimit(value: unknown, fallback: number): number {
    return Preferences.isTerminalOutputLimit(value) ? value : fallback;
  }

  private static readComposer(value: unknown): ComposerSettings | null {
    if (!Object.isObject(value) || Array.isArray(value))
      return null;
    const record: Record<string, unknown> = { ...value };
    const provider = record[Resources.providerField];
    if (!Object.isString(provider) || String.isNullOrWhitespace(provider))
      return null;

    return new ComposerSettings(
      provider,
      Preferences.readOptionalString(record[Resources.modelField]),
      Preferences.readOptionalString(record[Resources.effortField]),
      Preferences.readOptionalString(record[Resources.providerAccountIdField]),
      Preferences.readOptionalString(record[Resources.responderTeammateIdField]));
  }

  private static readOptionalString(value: unknown): string | null {
    return Object.isString(value) && !String.isNullOrWhitespace(value) ? value : null;
  }

  private static writeComposer(composer: ComposerSettings): Record<string, unknown> {
    return {
      [Resources.providerField]: composer.provider,
      [Resources.modelField]: composer.model,
      [Resources.effortField]: composer.effort,
      [Resources.providerAccountIdField]: composer.providerAccountId,
      [Resources.responderTeammateIdField]: composer.responderTeammateId
    };
  }
}
