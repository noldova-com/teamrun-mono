/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";
import { ArrangementReader } from "./arrangement.reader";
import { DocumentTabs } from "./document-tabs";
import { PanelArrangement } from "./panel-arrangement";

export class Layout {
  public readonly arrangement: PanelArrangement;
  public readonly documents: DocumentTabs;
  public readonly collapsedProjects: readonly string[];
  public readonly pinnedConversations: readonly string[];
  public readonly projectOrder: readonly string[];
  public readonly conversationOrder: ReadonlyMap<string, readonly string[]>;

  public constructor(arrangement: PanelArrangement, documents: DocumentTabs, collapsedProjects: readonly string[] = [],
    pinnedConversations: readonly string[] = [], projectOrder: readonly string[] = [],
    conversationOrder: ReadonlyMap<string, readonly string[]> = new Map()) {
    this.arrangement = arrangement;
    this.documents = documents;
    this.collapsedProjects = Layout.distinct(collapsedProjects);
    this.pinnedConversations = Layout.distinct(pinnedConversations);
    this.projectOrder = Layout.distinct(projectOrder);
    const orders = [...conversationOrder].filter(([projectId]) => !String.isNullOrWhitespace(projectId));
    this.conversationOrder = new Map(orders.map(([projectId, ids]) => [projectId, Layout.distinct(ids)]));
  }

  public static createDefault(): Layout {
    return new Layout(PanelArrangement.createDefault(), DocumentTabs.createEmpty());
  }

  public static fromJson(value: unknown): Layout {
    if (!Object.isObject(value) || Array.isArray(value))
      return Layout.createDefault();
    const record: Record<string, unknown> = { ...value };

    const collapsed = Layout.readIds(record[Resources.collapsedProjectsField]);
    const pinned = Layout.readIds(record[Resources.pinnedConversationsField]);
    const order = Layout.readIds(record[Resources.projectOrderField]);
    const conversationOrder = Layout.readOrders(record[Resources.conversationOrderField]);

    return new Layout(new ArrangementReader().read(record), DocumentTabs.fromJson(record[Resources.documentsField]), collapsed,
      pinned, order, conversationOrder);
  }

  private static readOrders(value: unknown): ReadonlyMap<string, readonly string[]> {
    if (!Object.isObject(value) || Array.isArray(value))
      return new Map();
    return new Map(Object.entries({ ...value }).map(([projectId, ids]) => [projectId, Layout.readIds(ids)]));
  }

  private static readIds(value: unknown): readonly string[] {
    return Array.isArray(value) ? value.filter(t => Object.isString(t)) : [];
  }

  private static distinct(ids: readonly string[]): readonly string[] {
    return [...new Set(ids.filter(t => !String.isNullOrWhitespace(t)))];
  }

  public toJson(): Record<string, unknown> {
    return {
      ...this.arrangement.toJson(), [Resources.documentsField]: this.documents.toJson(), [Resources.collapsedProjectsField]: this.collapsedProjects,
      [Resources.pinnedConversationsField]: this.pinnedConversations, [Resources.projectOrderField]: this.projectOrder,
      [Resources.conversationOrderField]: Object.fromEntries([...this.conversationOrder].map(([projectId, ids]) => [projectId, [...ids]]))
    };
  }

  public withArrangement(arrangement: PanelArrangement): Layout {
    return arrangement === this.arrangement ? this : this.copy(this.documents, this.collapsedProjects, this.pinnedConversations, this.projectOrder, arrangement);
  }

  public resetArrangement(): Layout {
    return this.withArrangement(PanelArrangement.createDefault());
  }

  public showDocument(conversationId: string, preview: boolean = false): Layout {
    return this.copy(this.documents.show(conversationId, preview));
  }

  public keepDocumentOpen(conversationId: string): Layout {
    const kept = this.documents.keepOpen(conversationId);
    return kept === this.documents ? this : this.copy(kept);
  }

  public closeDocument(conversationId: string): Layout {
    const closed = this.documents.close(conversationId);
    return closed === this.documents ? this : this.copy(closed);
  }

  public keepDocuments(existing: readonly string[]): Layout {
    const kept = this.documents.keep(existing);
    const pinned = this.pinnedConversations.filter(t => existing.includes(t));
    return kept === this.documents && pinned.length === this.pinnedConversations.length ? this : this.copy(kept, this.collapsedProjects, pinned);
  }

  public isPinned(conversationId: string): boolean {
    return this.pinnedConversations.includes(conversationId);
  }

  public togglePin(conversationId: string): Layout {
    const pinned = this.isPinned(conversationId) ? this.pinnedConversations.filter(t => t !== conversationId) : [...this.pinnedConversations, conversationId];
    return this.copy(this.documents, this.collapsedProjects, pinned);
  }

  public orderPins(order: readonly string[]): Layout {
    const pinned = [...order.filter(t => this.isPinned(t)), ...this.pinnedConversations.filter(t => !order.includes(t))];
    return this.copy(this.documents, this.collapsedProjects, pinned);
  }

  public orderProjects(order: readonly string[]): Layout {
    return this.copy(this.documents, this.collapsedProjects, this.pinnedConversations, order);
  }

  public conversationOrderOf(projectId: string): readonly string[] {
    return this.conversationOrder.get(projectId) ?? [];
  }

  public orderConversations(projectId: string, order: readonly string[]): Layout {
    return this.copy(this.documents, this.collapsedProjects, this.pinnedConversations, this.projectOrder, this.arrangement,
      new Map(this.conversationOrder).set(projectId, order));
  }

  public isProjectCollapsed(projectId: string): boolean {
    return this.collapsedProjects.includes(projectId);
  }

  public toggleProject(projectId: string): Layout {
    const collapsed = this.isProjectCollapsed(projectId) ? this.collapsedProjects.filter(t => t !== projectId) : [...this.collapsedProjects, projectId];
    return this.copy(this.documents, collapsed);
  }

  private copy(documents: DocumentTabs, collapsedProjects: readonly string[] = this.collapsedProjects,
    pinnedConversations: readonly string[] = this.pinnedConversations, projectOrder: readonly string[] = this.projectOrder,
    arrangement: PanelArrangement = this.arrangement, conversationOrder: ReadonlyMap<string, readonly string[]> = this.conversationOrder): Layout {
    return new Layout(arrangement, documents, collapsedProjects, pinnedConversations, projectOrder, conversationOrder);
  }
}
