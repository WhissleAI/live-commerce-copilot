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
  streamTitle,
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

describe("streamTitle", () => {
  /**
   * CONTENT-31. Every `stream_error` used to be titled "The server does not
   * know that show", including the ones where it plainly did.
   */
  it("keeps the not-found diagnosis where it is actually the diagnosis", () => {
    expect(streamTitle("no show shw_412")).toMatch(/does not have that session/i);
    expect(streamTitle(new Error("/api/stream failed: 404"))).toMatch(
      /does not have that session/i,
    );
  });

  it("calls an auth failure an auth failure", () => {
    expect(streamTitle("HTTP 401")).toMatch(/no longer signed in/i);
    expect(streamTitle("forbidden")).toMatch(/no longer signed in/i);
  });

  it("does not guess at a failure it cannot classify", () => {
    const t = streamTitle("ECONNRESET");
    expect(t).toMatch(/stream stopped/i);
    expect(t).not.toMatch(/does not have/i);
  });

  it("says nothing about a show", () => {
    for (const e of ["no show s1", "HTTP 401", "boom"]) {
      expect(streamTitle(e).toLowerCase()).not.toMatch(/\bshow\b/);
    }
  });
});

describe("operatorMessage and the backend's API-contract copy", () => {
  /**
   * `src/api/routes.ts` ships these as 400 bodies and every one of them was
   * rendered to a seller verbatim. They describe a contract the operator has
   * no part in and cannot act on.
   */
  it("does not show a seller a wire-format complaint", () => {
    for (const m of [
      "seq must be a non-negative integer",
      "durationMs must be between 1 and 120000",
      "frame must be an image data URL",
      "send { interests: [{ term }] }",
    ]) {
      const out = operatorMessage(new Error(m));
      expect(out).not.toContain(m);
      expect(out.length).toBeGreaterThan(20);
    }
  });

  it("prefers the status the api client attached to the error", () => {
    const e = Object.assign(new Error("seq must be a non-negative integer"), { status: 400 });
    expect(operatorMessage(e)).toMatch(/malformed/i);
  });

  it("still leaves a refusal written for an operator alone", () => {
    const written = "the eBay Live session is old enough that eBay may have ended it";
    expect(operatorMessage(new Error(written))).toBe(written);
  });
});
