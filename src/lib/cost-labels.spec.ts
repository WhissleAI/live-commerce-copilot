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

const analytics = readFileSync(
  join(import.meta.dirname, "..", "components", "pages", "AnalyticsPage.tsx"),
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

/**
 * Analytics had the same mislabel and one worse consequence: "GMV per session
 * hour" divided gross by every hour the app was attached to anything. Two
 * rooms left attached overnight held 21.6 hours each, sold nothing, and put
 * $205 an hour on the metric the PRD names first — against roughly $13,000
 * over the shows that actually sold.
 */
describe("the Analytics page says what it measures", () => {
  it("does not label a DURATION 'on air'", () => {
    // "the session on air right now" is fine and true — a live show is on air.
    // What is not is calling attach-to-detach time airtime, which is how a
    // subreddit came to hold 21.6 hours of it.
    expect(analytics).not.toMatch(/>On air</);
    expect(analytics).not.toMatch(/h on air/);
    expect(analytics).not.toMatch(/hours on air/);
  });

  it("divides gross by the hours that produced it", () => {
    expect(analytics).toMatch(/o\.gmv\.grossCents \/ o\.gmv\.hours/);
    expect(analytics).not.toMatch(/grossCents \/ o\.shows\./);
  });

  it("says nothing sold rather than printing a rate of nothing", () => {
    expect(analytics).toContain("nothing has sold in this window");
  });

  it("hints the answered rate with the number it is a rate of", () => {
    // The headline is sent ÷ asked. The hint used to print drafted ÷ asked —
    // 34 of 45, which reads as 76% above a headline of 7%.
    expect(analytics).toMatch(/\$\{e\.sent\} sent/);
  });
});
