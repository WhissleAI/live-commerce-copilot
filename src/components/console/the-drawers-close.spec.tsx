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

describe("a drawer can always be closed", () => {
  it("the incoming drawer has its own close button", () => {
    expect(code).toContain('aria-label="Close the incoming panel"');
    // Named for what it holds, so the header does not read "Chat" over a panel
    // that also carries the host.
    expect(code).toMatch(/layout\.hostAudio \? "Chat & host" : "Chat"/);
  });

  it("both drawers close on Escape", () => {
    const esc = code.slice(code.indexOf('if (e.key === "Escape")'), code.indexOf('if (e.key === "?"'));
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
    const drawer = code.slice(code.indexOf("Close the incoming panel"), code.indexOf("</PanelBoundary>", code.indexOf("Close the incoming panel")));
    expect(drawer).not.toContain("onOpenBridge");
  });

  it("the drawer announces itself as a dialog", () => {
    expect(code).toContain('aria-label="Incoming: buyer chat and the host"');
  });
});

describe("the autonomy menu is named", () => {
  it("says what it changes, rather than being announced as 'menu'", () => {
    const top = readFileSync(join(process.cwd(), "src/components/console/TopBar.tsx"), "utf8");
    const menu = top.slice(top.indexOf('role="menu"'), top.indexOf('role="menu"') + 300);
    expect(menu).toContain('aria-label="Autonomy level"');
  });
});
