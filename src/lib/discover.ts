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
  DiscoverInterests,
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
  // An action the server did not name is a LINK, and never inferred from the
  // surface. Reddit answers with rooms AND with threads — `r/mechmarket` is a
  // room to watch, `t3_1abc2de` is a thread to open — so "reddit means
  // watch-room" would offer "Watch this subreddit" over a thread and post a
  // thread id into the rooms table. Every other action writes something; a
  // link is the only fallback that cannot.
  const action = ACTIONS.find((a) => a === o["action"]) ?? "open";
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
 * The identity a term matches on, when we are the ones inventing it.
 *
 * Only for the optimistic add: the operator types a term, the chip appears
 * before the round trip, and the server's own slug replaces this the moment
 * the write answers. It is never sent anywhere.
 */
export function interestSlug(term: string): string {
  return term.trim().toLowerCase();
}

/**
 * One interest, exactly as the server sends it: five fields and no others.
 *
 * This was tolerant of three spellings of the count and three of the origin
 * while the endpoint was being written beside it. It is not any more — the
 * shape is pinned, and a reader that still accepts `listings` or `catalogName`
 * is a reader that would go on silently working against a payload nobody
 * sends, which is how a guess outlives the guessing.
 */
export function normalizeInterest(raw: unknown): DiscoverInterest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const term = str(o["term"]);
  if (!term) return null;
  return {
    slug: str(o["slug"]) ?? interestSlug(term),
    term,
    // Owned unless the server says it derived it. A term the operator typed is
    // the one thing we must never claim came out of their catalogs.
    origin: o["origin"] === "derived" ? "derived" : "own",
    pinned: o["pinned"] === true,
    weight: count(o["weight"]) ?? 0,
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
    // The slug is the identity, so it is what deduplicates: two spellings of
    // one term are one interest.
    if (!i || seen.has(i.slug)) return [];
    seen.add(i.slug);
    return [i];
  });
}

/** The interests endpoint's answer: the set, and why it is that size. */
export function normalizeInterestSet(raw: unknown): DiscoverInterests {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { interests: normalizeInterests(raw), catalogs: count(o["catalogs"]) ?? 0 };
}

/**
 * Where a chip came from, in the words the chip itself can carry.
 *
 * It names no catalog, because interests derive from all of an account's
 * catalogs at once and belong to none of them — the weight is the provenance.
 */
export function interestOrigin(i: DiscoverInterest): string {
  if (i.origin !== "derived") return "You added this term.";
  return i.weight > 0
    ? `Derived from ${i.weight} of your listings.`
    : "Derived from your catalogs.";
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
    // Not zero: an older server was never asked how many catalogs there are,
    // and answering for it would be inventing a measurement.
    catalogs: null,
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
 * A Reddit room id carries its prefix — `r/mechmarket`, verbatim what the
 * rooms endpoint accepts — so the shape no longer needs tolerating, and the
 * prefix-stripping that stood in for not knowing it is gone. Case is all that
 * is left, and it earns its place: Reddit treats a subreddit name
 * case-insensitively, so `r/MechMarket` is the same room.
 */
export function roomKey(v: string): string {
  return v.trim().toLowerCase();
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
