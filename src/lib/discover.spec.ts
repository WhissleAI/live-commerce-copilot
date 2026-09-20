import { describe, expect, it } from "vitest";
import {
  DISCOVER_SURFACES,
  actionLabel,
  interestSlug,
  isWatched,
  mergeRooms,
  normalizeInterestSet,
  roomKey,
  roomSurfacesIn,
  ebayReasonLine,
  foldSources,
  hitFromShow,
  hitsFor,
  interestOrigin,
  legacyDiscover,
  matchedTerms,
  normalizeHit,
  normalizeInterests,
  normalizeSource,
  readableSurfaces,
  sourceFor,
} from "./discover";
import type { DiscoverHit, HomeView, SurfaceRoom } from "./types";

const home = (over: Partial<HomeView> = {}): HomeView => ({
  live: [],
  discovery: {
    reason: "ok",
    session: { present: true, savedAt: null, ageHours: 2, stale: false, path: "" },
  },
  prepared: [],
  preparing: [],
  watching: [],
  ...over,
});

describe("the surfaces Discover asks", () => {
  // The whole bug, in one assertion. Twitch and Reddit both have first-class
  // public APIs — an app token lists Helix streams with no user sign-in — and
  // they were absent from discovery because nobody had looked.
  it("asks every registered adapter an operator could discover on, not just eBay Live", () => {
    expect(DISCOVER_SURFACES).toEqual(["ebaylive", "twitch", "reddit", "whatnot", "tiktoklive"]);
  });

  // Not the same omission: an inbox and a scripted rehearsal are not places
  // to find something.
  it("leaves out the two that are not places to find anything", () => {
    expect(DISCOVER_SURFACES).not.toContain("dm");
    expect(DISCOVER_SURFACES).not.toContain("simulated");
  });

  // A capability row is not an adapter. `youtubelive` has one and no adapter
  // directory and no registration, which is why Home's surface table draws
  // six rows; a chip for it would promise a surface nothing can reach.
  it("leaves out the capability row that has no adapter behind it", () => {
    expect(DISCOVER_SURFACES).not.toContain("youtubelive");
  });
});

describe("foldSources", () => {
  it("keeps every surface even when the server answered for one", () => {
    const rows = foldSources([{ surface: "ebaylive", method: "a scrape", hits: [] }]);
    expect(rows.map((r) => r.surface)).toEqual(DISCOVER_SURFACES);
  });

  // The rule the old screen broke by omission: a surface that cannot answer
  // is DRAWN as unable to answer. A missing chip reads as a product that has
  // never heard of Twitch.
  it("marks a surface the server never mentioned as unable to answer", () => {
    const twitch = sourceFor(foldSources([]), "twitch");
    expect(twitch?.unavailable?.reason).toMatch(/did not answer for Twitch/);
    expect(twitch?.hits).toEqual([]);
  });

  it("carries the missing variable through untouched, because the name is the answer", () => {
    const rows = foldSources([
      {
        surface: "twitch",
        method: "Helix GET /streams with an app token.",
        hits: [],
        unavailable: { reason: "Twitch has no app credentials here.", missing: "TWITCH_CLIENT_ID" },
      },
    ]);
    expect(sourceFor(rows, "twitch")?.unavailable?.missing).toBe("TWITCH_CLIENT_ID");
  });

  it("drops hits from a source that says it could not answer", () => {
    const rows = foldSources([
      {
        surface: "reddit",
        method: "subreddit search",
        hits: [{ id: "r/x", title: "stale" }],
        unavailable: { reason: "Reddit timed out.", missing: null },
      },
    ]);
    expect(sourceFor(rows, "reddit")?.hits).toEqual([]);
  });

  it("says plainly when the server did not describe its method", () => {
    const rows = foldSources([{ surface: "reddit", hits: [] }]);
    expect(sourceFor(rows, "reddit")?.method).toMatch(/did not say/);
  });

  it("ignores a source on a surface nobody can discover on", () => {
    const rows = foldSources([{ surface: "dm", method: "the inbox", hits: [] }]);
    expect(rows.some((r) => r.surface === ("dm" as never))).toBe(false);
  });
});

describe("normalizeHit", () => {
  it("keeps a measured zero and nulls anything that is not a number", () => {
    expect(normalizeHit({ id: "a", title: "t", viewers: 0 }, "twitch")?.viewers).toBe(0);
    expect(normalizeHit({ id: "a", title: "t" }, "twitch")?.viewers).toBeNull();
    expect(normalizeHit({ id: "a", title: "t", viewers: "many" }, "twitch")?.viewers).toBeNull();
  });

  it("nulls a host the source did not give, rather than inventing a dash", () => {
    expect(normalizeHit({ id: "a", title: "t" }, "reddit")?.host).toBeNull();
    expect(normalizeHit({ id: "a", title: "t", host: "  " }, "reddit")?.host).toBeNull();
  });

  it("refuses a hit with no id or no title, which has nothing to attach to", () => {
    expect(normalizeHit({ title: "t" }, "twitch")).toBeNull();
    expect(normalizeHit({ id: "a" }, "twitch")).toBeNull();
  });

  it("takes the action the server named", () => {
    expect(normalizeHit({ id: "a", title: "t", action: "prepare" }, "ebaylive")?.action).toBe(
      "prepare",
    );
    expect(normalizeHit({ id: "r/x", title: "t", action: "watch-room" }, "reddit")?.action).toBe(
      "watch-room",
    );
    expect(normalizeHit({ id: "a", title: "t", action: "attach" }, "twitch")?.action).toBe(
      "attach",
    );
  });

  /**
   * The gating rule, at the only place it could be broken quietly.
   *
   * Reddit answers with rooms AND with threads: `r/mechmarket` is a room to
   * watch, `t3_1abc2de` is a thread to open. Inferring the action from the
   * surface would offer "Watch this subreddit" over a thread and post a
   * thread id into the rooms table. An unnamed action is a LINK — every other
   * action writes something, and a link is the only fallback that cannot.
   */
  it("never infers an action from the surface", () => {
    expect(normalizeHit({ id: "t3_1abc2de", title: "WTS GMK Olivia" }, "reddit")?.action).toBe(
      "open",
    );
    expect(normalizeHit({ id: "r/mechmarket", title: "r/mechmarket" }, "reddit")?.action).toBe(
      "open",
    );
    expect(normalizeHit({ id: "a", title: "t" }, "ebaylive")?.action).toBe("open");
    expect(normalizeHit({ id: "a", title: "t", action: "nonsense" }, "twitch")?.action).toBe(
      "open",
    );
  });

  it("drops a why entry with no term and defaults an unknown where to the title", () => {
    const hit = normalizeHit(
      { id: "a", title: "t", why: [{ where: "title" }, { term: "Omega", where: "nowhere" }] },
      "twitch",
    );
    expect(hit?.why).toEqual([{ term: "Omega", where: "title" }]);
  });
});

describe("normalizeSource", () => {
  it("returns null for a payload that names no surface we ask", () => {
    expect(normalizeSource({ method: "x", hits: [] })).toBeNull();
    expect(normalizeSource(null)).toBeNull();
  });
});

describe("interests", () => {
  const derived = {
    slug: "omega-seamaster",
    term: "Omega Seamaster",
    origin: "derived",
    pinned: false,
    weight: 12,
  };

  it("reads the five fields the server sends and nothing else", () => {
    expect(normalizeInterests([derived])).toEqual([
      {
        slug: "omega-seamaster",
        term: "Omega Seamaster",
        origin: "derived",
        pinned: false,
        weight: 12,
      },
    ]);
  });

  // The shape is pinned now. A reader that still took `listings` or
  // `catalogName` would go on silently working against a payload nobody
  // sends, which is how a guess outlives the guessing.
  it("no longer accepts the field names it was guessing at", () => {
    const [i] = normalizeInterests([
      { name: "GMK", kind: "catalog", count: 4, catalogName: "Keys" },
    ]);
    // `name` is not a term, so there is no interest here at all.
    expect(i).toBeUndefined();
    const [j] = normalizeInterests([{ term: "GMK", listings: 4, catalogName: "Keys" }]);
    expect(j).toEqual({ slug: "gmk", term: "GMK", origin: "own", pinned: false, weight: 0 });
  });

  it("weighs a term the operator typed at nothing", () => {
    expect(normalizeInterests([{ term: "Pokémon", origin: "own" }])[0]?.weight).toBe(0);
  });

  // A term the operator typed must never be claimed as derived from their
  // listings: the chip's provenance is the one thing it is for.
  it("treats anything it cannot prove as the operator's own", () => {
    expect(normalizeInterests([{ term: "Pokémon" }])[0]?.origin).toBe("own");
  });

  // The slug is the identity, so it is what deduplicates: two spellings of
  // one term are one interest.
  it("drops duplicates by slug, and anything with no term at all", () => {
    expect(
      normalizeInterests([
        { term: "GMK", slug: "gmk" },
        { term: "gmk", slug: "gmk" },
        { term: " " },
        {},
        null,
        "a bare string is not an interest",
      ]).map((i) => i.term),
    ).toEqual(["GMK"]);
  });

  it("falls back to the term as its own identity when no slug came", () => {
    expect(normalizeInterests([{ term: "Omega Seamaster" }])[0]?.slug).toBe("omega seamaster");
    expect(interestSlug("  Pokémon ")).toBe("pokémon");
  });

  it("reads the wrapped shape the endpoint answers with, and its catalog count", () => {
    const set = normalizeInterestSet({ interests: [derived], catalogs: 3 });
    expect(set.interests).toHaveLength(1);
    expect(set.catalogs).toBe(3);
    // No count means none, on an endpoint that always sends one.
    expect(normalizeInterestSet({ interests: [] }).catalogs).toBe(0);
  });

  // The weight is the whole of a derived chip's provenance, and no catalog is
  // named because interests derive from all of an account's catalogs at once
  // and belong to none of them.
  it("says where a chip came from without naming a catalog it does not have", () => {
    expect(interestOrigin({ ...derived, weight: 1, origin: "derived" })).toBe(
      "Derived from 1 of your listings.",
    );
    expect(interestOrigin({ ...derived, weight: 0, origin: "derived" })).toBe(
      "Derived from your catalogs.",
    );
    expect(interestOrigin({ ...derived, origin: "own", weight: 0 })).toBe("You added this term.");
  });
});

describe("the fallback, for a server without the index", () => {
  it("builds the eBay grid out of the payload the old screen had", () => {
    const view = legacyDiscover(
      home({
        live: [
          {
            eventId: "e1",
            title: "Denim Vault",
            url: "https://www.ebay.com/ebaylive/events/e1/stream",
            host: "kicksbyrae",
            viewers: 42,
          },
        ],
      }),
    );
    expect(hitsFor(view.sources, "all")).toHaveLength(1);
    expect(sourceFor(view.sources, "ebaylive")?.hits[0]).toMatchObject({
      surface: "ebaylive",
      id: "e1",
      title: "Denim Vault",
      viewers: 42,
      action: "prepare",
    });
  });

  // Nothing on this path knows what the operator sells, so nothing on it may
  // claim a reason. An empty `why` is the truth and the card draws none.
  it("claims no matched terms, because it has no interests to match", () => {
    const view = legacyDiscover(home({ live: [{ eventId: "e1", title: "t", url: "u" }] }));
    expect(view.interests).toEqual([]);
    expect(sourceFor(view.sources, "ebaylive")?.hits[0]?.why).toEqual([]);
  });

  it("still lists every other surface, as unable to answer here", () => {
    const view = legacyDiscover(home());
    expect(view.sources.map((s) => s.surface)).toEqual(DISCOVER_SURFACES);
    expect(sourceFor(view.sources, "twitch")?.unavailable).not.toBeNull();
  });

  it("says how the list was obtained — a scrape, not an API", () => {
    expect(sourceFor(legacyDiscover(home()).sources, "ebaylive")?.method).toMatch(/scrape/);
  });

  it("survives a home read that failed outright", () => {
    expect(() => legacyDiscover(null)).not.toThrow();
    expect(hitsFor(legacyDiscover(null).sources, "all")).toEqual([]);
  });

  // Three different facts that used to render identically. Each asks the
  // operator for something different, or for nothing at all.
  it("keeps the three eBay empty states apart", () => {
    const signedOut = legacyDiscover(
      home({ discovery: { ...home().discovery, reason: "no-session" } }),
    );
    // CONTENT-21: this used to assert the sentence named `npm run ebay:signin`
    // — a shell command, in a repository the seller does not have, answering
    // the blocking step of the primary Before workflow. It says what the state
    // is and who can change it now, and says the same thing whichever side
    // produced the refusal.
    const reason = sourceFor(signedOut.sources, "ebaylive")?.unavailable?.reason ?? "";
    expect(reason).not.toMatch(/npm run/);
    expect(reason).toMatch(/access to the machine/);
    const blocked = legacyDiscover(home({ discovery: { ...home().discovery, reason: "blocked" } }));
    expect(sourceFor(blocked.sources, "ebaylive")?.unavailable?.reason).toMatch(/refused/);
    // Nobody on air is a fact about the world, not a fault, and gets no
    // "unavailable" at all.
    expect(sourceFor(legacyDiscover(home()).sources, "ebaylive")?.unavailable).toBeNull();
    expect(ebayReasonLine("ok")).toBeNull();
  });

  it("carries the seller handle and tags so a prepare off the old payload still works", () => {
    const hit = hitFromShow({
      eventId: "e1",
      title: "t",
      url: "u",
      sellerHandle: "kicksbyrae",
      tags: ["Pokémon"],
      thumbnailUrl: "http://img",
    });
    expect(hit.legacy?.sellerHandle).toBe("kicksbyrae");
    expect(hit.legacy?.tags).toEqual(["Pokémon"]);
  });
});

describe("what a card offers", () => {
  const hit = (over: Partial<DiscoverHit>): DiscoverHit => ({
    surface: "ebaylive",
    id: "x",
    title: "t",
    host: null,
    url: "u",
    startedAt: null,
    liveNow: true,
    viewers: null,
    why: [],
    action: "prepare",
    ...over,
  });

  it("names the one action in the surface's own words", () => {
    expect(actionLabel(hit({}))).toBe("Prepare");
    expect(actionLabel(hit({ surface: "twitch", action: "attach" }))).toBe("Attach");
    expect(actionLabel(hit({ surface: "reddit", action: "watch-room" }))).toBe(
      "Watch this subreddit",
    );
    expect(actionLabel(hit({ surface: "twitch", action: "watch-room" }))).toBe(
      "Watch this channel",
    );
  });
});

describe("counting", () => {
  const sources = foldSources([
    {
      surface: "twitch",
      method: "helix",
      hits: [
        { id: "a", title: "A", why: [{ term: "Omega", where: "title" }] },
        { id: "b", title: "B", why: [{ term: "omega", where: "body" }, { term: "GMK" }] },
      ],
    },
    { surface: "reddit", method: "search", hits: [{ id: "r/x", title: "X" }] },
  ]);

  it("counts only the surfaces that actually answered", () => {
    expect(readableSurfaces(sources)).toEqual(["twitch", "reddit"]);
  });

  it("filters to one surface, or takes them all", () => {
    expect(hitsFor(sources, "all")).toHaveLength(3);
    expect(hitsFor(sources, "twitch")).toHaveLength(2);
  });

  it("lists each matched term once, in the order it first appeared", () => {
    expect(matchedTerms(hitsFor(sources, "twitch"))).toEqual(["Omega", "GMK"]);
  });
});

// ── the standing watch ──────────────────────────────────────────────────────

describe("whether a room is already watched", () => {
  const room = (over: Partial<SurfaceRoom> = {}): SurfaceRoom => ({
    surface: "reddit",
    room: "r/mechmarket",
    posting: false,
    disclosure: null,
    addedAt: "2026-09-18T00:00:00.000Z",
    ...over,
  });
  // A Reddit room id carries its prefix — verbatim what the rooms endpoint
  // accepts — so both sides are spelled the same and nothing is stripped.
  const hit = { surface: "reddit" as const, id: "r/mechmarket" };

  it("matches the room the hit is offering", () => {
    expect(isWatched([room()], hit)).toBe(true);
  });

  // Reddit treats a subreddit name case-insensitively, so this is one room.
  it("matches it whatever case either side was written in", () => {
    expect(roomKey("r/MechMarket")).toBe(roomKey("r/mechmarket"));
    expect(isWatched([room({ room: "R/MechMarket" })], hit)).toBe(true);
  });

  it("does not match a room of the same name on another surface", () => {
    expect(isWatched([room({ surface: "twitch" })], hit)).toBe(false);
  });

  // A thread is not a room. `t3_1abc2de` must never find one.
  it("does not match a thread id against the rooms table", () => {
    expect(isWatched([room()], { surface: "reddit", id: "t3_1abc2de" })).toBe(false);
  });

  // Absent reads as watched — the room being in the list IS the watch, and a
  // server from before the column existed says nothing about it.
  it("treats an absent flag as watched and an explicit false as not", () => {
    expect(isWatched([room({ watching: true })], hit)).toBe(true);
    expect(isWatched([room()], hit)).toBe(true);
    expect(isWatched([room({ watching: false })], hit)).toBe(false);
  });

  it("is false when nothing is watched at all", () => {
    expect(isWatched([], hit)).toBe(false);
  });

  it("replaces one surface's list wholesale and leaves the others alone", () => {
    const before = [room(), room({ surface: "twitch", room: "raewatches" })];
    const after = mergeRooms(before, "reddit", [room({ room: "r/watches" })]);
    expect(after.filter((r) => r.surface === "reddit").map((r) => r.room)).toEqual(["r/watches"]);
    expect(after.some((r) => r.surface === "twitch")).toBe(true);
  });
});

describe("which watch lists are worth reading", () => {
  it("names only the surfaces that offered a room to watch", () => {
    const sources = foldSources([
      { surface: "ebaylive", method: "a scrape", hits: [{ id: "e1", title: "A" }] },
      {
        surface: "reddit",
        method: "search",
        hits: [{ id: "r/x", title: "X", action: "watch-room" }],
      },
    ]);
    expect(roomSurfacesIn(sources)).toEqual(["reddit"]);
  });

  it("asks for nothing when no hit has a room", () => {
    expect(roomSurfacesIn(foldSources([]))).toEqual([]);
  });
});
