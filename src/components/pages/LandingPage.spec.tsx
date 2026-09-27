import { describe, expect, it } from "vitest";
import { readFileSync, statSync, readdirSync } from "node:fs";

const src = readFileSync("src/components/pages/LandingPage.tsx", "utf8");

// The landing page stakes its credibility on one sentence: "Every image on this
// page is a capture of the product or of eBay Live, never a mock." That is only
// worth saying while it is true, and a capture of a screen the product no
// longer has is a mock with extra steps — `shows.jpg` showed a page called
// Shows, with Live/Past/Following/Discover tabs, months after Home replaced it.
//
// Nothing here can tell whether an image is CURRENT; that needs an eye. What it
// can do is refuse the two lies a stale capture tells in words.

describe("the landing page does not date itself wrong", () => {
  it("never calls a stored screenshot 'tonight', 'today' or 'right now'", () => {
    const captions = [...src.matchAll(/caption="([^"]+)"/g)].map((m) => m[1]!);
    expect(captions.length).toBeGreaterThan(0);
    const dated = captions.filter((c) => /\b(tonight|today|right now|just now|this evening)\b/i.test(c));
    expect(dated, "a stored image cannot claim to be from tonight").toEqual([]);
  });

  it("only points at images that exist", () => {
    const used = [...src.matchAll(/src="\/landing\/([^"]+)"/g)].map((m) => m[1]!);
    const have = new Set(readdirSync("public/landing"));
    expect(used.filter((f) => !have.has(f))).toEqual([]);
  });

  it("ships no screenshot the page has stopped using", () => {
    const used = new Set([...src.matchAll(/src="\/landing\/([^"]+)"/g)].map((m) => m[1]!));
    const orphans = readdirSync("public/landing").filter((f) => !used.has(f));
    expect(orphans, "an unused capture is dead weight in the bundle").toEqual([]);
  });

  it("gives every screenshot alt text that describes it", () => {
    const shots = [...src.matchAll(/<Shot\b[\s\S]{0,700}?\/>/g)].map((m) => m[0]);
    expect(shots.length).toBeGreaterThan(3);
    for (const shot of shots) {
      const alt = shot.match(/alt="([^"]*)"/)?.[1] ?? "";
      expect(alt.split(" ").length, `alt too thin: ${alt}`).toBeGreaterThan(5);
    }
  });
});
