/**
 * What the front door is allowed to say.
 *
 * A marketing page is the one file in a repository with no natural failure
 * mode: it renders whatever it is told to, forever, including a sentence that
 * stopped being true two releases ago. So the claims that would hurt most if
 * they drifted are asserted here against the same sources the app uses — the
 * shipped capability table, and the files on disk — rather than against a
 * reviewer's memory.
 *
 * Three things this file holds:
 *
 *  1. Nobody but the operator sends a reply. No surface has a delivery path in
 *     the backend (eBay Live publishes no chat-post API and the reader has no
 *     send path by construction), so no card may imply that we post, send or
 *     reply on anyone's behalf.
 *  2. A surface the capability table calls `draft-only` must be described that
 *     way in the copy, not merely omitted from it.
 *  3. Every screenshot the page shows exists. A broken <img> on a landing page
 *     is a claim about a product nobody can see.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SURFACE_IDS, capabilitiesOf, draftOnly } from "@/lib/surfaces";
import {
  FamilyCard,
  NOT_THE_SENDER,
  SURFACE_FAMILIES,
  isDraftOnlyFamily,
  tempoLabel,
  type SurfaceFamily,
} from "./LandingPage";

const SOURCE = readFileSync(resolve("src/components/pages/LandingPage.tsx"), "utf8");

/** Every string a visitor could read off one card. */
const copyOf = (f: SurfaceFamily) => [f.title, f.delivery, f.lead, f.limit].join(" ").toLowerCase();

describe("the surfaces strip", () => {
  it("names only surfaces this build actually has", () => {
    for (const f of SURFACE_FAMILIES) {
      for (const id of f.surfaces) expect(SURFACE_IDS).toContain(id);
    }
  });

  // YouTube Live has a row in the capability table and no adapter behind it.
  // A surface a visitor cannot use is not a surface, so it is not offered — and
  // where the page does name it, it names it as the limit that it is.
  it("does not offer a surface with no adapter", () => {
    const named = SURFACE_FAMILIES.flatMap((f) => f.surfaces);
    expect(named).not.toContain("youtubelive");
    expect(SURFACE_FAMILIES.map(copyOf).join(" ")).not.toContain("youtube");
    for (const line of SOURCE.split("\n").filter((l) => l.includes("YouTube Live"))) {
      expect(line + SOURCE.split(line)[1]?.slice(0, 120)).toMatch(/no adapter/);
    }
  });

  it("covers every surface a visitor could reach, once", () => {
    const named = SURFACE_FAMILIES.flatMap((f) => f.surfaces);
    expect(new Set(named).size).toBe(named.length);
    // `simulated` is the scripted demo fixture, not a place to sell.
    expect(named).toEqual(
      expect.arrayContaining(["ebaylive", "whatnot", "tiktoklive", "twitch", "reddit", "dm"]),
    );
  });

  it("never claims to be the sender", () => {
    for (const f of SURFACE_FAMILIES) {
      // The chip is the shortest thing on the card and the easiest to overclaim
      // in: whatever else it says, our half ends at the draft.
      expect(f.delivery.startsWith("drafts")).toBe(true);
      const copy = copyOf(f);
      expect(copy).not.toMatch(/\bwe (post|send|reply|deliver)\b/);
      expect(copy).not.toMatch(/\b(posts|sends|replies) for you\b/);
      expect(copy).not.toMatch(/\bauto(matically)?[- ]?(post|send|repl)/);
    }
    expect(NOT_THE_SENDER.toLowerCase()).toContain("you are the sender");
  });

  it("says draft-only where the shipped table says draft-only", () => {
    const drafting = SURFACE_FAMILIES.filter(isDraftOnlyFamily);
    // Reddit and the follow-up inbox, at minimum — if this ever comes back
    // empty the table changed under the page.
    expect(drafting.length).toBeGreaterThanOrEqual(2);
    for (const f of drafting) {
      expect(copyOf(f)).toMatch(/draft|you post|you send/);
    }
    // And the one the backend locks hardest says so in the operator's words.
    const reddit = SURFACE_FAMILIES.find((f) => f.surfaces.includes("reddit"))!;
    expect(draftOnly(capabilitiesOf("reddit"))).toBe(true);
    expect(reddit.limit.toLowerCase()).toContain("never post");
  });

  it("reads its tempo off the capability table rather than asserting one", () => {
    expect(tempoLabel(["ebaylive", "whatnot"])).toBe("live");
    expect(tempoLabel(["reddit"])).toBe("async");
    expect(tempoLabel(["dm"])).toBe("async");
  });

  it("renders a card with its tempo, its surfaces and its limit", () => {
    const reddit = SURFACE_FAMILIES.find((f) => f.id === "communities")!;
    render(<FamilyCard f={reddit} />);
    expect(screen.getByText("async")).toBeInTheDocument();
    expect(screen.getByText("drafts · you post")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /communities surfaces/i })).toBeInTheDocument();
    expect(screen.getByText("Reddit")).toBeInTheDocument();
    expect(screen.getByText(/never post to reddit for you/i)).toBeInTheDocument();
  });
});

describe("the imagery", () => {
  const shots = [...SOURCE.matchAll(/src="(\/landing\/[^"]+)"/g)].map((m) => m[1]!);

  it("shows something", () => {
    expect(shots.length).toBeGreaterThan(0);
  });

  it("only shows screenshots that exist in the repository", () => {
    for (const src of new Set(shots)) {
      expect(existsSync(resolve(`public${src}`)), `${src} is not in public/`).toBe(true);
    }
  });

  it("gives every one of them alt text", () => {
    const imgs = [...SOURCE.matchAll(/<Shot\b[\s\S]*?\/>/g)].map((m) => m[0]);
    expect(imgs.length).toBe(shots.length);
    for (const img of imgs) expect(img).toMatch(/alt="[^"]{20,}"/);
  });
});

describe("the claims that are counted", () => {
  // Six guards fire in the running pipeline. Two more exist in the codebase and
  // are not fed a corpus, so the page must not have been talked into eight.
  it("claims six guards, not eight", () => {
    expect(SOURCE).toMatch(/[Ss]ix\s+deterministic guards/);
    expect(SOURCE).not.toMatch(/eight (deterministic )?guards/i);
  });

  it("keeps the limits that are inconvenient", () => {
    const limits = [
      /p95 misses the 2s budget/i, // measured, and stated first
      /no surface delivers a reply/i, // the one the whole page rests on
      /against a mock/i, // listing writes, by default
      /asking prices/i, // comps are not sold prices
      /90-second undo|ninety seconds/i, // the window is real and it is short
      /\$0\.06/, // the measured cost, with its basis
    ];
    for (const re of limits) expect(SOURCE).toMatch(re);
  });
});
