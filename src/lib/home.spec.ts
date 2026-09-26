import { describe, expect, it } from "vitest";
import {
  afterLabel,
  deriveSurfaces,
  duringLabel,
  homeModel,
  missingLine,
  normalizeSurfaceRow,
  ownCatalogs,
  waitForPreparation,
  watchingLine,
  type HomeSources,
} from "./home";
import { SURFACE_CAPABILITIES } from "./surfaces";
import type {
  CatalogSummary,
  EbayStatus,
  HomeView,
  PreparedShow,
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
  origin: { kind: "room", id: "r/mechmarket", label: "r/mechmarket" },
  room: "r/mechmarket",
  sessionId: "s_reddit",
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
    // Two independent axes, and eBay Live is why they cannot be collapsed: it
    // cannot deliver a reply (there is no chat-post API) and it genuinely does
    // act (five listing writes against the seller's own catalog). Word for
    // word the backend's `duringPhrase` — `src/surfaces/readiness.ts`.
    expect(duringLabel(SURFACE_CAPABILITIES.ebaylive)).toBe("answers you send, and acts");
    expect(duringLabel(SURFACE_CAPABILITIES.twitch)).toBe("answers and acts");
    // Reddit is draft-only AND has no room to be in: a queue, and you send it.
    expect(duringLabel(SURFACE_CAPABILITIES.reddit)).toBe("drafts only");
    expect(duringLabel(SURFACE_CAPABILITIES.dm)).toBe("drafts only");
  });

  // The bug this replaced: Whatnot and TikTok were mirrored as copies of eBay
  // Live, so the table claimed we can mark a price down on a platform we hold
  // no seller credentials for. There is a live room and an answer for it, and
  // a human is the one who puts it in the chat.
  it("says a scraped live surface answers and YOU send, never that it acts", () => {
    expect(duringLabel(SURFACE_CAPABILITIES.whatnot)).toBe("answers, you send");
    expect(duringLabel(SURFACE_CAPABILITIES.tiktoklive)).toBe("answers, you send");
  });

  it("gives an async surface a digest, not a report it never has a session for", () => {
    expect(afterLabel(SURFACE_CAPABILITIES.ebaylive)).toBe("report and follow-ups");
    expect(afterLabel(SURFACE_CAPABILITIES.reddit)).toBe("a record of what you sent");
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

  // The server sends prose where the missing piece is a person's decision
  // rather than a key. It is plain text either way and never looked up in a
  // map — but "needs a connected eBay account on the server" is nonsense, so
  // the extra clause is only earned by something shaped like a variable.
  it("reads back prose as prose", () => {
    expect(missingLine({ label: "eBay Live", missing: "a connected eBay account" })).toBe(
      "eBay Live needs a connected eBay account.",
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

  // The registry returns the adapters that EXIST. YouTube Live is declared in
  // the capability table and has no adapter, so a real answer simply does not
  // mention it — and inheriting the table's optimistic defaults would draw it
  // as connected and ready to paste a link into.
  it("does not draw a surface the registry never mentioned as connected", () => {
    const withoutYouTube = remoteSurfaces.filter((s) => s.id !== "youtubelive");
    const rows = deriveSurfaces(withoutYouTube, {
      ebay: null,
      catalogs: null,
      home: null,
      reports: null,
      drafts: null,
      rooms: {},
    });
    const yt = rows.find((r) => r.id === "youtubelive")!;
    expect(yt.connected).toBe(false);
    expect(yt.attachable).toBe(false);
    expect(yt.before).toEqual([{ label: "No adapter in this build yet", done: false }]);
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
    expect(row.after).toBe("a record of what you sent");
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
        after: "a record of what you sent",
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
    expect(m.behind.reports).toHaveLength(2);
    expect(m.behind.reports[0]).toMatchObject({
      showId: "s_old",
      answered: 39,
      blocked: 3,
      hasReport: true,
    });
    // The stored report holds the top gap; a list row does not, and inventing
    // a second answer here would put two of them in the product.
    expect(m.behind.reports[0]!.topGap).toBeNull();
    // A session whose report never generated is still a row — it is the one an
    // operator most wants to look at, and it simply has nothing to open.
    expect(m.behind.reports[1]).toMatchObject({ showId: "s_nolog", hasReport: false });
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
    expect(line).toMatch(/\d+ surfaces connected/);
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

describe("the scripted show is hidden as a setup row, never as a running session", () => {
  const simulated = watching({
    showId: "s_demo",
    surface: "simulated",
    source: "simulated",
    title: "Friday Night Grails — Ep. 42",
  });

  // `HIDDEN_SURFACES` filters the TABLE, which is a list of places you could
  // sell. A session on air is not a setup row, and dropping it would leave an
  // operator with a running console nothing on home points at.
  it("keeps it out of the surface table", () => {
    const m = homeModel(sources({ home: legacyHome({ watching: [simulated] }) }));
    expect(m.surfaces.map((s) => s.id)).not.toContain("simulated");
  });

  it("keeps it IN the NOW band when it is on air, derived", () => {
    const m = homeModel(sources({ home: legacyHome({ watching: [simulated] }) }));
    expect(m.now.live.map((l) => l.showId)).toEqual(["s_demo"]);
    expect(m.now.live[0]!.surface).toBe("simulated");
  });

  it("keeps it IN the NOW band when it is on air, served", () => {
    const served = legacyHome({
      now: {
        live: [
          {
            showId: "s_demo",
            surface: "simulated",
            title: "Friday Night Grails — Ep. 42",
            host: "@kicksbyrae",
            startedAt: "2026-09-18T19:00:00.000Z",
            awaiting: 1,
            blocked: 0,
            readOnly: false,
          },
        ],
        drafts: { total: 0, bySurface: [] },
      },
      surfaces: [
        {
          id: "simulated",
          label: "Simulated show",
          attachable: true,
          tempo: "live",
          delivery: "api",
          connected: true,
          missing: null,
          before: [],
          during: "answers and acts",
          after: "report and follow-ups",
        },
      ],
    });
    const m = homeModel(sources({ home: served }));
    // Filtered out of a table the server itself sent it in…
    expect(m.surfaces.map((s) => s.id)).not.toContain("simulated");
    // …and still the session that needs the operator.
    expect(m.now.live.map((l) => l.showId)).toEqual(["s_demo"]);
  });
});

// ── waiting for a preparation ───────────────────────────────────────────────
//
// `POST /api/shows/prepare` answers when the work is QUEUED. The row that
// makes an attach legal lands a minute later, at the end of several eBay
// Browse calls and an agent creation — and the paste box attached on the very
// next line, so it hit the same `prepare-first` 409 it was recovering from,
// every time. "Prepare the agent and then monitor" could not be done from the
// paste box at all. These pin the three ways out of the wait.
describe("waiting for a preparation to land", () => {
  const show = (eventId: string) =>
    ({
      eventId,
      title: "a real title, off the grid",
      host: "Filthy Hits",
      sellerHandle: "rcerjd-9tko",
      tags: [],
      thumbnailUrl: null,
      catalogId: `ebay-${eventId}`,
      agentId: "ag_1",
      items: 42,
      warnings: [],
      preparedAt: "2026-09-25T10:00:00.000Z",
    }) satisfies PreparedShow;

  /** A clock and a sleep that cost no real time. */
  function fakeTime() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  }

  it("keeps waiting while the id is still in `preparing`, then returns the row", async () => {
    const { now, sleep } = fakeTime();
    let reads = 0;
    const row = show("Aaaa1111Bbbb2222");
    const got = await waitForPreparation("Aaaa1111Bbbb2222", {
      now,
      sleep,
      read: async () => {
        reads++;
        // Queued, queued, queued — and only then written.
        return reads < 4
          ? { prepared: [], preparing: ["Aaaa1111Bbbb2222"], failed: [] }
          : { prepared: [row], preparing: [], failed: [] };
      },
    });
    expect(got).toEqual(row);
    expect(reads).toBe(4);
  });

  it("stops the moment the server says the preparation threw", async () => {
    const { now, sleep } = fakeTime();
    await expect(
      waitForPreparation("Cccc3333Dddd4444", {
        now,
        sleep,
        read: async () => ({
          prepared: [],
          preparing: [],
          failed: [
            { eventId: "Cccc3333Dddd4444", at: "2026-09-25T10:00:00.000Z", error: "eBay refused the seller filter" },
          ],
        }),
      }),
    ).rejects.toThrow(/eBay refused the seller filter/);
  });

  it("a stale failure never condemns the attempt that just worked", async () => {
    const { now, sleep } = fakeTime();
    const row = show("Eeee5555Ffff6666");
    // The server keeps failures until the same event is prepared again, so a
    // landed row and an old failure can be true at once. The row wins.
    const got = await waitForPreparation("Eeee5555Ffff6666", {
      now,
      sleep,
      read: async () => ({
        prepared: [row],
        preparing: [],
        failed: [{ eventId: "Eeee5555Ffff6666", at: "2026-09-25T09:00:00.000Z", error: "an earlier try" }],
      }),
    });
    expect(got).toEqual(row);
  });

  it("gives up on a deadline and says how long it waited, not whose fault it was", async () => {
    const { now, sleep } = fakeTime();
    await expect(
      waitForPreparation("Gggg7777Hhhh8888", {
        now,
        sleep,
        timeoutMs: 10_000,
        everyMs: 1_000,
        read: async () => ({ prepared: [], preparing: ["Gggg7777Hhhh8888"], failed: [] }),
      }),
    ).rejects.toThrow(/more than 10s/);
  });

  it("tolerates a server that does not send `failed` at all", async () => {
    const { now, sleep } = fakeTime();
    const row = show("Iiii9999Jjjj0000");
    let reads = 0;
    const got = await waitForPreparation("Iiii9999Jjjj0000", {
      now,
      sleep,
      read: async () => (++reads < 2 ? { prepared: [], preparing: [] } : { prepared: [row], preparing: [] }),
    });
    expect(got).toEqual(row);
  });
});
