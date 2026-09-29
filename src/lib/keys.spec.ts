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
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
      expect(shortcutActs({ key: key })).toBe(true);
    }
  });

  it("still refuses Enter while a button holds it, so it cannot double-fire", () => {
    const host = mount(`<button id="b">Edit</button>`);
    host.querySelector<HTMLButtonElement>("#b")!.focus();
    expect(shortcutActs({ key: "Enter" })).toBe(false);
  });

  it("refuses every key while the legend is up, so Enter cannot send (CONTENT-35)", () => {
    mount(`<div role="dialog" aria-label="What the pills mean"></div>`);
    for (const key of ["Enter", "j", "k", "x", "r"]) {
      expect(shortcutActs({ key: key })).toBe(false);
    }
  });

  it("refuses every key while the operator is editing a draft", () => {
    const host = mount(`<textarea id="t"></textarea>`);
    host.querySelector<HTMLTextAreaElement>("#t")!.focus();
    expect(shortcutActs({ key: "j" })).toBe(false);
    expect(shortcutActs({ key: "Enter" })).toBe(false);
  });

  it("acts on a bare document", () => {
    expect(shortcutActs({ key: "Enter" })).toBe(true);
  });
});

describe("a modifier is not ours", () => {
  /** What the console's switch does with each of these, bare. */
  const HARM: Record<string, string> = {
    r: "regenerates the focused draft, and swallows the reload",
    a: "approves a marketplace action instead of selecting all",
    x: "dismisses the focused card instead of cutting",
    k: "moves the queue selection while the command bar opens",
    e: "opens the editor",
    u: "rolls a committed action back",
    i: "opens the inspector",
    Enter: "sends the focused reply",
  };

  it("refuses every shortcut key while ⌘ or Ctrl is held", () => {
    for (const [key, what] of Object.entries(HARM)) {
      expect(shortcutActs({ key, metaKey: true }), `⌘${key} ${what}`).toBe(false);
      expect(shortcutActs({ key, ctrlKey: true }), `Ctrl+${key} ${what}`).toBe(false);
    }
  });

  it("refuses Alt too, which types a character on a Mac", () => {
    expect(shortcutActs({ key: "u", altKey: true })).toBe(false);
  });

  it("still acts on Shift, because the keymap is case-insensitive", () => {
    // `case "x": case "X":` — Shift+X is the same shortcut, deliberately, and
    // `?` cannot be typed without Shift at all.
    for (const key of ["J", "K", "E", "X", "R", "A", "U", "I"]) {
      expect(shortcutActs({ key, shiftKey: true } as never)).toBe(true);
    }
  });

  it("refuses a keypress that belongs to an IME candidate", () => {
    // Enter while composing commits the candidate. It must not also send.
    expect(shortcutActs({ key: "Enter", isComposing: true })).toBe(false);
  });

  it("takes a real KeyboardEvent unchanged", () => {
    // The call site passes `e`. If the shape drifted from the DOM's, this fails.
    expect(shortcutActs(new KeyboardEvent("keydown", { key: "j" }))).toBe(true);
    expect(shortcutActs(new KeyboardEvent("keydown", { key: "j", metaKey: true }))).toBe(false);
  });
});

describe("the console passes the event, not the key", () => {
  it("calls shortcutActs(e)", () => {
    // The whole fix is in the argument. `shortcutActs(e.key)` typechecks as
    // never again, but the `?` branch has its own inline guard and that one can
    // only be held here.
    const src = readFileSync(join(process.cwd(), "src/components/console/Console.tsx"), "utf8");
    expect(src).toContain("shortcutActs(e)");
    expect(src).not.toContain("shortcutActs(e.key)");
    // `?` is checked inline rather than through the rule, so it needs the same
    // two exclusions written out.
    expect(src).toMatch(/e\.key === "\?" && !cmd && !e\.altKey/);
  });
});
