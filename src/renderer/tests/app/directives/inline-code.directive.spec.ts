/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";

import { InlineCodeDirective } from "../../../src/app/directives/inline-code.directive";

@Component({ imports: [FormsModule, InlineCodeDirective], template: `<div><textarea [trInlineCode]="text()" [ngModel]="text()" (ngModelChange)="text.set($event)"></textarea></div>` })
class InlineCodeTestHost {
  public readonly text = signal("");
}

describe("InlineCodeDirective", () => {
  it("highlights code spans while preserving the exact source and excluding escaped, incomplete, and fenced code", async () => {
    const fixture = TestBed.createComponent(InlineCodeTestHost);
    const text = "`hello` and ``a`b`` with **`bold`**\n\n- `listed`\n\n\\`escaped\\` and `unfinished\n\n```ts\nconst x = `template`;\n```";
    fixture.componentInstance.text.set(text);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect([...element.querySelectorAll(".tr-composer-inline-code")].map(t => t.textContent)).toEqual(["`hello`", "``a`b``", "`bold`", "`listed`"]);
    expect([...element.querySelectorAll(".tr-composer-code-delimiter")].map(t => t.textContent)).toEqual(["`", "`", "``", "``", "`", "`", "`", "`"]);
    expect(element.querySelector(".tr-composer-highlight")?.textContent).toBe(text + "\u200b");
    expect(element.querySelector(".tr-composer-highlight")?.getAttribute("aria-hidden")).toBe("true");
    expect(element.querySelector("textarea")?.value).toBe(text);
  });

  it("keeps highlighting a list whose last line ends in spaces", async () => {
    const fixture = TestBed.createComponent(InlineCodeTestHost);
    const element = fixture.nativeElement as HTMLElement;
    for (const text of ["1. `one`\n2. `two` ", "- `one`\n- `two`  "]) {
      fixture.componentInstance.text.set(text);
      fixture.detectChanges();
      await fixture.whenStable();

      expect([...element.querySelectorAll(".tr-composer-inline-code")].map(t => t.textContent)).toEqual(["`one`", "`two`"]);
      expect(element.querySelector(".tr-composer-highlight")?.textContent).toBe(text + "\u200b");
    }
  });

  it("treats HTML as text and does not replace the native input or its selection when typing", async () => {
    const fixture = TestBed.createComponent(InlineCodeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const box = element.querySelector("textarea")!;
    const text = '`<img src=x onerror="alert(1)">` & <script>bad()</script>';
    box.value = text;
    box.setSelectionRange(3, 7);
    box.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    expect(element.querySelector("textarea")).toBe(box);
    expect(box.value).toBe(text);
    expect([box.selectionStart, box.selectionEnd]).toEqual([3, 7]);
    expect(element.querySelector(".tr-composer-highlight")?.textContent).toBe(text + "\u200b");
    expect(element.querySelectorAll("img, script")).toHaveLength(0);
    expect(element.querySelector(".tr-composer-inline-code")?.textContent).toContain("<img");
  });

  it("updates for a restored draft and a clear, follows internal scrolling, and removes its mirror on destruction", async () => {
    const fixture = TestBed.createComponent(InlineCodeTestHost);
    fixture.componentInstance.text.set("`first`\n");
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const box = element.querySelector("textarea")!;
    const backdrop = element.querySelector<HTMLElement>(".tr-composer-highlight")!;
    box.scrollTop = 90;
    box.dispatchEvent(new Event("scroll"));
    expect(backdrop.scrollTop).toBe(90);
    fixture.componentInstance.text.set("restored `draft`");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(backdrop.querySelector(".tr-composer-inline-code")?.textContent).toBe("`draft`");
    fixture.componentInstance.text.set("");
    fixture.detectChanges();
    await fixture.whenStable();
    expect(backdrop.textContent).toBe("\u200b");
    fixture.destroy();
    expect(backdrop.parentElement).toBeNull();
  });
});
