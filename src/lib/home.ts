/**
 * What home is made of, worked out once.
 *
 * Home used to be "your shows", because when it was written a session could
 * only be one thing: an eBay Live show with an eBay checklist above it. Seven
 * surfaces later that is the last screen in the product that still believes a
 * conversation is a show. An async surface has no session at all — Reddit is a
 * standing watch and a queue of drafts — so a list of shows cannot be the
 * spine. The spine is what needs a human NOW.
 *
 * Two jobs live here, and both are pure so the page can be reasoned about
 * without a server:
 *
 *  1. `homeModel` builds the four bands out of whatever the backend gave us.
 *     The surface-aware keys on `GET /api/home` are new and purely additive,
 *     so every one of them may be missing — an older server, or a frontend
 *     that deployed first. Each band falls back INDEPENDENTLY to the legacy
 *     payload plus reads this client already makes, because a half-shipped
 *     server should cost one band's precision, not the screen.
 *
 *  2. The per-surface phase table: before / during / after, with the
 *     operator's own state in each. When the server sends `surfaces[]` that is
 *     authoritative and we render exactly what it said. When it does not, the
 *     rows are derived here — which is how the old eBay checklist survives the
 *     rewrite: its four steps are now eBay Live's Before, one row of seven,
 *     instead of the whole product's front door.
 */

import type {
  CatalogSummary,
  EbayStatus,
  HomeBehind,
  HomeDraftCount,
  HomeLiveSession,
  HomeNext,
  HomeNow,
  HomeReport,
  HomeSurfaceRow,
  HomeSurfaceStep,
  HomeView,
  PreparedShow,
  ShowRow,
  ShowSummary,
  SurfaceCapabilities,
  SurfaceDraft,
  SurfaceId,
  SurfaceInfo,
} from "./types";
import { SURFACE_LABEL, capabilitiesOf, isSurfaceId, withRemote } from "./surfaces";

// ── the three phases, in words ──────────────────────────────────────────────

/** Actions that change something a buyer can see. */
const WRITE_ACTIONS = new Set([
  "push_listing",
  "swap_pinned",
  "markdown_price",
  "adjust_stock",
  "end_listing",
  "create_clip",
  "run_poll",
  "pin_message",
]);

/**
 * What this surface does DURING a conversation.
 *
 * Three answers, and the difference between them is the whole product: we can
 * act, we can answer but not act, or a human is the sender and we only ever
 * write the draft.
 */
export function duringLabel(caps: SurfaceCapabilities): string {
  if (caps.delivery === "draft-only") return "drafts only";
  return caps.actions.some((a) => WRITE_ACTIONS.has(a)) ? "answers and acts" : "answers, you send";
}

/** What it leaves AFTER. A surface with no session leaves a digest, not a report. */
export function afterLabel(caps: SurfaceCapabilities): string {
  return caps.tempo === "async" ? "weekly digest" : "report and follow-ups";
}

/**
 * The sentence for a surface that is not connected.
 *
 * A missing key is not an error — nobody has broken anything by not having a
 * Twitch app. It is an invitation with the answer already in it, which is why
 * the variable name is repeated verbatim rather than summarised.
 */
export function missingLine(row: { label: string; missing: string | null }): string | null {
  if (!row.missing) return null;
  return `${row.label} needs ${row.missing} on the server. The adapter is here; the key is not.`;
}

// ── the surface table ───────────────────────────────────────────────────────

/** The simulated surface is a fixture for developing against, not a place to sell. */
const HIDDEN_SURFACES: SurfaceId[] = ["simulated"];

interface DerivedContext {
  ebay: EbayStatus | null;
  catalogs: CatalogSummary[] | null;
  home: HomeView | null;
  reports: ShowRow[] | null;
  drafts: SurfaceDraft[] | null;
  rooms: Partial<Record<SurfaceId, number>>;
}

/** Catalogs the seller actually loaded — the two shipped fixtures are demos. */
export function ownCatalogs(catalogs: CatalogSummary[] | null | undefined): CatalogSummary[] {
  return (catalogs ?? []).filter((c) =>
    c.origin ? c.origin.kind !== "seed" : !["kicksbyrae", "curated-cards"].includes(c.id),
  );
}

/** Is the saved eBay Live session one the grid will actually answer? */
export function ebayLiveSignedIn(home: HomeView | null): boolean {
  const s = home?.discovery.session;
  if (!s?.present || s.stale) return false;
  return !["blocked", "signed-out"].includes(home?.discovery.reason ?? "");
}

function stepsFor(id: SurfaceId, info: SurfaceInfo, ctx: DerivedContext): HomeSurfaceStep[] {
  const caps = info.capabilities;
  const keyed: HomeSurfaceStep = {
    label: info.missing ? `Keys on the server — ${info.missing}` : "Keys on the server",
    done: info.available !== false,
    href: "/settings",
  };
  const rooms = ctx.rooms[id] ?? 0;

  if (id === "ebaylive") {
    // The old readiness checklist, in the one place it was ever true: eBay's
    // own Before. Nothing here is new — it stopped being the product's.
    const own = ownCatalogs(ctx.catalogs);
    const live = (ctx.home?.watching ?? []).some(
      (w) => w.status === "live" && (w.surface ?? w.source) === "ebaylive",
    );
    const prepared = ctx.home?.prepared.length ?? 0;
    return [
      {
        label: "eBay account connected",
        done: Boolean(ctx.ebay?.write.connected),
        href: "/settings",
        search: { tab: "ebay" },
        cta: "Connect",
      },
      {
        label: "Your listings loaded as knowledge",
        done: own.length > 0,
        href: "/settings",
        search: { tab: "ebay" },
        cta: "Import listings",
      },
      {
        label: "Signed in to eBay Live",
        done: ebayLiveSignedIn(ctx.home),
        href: "/",
        search: { view: "discover" },
        cta: "How to sign in",
      },
      {
        label: "A session prepared",
        done: live || prepared > 0,
        href: "/",
        search: { view: "discover" },
        cta: "Discover sessions",
      },
    ];
  }

  if (caps.tempo === "async" && id === "dm") {
    const followups = (ctx.drafts ?? []).filter((d) => d.surface === "dm").length;
    const finished = (ctx.reports ?? []).filter((r) => r.status !== "live").length;
    return [
      {
        label: "A session has finished",
        done: finished > 0 || followups > 0,
        href: "/",
        cta: "Monitor a session",
      },
      {
        label: "Policies and product docs loaded",
        done: ownCatalogs(ctx.catalogs).length > 0,
        href: "/knowledge",
        cta: "Open Knowledge",
      },
    ];
  }

  if (caps.communityRules) {
    // Reddit, Twitch: a key, the rooms, and the ground truth to answer from.
    return [
      keyed,
      {
        label: rooms ? `${rooms} ${roomNoun(id, rooms)} watched` : `Choose ${roomNoun(id, 2)}`,
        done: rooms > 0,
        href: "/rooms",
        cta: "Open Rooms",
      },
      {
        label: "Ground truth loaded",
        done: ownCatalogs(ctx.catalogs).length > 0,
        href: "/knowledge",
        cta: "Open Knowledge",
      },
    ];
  }

  // Whatnot, TikTok Live: nothing to configure — you paste a link.
  const seen = (ctx.reports ?? []).some((r) => r.source === id);
  return [
    keyed,
    {
      label: seen ? "A session has run here" : "Paste a session link to begin",
      done: seen,
      href: "/",
      cta: "Paste a link",
    },
  ];
}

function roomNoun(id: SurfaceId, n: number): string {
  const one =
    id === "reddit" ? "subreddit" : id === "twitch" || id === "youtubelive" ? "channel" : "room";
  return n === 1 ? one : `${one}s`;
}

/**
 * Is a surface connected, when the server did not say?
 *
 * eBay means a sealed OAuth consent; the keyed surfaces mean their variables
 * are present; the follow-up inbox needs nothing and is always on. A scraped
 * surface needs nothing either, so its answer is whether this build has an
 * adapter for it at all.
 */
function connectedFallback(id: SurfaceId, info: SurfaceInfo, ctx: DerivedContext): boolean {
  if (id === "ebaylive") return Boolean(ctx.ebay?.write.connected);
  if (id === "dm") return true;
  return info.available !== false;
}

/**
 * The surface table, derived.
 *
 * Used only when `GET /api/home` did not send `surfaces[]`. `/api/surfaces`
 * has shipped for a while and is the honest source for what this build can
 * reach — `attachable`, `available` and `missing` all come from it, so a
 * surface with no adapter (YouTube Live today) is read off the flag rather
 * than named in a list here that would rot the moment one lands.
 */
export function deriveSurfaces(
  surfaces: SurfaceInfo[] | null,
  ctx: DerivedContext,
): HomeSurfaceRow[] {
  const infos = withRemote(surfaces);
  // `withRemote(null)` marks everything unattachable, which is right when the
  // server answered and did not mention a surface and wrong when it never
  // answered at all. One is distinguishable from the other: a server that
  // answered says SOMETHING about at least one surface.
  const serverSpoke = infos.some((s) => s.attachable || s.missing || s.available === false);

  return infos
    .filter((s) => !HIDDEN_SURFACES.includes(s.id))
    .map((info) => {
      const caps = info.capabilities;
      const row: HomeSurfaceRow = {
        id: info.id,
        label: info.label,
        // With no answer from the server the paste box is the only honest
        // authority left: it is the thing that would have to recognise a link,
        // and the follow-up inbox is the one surface it cannot be handed.
        attachable: serverSpoke ? info.attachable === true : info.id !== "dm",
        tempo: caps.tempo,
        delivery: caps.delivery,
        connected: connectedFallback(info.id, info, ctx),
        missing: info.missing ?? null,
        before: stepsFor(info.id, info, ctx),
        during: duringLabel(caps),
        after: afterLabel(caps),
      };
      const rooms = ctx.rooms[info.id];
      if (rooms != null) row.rooms = rooms;
      return row;
    });
}

/** A server row, made safe to render. Every field may be absent mid-rollout. */
export function normalizeSurfaceRow(raw: Partial<HomeSurfaceRow>): HomeSurfaceRow | null {
  if (!isSurfaceId(raw.id)) return null;
  const caps = capabilitiesOf(raw.id);
  const row: HomeSurfaceRow = {
    id: raw.id,
    label: raw.label || SURFACE_LABEL[raw.id],
    attachable: raw.attachable === true,
    tempo: raw.tempo === "async" ? "async" : caps.tempo,
    delivery: raw.delivery === "draft-only" ? "draft-only" : caps.delivery,
    connected: raw.connected === true,
    missing: raw.missing ?? null,
    before: Array.isArray(raw.before)
      ? raw.before
          .filter((s) => s && typeof s.label === "string")
          .map((s) => ({ ...s, done: s.done === true }))
      : [],
    during: raw.during || duringLabel(caps),
    after: raw.after || afterLabel(caps),
  };
  if (typeof raw.rooms === "number") row.rooms = raw.rooms;
  return row;
}

// ── the bands ───────────────────────────────────────────────────────────────

function liveFromWatching(watching: ShowSummary[]): HomeLiveSession[] {
  return watching
    .filter((w) => w.status === "live")
    .map((w) => ({
      showId: w.showId,
      surface: (w.surface ?? w.source) as SurfaceId,
      title: w.title,
      host: w.sellerHandle,
      startedAt: w.startedAt,
      awaiting: w.awaiting ?? 0,
      blocked: w.blocked ?? 0,
      readOnly: w.readOnly,
    }));
}

function draftsFrom(drafts: SurfaceDraft[] | null): HomeDraftCount {
  const open = (drafts ?? []).filter((d) => (d.status ?? "open") === "open");
  const by = new Map<SurfaceId, number>();
  for (const d of open) by.set(d.surface, (by.get(d.surface) ?? 0) + 1);
  return {
    total: open.length,
    bySurface: [...by.entries()]
      .map(([surface, count]) => ({ surface, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function reportsFrom(rows: ShowRow[] | null): HomeReport[] {
  return (
    (rows ?? [])
      // A session whose report never generated is still a row here. That is the
      // one you most want to look at, and the sessions list this replaced said
      // so — dropping it would lose the only place that fact is visible.
      .filter((r) => r.status !== "live")
      .slice(0, 6)
      .map((r) => ({
        showId: r.showId,
        surface: (isSurfaceId(r.source) ? r.source : "ebaylive") as SurfaceId,
        title: r.title,
        // A row from the sessions list carries no end time. Its report's
        // generation is the closest honest stand-in; never invent one.
        endedAt: r.generatedAt ?? r.startedAt,
        answered: r.answered ?? 0,
        blocked: r.blocked ?? 0,
        // The stored report holds the top gap. A list row does not, and
        // computing a different one here would put two answers in the product.
        topGap: null,
        hasReport: r.hasReport,
      }))
  );
}

export interface HomeSources {
  home: HomeView | null;
  surfaces: SurfaceInfo[] | null;
  reports: ShowRow[] | null;
  drafts: SurfaceDraft[] | null;
  catalogs: CatalogSummary[] | null;
  ebay: EbayStatus | null;
  rooms?: Partial<Record<SurfaceId, number>>;
}

export interface HomeModel {
  now: HomeNow;
  next: HomeNext;
  behind: HomeBehind;
  surfaces: HomeSurfaceRow[];
  /** Which bands the server itself answered, so the page can be honest about
   *  a number it worked out rather than read. */
  served: { now: boolean; next: boolean; behind: boolean; surfaces: boolean };
}

export function homeModel(sources: HomeSources): HomeModel {
  const { home } = sources;
  const ctx: DerivedContext = {
    ebay: sources.ebay,
    catalogs: sources.catalogs,
    home,
    reports: sources.reports,
    drafts: sources.drafts,
    rooms: sources.rooms ?? {},
  };

  const servedNow = Array.isArray(home?.now?.live);
  const now: HomeNow = servedNow
    ? {
        live: home!.now!.live.filter((l) => l && typeof l.showId === "string"),
        drafts: home!.now!.drafts?.bySurface
          ? {
              total: home!.now!.drafts.total ?? 0,
              bySurface: home!.now!.drafts.bySurface.filter((d) => isSurfaceId(d.surface)),
            }
          : draftsFrom(sources.drafts),
      }
    : { live: liveFromWatching(home?.watching ?? []), drafts: draftsFrom(sources.drafts) };

  const servedNext = Array.isArray(home?.next?.discoverable);
  const next: HomeNext = {
    prepared: (home?.next?.prepared ?? home?.prepared ?? []) as PreparedShow[],
    // Today exactly one surface has a grid we can read. Saying so is the
    // difference between "Discover is for eBay Live" and an operator
    // concluding the other six are broken.
    discoverable: servedNext ? home!.next!.discoverable.filter(isSurfaceId) : ["ebaylive"],
  };

  const servedBehind = Array.isArray(home?.behind?.reports);
  const behind: HomeBehind = servedBehind
    ? {
        reports: home!.behind!.reports.filter((r) => r && typeof r.showId === "string"),
        followups: home!.behind!.followups ?? followupsFrom(sources.drafts),
      }
    : { reports: reportsFrom(sources.reports), followups: followupsFrom(sources.drafts) };

  const servedSurfaces = Array.isArray(home?.surfaces) && home!.surfaces!.length > 0;
  const surfaces = servedSurfaces
    ? home!
        .surfaces!.map((r) => normalizeSurfaceRow(r))
        .filter((r): r is HomeSurfaceRow => r !== null)
        .filter((r) => !HIDDEN_SURFACES.includes(r.id))
    : deriveSurfaces(sources.surfaces, ctx);

  return {
    now,
    next,
    behind,
    surfaces,
    served: { now: servedNow, next: servedNext, behind: servedBehind, surfaces: servedSurfaces },
  };
}

function followupsFrom(drafts: SurfaceDraft[] | null): { total: number; ready: number } {
  const dm = (drafts ?? []).filter((d) => d.surface === "dm");
  return { total: dm.length, ready: dm.filter((d) => (d.status ?? "open") === "open").length };
}

// ── what the bands say when they are empty ──────────────────────────────────

/**
 * NOW with nothing in it is still a fact worth drawing.
 *
 * A band that disappears when empty teaches an operator that the copilot is
 * only there when it is busy. It is watching either way, and how many surfaces
 * are watching is the reassurance that belongs in the space.
 */
export function watchingLine(surfaces: HomeSurfaceRow[]): string {
  const on = surfaces.filter((s) => s.connected);
  if (on.length === 0) return "No surface is connected yet — the table below is where that starts.";
  const names = on.map((s) => s.label);
  const listed = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and more`;
  return `Nothing needs you this minute. ${on.length} surface${on.length === 1 ? "" : "s"} watching — ${listed}.`;
}
