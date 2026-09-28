import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Zero is not "nothing measured", and this codebase kept saying it was.
 *
 * Five places, found one at a time across this session, all the same shape —
 * a rate or percentile over an empty set rendering as a result:
 *
 *   perHourUsd      spend ÷ 0 working minutes    → looked free
 *   groundedRate    answered ÷ 0 questions       → looked like it answered none
 *   gmv per hour    gross ÷ 0 selling hours      → a rate over idle attachment
 *   console p95     percentile of an empty window → "0ms" in green, mid-show
 *   worst p95       Math.max(0, ...[])           → "0ms" AND a met target
 *
 * The rate helpers in the backend's `metrics.ts` all return `number | null`
 * for exactly this reason. The ones that leaked were computed inline and
 * missed it. This spec holds the display side of the last of them.
 */
const analytics = readFileSync(
  join(import.meta.dirname, "..", "components", "pages", "AnalyticsPage.tsx"),
  "utf8",
);

describe("an empty window renders as unmeasured, not as a result", () => {
  it("worst p95 shows no number when nothing answered", () => {
    expect(analytics).toMatch(/e\.worstP95Ms == null \? "—"/);
  });

  it("and awards no target it did not earn", () => {
    // `0 < P95_ANSWER_MS` is true, so the empty case used to render a MET
    // badge — the strongest possible claim, on no evidence.
    expect(analytics).toMatch(/e\.worstP95Ms == null\s*\n?\s*\?\s*\{\}/);
  });

  it("cache hit rate distinguishes 'never hits' from 'never asked'", () => {
    expect(analytics).toMatch(/e\.cacheHitRate == null \? "—"/);
    expect(analytics).toContain("no sessions in this window");
  });

  it("the live session view uses one signal for both its numbers", () => {
    // An empty latency window is the same fact for p95 and for cache: this
    // session has not answered anything.
    expect(analytics.match(/c\.latency\.samples === 0/g) ?? []).not.toHaveLength(0);
  });
});
