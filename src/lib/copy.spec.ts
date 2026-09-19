/**
 * The two things `lib/copy` exists to stop:
 *
 *  · "sent" meaning two different things in one file, one of which never
 *    happens (CONTENT-04);
 *  · `/api/drafts failed: 500` reaching an operator's eyes (CONTENT-23).
 */

import { describe, expect, it } from "vitest";
import {
  NOTHING_BLOCKED,
  NO_FINISHED_SESSIONS,
  READINESS_UNAVAILABLE,
  SENT_MEANS,
  SENT_MEANS_REPLIES,
  SENT_MEANS_SUMMARY,
  operatorMessage,
} from "./copy";

describe("what sent means", () => {
  /**
   * `pipeline.send()` sets `status: "sent"`, counts it and appends an audit
   * entry. There is no platform call on that path or any other — the executor
   * has no `post_reply` branch and the proposer never produces one. So the
   * word may not be defined as anything reaching anybody.
   */
  it("never says a reply reached a buyer", () => {
    for (const s of [SENT_MEANS, SENT_MEANS_SUMMARY, SENT_MEANS_REPLIES]) {
      expect(s.toLowerCase()).not.toMatch(/reached (a|the) buyer/);
      expect(s.toLowerCase()).not.toMatch(/delivered|we sent|we post/);
    }
  });

  it("says what it does mean — approved, re-checked, recorded", () => {
    expect(SENT_MEANS).toMatch(/approved it/i);
    expect(SENT_MEANS).toMatch(/audit/i);
  });

  it("is one definition, used by both hints", () => {
    expect(SENT_MEANS_SUMMARY).toContain(SENT_MEANS);
    expect(SENT_MEANS_REPLIES).toContain(SENT_MEANS);
  });

  /**
   * The replies hint used to say "the six verdicts it received" on a page that
   * now draws the room-rule and sponsor pills too, where the surface has them.
   */
  it("does not promise a fixed number of verdicts", () => {
    expect(SENT_MEANS_REPLIES).not.toMatch(/\bsix verdicts\b/);
  });
});

describe("states that were written three times", () => {
  it("gives each one a single title", () => {
    expect(NO_FINISHED_SESSIONS.title).toBe("No sessions have finished yet.");
    expect(NOTHING_BLOCKED.title).toBe("Nothing was blocked.");
    expect(READINESS_UNAVAILABLE.title).toBe("Readiness could not be read.");
  });

  it("speaks of sessions, not shows", () => {
    const all = [
      ...Object.values(NO_FINISHED_SESSIONS),
      ...Object.values(NOTHING_BLOCKED),
      ...Object.values(READINESS_UNAVAILABLE),
    ].join(" ");
    expect(all.toLowerCase()).not.toMatch(/\bshows?\b/);
  });
});

describe("operatorMessage", () => {
  it("turns the shape api.ts manufactures into a sentence", () => {
    const out = operatorMessage(new Error("/api/drafts failed: 500"), "The drafts");
    expect(out).not.toContain("/api/drafts");
    expect(out).not.toContain("500");
    expect(out).toContain("The drafts could not be read.");
  });

  it("handles a bare HTTP status the same way", () => {
    expect(operatorMessage(new Error("HTTP 404"))).toMatch(/not there any more/i);
  });

  it("says a 401 is a sign-in, not a failure", () => {
    expect(operatorMessage(new Error("/api/home failed: 401"))).toMatch(/session has expired/i);
  });

  it("names an unmapped status rather than swallowing it", () => {
    expect(operatorMessage(new Error("HTTP 418"))).toContain("418");
  });

  it("rewrites the browser's own network wording, which names no route", () => {
    expect(operatorMessage(new TypeError("Failed to fetch"))).toMatch(/could not be reached/i);
  });

  it("leaves a sentence somebody wrote for an operator alone", () => {
    // preflight, the guard chain and the eBay sign-in refusal are all written
    // for the person reading them and are better than any substitute.
    const refusal = "posting is off for r/watchexchange — the draft is yours to send";
    expect(operatorMessage(new Error(refusal))).toBe(refusal);
  });

  it("says something when there is nothing to say", () => {
    expect(operatorMessage(undefined, "This session")).toMatch(/No reason was given/);
    expect(operatorMessage(undefined)).toBeTruthy();
  });
});
