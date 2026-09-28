import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { api, tokenQuery } from "./api";

/**
 * The account session must not travel in a `src` attribute.
 *
 * `<img>` and `<audio>` cannot send a bearer header, so the report's frame and
 * audio URLs carry their token in the query string — which puts it in the
 * rendered DOM once per frame, and in every access-log line the report writes.
 * That token was `sst_`: thirty days, whole account. The backend's query-token
 * path allowlist did not contain the damage, because it governs where a token
 * may be READ from, not what it can do — harvested from a `src` and replayed as
 * `Authorization: Bearer`, it reaches everything.
 *
 * `api.mediaToken()` mints a scoped `smt_` instead: one hour, one show,
 * read-only. These tests hold the shape of that decision, since the regression
 * is invisible — the page looks identical either way.
 */
describe("media URLs carry a scoped token, never the session", () => {
  it("requires a token to be passed in — it cannot reach for the session itself", () => {
    const frame = api.frameUrl("show-1", 7, "smt_deadbeef");
    const audio = api.audioUrl("show-1", 7, "smt_deadbeef");
    expect(frame).toContain("token=smt_deadbeef");
    expect(audio).toContain("token=smt_deadbeef");
  });

  it("builds the media paths the backend scopes on", () => {
    // `inShowScope` admits an `smt_` token only under this show's `media/`.
    expect(api.frameUrl("show-1", 7, "t")).toContain("/api/shows/show-1/media/frames/7");
    expect(api.audioUrl("show-1", 7, "t")).toContain("/api/shows/show-1/media/audio/7");
  });

  it("escapes a show id that would otherwise break out of the path", () => {
    expect(api.frameUrl("a/b?x=1", 1, "t")).toContain("/api/shows/a%2Fb%3Fx%3D1/media/frames/1");
  });

  it("leaves the session query to the one caller that still has no alternative", () => {
    // EventSource cannot set a header and the stream IS the console, so there
    // is no narrower token to give it. Everything else moved off.
    const src = readFileSync(join(import.meta.dirname, "api.ts"), "utf8");
    const uses = src.split("\n").filter((l) => l.includes("tokenQuery()") && !l.includes("function"));
    expect(uses).toHaveLength(1);
    expect(uses[0]).toContain("/api/stream");
    expect(typeof tokenQuery()).toBe("string");
  });

  it("has no helper left that builds a session-bearing URL", () => {
    // `exportUrl` was replaced by `exportBlob` and left behind unused: a
    // shareable link with a thirty-day account token in it.
    expect("exportUrl" in api).toBe(false);
  });
});
