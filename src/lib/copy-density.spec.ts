import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Product copy is not documentation, and it grows back.
//
// The landing page reached 3,281 rendered words and the signed-in screens
// carried 97 elements over their ceiling — every card a paragraph, every column
// a paragraph. The pass that fixed it is worth nothing if the next person adds
// a 60-word explainer, so the ceiling is a test.
//
// The budgets live in .claude/skills/product-surface-copy. This enforces the
// one that can be checked without rendering: no single piece of operator-facing
// copy runs past SENTENCE_MAX words in one sentence.

// A RATCHET, not the target.
//
// The skill's real budget is 14 words for a card body and 20 for any sentence.
// The product is not there yet, and these numbers say where it actually is so
// the guard bites on anything NEW. They come down as passages are done; the
// worst passage in the product was 97 words when this started.
//
//   97 -> 50 -> 34
//
// Lower them again when you next work on copy. Do not raise them.
const SENTENCE_MAX = 26;
const PASSAGE_MAX = 34;

/**
 * Is this actually a sentence someone reads?
 *
 * The first draft of this guard flagged an SVG path in the logo and a fragment
 * of the navigation-menu component. Both are long, both start with a capital,
 * and neither is copy. Prose has plain lowercase words in it and no code
 * punctuation; that separates the two without a list of exceptions.
 */
function isProse(t: string): boolean {
  if (/[{}]|=>|;\s|\.displayName|^\s*[MmLlCcZz][\d.\s,-]{10}/.test(t)) return false;
  const lower = t.split(/\s+/).filter((w) => /^[a-z][a-z'’-]{2,}$/.test(w)).length;
  return lower >= 6;
}

/** Copy the operator reads, as written in the component. */
function passages(src: string): string[] {
  const s = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^import[\s\S]*?from\s+"[^"]+";/gm, "")
    // Alt text is exempt. It describes an image for someone who cannot see it,
    // which is a different job from copy — a thin alt is the bug there, not a
    // long one. LandingPage.spec.tsx asserts alt exists and is substantial.
    .replace(/\balt="[^"]*"/g, "");
  const out: string[] = [];
  // Long string literals that read like prose, not class names or ids.
  for (const m of s.matchAll(/"([A-Z][^"\\\n]{60,900})"/g)) {
    const t = m[1]!;
    if (/px|rounded|flex|grid|text-\[|bg-|border|\bgap-/.test(t)) continue;
    if (isProse(t)) out.push(t);
  }
  // JSX text nodes.
  for (const m of s.matchAll(/>([^<>{}]{80,900})</g)) {
    const t = m[1]!.replace(/\s+/g, " ").trim();
    if (isProse(t)) out.push(t);
  }
  return out;
}

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) files(p, out);
    // LegalPage is exempt: privacy and terms are enumeration, and there the
    // enumeration IS the content. Tighten its phrasing, never its items.
    else if (p.endsWith(".tsx") && !p.endsWith(".spec.tsx") && !p.includes("LegalPage")) out.push(p);
  }
  return out;
}

describe("operator-facing copy stays inside its ceiling", () => {
  const offenders: { file: string; words: number; text: string }[] = [];
  for (const f of files("src/components")) {
    for (const p of passages(readFileSync(f, "utf8"))) {
      const words = p.split(/\s+/).filter(Boolean).length;
      if (words > PASSAGE_MAX) offenders.push({ file: f, words, text: p.slice(0, 70) });
    }
  }

  it(`has no passage over ${PASSAGE_MAX} words`, () => {
    expect(
      offenders.sort((a, b) => b.words - a.words).map((o) => `${o.file} ${o.words}w — ${o.text}`),
    ).toEqual([]);
  });

  it(`has no sentence over ${SENTENCE_MAX} words`, () => {
    const long: string[] = [];
    for (const f of files("src/components")) {
      for (const p of passages(readFileSync(f, "utf8"))) {
        for (const sentence of p.split(/(?<=[.!?])\s+/)) {
          const w = sentence.split(/\s+/).filter(Boolean).length;
          if (w > SENTENCE_MAX) long.push(`${f} ${w}w — ${sentence.slice(0, 70)}`);
        }
      }
    }
    expect(long).toEqual([]);
  });
});
