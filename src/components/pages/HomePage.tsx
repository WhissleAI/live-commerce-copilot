/**
 * Today — what needs the operator now, with the three phases underneath it.
 *
 * This replaces a page called Shows whose front door was an eBay readiness
 * checklist: "Signed in to eBay Live", "eBay account connected", "Your catalog
 * loaded", "Next show prepared". Every one of those is true — of ONE surface.
 * They were drawn as the product's readiness because when they were written a
 * session could only be an eBay Live show, and the multi-surface paste box
 * ended up shoved underneath them as a consolation.
 *
 * Two facts broke that shape:
 *
 *   1. An async surface has NO session. Reddit is a standing watch and a queue
 *      of drafts; there is nothing to list under "your shows" and nothing to
 *      start. A list of sessions cannot be the spine of a product where three
 *      of seven surfaces never have one.
 *   2. Every phase is per-surface. Twitch's Before is an OAuth app and a
 *      sponsor brief; Reddit's is a script app and a list of subreddits. One
 *      checklist cannot hold them, and the one we had quietly asserted that
 *      eBay's Before was everyone's.
 *
 * So: three bands in the order attention actually goes — NOW, NEXT, BEHIND YOU
 * — and beneath them the surface table, which is the same before/during/after
 * story told once per surface with the operator's own state in each. The
 * checklist is not gone; it is eBay Live's Before, one row of seven.
 *
 * Nothing here requires the surface-aware backend. `homeModel` builds every
 * band from the legacy payload when the new keys are absent, because a
 * frontend that deploys first should cost precision, not the screen.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  FileText,
  Loader2,
  Plus,
  Radio,
  SquarePen,
} from "lucide-react";
import { api, surfaceUnavailable } from "@/lib/api";
import { cn } from "@/lib/utils";
import { recognise, surfaceLabel } from "@/lib/surfaces";
import { homeModel, missingLine, watchingLine, type HomeModel } from "@/lib/home";
import { timeAgo } from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import type {
  CatalogSummary,
  EbayStatus,
  HomeLiveSession,
  HomeReport,
  HomeSurfaceRow,
  HomeSurfaceStep,
  HomeView,
  ShowRow,
  SurfaceDraft,
  SurfaceId,
  SurfaceInfo,
} from "@/lib/types";
import { AppShell, type Tab } from "@/components/app/AppShell";
import { Badge, Button, Card, SectionHeading, Skeleton } from "@/components/ui/kit";
import { DiscoverView } from "./DiscoverView";

type View = "today" | "discover";

/** Surfaces whose Before we can only answer by reading their rooms. */
const ROOM_SURFACES: SurfaceId[] = ["reddit", "twitch", "youtubelive"];

export function HomePage({ view = "today" }: { view?: View }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<View>(view);
  useEffect(() => setTab(view), [view]);

  const [home, setHome] = useState<HomeView | null>(null);
  const [surfaces, setSurfaces] = useState<SurfaceInfo[] | null>(null);
  const [rows, setRows] = useState<ShowRow[] | null>(null);
  const [drafts, setDrafts] = useState<SurfaceDraft[] | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogSummary[] | null>(null);
  const [ebay, setEbay] = useState<EbayStatus | null>(null);
  const [rooms, setRooms] = useState<Partial<Record<SurfaceId, number>>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [h, s, r, d] = await Promise.all([
      api.home().catch(() => null),
      api.surfaces().catch(() => null),
      api.reports(50).catch(() => null),
      api.drafts().catch(() => null),
    ]);
    setHome(h);
    setSurfaces(s);
    setRows(r);
    setDrafts(d);
    setLoading(false);

    // Only a server that has not shipped the surface table makes us work it
    // out, and only then do we pay for the reads that answer it.
    if (!Array.isArray(h?.surfaces) || h.surfaces.length === 0) {
      void api.catalogs().then(setCatalogs).catch(noop);
      void api.ebayStatus().then(setEbay).catch(noop);
      void Promise.all(
        ROOM_SURFACES.map(
          async (id) => [id, (await api.rooms(id).catch(() => [])).length] as const,
        ),
      ).then((pairs) => setRooms(Object.fromEntries(pairs)));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const model = useMemo(
    () => homeModel({ home, surfaces, reports: rows, drafts, catalogs, ebay, rooms }),
    [home, surfaces, rows, drafts, catalogs, ebay, rooms],
  );

  // ── the paste box ─────────────────────────────────────────────────────────
  const [url, setUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = useMemo(() => recognise(url), [url]);
  const targetRow = target ? (model.surfaces.find((s) => s.id === target.surface) ?? null) : null;
  const canOpen = !targetRow || targetRow.attachable;

  const start = useCallback(
    async (paste?: string) => {
      const value = (paste ?? url).trim();
      if (!value || starting) return;
      setStarting(true);
      setError(null);
      try {
        let res;
        try {
          res = await api.startSession({ url: value });
        } catch (e) {
          // A surface we know and cannot reach. The response names the variable
          // that would fix it, and that name is the whole value of the answer.
          const unavailable = surfaceUnavailable(e);
          if (unavailable) {
            setError(
              unavailable.missing
                ? `${surfaceLabel(unavailable.surface ?? target?.surface ?? null)} is not connected — ${unavailable.missing} is not set on the server. The adapter is there; the key is not.`
                : unavailable.message,
            );
            setStarting(false);
            return;
          }
          // A session that was never prepared has no catalog and no agent.
          // Prepare it here (about a minute) and attach once that lands.
          if (!/prepare the agent/i.test((e as Error).message)) throw e;
          const eventId =
            value.match(/\/ebaylive\/events\/([A-Za-z0-9]{10,})/)?.[1] ??
            (/^[A-Za-z0-9]{16}$/.test(value) ? value : null);
          if (!eventId) throw e;
          setError("Preparing this session's agent and knowledge first — about a minute…");
          await api.prepareShow({
            eventId,
            title: `eBay Live ${eventId}`,
            host: "",
            sellerHandle: null,
            tags: [],
            thumbnailUrl: null,
          });
          setError(null);
          res = await api.startSession({ url: value });
        }
        await navigate({ to: "/setup", search: { showId: res.showId } });
      } catch (e) {
        const unavailable = surfaceUnavailable(e);
        setError(
          unavailable?.missing
            ? `${surfaceLabel(unavailable.surface ?? target?.surface ?? null)} is not connected — ${unavailable.missing} is not set on the server. The adapter is there; the key is not.`
            : (e as Error).message,
        );
        setStarting(false);
      }
    },
    [navigate, starting, url, target],
  );

  const openConsole = useCallback(
    (showId: string) => {
      void api
        .activateShow(showId)
        .catch(noop)
        .then(() => navigate({ to: "/console" }));
    },
    [navigate],
  );

  const tabs: Tab[] = [
    { label: "Today", active: tab === "today", onClick: () => setTab("today") },
    // Scoped on the label, not implied by silence: one surface has a grid we
    // can read, and six do not because they have no grid — not because they
    // are broken.
    {
      label: "Discover · eBay Live",
      active: tab === "discover",
      onClick: () => setTab("discover"),
    },
  ];

  return (
    <AppShell section="home" title="Today" subtitle={subtitle(model, loading)} tabs={tabs}>
      {tab === "discover" ? (
        <DiscoverView onAttach={(u) => void start(u)} />
      ) : (
        <>
          <NowBand
            live={model.now.live}
            drafts={model.now.drafts}
            surfaces={model.surfaces}
            loading={loading}
            onOpen={openConsole}
          />

          <Band
            eyebrow="Next"
            title="What you are preparing"
            hint="A session, a channel, or a thread. The copilot works out which surface it is, and what it can do there follows from that — a live session gives it a lineup to answer from, a subreddit gives it the room's rules and a reply you send yourself."
          >
            <div className="mt-3 flex items-start gap-2.5">
              <div className="flex-1">
                <input
                  id="stream-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void start();
                  }}
                  spellCheck={false}
                  aria-label="A session, a channel, or a thread"
                  placeholder="a session, a channel, or a thread"
                  className="num w-full rounded-sm bg-panel px-3 py-2.5 text-[13px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
                />
                {/* Recognised BEFORE they commit: the surface decides everything
                    that happens next, and an operator who finds that out after
                    committing has already committed. */}
                <div className="mt-1.5 h-4 text-[11px] text-text-muted">
                  {url.trim() ? (
                    target ? (
                      <>
                        <span className="text-text-secondary">{surfaceLabel(target.surface)}</span>
                        <span className="num"> · {target.detail}</span>
                        {!canOpen
                          ? " — this build has no adapter wired for it yet"
                          : target.surface === "ebaylive"
                            ? " — a new agent is created for this session"
                            : ""}
                      </>
                    ) : (
                      "we do not recognise that — paste a session link, a channel, or a thread"
                    )
                  ) : (
                    ""
                  )}
                </div>
              </div>
              <Button
                size="md"
                variant="primary"
                onClick={() => void start()}
                disabled={!target || !canOpen || starting}
              >
                {starting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <ArrowRight className="size-3.5" aria-hidden />
                )}
                {starting ? "attaching…" : "Start monitoring"}
              </Button>
            </div>

            {error ? (
              <Card tone="bad" className="mt-3 flex items-start gap-2 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
                <span className="text-[12.5px] text-text">{error}</span>
              </Card>
            ) : null}

            <div className="mt-3 flex flex-col gap-1.5">
              {model.next.prepared.map((p) => (
                <Card key={p.eventId} className="flex items-center gap-3 px-3 py-2.5">
                  <Badge tone="accent">prepared</Badge>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{p.title}</span>
                  <span className="num hidden shrink-0 text-[11.5px] text-text-muted sm:block">
                    {p.items} lots · {p.host || "unknown host"}
                  </span>
                  <Button size="sm" onClick={() => void start(p.eventId)}>
                    <Radio className="size-3" aria-hidden /> Monitor
                  </Button>
                </Card>
              ))}
              {model.next.discoverable.includes("ebaylive") ? (
                <Card className="flex items-center gap-3 px-3 py-2.5">
                  <Plus className="size-3.5 shrink-0 text-text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 text-[12.5px] text-text-secondary">
                    eBay Live is the one surface with a grid we can read — Discover lists what is on
                    air there and prepares a session before it starts.
                  </span>
                  <Button size="sm" onClick={() => setTab("discover")}>
                    Discover
                  </Button>
                </Card>
              ) : null}
            </div>
          </Band>

          <BehindBand
            reports={model.behind.reports}
            followups={model.behind.followups}
            loading={loading}
          />

          <SurfaceTable rows={model.surfaces} loading={loading} />
        </>
      )}
    </AppShell>
  );
}

function noop() {}

function subtitle(model: HomeModel, loading: boolean): string {
  if (loading) return "reading what needs you…";
  const parts = [
    `${model.now.live.length} on air`,
    `${model.now.drafts.total} draft${model.now.drafts.total === 1 ? "" : "s"} waiting`,
    `${model.surfaces.filter((s) => s.connected).length}/${model.surfaces.length} surfaces connected`,
  ];
  return parts.join(" · ");
}

// ── the band frame ──────────────────────────────────────────────────────────

/**
 * One band. The eyebrow is the phase; the heading is what it means.
 *
 * Both, because "NOW" alone is a label an operator has to learn and "What
 * needs you this minute" alone loses the three-phase spine the rest of the
 * product is organised by.
 */
export function Band({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="mb-9 first:mb-8">
      <div className="text-[11px] font-semibold tracking-[0.09em] text-text-faint uppercase">
        {eyebrow}
      </div>
      <SectionHeading className="mt-1" {...(hint ? { hint } : {})}>
        {title}
      </SectionHeading>
      {children}
    </section>
  );
}

// ── NOW ─────────────────────────────────────────────────────────────────────

export function NowBand({
  live,
  drafts,
  surfaces,
  loading,
  onOpen,
}: {
  live: HomeLiveSession[];
  drafts: { total: number; bySurface: { surface: SurfaceId; count: number }[] };
  surfaces: HomeSurfaceRow[];
  loading?: boolean;
  onOpen: (showId: string) => void;
}) {
  const empty = live.length === 0 && drafts.total === 0;
  return (
    <Band
      eyebrow="Now"
      title="What needs you this minute"
      hint="Sessions on air across every surface, and the replies waiting for a human to send. This band is the only one that is about the next sixty seconds."
    >
      <div className="mt-3 flex flex-col gap-1.5">
        {loading ? (
          <>
            <Skeleton className="h-[52px]" />
            <Skeleton className="h-[52px]" />
          </>
        ) : (
          <>
            {live.map((s) => (
              <LiveRow key={s.showId} session={s} onOpen={() => onOpen(s.showId)} />
            ))}

            {drafts.total > 0 ? (
              <Card className="flex items-center gap-3 px-3 py-2.5">
                <SquarePen className="size-3.5 shrink-0 text-text-muted" aria-hidden />
                <span className="min-w-0 flex-1 text-[13px]">
                  {drafts.total} draft{drafts.total === 1 ? "" : "s"} waiting for you to send
                  {drafts.bySurface.length ? (
                    <span className="ml-2 text-[11.5px] text-text-muted">
                      {drafts.bySurface
                        .map((d) => `${d.count} ${surfaceLabel(d.surface)}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                </span>
                <Link to="/drafts">
                  <Button size="sm" variant="primary">
                    Open Drafts <ArrowRight className="size-3" aria-hidden />
                  </Button>
                </Link>
              </Card>
            ) : null}

            {/* An empty NOW is a fact, not an absence. A band that vanishes when
                quiet teaches that the copilot is only there when it is busy. */}
            {empty ? (
              <Card className="flex items-center gap-3 px-4 py-3">
                <Check className="size-4 shrink-0 text-ok" aria-hidden />
                <span className="text-[12.5px] text-text-secondary">{watchingLine(surfaces)}</span>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </Band>
  );
}

function LiveRow({ session, onOpen }: { session: HomeLiveSession; onOpen: () => void }) {
  const now = useNow(1000);
  const elapsed = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000));
  const clock = [Math.floor(elapsed / 3600), Math.floor((elapsed % 3600) / 60), elapsed % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

  return (
    <Card className="flex items-center gap-3 px-3 py-2.5 transition-shadow duration-150 hover:z2">
      <Badge tone="bad" className="gap-1.5">
        <span aria-hidden className="anim-live size-1.5 rounded-full bg-bad" />
        LIVE
      </Badge>
      <span className="num shrink-0 text-[12px] text-text-secondary">{clock}</span>
      <span className="min-w-0 flex-1 truncate text-[13px]">
        {session.title}
        <span className="ml-2 text-[11.5px] text-text-muted">
          {surfaceLabel(session.surface)}
          {session.host ? ` · ${session.host}` : ""}
        </span>
      </span>
      {session.readOnly ? (
        <Badge title="A session you do not own: every write action is refused">read-only</Badge>
      ) : null}
      <span className="num hidden shrink-0 text-[11.5px] text-text-muted sm:block">
        {session.awaiting} awaiting
        {session.blocked ? ` · ${session.blocked} blocked` : ""}
      </span>
      <Button
        size="sm"
        variant={session.awaiting || session.blocked ? "primary" : "secondary"}
        onClick={onOpen}
      >
        Open console
      </Button>
    </Card>
  );
}

// ── BEHIND YOU ──────────────────────────────────────────────────────────────

export function BehindBand({
  reports,
  followups,
  loading,
}: {
  reports: HomeReport[];
  followups: { total: number; ready: number };
  loading?: boolean;
}) {
  return (
    <Band
      eyebrow="Behind you"
      title="What finished"
      hint="Each session leaves a report — what it answered, what it blocked, and the questions your knowledge could not ground. The follow-ups are the people who asked and did not buy."
    >
      <div className="mt-3 flex flex-col gap-1.5">
        {loading ? (
          <Skeleton className="h-[52px]" />
        ) : reports.length === 0 ? (
          <Card className="px-4 py-3 text-[12.5px] text-text-muted">
            Nothing has finished yet. A session's report is written when it ends, and the gaps it
            found are carried into the next one.
          </Card>
        ) : (
          reports.map((r) => (
            <Card key={r.showId} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="size-3.5 shrink-0 text-text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{r.title}</span>
                <span className="block truncate text-[11.5px] text-text-muted">
                  {surfaceLabel(r.surface)} · {timeAgo(r.endedAt)}
                  {r.topGap ? ` · top gap: “${r.topGap}”` : ""}
                </span>
              </span>
              <span className="num hidden shrink-0 text-[11.5px] text-text-muted sm:block">
                {r.answered} answered
                {r.blocked ? ` · ${r.blocked} blocked` : ""}
              </span>
              {r.hasReport === false ? (
                // The session ended and its report never generated. That is the
                // one an operator most wants to look at, so it is still a row —
                // it just has nothing to open yet.
                <Badge tone="warn" title="The session ended but its report never generated">
                  no report
                </Badge>
              ) : (
                <Link to="/reports/$showId" params={{ showId: r.showId }}>
                  <Button size="sm">Report</Button>
                </Link>
              )}
            </Card>
          ))
        )}

        {followups.total > 0 ? (
          <Card className="flex items-center gap-3 px-3 py-2.5">
            <SquarePen className="size-3.5 shrink-0 text-text-muted" aria-hidden />
            <span className="min-w-0 flex-1 text-[12.5px] text-text-secondary">
              {followups.total} follow-up{followups.total === 1 ? "" : "s"} from finished sessions
              {followups.ready ? ` · ${followups.ready} still to send` : " · all sent"}
            </span>
            <Link to="/drafts">
              <Button size="sm">Open Drafts</Button>
            </Link>
          </Card>
        ) : null}
      </div>
    </Band>
  );
}

// ── SURFACES ────────────────────────────────────────────────────────────────

/**
 * The phase table — the centre of the rethink.
 *
 * One row per surface: connected or not, what its Before still needs with the
 * place that finishes each step, what it does During, what it leaves After.
 * Expanding a row is how the product explains itself: the three phases with
 * this operator's own state in each, rather than a doc that says what the
 * phases are in general.
 *
 * A surface nobody has connected is a quiet invitation. Nothing here is red,
 * because nothing here is broken — not having a Twitch app is a choice.
 */
export function SurfaceTable({ rows, loading }: { rows: HomeSurfaceRow[]; loading?: boolean }) {
  const [open, setOpen] = useState<SurfaceId | null>(null);
  return (
    <Band
      eyebrow="Surfaces"
      title="Where the copilot can work"
      hint="Every surface passes through the same three phases; what fills them differs by tempo. A live surface has a session with a start and an end; an async one has a standing watch and a queue of drafts, and never has a session at all."
    >
      <Card className="mt-3 overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted">
                <th className="px-4 py-2 font-medium">Surface</th>
                <th className="px-3 py-2 font-medium">Before</th>
                <th className="px-3 py-2 font-medium">During</th>
                <th className="px-3 py-2 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td colSpan={4} className="px-4 py-2.5">
                        <Skeleton className="h-4" />
                      </td>
                    </tr>
                  ))
                : rows.map((r) => (
                    <SurfaceRow
                      key={r.id}
                      row={r}
                      open={open === r.id}
                      onToggle={() => setOpen((cur) => (cur === r.id ? null : r.id))}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Band>
  );
}

export function SurfaceRow({
  row,
  open,
  onToggle,
}: {
  row: HomeSurfaceRow;
  open: boolean;
  onToggle: () => void;
}) {
  const done = row.before.filter((s) => s.done).length;
  const next = row.before.find((s) => !s.done) ?? null;
  const missing = missingLine(row);

  return (
    <>
      <tr className="shadow-[0_1px_0_var(--hairline)] last:shadow-none">
        <td className="px-4 py-2.5 align-top">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${row.label} — before, during and after`}
            className="flex items-center gap-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ChevronRight
              className={cn("size-3.5 shrink-0 text-text-muted", open && "rotate-90")}
              aria-hidden
            />
            <span className="font-medium">{row.label}</span>
          </button>
          <div className="mt-1 ml-5 flex flex-wrap items-center gap-1.5">
            <Badge tone={row.connected ? "ok" : "neutral"}>
              {row.connected ? "connected" : "not connected"}
            </Badge>
            <Badge>{row.tempo === "async" ? "async" : "live"}</Badge>
            {!row.attachable && row.tempo === "live" ? (
              <Badge title="No adapter is wired for this surface in this build">
                no adapter yet
              </Badge>
            ) : null}
          </div>
        </td>
        <td className="px-3 py-2.5 align-top">
          {row.before.length === 0 ? (
            <span className="text-text-muted">nothing to set up</span>
          ) : (
            <>
              <span className="num text-text-secondary">
                {done}/{row.before.length} ready
              </span>
              <span className="mt-0.5 block text-[11.5px] text-text-muted">
                {next ? next.label : "everything this surface needs is in place"}
              </span>
            </>
          )}
        </td>
        <td className="px-3 py-2.5 align-top text-text-secondary">{row.during}</td>
        <td className="px-3 py-2.5 align-top text-text-secondary">{row.after}</td>
      </tr>

      {/* The invitation, never an error: a key nobody has set is not a fault,
          and the variable is named because we already know which one it is. */}
      {missing ? (
        <tr className="shadow-[0_1px_0_var(--hairline)]">
          <td colSpan={4} className="px-4 pb-2.5 text-[11.5px] text-text-muted">
            {missing}
          </td>
        </tr>
      ) : null}

      {open ? (
        <tr className="shadow-[0_1px_0_var(--hairline)]">
          <td colSpan={4} className="bg-elevated/60 px-4 py-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <Phase label="Before">
                {row.before.length === 0 ? (
                  <p className="text-[11.5px] text-text-muted">
                    Nothing to connect — this surface needs no keys and no consent.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {row.before.map((s) => (
                      <li key={s.label} className="flex items-start gap-2">
                        {s.done ? (
                          <Check className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />
                        ) : (
                          <Circle
                            className="mt-0.5 size-3.5 shrink-0 text-text-faint"
                            aria-hidden
                          />
                        )}
                        <span className="min-w-0 flex-1 text-[12px]">{s.label}</span>
                        {!s.done && s.href ? <StepLink step={s} /> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Phase>

              <Phase label="During">
                <p className="text-[12px]">{row.during}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-text-muted">
                  {row.tempo === "async"
                    ? "No session — a standing watch and a queue of drafts, always open."
                    : "A bounded session with a start and an end: answer, act, guards, one keystroke."}
                  {row.delivery === "draft-only" ? " We never post here; you do." : ""}
                </p>
                {row.rooms != null ? (
                  <p className="num mt-1 text-[11.5px] text-text-muted">
                    {row.rooms} room{row.rooms === 1 ? "" : "s"} watched
                  </p>
                ) : null}
              </Phase>

              <Phase label="After">
                <p className="text-[12px]">{row.after}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-text-muted">
                  {row.tempo === "async"
                    ? "What was asked this week, what we drafted, and what we skipped and why."
                    : "What it answered, what it blocked, what to fix, and the people who asked and did not buy."}
                </p>
              </Phase>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Phase({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="section-header mb-1.5">{label}</div>
      {children}
    </div>
  );
}

/**
 * A Before step's destination.
 *
 * The href is data — it arrives from the server on a surface row — so it is a
 * string where `Link` wants one of the registered route paths. The cast lives
 * here, once, rather than at every call site.
 */
function StepLink({ step }: { step: HomeSurfaceStep }) {
  return (
    <Link to={step.href as "/"} search={step.search ?? {}}>
      <Button size="xs">{step.cta ?? "Open"}</Button>
    </Link>
  );
}
