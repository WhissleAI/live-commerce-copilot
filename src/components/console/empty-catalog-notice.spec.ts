import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A session with no catalog answers nothing, and said so nowhere.
 *
 * Attaching a show without a catalog leaves retrieval with no listings to
 * ground on, so every draft comes back deferring to the host. Run against a
 * simulated show, the console showed eleven cards reading "the host will cover
 * that shortly", each with a Copy button, and not one word explaining why.
 *
 * It took a database query to tell the two apart — a copilot that cannot
 * answer, and one that will not. An operator has no database.
 *
 * The rail cannot carry this. An empty lot QUEUE is normal for a show with a
 * full catalog, so its silence already means something else; only
 * `listings.length` distinguishes them.
 */
const page = readFileSync(join(import.meta.dirname, "Console.tsx"), "utf8");

describe("the console says when it has nothing to answer from", () => {
  it("renders a notice keyed off an empty catalog", () => {
    expect(page).toMatch(/listings\.length === 0/);
    expect(page).toMatch(/This session has no catalog/);
  });

  it("explains the consequence, not just the state", () => {
    // "No catalog" alone does not tell an operator why every card is a
    // deflection; that connection is the whole point of the line.
    expect(page).toMatch(/defer every question to you/);
  });

  it("names where to fix it", () => {
    expect(page).toMatch(/Knowledge/);
    expect(page).toMatch(/Home/);
  });

  it("only fires once a show is attached", () => {
    // Before a show exists the console already says "Nothing is on air", and a
    // second empty-state under it would be noise.
    expect(page).toMatch(/show && listings\.length === 0/);
  });
});
