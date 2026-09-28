/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { PanelKind } from "../../../src/app/enums/panel-kind";
import { DocumentTabs } from "../../../src/app/models/document-tabs";
import { Layout } from "../../../src/app/models/layout";
import { Panel } from "../../../src/app/models/panel";
import { PanelArrangement } from "../../../src/app/models/panel-arrangement";
import { TabGroup } from "../../../src/app/models/tab-group";

describe("Layout", () => {
  const explorer = new Panel(PanelKind.Explorer);
  const changes = new Panel(PanelKind.Changes);
  const activity = new Panel(PanelKind.Activity);

  it("starts with the default panel arrangement and no open conversations, and resets only the arrangement", () => {
    const layout = Layout.createDefault();
    expect(layout.arrangement.toJson()).toEqual(PanelArrangement.createDefault().toJson());
    expect(layout.documents.open).toEqual([]);

    const arranged = layout.withArrangement(layout.arrangement.closePanel(changes)).showDocument("c1").togglePin("c1");
    expect(arranged.arrangement.isOpen(changes)).toBe(false);
    expect(arranged.withArrangement(arranged.arrangement)).toBe(arranged);
    const reset = arranged.resetArrangement();
    expect(reset.arrangement.isOpen(changes)).toBe(true);
    expect(reset.documents.open).toEqual(["c1"]);
    expect(reset.pinnedConversations).toEqual(["c1"]);
  });

  it("keeps the open conversations as tabs", () => {
    let layout = Layout.createDefault().showDocument("c1").showDocument("c2").showDocument("c1");

    expect(layout.documents.open).toEqual(["c1", "c2"]);
    expect(layout.documents.active).toBe("c1");
    layout = layout.showDocument("c3").closeDocument("c3");
    expect(layout.documents.active).toBe("c2");
    layout = layout.closeDocument("c2");
    expect(layout.documents.active).toBe("c1");
    expect(layout.closeDocument("nope")).toBe(layout);
    layout = layout.showDocument("c4").keepDocuments(["c4"]);
    expect(layout.documents.open).toEqual(["c4"]);
    expect(layout.keepDocuments(["c4"])).toBe(layout);
    expect(layout.closeDocument("c4").documents.active).toBeNull();

    let previewed = Layout.createDefault().showDocument("c1").showDocument("c2", true);
    expect(previewed.documents.open).toEqual(["c1", "c2"]);
    expect(previewed.documents.preview).toBe("c2");
    previewed = previewed.showDocument("c3", true);
    expect(previewed.documents.open).toEqual(["c1", "c3"]);
    expect(previewed.documents.preview).toBe("c3");
    expect(previewed.documents.active).toBe("c3");
    previewed = previewed.showDocument("c1", true);
    expect(previewed.documents.preview).toBe("c3");
    expect(previewed.documents.active).toBe("c1");
    previewed = previewed.showDocument("c4");
    expect(previewed.documents.open).toEqual(["c1", "c3", "c4"]);
    expect(previewed.documents.preview).toBe("c3");
    expect(previewed.keepDocumentOpen("c4")).toBe(previewed);
    previewed = previewed.keepDocumentOpen("c3");
    expect(previewed.documents.preview).toBeNull();
    previewed = previewed.showDocument("c5", true);
    expect(previewed.documents.open).toEqual(["c1", "c3", "c4", "c5"]);
    expect(previewed.closeDocument("c5").documents.preview).toBeNull();
    expect(previewed.keepDocuments(["c1", "c3", "c4"]).documents.preview).toBeNull();
    const readPreview = Layout.fromJson(JSON.parse(JSON.stringify(previewed.toJson())));
    expect(readPreview.documents.preview).toBe("c5");
    expect(Layout.fromJson({ documents: { open: ["c1"], active: "c1", preview: "zz" } }).documents.preview).toBeNull();
  });

  it("round-trips through JSON and reads leniently", () => {
    const arrangement = PanelArrangement.createDefault().splitGroup(activity, TabGroup.documentsId, PanelEdge.Bottom).resizeDock(DockSide.Right, 300);
    const layout = Layout.createDefault().withArrangement(arrangement).showDocument("c1");

    const read = Layout.fromJson(JSON.parse(JSON.stringify(layout.toJson())));
    expect(read.toJson()).toEqual(layout.toJson());
    expect(read.arrangement.middle.groups.map(t => t.panels)).toEqual([[], [activity]]);
    expect(read.arrangement.dock(DockSide.Right).size).toBe(300);
    expect(read.documents.active).toBe("c1");

    expect(Layout.fromJson("x").toJson()).toEqual(Layout.createDefault().toJson());
    expect(Layout.fromJson([]).toJson()).toEqual(Layout.createDefault().toJson());
    const saved = Layout.fromJson({ docks: { Left: { panels: ["Changes", "Explorer"], activePanel: "Explorer", size: 300 }, Right: { panels: ["Changes"] } }, documents: 5 });
    expect(saved.arrangement.dock(DockSide.Left).panels).toEqual([changes, explorer]);
    expect(saved.arrangement.groupOf(explorer)?.activePanel).toEqual(explorer);
    expect(saved.arrangement.dock(DockSide.Right).isEmpty).toBe(true);
    expect(saved.documents.open).toEqual([]);
    const tabs = Layout.fromJson({ documents: { open: ["c1", 2, " "], active: "zz" } });
    expect(tabs.documents.open).toEqual(["c1"]);
    expect(tabs.documents.active).toBe("c1");

    const folded = layout.toggleProject("p1").toggleProject("p2");
    expect(folded.collapsedProjects).toEqual(["p1", "p2"]);
    expect(folded.isProjectCollapsed("p1")).toBe(true);
    expect(folded.toggleProject("p1").collapsedProjects).toEqual(["p2"]);
    expect(Layout.fromJson(JSON.parse(JSON.stringify(folded.toJson()))).collapsedProjects).toEqual(["p1", "p2"]);
    expect(folded.resetArrangement().collapsedProjects).toEqual(["p1", "p2"]);
    expect(folded.showDocument("c2").collapsedProjects).toEqual(["p1", "p2"]);
    expect(Layout.fromJson({ collapsedProjects: ["p1", 3, " ", "p1"] }).collapsedProjects).toEqual(["p1"]);
    expect(Layout.fromJson({ collapsedProjects: "p1" }).collapsedProjects).toEqual([]);

    const pinned = layout.togglePin("c1").togglePin("c2").togglePin("c3");
    expect(pinned.pinnedConversations).toEqual(["c1", "c2", "c3"]);
    expect(pinned.isPinned("c2")).toBe(true);
    expect(pinned.togglePin("c2").pinnedConversations).toEqual(["c1", "c3"]);
    expect(pinned.orderPins(["c3", "c1", "zz"]).pinnedConversations).toEqual(["c3", "c1", "c2"]);
    expect(pinned.keepDocuments(["c1", "c3"]).pinnedConversations).toEqual(["c1", "c3"]);
    expect(pinned.keepDocuments(["c1", "c2", "c3"])).toBe(pinned);
    const ordered = pinned.orderProjects(["p2", "p1"]);
    expect(ordered.projectOrder).toEqual(["p2", "p1"]);
    expect(ordered.resetArrangement().pinnedConversations).toEqual(["c1", "c2", "c3"]);
    expect(ordered.resetArrangement().projectOrder).toEqual(["p2", "p1"]);
    const readBack = Layout.fromJson(JSON.parse(JSON.stringify(ordered.toJson())));
    expect(readBack.pinnedConversations).toEqual(["c1", "c2", "c3"]);
    expect(readBack.projectOrder).toEqual(["p2", "p1"]);
    expect(Layout.fromJson({ pinnedConversations: ["c1", 3, " ", "c1"], projectOrder: "p1" }).pinnedConversations).toEqual(["c1"]);
    expect(Layout.fromJson({ projectOrder: "p1" }).projectOrder).toEqual([]);

    const arranged = ordered.orderConversations("p1", ["c3", "c1", " ", "c3"]).orderConversations("p2", ["c9"]);
    expect(arranged.conversationOrderOf("p1")).toEqual(["c3", "c1"]);
    expect(arranged.conversationOrderOf("p2")).toEqual(["c9"]);
    expect(arranged.conversationOrderOf("p3")).toEqual([]);
    expect(arranged.resetArrangement().conversationOrderOf("p1")).toEqual(["c3", "c1"]);
    expect(Layout.fromJson(JSON.parse(JSON.stringify(arranged.toJson()))).conversationOrderOf("p1")).toEqual(["c3", "c1"]);
    expect(Layout.fromJson({ conversationOrder: { p1: ["c2", 5], "": ["c1"], p2: "c1" } }).conversationOrderOf("p1")).toEqual(["c2"]);
    expect(Layout.fromJson({ conversationOrder: { p1: ["c2", 5], "": ["c1"], p2: "c1" } }).conversationOrderOf("p2")).toEqual([]);
    expect(Layout.fromJson({ conversationOrder: [] }).conversationOrder.size).toBe(0);
  });

  it("keeps the document tabs consistent on their own", () => {
    const tabs = new DocumentTabs(["a", "b", "a", ""], "zz");
    expect(tabs.open).toEqual(["a", "b"]);
    expect(tabs.active).toBe("a");
    expect(DocumentTabs.fromJson([]).open).toEqual([]);
    expect(DocumentTabs.fromJson({ open: "a" }).open).toEqual([]);
  });
});
