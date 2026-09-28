/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { Conversation, ConversationIdParams, ConversationMember, MethodName } from "@noldova/teamrun-protocol";
import { MemoryStorage } from "../../../fixtures/memory-storage";
import { TeammateFixture } from "../../../fixtures/teammate-fixture";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { NavigationService } from "../../../../src/app/services/navigation.service";
import { TeammatesPanelComponent } from "../../../../src/app/components/teammates-panel/teammates-panel.component";

describe("TeammatesPanelComponent", () => {
  it("shows only the active chat's members and clears when Settings or no chat is active", async () => {
    MemoryStorage.install(window);
    const data = new TeammateFixture();
    data.bridge.answer(MethodName.ConversationList, () => ["c1", "c2"].map(id => new Conversation(id, "p1", id, "t", "t").toJson()))
      .answer(MethodName.ConversationListMembers, payload => {
        const id = ConversationIdParams.fromJson(payload).conversationId;
        return [new ConversationMember(id, id === "c1" ? "alice" : "bob", "t", null, false).toJson()];
      });
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: data.bridge }] });
    const store = TestBed.inject(ChatStore);
    const navigation = TestBed.inject(NavigationService);
    await store.initialize();
    const fixture = TestBed.createComponent(TeammatesPanelComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain("Open a conversation");
    await store.selectConversation("c1");
    await fixture.whenStable();
    expect(root.textContent).toContain("Alice");
    expect(root.querySelector("[data-avatar-color]")?.getAttribute("data-avatar-color")).toBe("Cyan");
    expect(root.textContent).not.toContain("Bob");
    expect(root.textContent).not.toContain("Offline");
    expect(root.querySelector("button")).toBeNull();
    await store.selectConversation("c2");
    await fixture.whenStable();
    expect(root.textContent).toContain("Bob");
    expect(root.querySelector("[data-avatar-color]")?.getAttribute("data-avatar-color")).toBe("Purple");
    expect(root.textContent).not.toContain("Alice");
    navigation.openSettings();
    await fixture.whenStable();
    expect(root.textContent).toContain("Open a conversation");
    expect(root.textContent).not.toContain("Bob");
    navigation.showChat();
    await fixture.whenStable();
    expect(root.textContent).toContain("Bob");
    store.deselectConversation();
    await fixture.whenStable();
    expect(root.textContent).toContain("Open a conversation");
  });
});
