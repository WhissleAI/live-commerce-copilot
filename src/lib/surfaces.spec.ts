import { describe, expect, it } from "vitest";
import {
  EBAYLIVE_CAPABILITIES,
  SURFACE_CAPABILITIES,
  capabilitiesOf,
  consoleLayout,
  guardOrderFor,
  normalizeCapabilities,
  recognise,
  surfaceLabel,
  surfaceOf,
  withRemote,
} from "./surfaces";
import type { SurfaceCapabilities, SurfaceInfo } from "./types";

describe("capabilitiesOf", () => {
  it("answers from the table for a surface it knows", () => {
    expect(capabilitiesOf("reddit").delivery).toBe("draft-only");
    expect(capabilitiesOf("twitch").communityRules).toBe(true);
  });

  // The degrade path that matters most: every show row written before the
  // column existed has no surface at all, and each of those was live commerce.
  it("answers as live commerce for an unknown, absent or null id", () => {
    expect(capabilitiesOf(undefined)).toEqual(EBAYLIVE_CAPABILITIES);
    expect(capabilitiesOf(null)).toEqual(EBAYLIVE_CAPABILITIES);
    expect(capabilitiesOf("mastodon")).toEqual(EBAYLIVE_CAPABILITIES);
  });

  it("prefers the server's answer when it has one", () => {
    const remote: SurfaceInfo[] = [
      {
        id: "ebaylive",
        label: "eBay Live",
        capabilities: { ...EBAYLIVE_CAPABILITIES, communityRules: true },
      },
    ];
    expect(capabilitiesOf("ebaylive", remote).communityRules).toBe(true);
    // A surface the server did not mention keeps its built-in answer rather
    // than disappearing.
    expect(capabilitiesOf("reddit", remote).delivery).toBe("draft-only");
  });
});

describe("normalizeCapabilities", () => {
  it("fills every field a half-shipped payload left out", () => {
    const c = normalizeCapabilities({ tempo: "async" } as Partial<SurfaceCapabilities>);
    expect(c.tempo).toBe("async");
    expect(c.perception.audio).toBe(true);
    expect(Array.isArray(c.actions)).toBe(true);
    expect(c.communityRules).toBe(false);
  });

  it("survives null, which is what a 500 deserialises to", () => {
    expect(() => normalizeCapabilities(null)).not.toThrow();
    expect(normalizeCapabilities(null).delivery).toBe("api");
  });
});

describe("surfaceOf", () => {
  it("prefers the surface column and falls back to its older name", () => {
    expect(surfaceOf({ surface: "reddit", source: "ebaylive" })).toBe("reddit");
    expect(surfaceOf({ source: "twitch" })).toBe("twitch");
  });

  it("reads a show with neither as eBay Live", () => {
    expect(surfaceOf(null)).toBe("ebaylive");
    expect(surfaceOf({})).toBe("ebaylive");
  });
});

describe("consoleLayout", () => {
  // The regression test for the reference surface: eBay Live must keep every
  // column it has today, and must NOT grow the one it never had.
  it("gives eBay Live every column it renders today", () => {
    expect(consoleLayout(SURFACE_CAPABILITIES.ebaylive)).toEqual({
      lotRail: true,
      latencyMeter: true,
      hostAudio: true,
      threadPanel: false,
      actionRail: true,
      deliverable: true,
    });
  });

  it("gives the simulated show exactly the same shape", () => {
    expect(consoleLayout(SURFACE_CAPABILITIES.simulated)).toEqual(
      consoleLayout(SURFACE_CAPABILITIES.ebaylive),
    );
  });

  it("drops the lot rail where there is no listing corpus", () => {
    expect(consoleLayout(SURFACE_CAPABILITIES.twitch).lotRail).toBe(false);
    expect(consoleLayout(SURFACE_CAPABILITIES.ebaylive).lotRail).toBe(true);
  });

  it("drops the latency meter on an async surface and puts a thread panel there", () => {
    const reddit = consoleLayout(SURFACE_CAPABILITIES.reddit);
    expect(reddit.latencyMeter).toBe(false);
    expect(reddit.threadPanel).toBe(true);
    expect(reddit.hostAudio).toBe(false);
    expect(reddit.deliverable).toBe(false);
  });

  it("keeps the host-audio panel only where the surface carries audio", () => {
    expect(consoleLayout(SURFACE_CAPABILITIES.twitch).hostAudio).toBe(true);
    expect(consoleLayout(SURFACE_CAPABILITIES.dm).hostAudio).toBe(false);
  });
});

describe("guardOrderFor", () => {
  it("is the same six on eBay Live as it has always been", () => {
    expect(guardOrderFor(SURFACE_CAPABILITIES.ebaylive)).toEqual([
      "price",
      "availability",
      "policy",
      "claim_grounding",
      "tone",
      "pii",
    ]);
  });

  it("adds the room-rule guard only where the room has rules", () => {
    expect(guardOrderFor(SURFACE_CAPABILITIES.reddit)).toContain("community_rule");
    expect(guardOrderFor(SURFACE_CAPABILITIES.ebaylive)).not.toContain("community_rule");
  });

  it("adds the sponsor guard only where a sponsor corpus exists", () => {
    expect(guardOrderFor(SURFACE_CAPABILITIES.twitch)).toContain("sponsor");
    expect(guardOrderFor(SURFACE_CAPABILITIES.reddit)).not.toContain("sponsor");
  });
});

describe("withRemote", () => {
  it("returns every surface when the server answers nothing", () => {
    const rows = withRemote(null);
    expect(rows).toHaveLength(Object.keys(SURFACE_CAPABILITIES).length);
    // Nothing is attachable until a server says which adapters are wired: a
    // paste box that offers to watch something with no adapter offers a 409.
    expect(rows.every((r) => r.attachable === false)).toBe(true);
  });

  it("keeps a surface the server did not list", () => {
    const rows = withRemote([
      {
        id: "reddit",
        label: "Reddit",
        capabilities: SURFACE_CAPABILITIES.reddit,
        attachable: true,
      },
    ]);
    expect(rows.find((r) => r.id === "ebaylive")).toBeTruthy();
    expect(rows.find((r) => r.id === "reddit")?.attachable).toBe(true);
  });

  it("falls back to our own label when the server only has the id", () => {
    const rows = withRemote([
      { id: "tiktoklive", label: "tiktoklive", capabilities: SURFACE_CAPABILITIES.tiktoklive },
    ]);
    expect(rows.find((r) => r.id === "tiktoklive")?.label).toBe("TikTok Live");
  });
});

describe("recognise", () => {
  it("claims an eBay Live link and a bare event id first", () => {
    expect(recognise("https://www.ebay.com/ebaylive/events/47tK1SX0VsiHEXN1/stream")).toMatchObject(
      { surface: "ebaylive", externalId: "47tK1SX0VsiHEXN1" },
    );
    expect(recognise("47tK1SX0VsiHEXN1")?.surface).toBe("ebaylive");
  });

  it("recognises a subreddit and one thread in it", () => {
    expect(recognise("r/mechmarket")).toMatchObject({ surface: "reddit", room: "r/mechmarket" });
    expect(
      recognise("https://www.reddit.com/r/mechmarket/comments/1abc2de/wts_gmk_olivia/"),
    ).toMatchObject({ surface: "reddit", room: "r/mechmarket", externalId: "1abc2de" });
  });

  it("recognises the other live surfaces by their own URLs", () => {
    expect(recognise("https://www.twitch.tv/somechannel")?.surface).toBe("twitch");
    expect(recognise("https://www.whatnot.com/live/abc-123")?.surface).toBe("whatnot");
    expect(recognise("https://www.tiktok.com/@seller/live")?.surface).toBe("tiktoklive");
    expect(recognise("https://youtu.be/dQw4w9WgXcQ")?.surface).toBe("youtubelive");
  });

  // Guessing is worse than refusing: a mistyped link that resolves to the
  // wrong surface attaches to the wrong thing and says nothing about it.
  it("returns null rather than guessing", () => {
    expect(recognise("")).toBeNull();
    expect(recognise("   ")).toBeNull();
    expect(recognise("what is the size 10 price")).toBeNull();
    expect(recognise("https://example.com/whatever")).toBeNull();
  });
});

describe("surfaceLabel", () => {
  it("names what it knows and echoes what it does not", () => {
    expect(surfaceLabel("ebaylive")).toBe("eBay Live");
    expect(surfaceLabel("dm")).toBe("Follow-ups");
    expect(surfaceLabel("mastodon")).toBe("mastodon");
    expect(surfaceLabel(null)).toBe("unknown");
  });
});
