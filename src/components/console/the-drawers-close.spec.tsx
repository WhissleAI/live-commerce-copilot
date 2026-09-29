/**
 * Two drawers, and neither could be closed.
 *
 * Reported from a live session: "it overlays in an ugly manner on top and no way
 * to close". Both were true and they were the same omission.
 *
 * The incoming drawer had no close control at all — and it is 300px wide, pinned
 * to the left edge, so it covered the very button that opened it. The session
 * rail had a close row but no scrim. Neither was in the Escape chain, in a
 * console that prints its keymap on the card. And the drawer repeated the
 * header's Host audio button inside 300px.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const console_ = readFileSync(join(process.cwd(), "src/components/console/Console.tsx"), "utf8");

/** The source with comments blanked: this file's own prose describes the bug. */
const code = console_
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, (c) => c.replace(/[^\n]/g, " "))
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
  .replace(/\/\/[^\n]*/g, (c) => " ".repeat(c.length));

/**
 * The incoming drawer's own source, from its `role="dialog"` to the close of
 * the element that carries it.
 */
function drawerSource(): string {
  // Anchored on the label, then widened back to the opening tag: the element's
  // className sits ABOVE `role="dialog"`, so a slice starting at the role
  // attribute silently excludes every class this file asserts on.
  const label = code.indexOf('aria-label="Incoming: buyer chat and the host"');
  expect(label, "no incoming dialog in the console").toBeGreaterThan(-1);
  const start = code.lastIndexOf("<div", label);
  return code.slice(start, code.indexOf("\n        ) : null}", label));
}

describe("a drawer can always be closed", () => {
  it("the incoming drawer has its own close button", () => {
    expect(code).toContain('aria-label="Close the incoming panel"');
    // Named for what it holds, so the header does not read "Chat" over a panel
    // that also carries the host.
    expect(code).toMatch(/layout\.hostAudio \? "Chat & host" : "Chat"/);
  });

  it("both drawers close on Escape", () => {
    const esc = code.slice(
      code.indexOf('if (e.key === "Escape")'),
      code.indexOf('if (e.key === "?"'),
    );
    expect(esc, "the incoming drawer is not in the Escape chain").toContain("setDrawerOpen(false)");
    expect(esc, "the session rail is not in the Escape chain").toContain("setRailOpen(false)");
    // Last in the chain: anything genuinely on top of them gets Escape first.
    expect(esc.indexOf("setDrawerOpen(false)")).toBeGreaterThan(esc.indexOf("setInspect(null)"));
  });

  it("both drawers have a scrim, and clicking it closes them", () => {
    // Two scrims, one per drawer, each its own button so it is reachable by
    // keyboard and announced rather than being a dead div.
    const scrims = [...code.matchAll(/aria-label="Close the (incoming panel|session rail)"/g)];
    // Two close buttons + two scrims = four, and the rail's own ✕ makes five.
    expect(scrims.length).toBeGreaterThanOrEqual(4);
    expect(code).toMatch(/bg-canvas\/55/);
  });

  it("the drawer does not repeat the header's Host audio button", () => {
    // `onOpenBridge` is what draws it. The wide rail keeps its copy because there
    // the header can scroll away; inside 300px of drawer it is noise.
    //
    // Sliced by the dialog's own bounds. It used to slice to the next
    // `</PanelBoundary>`, which silently meant "the rest of the session rail"
    // the moment the drawer moved out of the proposals column.
    expect(drawerSource()).not.toContain("onOpenBridge");
  });

  it("the drawer announces itself as a dialog", () => {
    expect(code).toContain('aria-label="Incoming: buyer chat and the host"');
  });

  it("both drawers are siblings of the columns, not children of one", () => {
    // A scrim is `absolute inset-0`, so it covers its nearest positioned
    // ancestor and nothing more. The incoming drawer sat INSIDE the proposals
    // column: measured in the browser, its scrim came out 300x674 — exactly the
    // drawer's own box — so it dimmed nothing, swallowed no click, and that
    // column's `overflow-hidden` clipped the drawer it was meant to reveal.
    // Both drawers belong to the grid row, which is the element that means
    // "the work area".
    const proposals = code.indexOf('name="Proposals"');
    const columnCloses = code.indexOf("</PanelBoundary>", proposals);
    expect(proposals, "the proposals column is gone").toBeGreaterThan(-1);
    expect(columnCloses).toBeGreaterThan(proposals);

    for (const label of ["Close the incoming panel", "Close the session rail"]) {
      expect(
        code.indexOf(`aria-label="${label}"`),
        `${label} is nested inside the proposals column, so its scrim covers only that column`,
      ).toBeGreaterThan(columnCloses);
    }
  });

  it("both drawers say they are modal, and the rail only while it is one", () => {
    // A full-width scrim makes a panel modal in fact; `aria-modal` is it
    // saying so. The session rail is the same element twice over — a resident
    // column at >=1024, an overlay below — so it claims to be a dialog only in
    // the second form, or every screen-reader user is told the show rail is a
    // modal at every width.
    expect(drawerSource()).toContain('aria-modal="true"');
    expect(code).toMatch(/railOpen\s*\n?\s*\?\s*\{\s*role: "dialog"/);
  });

  it("a drawer does not survive the width that replaces it", () => {
    // Open the chat sheet at 1200, widen to 1400: the drawer was still open,
    // invisible behind its own `xl:hidden`, with the toggle that would close it
    // hidden at that width too. Narrowing again brought it back unasked.
    // It is also what makes holding focus inside one safe — a trap on a
    // `display:none` element has nothing to focus.
    expect(code).toContain("(min-width: 1536px)");
    expect(code).toContain("(min-width: 1280px)");
    expect(code).toContain("(min-width: 1024px)");
    const sync = code.slice(code.indexOf("(min-width: 1536px)"));
    expect(sync).toContain("setDrawerOpen(false)");
    expect(sync).toContain("setRailOpen(false)");
    // The incoming sheet gives way at 2xl while a side panel is open and xl
    // otherwise — the same condition its own className carries.
    expect(code).toMatch(/sidePanel \? "\(min-width: 1536px\)" : "\(min-width: 1280px\)"/);
  });

  it("the drawer is inset from the work area's edge, like the session rail", () => {
    // Flush against the viewport edge it read as a torn-off strip rather than a
    // panel; the rail opposite it is already inset by the grid's own padding.
    expect(drawerSource()).toMatch(/inset-y-2 left-2/);
    expect(drawerSource(), "a half-rounded panel that is not touching an edge").not.toMatch(
      /rounded-r-md/,
    );
  });
});

describe("the autonomy menu is named", () => {
  it("says what it changes, rather than being announced as 'menu'", () => {
    const top = readFileSync(join(process.cwd(), "src/components/console/TopBar.tsx"), "utf8");
    // The JSX attribute, on its own line — not the `'[role="menu"]'` selector
    // string that the focus effect above it also contains. Slicing to the first
    // match in the file found the selector and reported the menu unnamed.
    const attr = top.search(/\n\s+role="menu"\n/);
    expect(attr, 'no role="menu" attribute in TopBar').toBeGreaterThan(-1);
    expect(top.slice(attr, attr + 300)).toContain('aria-label="Autonomy level"');
  });
});
