/**
 * Discovery, as a model rather than a grid.
 *
 * The old Discover asked one question of one surface: what is live on eBay
 * right now. That was wrong twice over. It read one of the five surfaces an
 * operator can actually discover on, because
 * nobody checked that Twitch and Reddit have first-class public APIs — an app
 * token lists Helix streams with no user sign-in, and `oauth.reddit.com`
 * answers subreddit and thread search. And a grid of what is live is a phone
 * book: what an operator needs is what is live THAT HAS ANYTHING TO DO WITH
 * WHAT THEY SELL, which we already hold in their catalogs.
 *
 * Everything here is a pure function over the payload, for two reasons. The
 * screen has to survive a server that has not shipped `/api/discover` yet — the
 * two halves of this deploy minutes apart — and the rules that matter (never
 * hide a surface, never draw a hit that cannot say why it is there, never
 * render null as zero) are rules about data, so they are testable as data.
 */

import { SURFACE_LABEL, SURFACE_ROOM_NOUN, isSurfaceId, surfaceLabel } from "./surfaces";
import type {
  DiscoverAction,
  DiscoverHit,
  DiscoverInterest,
  DiscoverSourceResult,
  DiscoverView,
  DiscoveredShow,
  DiscoveryReason,
  HomeView,
  SurfaceId,
  SurfaceRoom,
  WhyWhere,
} from "./types";

/**
 * The surfaces Discover asks, in the order they are drawn.
 *
 * Five, which is the seven REGISTERED ADAPTERS minus `dm` and `simulated`: a
 * follow-up inbox and a scripted rehearsal are not places to find something.
 * Every surface an operator could actually discover on is here, including the
 * ones with no key set — a chip that disappears when a key is missing is
 * exactly how Twitch and Reddit stayed invisible while both had public APIs
 * waiting to be asked.
 *
 * `youtubelive` is NOT here, and its absence is the opposite of that omission.
 * It has a `SURFACE_CAPABILITIES` row and no adapter directory and no
 * registration, which is why Home's surface table draws six rows and not
 * seven. Nothing attaches to it and nothing can discover on it, so a chip for
 * it would promise a surface that does not exist — the same class of error as
 * the capability mirror claiming we can mark a price down on Whatnot. A chip
 * is only honest for a surface that is merely missing a key.
 */
export const DISCOVER_SURFACES: SurfaceId[] = [
  "ebaylive",
  "twitch",
  "reddit",
  "whatnot",
  "tiktoklive",
];

export function isDiscoverSurface(id: unknown): id is SurfaceId {
  return isSurfaceId(id) && DISCOVER_SURFACES.includes(id);
}

// ── reading the server ──────────────────────────────────────────────────────

const WHERE: WhyWhere[] = ["title", "category", "host", "room", "body"];
const ACTIONS: DiscoverAction[] = ["prepare", "attach", "watch-room", "open"];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * A number the server measured, or null.
 *
 * `0` is kept — a stream genuinely watched by nobody is a fact — but anything
 * that is not a finite number becomes null so the card draws nothing. The bug
 * this prevents is the one the old grid shipped: a missing viewer count
 * rendered as "0 viewers" on fifty cards, which reads as a dead platform.
 */
function count(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizeWhy(raw: unknown): DiscoverHit["why"] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((w) => {
    const o = (w ?? {}) as Record<string, unknown>;
    const term = str(o["term"]);
    if (!term) return [];
    const where = o["where"];
    return [{ term, where: (WHERE.find((x) => x === where) ?? "title") as WhyWhere }];
  });
}

export function normalizeHit(raw: unknown, surface: SurfaceId): DiscoverHit | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const id = str(o["id"]);
  const title = str(o["title"]);
  if (!id || !title) return null;
  const action = ACTIONS.find((a) => a === o["action"]) ?? defaultAction(surface);
  return {
    surface: isSurfaceId(o["surface"]) ? (o["surface"] as SurfaceId) : surface,
    id,
    title,
    host: str(o["host"]),
    url: str(o["url"]) ?? "",
    startedAt: str(o["startedAt"]),
    liveNow: o["liveNow"] === true,
    viewers: count(o["viewers"]),
    why: normalizeWhy(o["why"]),
    action,
  };
}

function normalizeUnavailable(raw: unknown): DiscoverSourceResult["unavailable"] {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const reason = str(o["reason"]);
  if (!reason) return null;
  return { reason, missing: str(o["missing"]) };
}

export function normalizeSource(raw: unknown): DiscoverSourceResult | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const surface = o["surface"];
  if (!isDiscoverSurface(surface)) return null;
  const hits = Array.isArray(o["hits"])
    ? o["hits"].flatMap((h) => {
        const hit = normalizeHit(h, surface);
        return hit ? [hit] : [];
      })
    : [];
  const unavailable = normalizeUnavailable(o["unavailable"]);
  return {
    surface,
    method: str(o["method"]) ?? METHOD_UNKNOWN,
    // A surface that could not answer has nothing to show, whatever it sent.
    hits: unavailable ? [] : hits,
    unavailable,
  };
}

const METHOD_UNKNOWN = "The server did not say how this list was obtained.";

/**
 * Every surface, in order, whether or not the server mentioned it.
 *
 * The fold is the honesty rule in code: a source the server omitted becomes a
 * row that says the server omitted it, rather than a surface that silently
 * does not exist. An operator can only ask for a key they can see is missing.
 */
export function foldSources(raw: unknown): DiscoverSourceResult[] {
  const said = new Map<SurfaceId, DiscoverSourceResult>();
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const s = normalizeSource(r);
      if (s) said.set(s.surface, s);
    }
  }
  return DISCOVER_SURFACES.map(
    (id) =>
      said.get(id) ?? {
        surface: id,
        method: METHOD_UNKNOWN,
        hits: [],
        unavailable: {
          reason: `This server did not answer for ${SURFACE_LABEL[id]} — it may be running a build from before ${SURFACE_LABEL[id]} was wired into Discover.`,
          missing: null,
        },
      },
  );
}

// ── interests ───────────────────────────────────────────────────────────────

/**
 * What the server called an interest, read as one.
 *
 * Tolerant on purpose: this file and the endpoint behind it are being written
 * in parallel, and the difference between `count` and `listings` is not worth
 * a blank screen. A bare string is accepted too — that is what a PUT body
 * round-trips to on a server that stores only the term.
 */
export function normalizeInterest(raw: unknown): DiscoverInterest | null {
  if (typeof raw === "string") {
    const term = raw.trim();
    return term ? { term, origin: "own", listings: null, catalog: null, pinned: false } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const term = str(o["term"]) ?? str(o["name"]);
  if (!term) return null;
  const origin = o["origin"] ?? o["kind"] ?? o["source"];
  return {
    term,
    // Owned unless the server says it derived it. A term the operator typed is
    // the one thing we must never claim came out of their catalog.
    origin: origin === "derived" || origin === "catalog" ? "derived" : "own",
    listings: count(o["listings"]) ?? count(o["count"]),
    catalog: str(o["catalog"]) ?? str(o["catalogName"]) ?? str(o["catalogId"]),
    pinned: o["pinned"] === true,
  };
}

export function normalizeInterests(raw: unknown): DiscoverInterest[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { interests?: unknown } | null)?.interests)
      ? (raw as { interests: unknown[] }).interests
      : [];
  const seen = new Set<string>();
  return list.flatMap((r) => {
    const i = normalizeInterest(r);
    if (!i) return [];
    const key = i.term.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [i];
  });
}

/** Where a chip came from, in the words the chip itself can carry. */
export function interestOrigin(i: DiscoverInterest): string {
  if (i.origin !== "derived") return "You added this term.";
  const where = i.catalog ? ` of ${i.catalog}` : "";
  return i.listings == null
    ? `Derived from your catalog${where ? ` — ${i.catalog}` : ""}.`
    : `Derived from ${i.listings} listing${i.listings === 1 ? "" : "s"}${where}.`;
}

// ── the fallback ────────────────────────────────────────────────────────────

/**
 * Why the eBay grid is empty, in the wording the old screen earned.
 *
 * Three different facts that used to render identically: "sign in to eBay
 * first" is an instruction, "nobody is on air" is a fact about the world, and
 * "we could not look" is a fault. Each survives the restructure because each
 * one asks the operator for something different — or for nothing at all.
 */
export function ebayReasonLine(reason: DiscoveryReason | undefined): string | null {
  switch (reason) {
    case "pending":
      return "The server has a session and has not read the grid yet. The first read after a restart takes about a minute; this refreshes itself.";
    case "no-session":
      return "eBay Live shows nothing at all to a signed-out visitor — not a short list, nothing. Run `npm run ebay:signin` in the server repo: a browser opens, you sign in yourself, and the session is saved. Nothing types a credential for you.";
    case "stale-session":
      return "The eBay session has gone stale. Run `npm run ebay:signin` in the server repo to sign in again.";
    case "signed-out":
      return "eBay has signed this session out — it ends a session it sees from a new address. Sign in from the address the server will use, and keep using it.";
    case "blocked":
      return "eBay refused the live grid from this network. Pasting a show link still attaches and monitors from here.";
    case "stale":
      return "This is the last grid we managed to read; eBay has not answered since.";
    default:
      return null;
  }
}

const LEGACY_METHOD =
  "The eBay Live grid, read from the house signed-in session — a page scrape, not an API.";

/**
 * Discover built out of the payload the old screen had.
 *
 * The two halves of this change deploy minutes apart, so a frontend that lands
 * first must cost precision, not the screen: no interests, no other surfaces,
 * and every hit without a `why` because nothing here knows what the operator
 * sells. It is the eBay-only grid, honestly labelled as the only thing this
 * server can answer.
 */
export function legacyDiscover(home: HomeView | null): DiscoverView {
  const shows = home?.live ?? [];
  const hits = shows.map(hitFromShow);
  const reason = ebayReasonLine(home?.discovery.reason);
  return {
    interests: [],
    sources: foldSources([
      {
        surface: "ebaylive",
        method: LEGACY_METHOD,
        hits,
        unavailable: hits.length === 0 && reason ? { reason, missing: null } : null,
      },
    ]),
  };
}

export function hitFromShow(s: DiscoveredShow): DiscoverHit {
  return {
    surface: "ebaylive",
    id: s.eventId,
    title: s.title,
    host: s.host ?? s.sellerHandle ?? null,
    url: s.url,
    startedAt: s.startedAt ?? null,
    liveNow: s.status !== "scheduled",
    viewers: count(s.viewers),
    // Nothing on this path knows what the operator sells, so nothing here can
    // claim a reason. An empty `why` is the truth, and the card draws no
    // matched terms rather than inventing one.
    why: [],
    action: "prepare",
    legacy: s,
  };
}

// ── what a card can do ──────────────────────────────────────────────────────

export function defaultAction(surface: SurfaceId): DiscoverAction {
  if (surface === "ebaylive") return "prepare";
  if (surface === "reddit") return "watch-room";
  if (surface === "twitch" || surface === "youtubelive") return "attach";
  return "open";
}

/** The one action this surface supports, in this surface's own words. */
export function actionLabel(hit: DiscoverHit): string {
  switch (hit.action) {
    case "prepare":
      return "Prepare";
    case "attach":
      return "Attach";
    case "watch-room":
      return `Watch this ${SURFACE_ROOM_NOUN[hit.surface] ?? "room"}`;
    default:
      return "Open";
  }
}

/** What pressing it will do, spelled out where there is room to. */
export function actionHint(hit: DiscoverHit): string {
  switch (hit.action) {
    case "prepare":
      return "Builds this show's catalog from the seller's listings and gives it its own agent, before it starts.";
    case "attach":
      return `Opens a session on ${surfaceLabel(hit.surface)} and starts answering from your knowledge.`;
    case "watch-room":
      return `Adds this ${SURFACE_ROOM_NOUN[hit.surface] ?? "room"} to your standing watch. Nothing is posted; every reply is a draft you send.`;
    default:
      return "Opens it where it lives.";
  }
}

// ── the standing watch ──────────────────────────────────────────────────────

/**
 * One room, as a key both sides can be compared on.
 *
 * The room a surface records in its watch list and the id a discovery hit
 * carries are not guaranteed to be spelled identically — `r/mechmarket` and
 * `mechmarket` are one subreddit, not two. Case and that one prefix are the
 * only things normalised away; nothing else is inferred, and the backend's
 * actual id format replaces this the moment it is pinned down.
 */
export function roomKey(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/^\/?r\//, "");
}

/**
 * Is this hit's room already on the operator's standing watch?
 *
 * Read from the server's own list rather than remembered on the page, because
 * a page-local memory is forgotten by a reload — which offers the button
 * again, lets the same subreddit be added twice, and gives the operator no way
 * to tell from this screen whether the first one took.
 *
 * An absent `watching` reads as watched: the room being in the list IS the
 * watch. Only an explicit `false` says otherwise.
 */
export function isWatched(
  rooms: readonly SurfaceRoom[],
  hit: Pick<DiscoverHit, "surface" | "id">,
): boolean {
  const key = roomKey(hit.id);
  return rooms.some(
    (r) => r.surface === hit.surface && roomKey(r.room) === key && r.watching !== false,
  );
}

/** One surface's watch list, replaced wholesale by what the server just said. */
export function mergeRooms(
  prev: readonly SurfaceRoom[],
  surface: SurfaceId,
  list: readonly SurfaceRoom[],
): SurfaceRoom[] {
  return [...prev.filter((r) => r.surface !== surface), ...list];
}

/** Which surfaces in this answer have a room worth reading the watch list for. */
export function roomSurfacesIn(sources: readonly DiscoverSourceResult[]): SurfaceId[] {
  const out: SurfaceId[] = [];
  for (const s of sources) {
    if (s.hits.some((h) => h.action === "watch-room") && !out.includes(s.surface)) {
      out.push(s.surface);
    }
  }
  return out;
}

// ── counting, for the chips ─────────────────────────────────────────────────

export function hitsFor(
  sources: DiscoverSourceResult[],
  surface: SurfaceId | "all",
): DiscoverHit[] {
  return sources.filter((s) => surface === "all" || s.surface === surface).flatMap((s) => s.hits);
}

export function sourceFor(
  sources: DiscoverSourceResult[],
  surface: SurfaceId,
): DiscoverSourceResult | null {
  return sources.find((s) => s.surface === surface) ?? null;
}

/** How many surfaces answered at all — the number home's card should carry. */
export function readableSurfaces(sources: DiscoverSourceResult[]): SurfaceId[] {
  return sources.filter((s) => !s.unavailable).map((s) => s.surface);
}

/** The distinct terms this list matched on, in the order they first appear. */
export function matchedTerms(hits: DiscoverHit[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    for (const w of h.why) {
      const key = w.term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(w.term);
    }
  }
  return out;
}
