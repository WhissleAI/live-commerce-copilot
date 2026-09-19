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
  vi.stubGlobal("fetch", (input: unknown) => {
    const path = new URL(String(input), "http://backend.test").pathname;
    const hit = routes[path] ?? { status: 404, body: { error: "not found" } };
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
    { term: "Omega Seamaster", origin: "derived", listings: 12, catalog: "Watch vault" },
    { term: "GMK", origin: "own" },
  ],
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

  it("carries the derived count on the chip, and nothing on one you added", async () => {
    backend({ "/api/discover": { body: INDEX }, "/api/home": { body: HOME } });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    const chip = (await screen.findAllByText("Omega Seamaster")).find((n) =>
      n.title.startsWith("Derived"),
    );
    expect(chip).toHaveAttribute("title", "Derived from 12 listings of Watch vault.");
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
      "/api/discover": { body: { interests: [], sources: INDEX.sources } },
      "/api/home": { body: HOME },
    });
    await renderWithRouter(<DiscoverView onAttach={noop} />);

    expect(await screen.findByText("We do not know what you sell yet.")).toBeInTheDocument();
    expect(screen.getByText("Open Knowledge")).toBeInTheDocument();
    expect(screen.queryByText("Watch collecting, all night")).not.toBeInTheDocument();
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
    { term: "Omega", origin: "derived" as const, listings: 12, catalog: "Watches", pinned: false },
    { term: "GMK", origin: "own" as const, listings: null, catalog: null, pinned: false },
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
    expect(removed).toEqual(["Omega"]);
  });

  it("says that removing a derived term keeps it removed", async () => {
    await renderWithRouter(<InterestRail interests={interests} onAdd={noop} onRemove={noop} />);
    expect(screen.getByText(/will not bring it back/)).toBeInTheDocument();
  });
});

describe("the no-interests state", () => {
  it("sends the operator to Knowledge rather than to a grid", async () => {
    await renderWithRouter(<NoInterests />);
    expect(screen.getByText("Open Knowledge").closest("a")).toHaveAttribute("href", "/knowledge");
  });
});
