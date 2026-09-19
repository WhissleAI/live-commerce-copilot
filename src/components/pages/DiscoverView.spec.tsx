import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithRouter } from "@/test/router";
import { DiscoverView, HitCard, InterestRail, NoInterests, SurfaceChips } from "./DiscoverView";
import { foldSources } from "@/lib/discover";
import type { DiscoverHit } from "@/lib/types";

const noop = () => {};

/**
 * The backend, routed by path.
 *
 * The api client is exercised for real rather than mocked, because the thing
 * under test IS the client's behaviour on a server that has not shipped the
 * endpoint yet — a mock of `api.discover` would be a mock of the answer.
 */
function backend(routes: Record<string, { status?: number; body?: unknown }>) {
  vi.stubGlobal("fetch", (input: unknown, init?: { method?: string }) => {
    const path = new URL(String(input), "http://backend.test").pathname;
    // Keyed by path, or by "METHOD path" where a route answers differently to
    // a read and a write — the watch list does.
    const method = (init?.method ?? "GET").toUpperCase();
    const hit = routes[`${method} ${path}`] ??
      routes[path] ?? { status: 404, body: { error: "not found" } };
    const text = JSON.stringify(hit.body ?? {});
    const status = hit.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(JSON.parse(text)),
      text: () => Promise.resolve(text),
    });
  });
}

const HOME = {
  live: [
    {
      eventId: "e1",
      title: "Friday Denim Vault",
      url: "https://www.ebay.com/ebaylive/events/e1/stream",
      host: "kicksbyrae",
      viewers: 42,
      status: "live",
    },
  ],
  discovery: {
    reason: "ok",
    session: { present: true, savedAt: null, ageHours: 2, stale: false, path: "" },
  },
  prepared: [],
  preparing: [],
  watching: [],
};

/** A server that has the index, with one surface keyed and one not. */
const INDEX = {
  interests: [
    {
      slug: "omega-seamaster",
      term: "Omega Seamaster",
      origin: "derived",
      pinned: false,
      weight: 12,
    },
    { slug: "gmk", term: "GMK", origin: "own", pinned: false, weight: 0 },
  ],
  catalogs: 2,
  sources: [
    {
      surface: "twitch",
      method: "Twitch Helix GET /streams with an app access token — an API, no sign-in.",
      hits: [
        {
          id: "3901",
          title: "Watch collecting, all night",
          host: "raewatches",
          url: "https://twitch.tv/raewatches",
          liveNow: true,
          viewers: 812,
          why: [{ term: "Omega Seamaster", where: "title" }],
          action: "attach",
        },
      ],
      unavailable: null,
    },
    {
      surface: "reddit",
      method: "Reddit /subreddits/search, then a thread search inside each — an API.",
      hits: [],
      unavailable: {
        reason: "Reddit has no script-app credentials on this server.",
        missing: "REDDIT_CLIENT_ID",
      },
    },
  ],
};

/** A server whose Reddit source has a room the operator could watch. */
const ROOMS_INDEX = {
  interests: [{ slug: "gmk", term: "GMK", origin: "own", pinned: false, weight: 0 }],
  catalogs: 1,
  sources: [
    {
      surface: "reddit",
      method: "Reddit /subreddits/search, then a thread search inside each — an API.",
      hits: [
        {
          id: "r/mechmarket",
          title: "r/mechmarket",
          url: "https://reddit.com/r/mechmarket",
          liveNow: false,
          why: [{ term: "GMK", where: "room" }],
          action: "watch-room",
        },
      ],
      unavailable: null,
    },
  ],
};

const WATCHED = [
  {
    surface: "reddit",
    // The prefix is part of the id, verbatim what the rooms endpoint takes.
    room: "r/mechmarket",
    posting: false,
    disclosure: null,
    addedAt: "2026-09-18T00:00:00.000Z",
    watching: true,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── the deploy-skew path ────────────────────────────────────────────────────

describe("Discover against a server without the index", () => {
  // The two halves of this change deploy minutes apart. A Discover tab that
  // breaks in that window is a worse regression than the grid it replaces.
  it("falls back to the eBay-only grid rather than showing a broken page", async () => {
    backend({ "/api/discover": { status: 404 }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("Friday Denim Vault")).toBeInTheDocument();
    expect(screen.getByText("kicksbyrae")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  // Silently drawing one surface and calling it Discover is the bug this
  // whole change exists to fix, so the fallback must never impersonate it.
  it("says it is the older, eBay-only answer", async () => {
    backend({ "/api/discover": { status: 404 }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText(/older, eBay-only discovery/)).toBeInTheDocument();
  });

  // No endpoint to persist to means no editor: a chip you could add that
  // nothing would remember is a lie told in a control.
  it("offers no interest editor it could not save", async () => {
    backend({ "/api/discover": { status: 404 }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    await screen.findByText("Friday Denim Vault");
    expect(screen.queryByLabelText("Add an interest")).not.toBeInTheDocument();
  });

  // Every surface still has a chip on the fallback path, because the reason
  // they were invisible was never that they were missing keys.
  it("still lists every other surface, quietly", async () => {
    backend({ "/api/discover": { status: 404 }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    await screen.findByText("Friday Denim Vault");
    expect(screen.getByRole("button", { name: /Twitch/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reddit/ })).toBeInTheDocument();
  });

  it("survives both reads failing at once", async () => {
    backend({});
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("Live right now, on what you sell")).toBeInTheDocument();
  });
});

// ── the index ───────────────────────────────────────────────────────────────

describe("Discover against a server that has the index", () => {
  it("draws a hit from a surface that is not eBay Live", async () => {
    backend({ "/api/discover": { body: INDEX }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("Watch collecting, all night")).toBeInTheDocument();
    expect(screen.getByText("Attach")).toBeInTheDocument();
  });

  // The honesty rule, on screen: a card that cannot say why it is in front of
  // you does not belong in front of you, and the why is the matched terms.
  it("shows the matched terms as the reason the card is there", async () => {
    backend({ "/api/discover": { body: INDEX }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    await screen.findByText("Watch collecting, all night");
    expect(screen.getByText("matched")).toBeInTheDocument();
    const term = screen.getAllByText("Omega Seamaster").find((n) => n.title.includes("matched"));
    expect(term).toBeTruthy();
    expect(term).toHaveAttribute("title", "matched in the title");
  });

  it("names how each source was obtained, in one line", async () => {
    backend({ "/api/discover": { body: INDEX }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText(/Helix GET \/streams with an app access token/)).toBeVisible();
  });

  // The weight is the provenance, and it names no catalog: interests derive
  // from ALL of an account's catalogs at once and belong to none of them.
  it("carries the derived weight on the chip, and nothing on one you added", async () => {
    backend({ "/api/discover": { body: INDEX }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    const chip = (await screen.findAllByText("Omega Seamaster")).find((n) =>
      n.title.startsWith("Derived"),
    );
    expect(chip).toHaveAttribute("title", "Derived from 12 of your listings.");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("GMK").title).toBe("You added this term.");
  });

  // Never hidden. Hiding a keyless surface is exactly how Twitch and Reddit
  // stayed invisible while both had public APIs waiting to be asked.
  it("keeps a keyless surface's chip, and explains it when selected", async () => {
    backend({ "/api/discover": { body: INDEX }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    const chip = await screen.findByRole("button", { name: /Reddit/ });
    expect(chip).toBeInTheDocument();
    // Quiet, not red: an unset key is a choice nobody has made yet.
    expect(chip.className).not.toMatch(/bad/);

    fireEvent.click(chip);
    expect(
      screen.getByText("Reddit has no script-app credentials on this server."),
    ).toBeInTheDocument();
    // The whole value of the answer is the NAME of the variable.
    expect(screen.getByText(/REDDIT_CLIENT_ID/)).toBeInTheDocument();
  });

  // No catalog, no interests, and therefore no honest question to ask any
  // surface — so a door to Knowledge rather than a grid of strangers.
  it("points at Knowledge when there are no interests, and draws no grid", async () => {
    backend({
      "/api/discover": { body: { interests: [], catalogs: 0, sources: INDEX.sources } },
      "/api/home": { body: HOME },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("We do not know what you sell yet.")).toBeInTheDocument();
    expect(screen.getByText("Open Knowledge")).toBeInTheDocument();
    expect(screen.queryByText("Watch collecting, all night")).not.toBeInTheDocument();
  });

  // Two different facts wanting two different things. Catalogs with no terms
  // is not "we do not know what you sell" — it is "you removed them all", and
  // the answer is the add box, not another trip to a page already full.
  it("tells an emptied set apart from an account with no listings", async () => {
    backend({
      "/api/discover": { body: { interests: [], catalogs: 3, sources: INDEX.sources } },
      "/api/home": { body: HOME },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("Every term has been removed.")).toBeInTheDocument();
    expect(screen.getByText(/3 catalogs are loaded/)).toBeInTheDocument();
    expect(screen.queryByText("Open Knowledge")).not.toBeInTheDocument();
  });

  // A server that answered the sources without the count still has to land on
  // the right empty state, so the number is asked for where it lives.
  it("asks the interests endpoint for the catalog count when the index omitted it", async () => {
    backend({
      "/api/discover": { body: { interests: [], sources: INDEX.sources } },
      "/api/discover/interests": { body: { interests: [], catalogs: 4 } },
      "/api/home": { body: HOME },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("Every term has been removed.")).toBeInTheDocument();
  });
});

// ── the standing watch ──────────────────────────────────────────────────────

describe("a room the operator already watches", () => {
  // The bug this fixes: the confirmation used to be page-local, so a reload
  // offered the button again, the same subreddit could be added twice, and
  // nothing on this screen said whether the first add had taken.
  it("reads the true state from the server rather than from this page", async () => {
    backend({
      "/api/discover": { body: ROOMS_INDEX },
      "/api/home": { body: HOME },
      "/api/surfaces/reddit/rooms": { body: WATCHED },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("Watching")).toBeInTheDocument();
    expect(screen.getByText("Watching").closest("button")).toBeDisabled();
    expect(screen.queryByText("Watch this subreddit")).not.toBeInTheDocument();
  });

  it("offers the watch when the server holds no such room", async () => {
    backend({
      "/api/discover": { body: ROOMS_INDEX },
      "/api/home": { body: HOME },
      "/api/surfaces/reddit/rooms": { body: [] },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("Watch this subreddit")).toBeInTheDocument();
  });

  // The add answers with that surface's whole watch list, and THAT is what
  // the screen draws — not an assumption that the press worked.
  it("reconciles against what the add answered, not against the press", async () => {
    backend({
      "/api/discover": { body: ROOMS_INDEX },
      "/api/home": { body: HOME },
      "GET /api/surfaces/reddit/rooms": { body: [] },
      "POST /api/surfaces/reddit/rooms": { body: { rooms: WATCHED } },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    fireEvent.click(await screen.findByText("Watch this subreddit"));
    expect(await screen.findByText("Watching")).toBeInTheDocument();
  });

  // A room the server records but is not reading is not a watch, and a button
  // that says "Watching" over it would be the same lie in the other direction.
  it("offers the watch again when the server says the room is not being read", async () => {
    backend({
      "/api/discover": { body: ROOMS_INDEX },
      "/api/home": { body: HOME },
      "/api/surfaces/reddit/rooms": { body: [{ ...WATCHED[0], watching: false }] },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("Watch this subreddit")).toBeInTheDocument();
  });
});

/**
 * A Reddit source answers with BOTH, and they are not the same thing.
 *
 * `r/mechmarket` is a room to watch; `t3_1abc2de` is a thread to open. Gating
 * on the surface rather than on the action would offer "Watch this subreddit"
 * over a thread and post a thread id into the rooms table.
 */
describe("a Reddit thread, which is a link and not a room", () => {
  const MIXED = {
    interests: [{ slug: "gmk", term: "GMK", origin: "own", pinned: false, weight: 0 }],
    catalogs: 1,
    sources: [
      {
        surface: "reddit",
        method: "Reddit /subreddits/search, then a thread search inside each — an API.",
        hits: [
          {
            id: "r/mechmarket",
            title: "r/mechmarket",
            url: "https://reddit.com/r/mechmarket",
            liveNow: false,
            why: [{ term: "GMK", where: "room" }],
            action: "watch-room",
          },
          {
            id: "t3_1abc2de",
            title: "WTS GMK Olivia, barely used",
            url: "https://reddit.com/r/mechmarket/comments/1abc2de/wts_gmk_olivia/",
            liveNow: false,
            why: [{ term: "GMK", where: "title" }],
            action: "open",
          },
        ],
        unavailable: null,
      },
    ],
  };

  it("offers the thread as a link and the room as a watch, on the same surface", async () => {
    backend({
      "/api/discover": { body: MIXED },
      "/api/home": { body: HOME },
      "/api/surfaces/reddit/rooms": { body: [] },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("WTS GMK Olivia, barely used")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    // Exactly one watch control, and it belongs to the room.
    expect(screen.getAllByText("Watch this subreddit")).toHaveLength(1);
  });

  // The write that must not happen: opening a thread posts nothing anywhere.
  it("never posts a thread id into the rooms table", async () => {
    const posted: string[] = [];
    backend({
      "/api/discover": { body: MIXED },
      "/api/home": { body: HOME },
      "GET /api/surfaces/reddit/rooms": { body: [] },
      "POST /api/surfaces/reddit/rooms": { body: [] },
    });
    const real = globalThis.fetch as (i: unknown, init?: { method?: string }) => unknown;
    vi.stubGlobal("fetch", (i: unknown, init?: { method?: string }) => {
      if ((init?.method ?? "GET").toUpperCase() === "POST") posted.push(String(i));
      return real(i, init);
    });
    vi.stubGlobal("open", () => null);

    await renderWithRouter(<DiscoverView onAttach={noop} />);
    fireEvent.click(await screen.findByText("Open"));
    await new Promise((r) => setTimeout(r, 20));
    expect(posted).toEqual([]);

    // And the same press on the ROOM does post — so the assertion above is a
    // statement about the thread, not about a harness that captures nothing.
    fireEvent.click(screen.getByText("Watch this subreddit"));
    await new Promise((r) => setTimeout(r, 20));
    expect(posted).toEqual(["http://backend.test/api/surfaces/reddit/rooms"]);
  });

  // And the room's own watch state never leaks onto the thread beside it.
  it("does not mark a thread as watched because its subreddit is", async () => {
    backend({
      "/api/discover": { body: MIXED },
      "/api/home": { body: HOME },
      "/api/surfaces/reddit/rooms": { body: WATCHED },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("Watching")).toBeInTheDocument();
    // The thread keeps its own control: one "Watching" for the room, one
    // "Open" for the thread, and no second watch.
    expect(screen.getAllByText("Watching")).toHaveLength(1);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });
});

// ── one card ────────────────────────────────────────────────────────────────

const hit = (over: Partial<DiscoverHit> = {}): DiscoverHit => ({
  surface: "twitch",
  id: "1",
  title: "Watch collecting, all night",
  host: "raewatches",
  url: "https://twitch.tv/raewatches",
  startedAt: null,
  liveNow: true,
  viewers: 812,
  why: [{ term: "Omega Seamaster", where: "title" }],
  action: "attach",
  ...over,
});

describe("a result card", () => {
  it("names the surface it is on", async () => {
    await renderWithRouter(<HitCard hit={hit()} onAct={noop} />);
    expect(screen.getByText("Twitch")).toBeInTheDocument();
  });

  // Null is the honest value and the UI draws NOTHING. The old grid rendered
  // a missing viewer count as "0" on fifty cards, which reads as a dead
  // platform rather than as a source that publishes no counts.
  it("draws nothing at all for a null host or null viewers", async () => {
    await renderWithRouter(<HitCard hit={hit({ host: null, viewers: null })} onAct={noop} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.queryByText("raewatches")).not.toBeInTheDocument();
  });

  it("draws a measured zero, because that one is a fact", async () => {
    await renderWithRouter(<HitCard hit={hit({ viewers: 0 })} onAct={noop} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("offers the one action this surface supports, and only that one", async () => {
    const { unmount } = await renderWithRouter(<HitCard hit={hit()} onAct={noop} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("Attach")).toBeInTheDocument();
    unmount();

    await renderWithRouter(
      <HitCard hit={hit({ surface: "reddit", action: "watch-room" })} onAct={noop} />,
    );
    expect(screen.getByText("Watch this subreddit")).toBeInTheDocument();
    unmount();
  });

  it("fires that action once when pressed", async () => {
    let fired = 0;
    await renderWithRouter(<HitCard hit={hit()} onAct={() => (fired += 1)} />);
    fireEvent.click(screen.getByText("Attach"));
    expect(fired).toBe(1);
  });

  it("draws no reason row for a hit that has no matched terms", async () => {
    await renderWithRouter(<HitCard hit={hit({ why: [] })} onAct={noop} />);
    expect(screen.queryByText("matched")).not.toBeInTheDocument();
  });
});

// ── the chips ───────────────────────────────────────────────────────────────

describe("the surface chips", () => {
  const sources = foldSources([
    { surface: "ebaylive", method: "a scrape", hits: [{ id: "a", title: "A" }] },
    {
      surface: "twitch",
      method: "helix",
      hits: [],
      unavailable: { reason: "no app token", missing: "TWITCH_CLIENT_ID" },
    },
  ]);

  it("draws All and every surface, answering or not", async () => {
    await renderWithRouter(
      <SurfaceChips sources={sources} selected="all" onSelect={noop} total={1} />,
    );
    for (const label of ["All", "eBay Live", "Twitch", "Reddit", "Whatnot", "TikTok Live"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("counts only what a surface actually found, and counts nothing it could not", async () => {
    await renderWithRouter(
      <SurfaceChips sources={sources} selected="all" onSelect={noop} total={1} />,
    );
    expect(screen.getByRole("button", { name: /eBay Live/ })).toHaveTextContent("eBay Live1");
    // A surface that could not answer counts nothing: a "0" beside Twitch
    // would read as a live check that found nothing, which is a measurement
    // nobody made.
    expect(screen.getByRole("button", { name: /Twitch/ })).toHaveTextContent(/^Twitch$/);
  });

  it("selects the surface that was pressed", async () => {
    const picked: string[] = [];
    await renderWithRouter(
      <SurfaceChips sources={sources} selected="all" onSelect={(f) => picked.push(f)} total={1} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Whatnot/ }));
    expect(picked).toEqual(["whatnot"]);
  });
});

// ── the interest rail ───────────────────────────────────────────────────────

describe("the interest rail", () => {
  const interests = [
    { slug: "omega", term: "Omega", origin: "derived" as const, pinned: false, weight: 12 },
    { slug: "gmk", term: "GMK", origin: "own" as const, pinned: false, weight: 0 },
  ];

  it("adds a term on Enter and clears the box", async () => {
    const added: string[] = [];
    await renderWithRouter(
      <InterestRail interests={interests} onAdd={(t) => added.push(t)} onRemove={noop} />,
    );
    const box = screen.getByLabelText("Add an interest");
    fireEvent.change(box, { target: { value: " Pokémon " } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(added).toEqual(["Pokémon"]);
    expect(box).toHaveValue("");
  });

  it("removes the term whose control was pressed", async () => {
    const removed: string[] = [];
    await renderWithRouter(
      <InterestRail interests={interests} onAdd={noop} onRemove={(t) => removed.push(t)} />,
    );
    fireEvent.click(screen.getByLabelText("Remove Omega"));
    // By slug: the identity the server matches on, not the spelling shown.
    expect(removed).toEqual(["omega"]);
  });

  it("says that removing a derived term keeps it removed", async () => {
    await renderWithRouter(<InterestRail interests={interests} onAdd={noop} onRemove={noop} />);
    expect(screen.getByText(/will not bring it back/)).toBeInTheDocument();
  });
});

describe("the no-interests state", () => {
  it("sends an account with no listings to Knowledge rather than to a grid", async () => {
    await renderWithRouter(<NoInterests catalogs={0} />);
    expect(screen.getByText("Open Knowledge").closest("a")).toHaveAttribute("href", "/knowledge");
  });

  // A server that did not say how many catalogs there are gets the safe half
  // of the branch: Knowledge is where an operator with nothing must go, and
  // offering it to one who has already been is a smaller error than the
  // reverse.
  it("falls back to Knowledge when the count is unknown", async () => {
    await renderWithRouter(<NoInterests catalogs={null} />);
    expect(screen.getByText("We do not know what you sell yet.")).toBeInTheDocument();
  });

  it("does not send an operator whose catalogs are loaded back to Knowledge", async () => {
    await renderWithRouter(<NoInterests catalogs={2} />);
    expect(screen.getByText("Every term has been removed.")).toBeInTheDocument();
    expect(screen.queryByText("Open Knowledge")).not.toBeInTheDocument();
  });
});
