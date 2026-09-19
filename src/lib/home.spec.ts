import { describe, expect, it } from "vitest";
import {
  afterLabel,
  deriveSurfaces,
  duringLabel,
  homeModel,
  missingLine,
  normalizeSurfaceRow,
  ownCatalogs,
  watchingLine,
  type HomeSources,
} from "./home";
import { SURFACE_CAPABILITIES } from "./surfaces";
import type {
  CatalogSummary,
  EbayStatus,
  HomeView,
  ShowRow,
  ShowSummary,
  SurfaceDraft,
  SurfaceInfo,
} from "./types";

// ── fixtures ────────────────────────────────────────────────────────────────

/** Exactly what a backend that predates the surface-aware keys sends. */
const legacyHome = (over: Partial<HomeView> = {}): HomeView => ({
  live: [],
  discovery: {
    reason: "ok",
    session: {
      present: true,
      savedAt: "2026-09-18T10:00:00.000Z",
      ageHours: 2,
      stale: false,
      path: "/s",
    },
  },
  prepared: [],
  preparing: [],
  watching: [],
  ...over,
});

const watching = (over: Partial<ShowSummary> = {}): ShowSummary => ({
  showId: "s_1",
  title: "Denim Vault",
  sellerHandle: "kicksbyrae",
  source: "ebaylive",
  externalId: "47tK1SX0VsiHEXN1",
  readOnly: false,
  status: "live",
  startedAt: "2026-09-18T18:00:00.000Z",
  viewers: 120,
  listings: 40,
  proposals: 2,
  ...over,
});

const draft = (over: Partial<SurfaceDraft> = {}): SurfaceDraft => ({
  id: "d_1",
  surface: "reddit",
  room: "r/mechmarket",
  question: { author: "u/buyer", text: "ships to EU?", at: "2026-09-17T09:00:00.000Z" },
  draft: "Yes — from Lisbon.",
  createdAt: "2026-09-17T09:01:00.000Z",
  status: "open",
  ...over,
});

const reportRow = (over: Partial<ShowRow> = {}): ShowRow => ({
  showId: "s_old",
  title: "Friday drop",
  source: "ebaylive",
  status: "ended",
  startedAt: "2026-09-12T18:00:00.000Z",
  viewers: 90,
  agentId: "a_1",
  generatedAt: "2026-09-12T20:10:00.000Z",
  durationMin: 128,
  questionsAsked: 44,
  answered: 39,
  sent: 31,
  blocked: 3,
  hasReport: true,
  ...over,
});

const ebayConnected: EbayStatus = {
  configured: true,
  env: "production",
  marketplaceId: "EBAY_US",
  token: true,
  browse: true,
  taxonomy: true,
  soldComps: false,
  error: null,
  write: {
    connected: true,
    connectedAt: "2026-09-01T00:00:00.000Z",
    scopes: ["sell"],
    blockers: [],
  },
};

const catalog: CatalogSummary = {
  id: "c_own",
  name: "Rae's lots",
  seller: { handle: "kicksbyrae", name: "Rae", about: "", voice: "" },
  itemCount: 42,
  policyCount: 6,
  sample: [],
  origin: { kind: "imported", handle: "kicksbyrae" },
};

/** What `/api/surfaces` answers on a real server: keys present or named. */
const remoteSurfaces: SurfaceInfo[] = [
  {
    id: "ebaylive",
    label: "eBay Live",
    capabilities: SURFACE_CAPABILITIES.ebaylive,
    attachable: true,
    available: true,
    missing: null,
  },
  {
    id: "reddit",
    label: "Reddit",
    capabilities: SURFACE_CAPABILITIES.reddit,
    attachable: true,
    available: false,
    missing: "REDDIT_CLIENT_ID",
  },
  {
    id: "twitch",
    label: "Twitch",
    capabilities: SURFACE_CAPABILITIES.twitch,
    attachable: true,
    available: false,
    missing: "TWITCH_CLIENT_ID",
  },
  {
    id: "whatnot",
    label: "Whatnot",
    capabilities: SURFACE_CAPABILITIES.whatnot,
    attachable: true,
    available: true,
    missing: null,
  },
  {
    id: "tiktoklive",
    label: "TikTok Live",
    capabilities: SURFACE_CAPABILITIES.tiktoklive,
    attachable: true,
    available: true,
    missing: null,
  },
  // Declared in the capability table, no adapter registered. The flag says so.
  {
    id: "youtubelive",
    label: "YouTube Live",
    capabilities: SURFACE_CAPABILITIES.youtubelive,
    attachable: false,
    available: true,
    missing: null,
  },
  {
    id: "dm",
    label: "Follow-ups",
    capabilities: SURFACE_CAPABILITIES.dm,
    attachable: false,
    available: true,
    missing: null,
  },
];

const sources = (over: Partial<HomeSources> = {}): HomeSources => ({
  home: legacyHome(),
  surfaces: remoteSurfaces,
  reports: null,
  drafts: null,
  catalogs: null,
  ebay: null,
  ...over,
});

// ── the phase words ─────────────────────────────────────────────────────────

describe("what a surface does during and after", () => {
  it("separates acting from answering from drafting", () => {
    expect(duringLabel(SURFACE_CAPABILITIES.ebaylive)).toBe("answers and acts");
    expect(duringLabel(SURFACE_CAPABILITIES.twitch)).toBe("answers and acts");
    // Reddit is draft-only: we never post, whatever the action list says.
    expect(duringLabel(SURFACE_CAPABILITIES.reddit)).toBe("drafts only");
    expect(duringLabel(SURFACE_CAPABILITIES.dm)).toBe("drafts only");
  });

  it("gives an async surface a digest, not a report it never has a session for", () => {
    expect(afterLabel(SURFACE_CAPABILITIES.ebaylive)).toBe("report and follow-ups");
    expect(afterLabel(SURFACE_CAPABILITIES.reddit)).toBe("weekly digest");
  });
});

describe("the line a surface with no key gets", () => {
  // The whole value of the sentence is the variable name: "could not open
  // twitch" sends an operator to the logs for something we already know.
  it("names the variable verbatim, and does not read as a fault", () => {
    const line = missingLine({ label: "Twitch", missing: "TWITCH_CLIENT_ID" });
    expect(line).toBe(
      "Twitch needs TWITCH_CLIENT_ID on the server. The adapter is here; the key is not.",
    );
  });

  it("says nothing at all when nothing is missing", () => {
    expect(missingLine({ label: "eBay Live", missing: null })).toBeNull();
  });
});

// ── the surface table ───────────────────────────────────────────────────────

describe("the surface table, derived", () => {
  it("carries the missing variable straight through from /api/surfaces", () => {
    const rows = deriveSurfaces(remoteSurfaces, {
      ebay: null,
      catalogs: null,
      home: null,
      reports: null,
      drafts: null,
      rooms: {},
    });
    const twitch = rows.find((r) => r.id === "twitch")!;
    expect(twitch.connected).toBe(false);
    expect(twitch.missing).toBe("TWITCH_CLIENT_ID");
    // And the Before step repeats it, so the fix is visible where the work is.
    expect(twitch.before[0]!.label).toContain("TWITCH_CLIENT_ID");
  });

  it("keeps the simulated fixture out of a table about where you can sell", () => {
    const rows = deriveSurfaces(remoteSurfaces, {
      ebay: null,
      catalogs: null,
      home: null,
      reports: null,
      drafts: null,
      rooms: {},
    });
    expect(rows.map((r) => r.id)).not.toContain("simulated");
  });

  it("trusts the attachable flag rather than a list of ids", () => {
    const rows = deriveSurfaces(remoteSurfaces, {
      ebay: null,
      catalogs: null,
      home: null,
      reports: null,
      drafts: null,
      rooms: {},
    });
    // YouTube Live has a capability row and no adapter. Nothing here hard-codes
    // that: the flag is the only thing that says so.
    expect(rows.find((r) => r.id === "youtubelive")!.attachable).toBe(false);
    expect(rows.find((r) => r.id === "whatnot")!.attachable).toBe(true);
  });

  it("is eBay's own Before that carries the old readiness checklist", () => {
    const rows = deriveSurfaces(remoteSurfaces, {
      ebay: ebayConnected,
      catalogs: [catalog],
      home: legacyHome({ prepared: [] }),
      reports: null,
      drafts: null,
      rooms: {},
    });
    const ebay = rows.find((r) => r.id === "ebaylive")!;
    expect(ebay.connected).toBe(true);
    expect(ebay.before.map((s) => s.label)).toEqual([
      "eBay account connected",
      "Your listings loaded as knowledge",
      "Signed in to eBay Live",
      "A session prepared",
    ]);
    expect(ebay.before.filter((s) => s.done)).toHaveLength(3);
    // The one step still open is the one that carries the place to do it.
    const open = ebay.before.find((s) => !s.done)!;
    expect(open.label).toBe("A session prepared");
    expect(open.href).toBe("/");
  });

  it("reads an eBay Live session the grid refuses as not signed in", () => {
    const blocked = legacyHome({
      discovery: { reason: "blocked", session: legacyHome().discovery.session },
    });
    const rows = deriveSurfaces(remoteSurfaces, {
      ebay: ebayConnected,
      catalogs: [catalog],
      home: blocked,
      reports: null,
      drafts: null,
      rooms: {},
    });
    const step = rows
      .find((r) => r.id === "ebaylive")!
      .before.find((s) => s.label === "Signed in to eBay Live")!;
    expect(step.done).toBe(false);
  });

  it("counts a room surface's rooms into its Before", () => {
    const rows = deriveSurfaces(remoteSurfaces, {
      ebay: null,
      catalogs: null,
      home: null,
      reports: null,
      drafts: null,
      rooms: { reddit: 3, twitch: 0 },
    });
    const reddit = rows.find((r) => r.id === "reddit")!;
    expect(reddit.rooms).toBe(3);
    expect(reddit.before.map((s) => s.label)).toContain("3 subreddits watched");
    const twitch = rows.find((r) => r.id === "twitch")!;
    expect(twitch.before.map((s) => s.label)).toContain("Choose channels");
  });

  it("gives the follow-up inbox a Before that is not a key", () => {
    const rows = deriveSurfaces(remoteSurfaces, {
      ebay: null,
      catalogs: null,
      home: null,
      reports: [reportRow()],
      drafts: null,
      rooms: {},
    });
    const dm = rows.find((r) => r.id === "dm")!;
    expect(dm.connected).toBe(true);
    expect(dm.missing).toBeNull();
    expect(dm.before[0]!.label).toBe("A session has finished");
    expect(dm.before[0]!.done).toBe(true);
  });
});

describe("a surface row the server sent", () => {
  it("survives a half-shipped row rather than throwing inside a render", () => {
    const row = normalizeSurfaceRow({ id: "reddit" })!;
    expect(row.label).toBe("Reddit");
    expect(row.before).toEqual([]);
    expect(row.during).toBe("drafts only");
    expect(row.after).toBe("weekly digest");
    expect(row.connected).toBe(false);
  });

  it("drops a row for a surface this build has never heard of", () => {
    expect(normalizeSurfaceRow({ id: "mastodon" as never })).toBeNull();
  });
});

// ── the bands, and the degrade path ─────────────────────────────────────────

describe("home against a server that has shipped the new keys", () => {
  const served: HomeView = legacyHome({
    now: {
      live: [
        {
          showId: "s_live",
          surface: "twitch",
          title: "Friday build",
          host: "raebuilds",
          startedAt: "2026-09-18T19:00:00.000Z",
          awaiting: 4,
          blocked: 1,
          readOnly: false,
        },
      ],
      drafts: { total: 7, bySurface: [{ surface: "reddit", count: 7 }] },
    },
    next: { prepared: [], discoverable: ["ebaylive"] },
    behind: {
      reports: [
        {
          showId: "s_old",
          surface: "ebaylive",
          title: "Friday drop",
          endedAt: "2026-09-12T20:00:00.000Z",
          answered: 39,
          blocked: 3,
          topGap: "does it ship to Canada",
        },
      ],
      followups: { total: 12, ready: 5 },
    },
    surfaces: [
      {
        id: "reddit",
        label: "Reddit",
        attachable: true,
        tempo: "async",
        delivery: "draft-only",
        connected: false,
        missing: "REDDIT_CLIENT_SECRET",
        before: [{ label: "Keys on the server", done: false, href: "/settings" }],
        during: "drafts only",
        after: "weekly digest",
        rooms: 2,
      },
    ],
  });

  it("renders exactly what the server said and works nothing out", () => {
    const m = homeModel(sources({ home: served }));
    expect(m.served).toEqual({ now: true, next: true, behind: true, surfaces: true });
    expect(m.now.live[0]!.surface).toBe("twitch");
    expect(m.now.drafts.total).toBe(7);
    expect(m.behind.reports[0]!.topGap).toBe("does it ship to Canada");
    expect(m.behind.followups).toEqual({ total: 12, ready: 5 });
    // The server's table wins over the seven-row derived one.
    expect(m.surfaces.map((s) => s.id)).toEqual(["reddit"]);
    expect(m.surfaces[0]!.missing).toBe("REDDIT_CLIENT_SECRET");
  });
});

describe("home against a server that has not shipped them", () => {
  // The whole point of the degrade path: an operator on an older backend, or
  // in the window where the frontend deployed first, gets four bands built out
  // of the legacy payload — not an empty screen and not a crash.
  const legacy = sources({
    home: legacyHome({ watching: [watching(), watching({ showId: "s_2", status: "ended" })] }),
    reports: [reportRow(), reportRow({ showId: "s_nolog", hasReport: false })],
    drafts: [draft(), draft({ id: "d_2" }), draft({ id: "d_3", surface: "dm", status: "sent" })],
    catalogs: [catalog],
    ebay: ebayConnected,
    rooms: { reddit: 2 },
  });

  it("says, for each band, that it worked the answer out", () => {
    expect(homeModel(legacy).served).toEqual({
      now: false,
      next: false,
      behind: false,
      surfaces: false,
    });
  });

  it("finds the sessions on air in the legacy watching list", () => {
    const m = homeModel(legacy);
    expect(m.now.live).toHaveLength(1);
    expect(m.now.live[0]).toMatchObject({
      showId: "s_1",
      surface: "ebaylive",
      host: "kicksbyrae",
      awaiting: 0,
      blocked: 0,
    });
  });

  it("counts the drafts waiting from the drafts read this client already makes", () => {
    const m = homeModel(legacy);
    // Two open Reddit drafts; the sent follow-up is not waiting for anyone.
    expect(m.now.drafts.total).toBe(2);
    expect(m.now.drafts.bySurface).toEqual([{ surface: "reddit", count: 2 }]);
    expect(m.behind.followups).toEqual({ total: 1, ready: 0 });
  });

  it("builds BEHIND YOU from the sessions list, and admits it has no top gap", () => {
    const m = homeModel(legacy);
    expect(m.behind.reports).toHaveLength(1);
    expect(m.behind.reports[0]).toMatchObject({ showId: "s_old", answered: 39, blocked: 3 });
    // The stored report holds the top gap; a list row does not, and inventing
    // a second answer here would put two of them in the product.
    expect(m.behind.reports[0]!.topGap).toBeNull();
    // A session whose report never generated is not a report.
    expect(m.behind.reports.map((r) => r.showId)).not.toContain("s_nolog");
  });

  it("scopes Discover to the one surface with a grid we can read", () => {
    expect(homeModel(legacy).next.discoverable).toEqual(["ebaylive"]);
  });

  it("keeps the prepared sessions the legacy payload already carried", () => {
    const prepared = {
      eventId: "e1",
      title: "Sunday cards",
      host: "rae",
      sellerHandle: "rae",
      tags: [],
      thumbnailUrl: null,
      catalogId: "c1",
      agentId: "a1",
      items: 30,
      warnings: [],
      preparedAt: "2026-09-18T12:00:00.000Z",
    };
    const m = homeModel(sources({ home: legacyHome({ prepared: [prepared] }) }));
    expect(m.next.prepared).toHaveLength(1);
  });

  it("still draws a full surface table", () => {
    const m = homeModel(legacy);
    expect(m.surfaces.map((s) => s.id)).toEqual([
      "ebaylive",
      "whatnot",
      "tiktoklive",
      "twitch",
      "youtubelive",
      "reddit",
      "dm",
    ]);
  });
});

describe("home with nothing to read at all", () => {
  // Both endpoints down: the page must still render rather than throw.
  const nothing = homeModel({
    home: null,
    surfaces: null,
    reports: null,
    drafts: null,
    catalogs: null,
    ebay: null,
  });

  it("renders empty bands instead of throwing", () => {
    expect(nothing.now.live).toEqual([]);
    expect(nothing.now.drafts.total).toBe(0);
    expect(nothing.behind.reports).toEqual([]);
    expect(nothing.next.discoverable).toEqual(["ebaylive"]);
  });

  it("does not invent a 'no adapter' verdict out of a server that never answered", () => {
    // `withRemote(null)` marks everything unattachable, which is right when the
    // server answered and omitted a surface and wrong when it never spoke.
    expect(nothing.surfaces.find((s) => s.id === "whatnot")!.attachable).toBe(true);
    expect(nothing.surfaces.find((s) => s.id === "dm")!.attachable).toBe(false);
  });
});

describe("an empty NOW", () => {
  it("names how many surfaces are watching rather than disappearing", () => {
    const m = homeModel(sources({ ebay: ebayConnected }));
    const line = watchingLine(m.surfaces);
    expect(line).toContain("Nothing needs you this minute.");
    expect(line).toMatch(/\d+ surfaces watching/);
  });

  it("points at the table when nothing at all is connected", () => {
    expect(watchingLine([])).toBe(
      "No surface is connected yet — the table below is where that starts.",
    );
  });
});

describe("whose catalogs are whose", () => {
  it("does not count the two shipped demos as the seller's own", () => {
    const { origin: _dropped, ...noOrigin } = catalog;
    const seeds: CatalogSummary[] = [
      { ...catalog, id: "kicksbyrae", origin: { kind: "seed" } },
      // A backend old enough to have no `origin` column: the two shipped
      // fixture ids are the only thing left to go on.
      { ...noOrigin, id: "curated-cards" },
      catalog,
    ];
    expect(ownCatalogs(seeds).map((c) => c.id)).toEqual(["c_own"]);
  });
});
