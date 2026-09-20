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
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_IMAGE_ALT, siteMeta } from "@/lib/meta";
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
    // It may not claim this as an absolute over surfaces. The product ships a
    // per-room posting switch — `RoomsPage` renders it, `rooms.ts` persists
    // it, preflight reads it — so "on every surface" was a promise the app's
    // own settings page contradicted. The claim is about THIS BUILD, which
    // has no wired path that posts anything.
    expect(NOT_THE_SENDER.toLowerCase()).not.toContain("on every surface");
    expect(NOT_THE_SENDER.toLowerCase()).toMatch(/this build/);
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

  /**
   * Two measured figures went stale in the flattering direction on a page
   * whose whole argument is that measured claims are kept honest:
   *
   *  · "2.11s against a 2.00s budget" — `npm run bench` now produces a TOTAL
   *    p95 of 2604ms and 2235ms on two runs. 2.11s was the best observation,
   *    not the current measurement.
   *  · "1.000 precision and recall on our own 44 cases" — there are 46 cases
   *    (`test/guardrails.eval.ts`), and the suite exits non-zero.
   *
   * Both are removed until they are re-measured. A number nobody re-ran is
   * exactly what this file exists to catch, so it may not come back by
   * accident: whoever restores one has to delete the assertion that forbids
   * it, which is a line in a diff a reviewer can see.
   */
  it("quotes no p95 and no eval score while they are being re-measured", () => {
    expect(SOURCE).not.toMatch(/2\.11\s*s/);
    expect(SOURCE).not.toMatch(/\b1\.000\b/);
    expect(SOURCE).not.toMatch(/precision and recall\s*—?\s*on our own \d+/i);
    // 44 was the wrong denominator even before the suite went red.
    expect(SOURCE).not.toMatch(/\b44 cases\b/);
  });

  it("says why the numbers are absent rather than quietly dropping them", () => {
    expect(SOURCE).toMatch(/re-?measur/i);
  });
});

/**
 * CONTENT-11 / CONTENT-12. The live site's meta description and
 * og:description were the pre-multisurface, eBay-only pitch, written twice in
 * two divergent copies, on a page whose own header comment says "a hero that
 * names one of them is a hero that is wrong about the rest". And
 * `twitter:card: summary_large_image` was declared with no image anywhere, so
 * a large-card unfurl rendered a blank slot.
 */
describe("what a link preview says", () => {
  it("does not sell a single-surface eBay product", () => {
    const d = SITE_DESCRIPTION.toLowerCase();
    expect(d).not.toMatch(/copilot for ebay live sellers/);
    expect(d).not.toMatch(/\bthe show\b/);
    for (const room of ["show", "stream", "subreddit", "inbox"]) expect(d).toContain(room);
  });

  it("keeps the sender claim in the one sentence most people will read", () => {
    expect(SITE_DESCRIPTION.toLowerCase()).toMatch(/nothing is posted for you/);
  });

  it("declares a large card only because there is an image to put in it", () => {
    const meta = siteMeta();
    const has = (k: string) => meta.some((m) => m.name === k || m.property === k);
    expect(has("twitter:card")).toBe(true);
    expect(has("og:image")).toBe(true);
    expect(has("twitter:image")).toBe(true);
  });

  it("points that image at a file that exists", () => {
    expect(existsSync(resolve(`public${SITE_IMAGE}`))).toBe(true);
  });

  it("gives it alt text", () => {
    expect(SITE_IMAGE_ALT.length).toBeGreaterThan(30);
  });
});
