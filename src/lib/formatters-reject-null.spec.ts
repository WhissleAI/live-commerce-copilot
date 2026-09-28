import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A formatter must never turn "not measured" into a number.
 *
 * The backend sends `number | null` for `answeredRate` and `blockRate` — the
 * two type definitions are hand-written on either side of the API and had
 * drifted, so the frontend declared `number`. `Math.round(null * 100)` is 0,
 * and a window in which nobody asked anything rendered:
 *
 *   Answered rate  0%   target >85%   (red)
 *   Block rate     0%   target <2%    (green, a guard "tested" on no drafts)
 *
 * Correcting the types surfaced five more sites that were awarding target
 * badges on nulls. Fixed in the formatters rather than at eleven call sites:
 * a null that reaches one now shows as absent by construction.
 *
 * Both pages keep their own pair — they format at different precisions — so
 * the rule is asserted for each rather than assumed from one.
 */
const pages = ["AnalyticsPage.tsx", "ReportPage.tsx"].map((f) => ({
  name: f,
  src: readFileSync(join(import.meta.dirname, "..", "components", "pages", f), "utf8"),
}));

describe("percent and duration formatters accept null", () => {
  for (const { name, src } of pages) {
    it(`${name} takes a nullable number`, () => {
      const decls = [...src.matchAll(/const (?:pct|pctText|ms) = \(n: ([^)]*)\)/g)].map((m) => m[1]);
      expect(decls.length).toBeGreaterThan(0);
      for (const d of decls) expect(d).toContain("null");
    });

    it(`${name} renders an em dash rather than a number`, () => {
      expect(src).toMatch(/n == null \? "—"/);
    });
  }
});

describe("target badges are not awarded on a null", () => {
  for (const { name, src } of pages) {
    it(`${name} gates every targetMet`, () => {
      // `null > 0.85` is false and `null < 0.02` is TRUE — so an unguarded
      // block-rate badge went GREEN on a session that drafted nothing.
      const bare = [...src.matchAll(/targetMet=\{([^}]*)\}/g)].map((m) => m[1]!.trim());
      for (const expr of bare) {
        expect(
          /== null|!= null|\?\?/.test(expr) || src.includes(`== null\n`),
          `${name}: targetMet={${expr}} must be unreachable when the value is null`,
        ).toBe(true);
      }
    });
  }
});
