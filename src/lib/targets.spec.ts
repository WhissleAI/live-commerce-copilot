import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DECISION_MS, P95_ANSWER_MS, targetLabel } from "./targets";

// One bar per measurement, across every screen that grades against it.
//
// Time-to-answer was corrected to the PRD's 10 s on the report and left at the
// original brief's 2 s on Analytics, so the same number read as inside target
// on one screen and as a miss on the other. That is not a rendering bug; it is
// two copies of a constant, which is what this file exists to stop.

describe("the PRD's targets", () => {
  it("states them as the PRD does", () => {
    expect(P95_ANSWER_MS).toBe(10_000);
    // Genuinely two seconds, and not a leftover: this one measures the human.
    expect(DECISION_MS).toBe(2_000);
  });

  it("derives the label from the number, so words and comparison cannot disagree", () => {
    expect(targetLabel(P95_ANSWER_MS)).toBe("target <10s");
    expect(targetLabel(DECISION_MS)).toBe("target <2s");
    expect(targetLabel(850)).toBe("target <850ms");
  });
});

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsxFiles(p, out);
    else if (p.endsWith(".tsx") && !p.endsWith(".spec.tsx")) out.push(p);
  }
  return out;
}

describe("no screen carries its own copy of a target", () => {
  it("never writes a latency target as a literal", () => {
    const offenders: string[] = [];
    for (const f of tsxFiles("src/components")) {
      const body = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const [i, line] of body.split("\n").entries()) {
        // A hard-coded LATENCY target — "target <10s", "target <850ms". Rate
        // and count targets ("target <2%", "target <25") are deliberately not
        // covered: several are the autonomy ladder's promotion criteria, which
        // are a different thing from the PRD's success metrics and legitimately
        // carry different numbers.
        if (/target\s*<\s*[\d.]+\s*(s|ms)\b/.test(line)) {
          offenders.push(`${f}:${i + 1} ${line.trim().slice(0, 80)}`);
        }
        if (/\b(p95|LatencyMs|medianDecisionMs)\w*\s*[<>]=?\s*(2000|10000|10_000)\b/.test(line)) {
          offenders.push(`${f}:${i + 1} ${line.trim().slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
