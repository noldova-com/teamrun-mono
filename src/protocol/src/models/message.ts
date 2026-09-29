/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { MessageAuthor } from "../enums/message-author.js";
import { MessageStatus } from "../enums/message-status.js";
import { Resources } from "../resources.js";
import { MessageDetail } from "./message-detail.js";
import { MessageAttachment } from "./message-attachment.js";
import { Provenance } from "./provenance.js";
import { TeammateMention } from "./teammate-mention.js";

export class Message {
  private static readonly OPEN_STATUSES: readonly MessageStatus[] = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval];
  private static readonly STARTED_STATUSES: readonly MessageStatus[] = [MessageStatus.Running, MessageStatus.AwaitingApproval];

  public readonly id: string;
  public readonly conversationId: string;
  public readonly sequence: number;
  public readonly author: MessageAuthor;
  public readonly inReplyTo: string | null;
  public readonly status: MessageStatus;
  public readonly details: readonly MessageDetail[];
  public readonly provenance: Provenance | null;
  public readonly createdAt: string;
  public readonly startedAt: string | null;
  public readonly endedAt: string | null;
  public readonly attachments: readonly MessageAttachment[];
  public readonly teammateId: string | null;
  public readonly teammateName: string | null;
  public readonly mentions: readonly TeammateMention[];

  public constructor(
    id: string,
    conversationId: string,
    sequence: number,
    author: MessageAuthor,
    inReplyTo: string | null,
    status: MessageStatus,
    details: readonly MessageDetail[],
    provenance: Provenance | null,
    createdAt: string,
    startedAt: string | null,
    endedAt: string | null,
    attachments: readonly MessageAttachment[] = [],
    teammateId: string | null = null,
    teammateName: string | null = null,
    mentions: readonly TeammateMention[] = []) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    if (!Number.isInteger(sequence) || sequence < 0)
      throw new ArgumentOutOfRangeException(Resources.sequenceField, sequence);
    if (!Object.isNull(inReplyTo))
      ArgumentException.throwIfNullOrWhitespace(inReplyTo, Resources.inReplyToField);
    if ((author === MessageAuthor.Provider) === Object.isNull(provenance))
      throw new ArgumentException(Resources.provenanceMismatch, Resources.provenanceField);
    if (Message.OPEN_STATUSES.includes(status) !== Object.isNull(endedAt))
      throw new ArgumentException(Resources.messageEndMismatch, Resources.endedAtField);
    if (Object.isNull(startedAt)
      ? author === MessageAuthor.Provider && Message.STARTED_STATUSES.includes(status)
      : author !== MessageAuthor.Provider || status === MessageStatus.Pending)
      throw new ArgumentException(Resources.messageStartMismatch, Resources.startedAtField);
    if (!Object.isNull(startedAt))
      ArgumentException.throwIfNullOrWhitespace(startedAt, Resources.startedAtField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    if (Object.isNull(teammateId) !== Object.isNull(teammateName) || (author !== MessageAuthor.Provider && !Object.isNull(teammateId)))
      throw new ArgumentException(Resources.invalidTeammateAuthor, Resources.teammateIdField);
    if (!Object.isNull(teammateId))
      ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (!Object.isNull(teammateName))
      ArgumentException.throwIfNullOrWhitespace(teammateName, Resources.teammateNameField);
    if (author !== MessageAuthor.User && mentions.length > 0)
      throw new ArgumentException(Resources.invalidMessageMentions, Resources.mentionsField);

    this.id = id;
    this.conversationId = conversationId;
    this.sequence = sequence;
    this.author = author;
    this.inReplyTo = inReplyTo;
    this.status = status;
    this.details = [...details];
    this.provenance = provenance;
    this.createdAt = createdAt;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    this.attachments = [...attachments];
    this.teammateId = teammateId;
    this.teammateName = teammateName;
    this.mentions = [...mentions];
  }

  public static fromJson(value: unknown, path?: string): Message {
    const reader = JsonReader.fromValue(value, path);
    return new Message(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.conversationIdField),
      reader.readInteger(Resources.sequenceField),
      reader.readOneOf(Resources.authorField, Object.values(MessageAuthor)),
      reader.readNullableString(Resources.inReplyToField),
      reader.readOneOf(Resources.statusField, Object.values(MessageStatus)),
      reader.readObjectArray(Resources.detailsField).map(t => MessageDetail.fromJson(t.toJson(), t.path)),
      Message.provenanceFromJson(reader),
      reader.readNonBlankString(Resources.createdAtField),
      Message.startFromJson(reader),
      reader.readNullableString(Resources.endedAtField),
      reader.hasField(Resources.attachmentsField)
        ? reader.readObjectArray(Resources.attachmentsField).map(t => MessageAttachment.fromJson(t.toJson(), t.path)) : [],
      reader.hasField(Resources.teammateIdField) ? reader.readNullableString(Resources.teammateIdField) : null,
      reader.hasField(Resources.teammateNameField) ? reader.readNullableString(Resources.teammateNameField) : null,
      reader.hasField(Resources.mentionsField) ? reader.readObjectArray(Resources.mentionsField).map(t => TeammateMention.fromJson(t.toJson(), t.path)) : []);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.conversationIdField]: this.conversationId,
      [Resources.sequenceField]: this.sequence,
      [Resources.authorField]: this.author,
      [Resources.inReplyToField]: this.inReplyTo,
      [Resources.statusField]: this.status,
      [Resources.detailsField]: this.details.map(t => t.toJson()),
      [Resources.provenanceField]: Object.isNull(this.provenance) ? null : this.provenance.toJson(),
      [Resources.createdAtField]: this.createdAt,
      [Resources.startedAtField]: this.startedAt,
      [Resources.endedAtField]: this.endedAt,
      ...(Object.isNull(this.teammateId) ? {} : { [Resources.teammateIdField]: this.teammateId, [Resources.teammateNameField]: this.teammateName }),
      ...(this.mentions.length === 0 ? {} : { [Resources.mentionsField]: this.mentions.map(t => t.toJson()) }),
      ...(this.attachments.length === 0 ? {} : { [Resources.attachmentsField]: this.attachments.map(t => t.toJson()) })
    };
  }

  public withStart(startedAt: string): Message {
    return new Message(this.id, this.conversationId, this.sequence, this.author, this.inReplyTo, MessageStatus.Running, this.details, this.provenance,
      this.createdAt, startedAt, null, this.attachments, this.teammateId, this.teammateName, this.mentions);
  }

  public withStatus(status: MessageStatus, endedAt: string | null): Message {
    return new Message(this.id, this.conversationId, this.sequence, this.author, this.inReplyTo, status, this.details, this.provenance, this.createdAt,
      this.startedAt, endedAt, this.attachments, this.teammateId, this.teammateName, this.mentions);
  }

  public withDetails(details: readonly MessageDetail[]): Message {
    return new Message(this.id, this.conversationId, this.sequence, this.author, this.inReplyTo, this.status, details, this.provenance, this.createdAt,
      this.startedAt, this.endedAt, this.attachments, this.teammateId, this.teammateName, this.mentions);
  }

  public withDetail(detail: MessageDetail): Message {
    const details = [...this.details, detail];
    return this.withDetails(details);
  }

  public withProvenance(provenance: Provenance): Message {
    return new Message(this.id, this.conversationId, this.sequence, this.author, this.inReplyTo, this.status, this.details, provenance, this.createdAt,
      this.startedAt, this.endedAt, this.attachments, this.teammateId, this.teammateName, this.mentions);
  }

  private static provenanceFromJson(reader: JsonReader): Provenance | null {
    const provenance = reader.readNullableObject(Resources.provenanceField);
    return Object.isNull(provenance) ? null : Provenance.fromJson(provenance.toJson(), provenance.path);
  }

  private static startFromJson(reader: JsonReader): string | null {
    if (reader.hasField(Resources.startedAtField))
      return reader.readNullableString(Resources.startedAtField);
    const isStartedReply = reader.readOneOf(Resources.authorField, Object.values(MessageAuthor)) === MessageAuthor.Provider
      && reader.readOneOf(Resources.statusField, Object.values(MessageStatus)) !== MessageStatus.Pending;
    return isStartedReply ? reader.readNonBlankString(Resources.createdAtField) : null;
  }
}
