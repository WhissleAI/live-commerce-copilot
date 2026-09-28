import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Settings page tells a seller what protects them. Three of its eight
 * descriptions promised more, or something else, than the guard does.
 *
 *   Grounding — "whose text supports it ... No citation, no send — the copilot
 *   abstains instead of guessing." Support is a token-overlap and trigram test
 *   (ratio >= 0.25 or cosine >= 0.18); `guards.ts` says outright it is "not an
 *   entailment model". A reply asserting nothing sends with no citation at all,
 *   which is how the follow-up drafts got out saying "the host will cover it
 *   shortly". And an uncited assertion returns `revise`, not abstained —
 *   abstention happens upstream in retrieval, so this pointed operators at the
 *   wrong subsystem.
 *
 *   PII — "masked before anything reaches public chat." `piiGuard` reads no
 *   policy and BLOCKS. `redactPii` goes to the agent's own content_guardrails,
 *   for channels this app is not in front of, so the knob printed beside this
 *   row changes nothing about the row.
 *
 *   Tone — omitted that an empty reply and profanity are blocks, not voice
 *   preferences.
 *
 * These are one-line claims that read fine and are checkable only against the
 * guard. This test holds the corrections in place.
 */
const page = readFileSync(
  join(import.meta.dirname, "..", "components", "pages", "SettingsPage.tsx"),
  "utf8",
);

/**
 * Only the strings a seller reads.
 *
 * The comments beside these quote the old wording to say why it changed, so
 * asserting over the raw slice fails on the very explanation of the fix.
 */
const describedChecks = (): string => {
  const withoutComments = page
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const checks = withoutComments.match(/checks:\s*(?:\n\s*)?"((?:[^"\\]|\\.)*)"/g) ?? [];
  expect(checks.length).toBeGreaterThanOrEqual(8);
  return checks.join("\n");
};

describe("the guard descriptions match the guards", () => {
  it("does not claim grounding understands meaning", () => {
    const s = describedChecks();
    expect(s).not.toContain("whose text supports it");
    expect(s).toMatch(/not a judgement of meaning/i);
  });

  it("does not claim every reply must cite something", () => {
    // A greeting or an explicit deferral goes uncited by design.
    const s = describedChecks();
    expect(s).not.toContain("No citation, no send");
    expect(s).toMatch(/may go uncited/i);
  });

  it("does not say grounding abstains — it revises", () => {
    const s = describedChecks();
    expect(s).not.toMatch(/abstains instead of guessing/);
    expect(s).toMatch(/comes back rewritten, not sent/i);
  });

  it("says PII is blocked, not masked", () => {
    const s = describedChecks();
    expect(s).not.toMatch(/are masked before/);
    expect(s).toMatch(/blocked, not scrubbed/i);
  });

  it("names the enforcement the redact knob actually reaches", () => {
    // Otherwise the setting reads as governing the row it sits beside.
    const s = describedChecks();
    expect(s).toMatch(/reaches the agent, not this check/i);
  });

  it("says an empty reply and profanity are blocks", () => {
    const s = describedChecks();
    expect(s).toMatch(/empty reply or profanity is blocked/i);
  });
});
