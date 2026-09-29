import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The response headers this site serves, asserted where they are declared.
 *
 * Measured on production first: sidestage.whissle.ai returned
 * `strict-transport-security` and nothing else — no nosniff, no referrer
 * policy, no framing rule — and the backend returned not even that. None of it
 * is visible from inside the app, which is why it went unnoticed through every
 * round of work: a missing header breaks nothing and shows up nowhere.
 *
 * Two of these are load-bearing rather than hygiene:
 *
 *  Referrer-Policy   a URL here can be `/reports/<showId>` or `?showId=…`.
 *                    Under the old default a click on any outbound link handed
 *                    that path to the destination in the `Referer`. Chrome and
 *                    Firefox already default to `strict-origin-when-cross-
 *                    origin`; this covers the clients that do not.
 *
 *  framing rules     the console's buttons are Send, Approve and Rollback.
 *                    That is the thing clickjacking is for, and nothing this
 *                    app serves is ever meant to be inside someone's iframe —
 *                    there is no `<iframe>` anywhere in src, and the audio
 *                    bridge is a `window.open` tab, not a frame.
 *
 * `Permissions-Policy` denies camera and microphone because this origin asks
 * for neither: capture happens on the backend's `/audio-bridge` page, in a tab
 * of its own, under its own nonce CSP.
 */
const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

describe("the headers the edge adds", () => {
  const all = vercel.headers.find((h) => h.source === "/(.*)");
  const value = (k: string) =>
    all?.headers.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value;

  it("applies to every route, not a prefix", () => {
    expect(all, "a rule scoped to a prefix leaves the rest of the app bare").toBeTruthy();
  });

  it("refuses to be framed, both ways", () => {
    // XFO for the clients that never implemented frame-ancestors; CSP for the
    // ones that ignore XFO.
    expect(value("X-Frame-Options")).toBe("DENY");
    expect(value("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("keeps a show id out of the Referer", () => {
    const p = value("Referrer-Policy");
    expect(p).toBeDefined();
    // `origin-when-cross-origin` and `unsafe-url` both still send a path or an
    // origin on a downgrade; only these two are strict enough.
    expect(["strict-origin-when-cross-origin", "no-referrer"]).toContain(p);
  });

  it("does not sniff, and asks for no device this origin never uses", () => {
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(value("Permissions-Policy")).toContain(`${feature}=()`);
    }
  });
});
