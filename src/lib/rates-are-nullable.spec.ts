import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A rate, an average or a percentile must be declared nullable.
 *
 * The backend returns `number | null` from every rate helper, because a rate
 * over an empty set is not zero. The frontend's types are hand-written on the
 * other side of the wire, TypeScript cannot see across it, and they drifted:
 * seven fields declared `number` for values the backend nulls.
 *
 * One of the seven, `timeToAnswerP95Ms`, drifted in the round that widened it
 * on the backend — the seam opening the moment somebody used it. That is the
 * argument for a ratchet rather than another sweep.
 *
 * Counts are exempt by construction: `answered`, `sent`, `blocked` and friends
 * mean something at zero. The rule keys off the field NAME saying "rate",
 * "median", "avg", "share", "per…" or a percentile, because that is the same
 * signal a reviewer uses.
 */
const types = readFileSync(join(import.meta.dirname, "types.ts"), "utf8");

const RATEISH =
  /^\s*(\w*(?:[Rr]ate|P95|P50|P99|[Mm]edian|Avg|Average|Share|per[A-Z])\w*)(\??):\s*([^;]+);/gm;

/**
 * Names that look like a rate and are genuinely never absent.
 *
 * Each needs a reason. `medianCents` and the median latencies come from
 * comps and per-session records that the backend declares non-null — widening
 * them is a migration against stored reports, not an edit here.
 */
const ALLOWED: Record<string, string> = {
  medianCents: "comps median, non-null on the backend's own type",
  medianOfMediansMs: "guarded at its one call site; backend declares it number",
  medianLatencyMs: "field on the stored ShowReport; widening is a migration",
  medianDecisionMs: "already `number | null` where it can be absent",
};

describe("rate-shaped fields are nullable", () => {
  it("every one matches what the backend can send", () => {
    const bad: string[] = [];
    for (const m of types.matchAll(RATEISH)) {
      const [, name, optional, ty] = m;
      if (!ty!.includes("number")) continue;
      if (ty!.includes("null") || optional) continue;
      if (ALLOWED[name!]) continue;
      bad.push(`${name}: ${ty!.trim()}`);
    }
    expect(bad).toEqual([]);
  });

  it("the allow-list carries a reason for each name", () => {
    for (const [name, why] of Object.entries(ALLOWED)) {
      expect(why.length, `${name} needs a reason, not a placeholder`).toBeGreaterThan(20);
    }
  });

  it("counts are left alone — zero means zero", () => {
    // The rule must not fire on `answered`, `sent`, `blocked`: a session that
    // answered nobody genuinely answered zero.
    for (const count of ["answered", "sent", "blocked", "commentsSeen"]) {
      expect(RATEISH.test(`  ${count}: number;`), count).toBe(false);
      RATEISH.lastIndex = 0;
    }
  });
});
