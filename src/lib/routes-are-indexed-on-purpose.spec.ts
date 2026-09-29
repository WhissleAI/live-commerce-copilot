import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * CONTENT-15's ratchet.
 *
 * Every route file is in exactly one of three states, and the test exists
 * because a new route lands in none of them by default — it simply becomes a
 * page a crawler can index, and nobody notices until it is in a search result
 * next to the front door.
 *
 *   INDEXABLE   listed in the sitemap, and says nothing about robots
 *   noindex     calls `noindexMeta()` in its head
 *   a redirect  has no head at all because it has no page
 *
 * The sitemap is read as the source of truth for the first list, so adding a
 * page to one place and not the other fails here rather than in a search
 * result six weeks later.
 */
const ROUTES = join(process.cwd(), "src", "routes");
const SITEMAP = join(process.cwd(), "public", "sitemap.xml");

/** `/privacy` ← `privacy.tsx`, `/` ← `index.tsx`. Flat routes only, which is all there are. */
const pathOf = (file: string): string =>
  file === "index.tsx" ? "/" : `/${file.replace(/\.tsx$/, "").replace(/\.index$/, "")}`;

const routeFiles = readdirSync(ROUTES)
  .filter((f) => f.endsWith(".tsx") && f !== "__root.tsx")
  .sort();

const source = (f: string) => readFileSync(join(ROUTES, f), "utf8");

const sitemapPaths = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  new URL(m[1]!).pathname.replace(/(.)\/$/, "$1"),
);

describe("what a crawler is invited to index", () => {
  it("has routes to check at all", () => {
    expect(routeFiles.length).toBeGreaterThan(10);
    expect(sitemapPaths).toContain("/");
  });

  it("puts every route in exactly one of the three states", () => {
    const unaccounted: string[] = [];
    for (const f of routeFiles) {
      const src = source(f);
      const redirect = src.includes("throw redirect(");
      const noindexed = src.includes("noindexMeta()");
      const inSitemap = sitemapPaths.includes(pathOf(f));
      // A parameterised route ($showId) can never be in a sitemap: the URLs are
      // a seller's own shows. It must be noindexed, which the count below sees.
      if ([redirect, noindexed, inSitemap].filter(Boolean).length !== 1) unaccounted.push(f);
    }
    expect(
      unaccounted,
      "each route is a redirect, or noindexed, or listed in public/sitemap.xml — never none and never two",
    ).toEqual([]);
  });

  it("does not list a page in the sitemap that no route serves", () => {
    const served = new Set(routeFiles.map(pathOf));
    for (const p of sitemapPaths) expect(served, `sitemap lists ${p}`).toContain(p);
  });

  it("lets the crawler in, so that noindex can be read", () => {
    const robots = readFileSync(join(process.cwd(), "public", "robots.txt"), "utf8");
    // A Disallow here would block the fetch and strand the directive.
    expect(robots).not.toMatch(/^\s*Disallow:\s*\//m);
    expect(robots).toMatch(/^Sitemap: https:\/\/sidestage\.whissle\.ai\/sitemap\.xml$/m);
  });
});
