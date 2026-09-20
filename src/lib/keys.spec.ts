/**
 * The console advertises a single-key keymap on the proposal card and calls
 * itself keyboard-first. These are the two ways that claim was false.
 *
 * 1. `isTyping()` counted a focused BUTTON as a typing context, so the entire
 *    keymap went inert after the first mouse click on any card and never came
 *    back. (CONTENT-36)
 * 2. The legend overlay opens by itself on a new browser and the shortcut
 *    handler only checked the research palette, so Enter — the reflex that
 *    dismisses a modal — reached the queue and sent a live reply.
 *    (CONTENT-35)
 */

import { afterEach, describe, expect, it } from "vitest";
import { activatesOnEnter, isTypingIn, modalOpen, shortcutActs } from "./keys";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isTypingIn", () => {
  it("is true for the places a keystroke becomes a character", () => {
    const host = mount(
      `<input id="i"><textarea id="t"></textarea><select id="s"></select><div id="c" contenteditable="true"></div>`,
    );
    for (const id of ["i", "t", "s"]) {
      expect(isTypingIn(host.querySelector(`#${id}`))).toBe(true);
    }
    const ce = host.querySelector<HTMLElement>("#c")!;
    // jsdom does not implement the contenteditable reflection.
    Object.defineProperty(ce, "isContentEditable", { value: true });
    expect(isTypingIn(ce)).toBe(true);
  });

  it("is FALSE for a button — the regression that killed the keymap", () => {
    const host = mount(`<button id="b">Edit</button>`);
    expect(isTypingIn(host.querySelector("#b"))).toBe(false);
  });

  it("is false for nothing focused", () => {
    expect(isTypingIn(null)).toBe(false);
  });
});

describe("activatesOnEnter", () => {
  it("claims Enter for elements the browser already clicks on Enter", () => {
    const host = mount(
      `<button id="b"></button><a id="a" href="#"></a><div id="r" role="button"></div><div id="w" role="switch"></div>`,
    );
    for (const id of ["b", "a", "r", "w"]) {
      expect(activatesOnEnter(host.querySelector(`#${id}`))).toBe(true);
    }
  });

  it("does not claim Enter for an ordinary element", () => {
    const host = mount(`<li id="l" tabindex="0"></li>`);
    expect(activatesOnEnter(host.querySelector("#l"))).toBe(false);
  });
});

describe("modalOpen", () => {
  it("sees any dialog, including ones the console does not render", () => {
    expect(modalOpen(document)).toBe(false);
    mount(`<div role="dialog" aria-label="What the pills mean"></div>`);
    expect(modalOpen(document)).toBe(true);
  });
});

describe("shortcutActs", () => {
  it("lets the whole keymap survive a focused button (CONTENT-36)", () => {
    const host = mount(`<button id="b">Edit</button>`);
    host.querySelector<HTMLButtonElement>("#b")!.focus();
    for (const key of ["j", "k", "e", "x", "r", "a", "u", "i"]) {
      expect(shortcutActs(key)).toBe(true);
    }
  });

  it("still refuses Enter while a button holds it, so it cannot double-fire", () => {
    const host = mount(`<button id="b">Edit</button>`);
    host.querySelector<HTMLButtonElement>("#b")!.focus();
    expect(shortcutActs("Enter")).toBe(false);
  });

  it("refuses every key while the legend is up, so Enter cannot send (CONTENT-35)", () => {
    mount(`<div role="dialog" aria-label="What the pills mean"></div>`);
    for (const key of ["Enter", "j", "k", "x", "r"]) {
      expect(shortcutActs(key)).toBe(false);
    }
  });

  it("refuses every key while the operator is editing a draft", () => {
    const host = mount(`<textarea id="t"></textarea>`);
    host.querySelector<HTMLTextAreaElement>("#t")!.focus();
    expect(shortcutActs("j")).toBe(false);
    expect(shortcutActs("Enter")).toBe(false);
  });

  it("acts on a bare document", () => {
    expect(shortcutActs("Enter")).toBe(true);
  });
});
