import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Cost page is where this product gets priced, so its labels have to be
 * true.
 *
 * `durationMin` is attach-to-detach. For a live event that ends, that is the
 * show; for a room that persists it is not, and the Rooms page says so —
 * "a room here is a list, not a running watch". Calling the sum of it "on air"
 * let two rooms left attached overnight hold 1297 minutes each: 98.4% of all
 * counted time, for one gateway call apiece and nobody answered. The headline
 * read $0.05 an hour where the working rate was $2.95.
 */
const page = readFileSync(
  join(import.meta.dirname, "..", "components", "pages", "CostPage.tsx"),
  "utf8",
);

describe("the Cost page says what it measures", () => {
  it("does not call time attached 'on air'", () => {
    expect(page).not.toMatch(/on air/i);
  });

  it("names the per-hour tile for the sessions it is a rate over", () => {
    expect(page).toContain("Per hour, sessions that answered");
  });

  it("shows that basis beside the number, so the scope is not a footnote", () => {
    expect(page).toMatch(/workingShows/);
    expect(page).toMatch(/workingMinutes/);
  });

  it("says 'no session has answered anyone yet' rather than printing a price", () => {
    // `perHourUsd` is null until something has been answered. A zero here would
    // read as "this is free".
    expect(page).toContain("no session has answered anyone yet");
  });
});
