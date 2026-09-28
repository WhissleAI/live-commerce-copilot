import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every finished session has to be reachable.
 *
 * The band showed the six most recent and said nothing about the rest — and
 * there is no other list, because `/reports` redirects to home. So a session
 * older than the sixth was unreachable from anywhere in the product, report
 * and all. Reported by a seller looking for a session that answered five
 * questions, thirteen days back; the home query's `LIMIT 6` was the whole
 * history the product would show.
 */
const home = readFileSync(
  join(import.meta.dirname, "..", "components", "pages", "HomePage.tsx"),
  "utf8",
);

describe("the finished-sessions band", () => {
  it("leads with a few rather than rendering everything", () => {
    expect(home).toMatch(/SHOWN_BY_DEFAULT = 6/);
    expect(home).toMatch(/reports\.slice\(0, SHOWN_BY_DEFAULT\)/);
  });

  it("offers the rest, counted, so the number is not a guess", () => {
    expect(home).toMatch(/All \$\{reports\.length\} sessions/);
  });

  it("offers nothing when there is nothing behind the fold", () => {
    expect(home).toMatch(/reports\.length > SHOWN_BY_DEFAULT/);
  });

  it("expands in place — there is nowhere else to send anyone", () => {
    // `/reports` redirects to `/`, so a link would bounce straight back.
    expect(home).toMatch(/setShowAll/);
    expect(home).toMatch(/Show fewer/);
  });
});
