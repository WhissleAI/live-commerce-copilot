/**
 * What the legal pages are allowed to say, and what they may not stop saying.
 *
 * These two pages were the worst copy in the product and for the most ordinary
 * reason: they were written in one month, about one surface, and never read
 * again. The landing page meanwhile claims they are "written from what it
 * actually stores", so the drift was a false claim about a false claim.
 *
 *  · CONTENT-01 — both pages carried a sandbox notice. `EBAY_ENV=production`
 *    in the deployed backend, and the eBay Live reading paths fetch
 *    `www.ebay.com` regardless of that variable, so the notice told real
 *    people their words were test data.
 *  · CONTENT-02 — five surfaces of collection were undisclosed.
 *
 * The assertions below are the cheap half of keeping that from recurring: a
 * surface in the shipped capability table that the privacy policy has never
 * heard of fails the suite. The expensive half is a person reading them, and
 * nothing here replaces it.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SURFACE_IDS } from "@/lib/surfaces";
import { PrivacyPage, SURFACE_READS, TermsPage } from "./LegalPage";

/** These pages are plain prose in one <Link>-bearing frame. */
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));


const privacy = () => render(<PrivacyPage />).container.textContent ?? "";
const terms = () => render(<TermsPage />).container.textContent ?? "";

describe("the privacy policy", () => {
  // The word is allowed — "it is not a sandbox" is the sentence we want. The
  // CLAIM is what must not come back.
  it("does not say the product runs on a sandbox", () => {
    const text = privacy().toLowerCase();
    expect(text).not.toMatch(/runs against (ebay's )?(the )?sandbox/);
    expect(text).not.toMatch(/currently runs against/);
    expect(text).not.toContain("test data");
    expect(text).not.toMatch(/nothing it does reaches/);
  });

  it("says the opposite, in the operator's words", () => {
    expect(privacy()).toMatch(/not a sandbox/i);
    expect(privacy()).toMatch(/real listings?/i);
  });

  /**
   * The one that will actually catch the next drift. A surface is added to
   * `SURFACE_CAPABILITIES` when its adapter lands; if nobody adds a row here,
   * a place the product reads other people's words is undisclosed, which is
   * exactly how the last five got in.
   *
   * `simulated` reads nothing (a hard-coded script) and `youtubelive` is a
   * capability row with no adapter, so neither has anything to disclose.
   */
  it("names every surface that reads somebody else's words", () => {
    const disclosed = new Set(SURFACE_READS.map((s) => s.id));
    const mustDisclose = SURFACE_IDS.filter((id) => id !== "simulated" && id !== "youtubelive");
    for (const id of mustDisclose) {
      expect(disclosed, `${id} reads a room and is not in the privacy policy`).toContain(id);
    }
  });

  it("renders each of them with what it reads", () => {
    const text = privacy();
    for (const s of SURFACE_READS) {
      expect(text).toContain(s.surface);
      expect(s.how.length).toBeGreaterThan(40);
    }
    // The three the old page had never heard of.
    expect(text).toMatch(/Reddit/);
    expect(text).toMatch(/Twitch/);
    expect(text).toMatch(/Whatnot/);
    expect(text).toMatch(/TikTok/);
  });

  it("says that comments by other people are stored, in those words", () => {
    expect(privacy()).toMatch(/comments by people who are not you/i);
    expect(privacy()).toMatch(/display name/i);
  });

  it("names the follow-up inbox as a thing that stores a named person", () => {
    expect(privacy()).toMatch(/follow-ups?/i);
  });

  /**
   * There is no time-based deletion of content anywhere in the backend — the
   * only recurring sweeps are the gateway agent GC, unattached prepared
   * sessions and OAuth nonces. So the page may not quote a period, and must
   * say that it does not have one.
   */
  it("invents no retention period", () => {
    const text = privacy();
    expect(text).toMatch(/no timer/i);
    expect(text).not.toMatch(/\b\d+\s*(days?|months?|years?)\s+(of|after|from)\b/i);
    expect(text).not.toMatch(/deleted after \d+/i);
  });

  it("names what it has not decided rather than filling it in", () => {
    expect(privacy()).toMatch(/not decided yet/i);
    expect(privacy()).toMatch(/legal basis/i);
  });

  it("says what outlives a deleted session", () => {
    expect(privacy()).toMatch(/deleting a session does not delete them/i);
  });

  it("names Whissle as the model provider and says what is sent", () => {
    expect(privacy()).toMatch(/Whissle/);
    expect(privacy()).toMatch(/only such provider/i);
  });
});

describe("the terms", () => {
  it("does not say the product runs on a sandbox", () => {
    const text = terms().toLowerCase();
    expect(text).not.toMatch(/runs against (ebay's )?(the )?sandbox/);
    expect(text).not.toMatch(/no real commerce/);
    expect(text).toMatch(/not a test environment/);
  });

  /**
   * The terms are the last place the sender claim is stated, and the page that
   * matters most if it is wrong. It must be true of the code: nothing in this
   * build posts anything. `actions/proposer.ts` never produces `post_reply`,
   * `actions/executor.ts` has no branch for it, and the one implementation
   * that exists is imported by its own test and by nothing in `src/`.
   */
  it("states who sends, and does not overclaim the absolute", () => {
    expect(terms()).toMatch(/nothing in this build posts for you/i);
    expect(terms()).toMatch(/you send, and you approve/i);
  });

  it("names the posting switch rather than leaving it to be discovered", () => {
    expect(terms()).toMatch(/posting switch/i);
  });

  it("is not written as though eBay were the only platform", () => {
    expect(terms()).toMatch(/Twitch/);
    expect(terms()).toMatch(/subreddit/i);
  });
});
