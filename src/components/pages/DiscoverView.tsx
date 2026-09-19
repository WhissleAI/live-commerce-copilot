/**
 * Discover — what is live, on every surface, that has anything to do with what
 * you sell.
 *
 * This replaces a tab labelled "Discover · eBay Live" that drew a grid of
 * whatever was on air on one platform. Two things were wrong with it.
 *
 * It read ONE SURFACE OUT OF SIX, and the code said so in a comment: "the
 * others have discovery pages behind a login or an app review". That is true of
 * the scraped surfaces and wrong about the two with first-class public APIs —
 * Helix lists live streams against an app token with no user sign-in, and
 * `oauth.reddit.com` answers subreddit and thread search. Twitch and Reddit
 * were invisible here because nobody looked, and the way that failure survived
 * a year is that an unavailable surface was HIDDEN rather than drawn. So every
 * surface keeps its chip: quiet when it has no key, never absent, and it says
 * what it needs the moment it is selected.
 *
 * And a grid of what is live is a phone book. What an operator needs is what is
 * live that they can sell into, which we already hold in Knowledge — so the
 * spine of this screen is the interest terms derived from their catalogs, every
 * card carries the terms it matched as the reason it is in front of them, and
 * an account with no catalog gets a door to Knowledge rather than a grid of
 * strangers.
 *
 * The empty states carry over from the old screen because they were the best
 * thing in it: "nobody is on air", "sign in to eBay first" and "we could not
 * look" are three different facts and must never render identically.
 *
 * DEGRADING: `/api/discover` and this file deploy separately. When the endpoint
 * is not there, `legacyDiscover` builds the eBay-only grid out of `/api/home`
 * and the screen says so — the operator loses precision, not the tab.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { surfaceLabel } from "@/lib/surfaces";
import { missingLine } from "@/lib/home";
import {
  DISCOVER_SURFACES,
  actionHint,
  actionLabel,
  hitsFor,
  interestOrigin,
  legacyDiscover,
  sourceFor,
} from "@/lib/discover";
import type {
  DiscoverHit,
  DiscoverInterest,
  DiscoverSourceResult,
  DiscoverView as DiscoverPayload,
  HomeView,
  PreparedShow,
  SurfaceId,
} from "@/lib/types";
import { Badge, Button, Card, EmptyState, SectionHeading, Skeleton } from "@/components/ui/kit";

type Filter = SurfaceId | "all";

/** Which half of the world we are in: the index, or the grid it replaced. */
type Mode = "index" | "legacy";

export function DiscoverView({ onAttach }: { onAttach: (url: string) => void }) {
  const [payload, setPayload] = useState<DiscoverPayload | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [home, setHome] = useState<HomeView | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState<string[]>([]);
  const [refreshed, setRefreshed] = useState<{ at: Date; hits: number } | null>(null);

  const read = useCallback(async (refresh: boolean) => {
    // Home is read either way: it carries the shows already prepared, which
    // exist whether or not the index does, and it is the fallback's payload.
    const [asked, h] = await Promise.all([
      // `null` is the endpoint answering "I am not here" — the deploy-skew
      // case, and a normal answer. A THROW is a fault: it still degrades to
      // the old grid, but it is said out loud rather than swallowed.
      api
        .discover()
        .then((v) => ({ view: v, failed: null as Error | null }))
        .catch((e) => ({ view: null, failed: e as Error })),
      api.home(refresh).catch(() => null),
    ]);
    setHome(h);
    const next = asked.view ?? legacyDiscover(h);
    setPayload(next);
    setMode(asked.view ? "index" : "legacy");
    setRefreshed({ at: new Date(), hits: hitsFor(next.sources, "all").length });
    if (asked.failed) setError(asked.failed.message);
  }, []);

  useEffect(() => {
    void read(false);
  }, [read]);

  // Poll while something is being prepared — each one is a minute of Browse
  // calls and an agent creation — or while the server has a session and has
  // not read the eBay grid yet. Both resolve on their own.
  useEffect(() => {
    const pending = home?.discovery.reason === "pending";
    if (!home?.preparing.length && !pending) return;
    const t = setInterval(() => void read(false), pending ? 4000 : 5000);
    return () => clearInterval(t);
  }, [home?.preparing.length, home?.discovery.reason, read]);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      await read(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── interests, owned in place ─────────────────────────────────────────────
  //
  // Optimistic, because adding a term you sell is not a decision that deserves
  // a spinner. The write is the WHOLE set, so a derived term the operator
  // removes is removed rather than re-derived on the next catalog import; if
  // the server refuses, the set snaps back and says why.
  // Memoised because three callbacks close over it, and a fresh [] on every
  // render would rebuild all three on every keystroke in the add box.
  const interests = useMemo(() => payload?.interests ?? [], [payload]);

  const writeInterests = useCallback(
    async (next: DiscoverInterest[]) => {
      const before = interests;
      setPayload((p) => (p ? { ...p, interests: next } : p));
      setError(null);
      try {
        const saved = await api.saveInterests(next);
        setPayload((p) => (p ? { ...p, interests: saved } : p));
        await read(false);
      } catch (e) {
        setPayload((p) => (p ? { ...p, interests: before } : p));
        setError((e as Error).message);
      }
    },
    [interests, read],
  );

  const addInterest = useCallback(
    (term: string) => {
      const t = term.trim();
      if (!t) return;
      if (interests.some((i) => i.term.toLowerCase() === t.toLowerCase())) return;
      void writeInterests([
        ...interests,
        { term: t, origin: "own", listings: null, catalog: null, pinned: false },
      ]);
    },
    [interests, writeInterests],
  );

  const removeInterest = useCallback(
    (term: string) => void writeInterests(interests.filter((i) => i.term !== term)),
    [interests, writeInterests],
  );

  // ── the one action a card has ─────────────────────────────────────────────
  const preparedBy = useMemo(
    () => new Map((home?.prepared ?? []).map((p) => [p.eventId, p])),
    [home?.prepared],
  );

  const act = useCallback(
    async (hit: DiscoverHit) => {
      setError(null);
      try {
        if (hit.action === "prepare") {
          const legacy = hit.legacy;
          await api.prepareShow({
            eventId: hit.id,
            title: hit.title,
            host: hit.host ?? "",
            sellerHandle: legacy?.sellerHandle ?? null,
            tags: legacy?.tags ?? [],
            thumbnailUrl: legacy?.thumbnailUrl ?? null,
          });
          await read(false);
          return;
        }
        if (hit.action === "watch-room") {
          await api.addRoom(hit.surface, hit.id);
          setWatching((w) => [...w, `${hit.surface}:${hit.id}`]);
          return;
        }
        if (hit.action === "attach") {
          onAttach(hit.url || hit.id);
          return;
        }
        if (hit.url) window.open(hit.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [onAttach, read],
  );

  const sources = payload?.sources ?? [];
  const shown = filter === "all" ? sources : sources.filter((s) => s.surface === filter);
  const total = hitsFor(sources, "all").length;
  const selected = filter === "all" ? null : sourceFor(sources, filter);

  // Interests are the question every source was asked. With none, there is no
  // question — and a grid of strangers is exactly what this screen stopped
  // being. The index says so; the fallback never had interests to begin with.
  const noInterests = mode === "index" && interests.length === 0;

  return (
    <div className="mb-10">
      <div className="flex flex-wrap items-baseline gap-2">
        <SectionHeading hint="Every surface asked the same question: given what you sell, what is worth your attention right now — and why. The terms come from your catalogs; each card names the ones it matched.">
          Live right now, on what you sell
        </SectionHeading>
        <span className="ml-auto flex items-center gap-2">
          {busy ? (
            <span className="text-[12px] text-text-muted">asking every surface…</span>
          ) : refreshed ? (
            <span className="anim-fade text-[12px] text-text-muted" key={refreshed.at.getTime()}>
              {refreshed.hits} match{refreshed.hits === 1 ? "" : "es"} · read{" "}
              {refreshed.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
          <Button onClick={() => void refresh()} disabled={busy}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            Refresh
          </Button>
        </span>
      </div>

      {error ? (
        <Card tone="bad" className="mt-3 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
          <span className="text-[12.5px]">{error}</span>
        </Card>
      ) : null}

      {mode === "legacy" ? <LegacyNotice /> : null}

      {mode === "index" ? (
        <InterestRail
          interests={interests}
          onAdd={addInterest}
          onRemove={removeInterest}
          disabled={busy}
        />
      ) : null}

      <SurfaceChips sources={sources} selected={filter} onSelect={setFilter} total={total} />

      {/* A surface that needs a key says what it needs HERE, where it was
          selected — the same sentence the surface table on Today uses, because
          it is the same fact and an operator should not have to learn it
          twice. Nothing about it is red: an unset key is not a fault. */}
      {selected?.unavailable ? (
        <UnavailableNote surface={selected.surface} source={selected} />
      ) : null}

      <div className="mt-4">
        {mode === null ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-[150px]" />
            <Skeleton className="h-[150px]" />
            <Skeleton className="h-[150px]" />
          </div>
        ) : noInterests ? (
          <NoInterests />
        ) : (
          <SourceResults
            sources={shown}
            all={filter === "all"}
            preparedBy={preparedBy}
            preparing={home?.preparing ?? []}
            watching={watching}
            onAct={(h) => void act(h)}
          />
        )}
      </div>

      {/* Prepared shows that are no longer on any grid still matter: the agent
          and the catalog exist, and they are what make attaching instant. */}
      {home?.prepared.length ? (
        <div className="mt-8">
          <SectionHeading hint="Each of these has its own agent carrying its own catalog. Deleting one deletes that agent and everything in it.">
            Prepared
          </SectionHeading>
          <div className="mt-3 flex flex-col gap-1.5">
            {home.prepared.map((p) => (
              <PreparedRow
                key={p.eventId}
                p={p}
                onDrop={() =>
                  void api
                    .dropPrepared(p.eventId)
                    .then(() => read(false))
                    .catch((e) => setError((e as Error).message))
                }
                onAttach={() =>
                  onAttach(`https://www.ebay.com/ebaylive/events/${p.eventId}/stream`)
                }
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The fallback, admitted.
 *
 * Silently drawing one surface and calling it Discover is the bug this whole
 * change exists to fix, so the fallback must never impersonate the index.
 */
export function LegacyNotice() {
  return (
    <Card className="mt-3 flex items-start gap-2 px-3 py-2.5">
      <Radio className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden />
      <span className="text-[12.5px] text-text-secondary">
        This server answers the older, eBay-only discovery. You are seeing the eBay Live grid
        without your interests applied — the other surfaces and the matched terms arrive with the
        server that has them.
      </span>
    </Card>
  );
}

// ── interests ───────────────────────────────────────────────────────────────

/**
 * The terms the operator sells around, editable where they are read.
 *
 * Derived terms carry their count, which is the whole of "where did this come
 * from": a chip that says 24 came out of twenty-four of their own listings,
 * and one that says nothing is one they typed. The tooltip names the catalog.
 */
export function InterestRail({
  interests,
  onAdd,
  onRemove,
  disabled,
}: {
  interests: DiscoverInterest[];
  onAdd: (term: string) => void;
  onRemove: (term: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const derived = interests.filter((i) => i.origin === "derived").length;

  function submit() {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
  }

  return (
    <section aria-label="Interests" className="mt-4">
      <div className="section-header">What you sell</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {interests.map((i) => (
          <span
            key={i.term}
            title={interestOrigin(i)}
            className="inline-flex items-center gap-1.5 rounded-sm bg-elevated py-[3px] pr-1 pl-2 text-[12px] leading-[14px] font-medium"
          >
            {i.term}
            {/* The count IS the provenance, visibly. Null means the server did
                not count, and an invented zero would read as a dead term. */}
            {i.origin === "derived" && i.listings != null ? (
              <span className="num text-[11px] text-text-muted">{i.listings}</span>
            ) : null}
            <button
              type="button"
              onClick={() => onRemove(i.term)}
              disabled={disabled}
              aria-label={`Remove ${i.term}`}
              className="grid size-[18px] place-items-center rounded-xs text-text-muted hover:bg-hairline hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-45"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}

        <span className="inline-flex items-center gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            spellCheck={false}
            aria-label="Add an interest"
            placeholder="add a term"
            className="h-[22px] w-[124px] rounded-sm bg-panel px-2 text-[12px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
          />
          <Button size="xs" onClick={submit} disabled={!draft.trim() || disabled}>
            <Plus className="size-3" aria-hidden />
            Add
          </Button>
        </span>
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">
        {derived > 0 ? (
          <>
            {derived} of these came out of your catalogs — the number on a chip is how many of your
            listings carry the term. The rest you added.{" "}
          </>
        ) : interests.length > 0 ? (
          <>These are terms you added; none were derived from a catalog yet. </>
        ) : null}
        Removing a derived term keeps it removed: the next catalog import will not bring it back.
      </p>
    </section>
  );
}

/** No catalog, so no interests — and therefore nothing honest to discover. */
export function NoInterests() {
  return (
    <Card className="border-dashed">
      <EmptyState
        icon={<Sparkles className="size-5" aria-hidden />}
        title="We do not know what you sell yet."
        action={
          <Link to="/knowledge">
            <Button variant="primary">
              Open Knowledge <ArrowRight className="size-3" aria-hidden />
            </Button>
          </Link>
        }
      >
        Discovery asks every surface one question — given what you sell, what is worth your
        attention right now — and the terms come from your catalogs. Load your listings, or add a
        term above, and this fills in. A grid of whatever happens to be live would not be worth your
        attention.
      </EmptyState>
    </Card>
  );
}

// ── surface chips ───────────────────────────────────────────────────────────

/**
 * All, then one chip per surface — including every surface that cannot answer.
 *
 * Hiding an unavailable surface is exactly how Twitch and Reddit stayed
 * invisible while both had public APIs waiting. A chip with no key is quiet,
 * carries a key glyph rather than a colour, and explains itself when selected.
 */
export function SurfaceChips({
  sources,
  selected,
  onSelect,
  total,
}: {
  sources: DiscoverSourceResult[];
  selected: Filter;
  onSelect: (f: Filter) => void;
  total: number;
}) {
  const ordered = DISCOVER_SURFACES.map((id) => sourceFor(sources, id)).filter(
    (s): s is DiscoverSourceResult => s !== null,
  );
  return (
    <nav aria-label="Surfaces" className="mt-4 flex flex-wrap items-center gap-1.5">
      <Chip active={selected === "all"} onClick={() => onSelect("all")} count={total}>
        All
      </Chip>
      {ordered.map((s) => (
        <Chip
          key={s.surface}
          active={selected === s.surface}
          onClick={() => onSelect(s.surface)}
          count={s.unavailable ? null : s.hits.length}
          quiet={Boolean(s.unavailable)}
          needsKey={Boolean(s.unavailable?.missing)}
          title={s.unavailable?.reason ?? s.method}
        >
          {surfaceLabel(s.surface)}
        </Chip>
      ))}
    </nav>
  );
}

function Chip({
  active,
  quiet,
  needsKey,
  count,
  title,
  onClick,
  children,
}: {
  active: boolean;
  quiet?: boolean;
  needsKey?: boolean;
  count: number | null;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-[12px] font-medium whitespace-nowrap",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active
          ? "bg-accent text-accent-foreground"
          : quiet
            ? "bg-elevated text-text-muted hover:text-text-secondary"
            : "bg-elevated text-text hover:brightness-[0.95]",
      )}
    >
      {needsKey ? <KeyRound className="size-3 opacity-70" aria-hidden /> : null}
      {children}
      {count != null ? (
        <span className={cn("num text-[11px]", active ? "opacity-80" : "text-text-muted")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

/**
 * What this surface needs, in the words Today's surface table already uses.
 *
 * One fact, one sentence, one place it is written — `missingLine` — so the two
 * screens cannot drift into two different explanations of the same unset key.
 */
export function UnavailableNote({
  surface,
  source,
}: {
  surface: SurfaceId;
  source: DiscoverSourceResult;
}) {
  const line = missingLine({
    label: surfaceLabel(surface),
    missing: source.unavailable?.missing ?? null,
  });
  return (
    <Card className="mt-3 flex items-start gap-2 px-3 py-2.5">
      {source.unavailable?.missing ? (
        <KeyRound className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden />
      )}
      <span className="text-[12.5px] leading-relaxed text-text-secondary">
        {source.unavailable?.reason}
        {line ? <span className="block text-text-muted">{line}</span> : null}
      </span>
    </Card>
  );
}

// ── results ─────────────────────────────────────────────────────────────────

export function SourceResults({
  sources,
  all,
  preparedBy,
  preparing,
  watching,
  onAct,
}: {
  sources: DiscoverSourceResult[];
  all: boolean;
  preparedBy: Map<string, PreparedShow>;
  preparing: string[];
  watching: string[];
  onAct: (hit: DiscoverHit) => void;
}) {
  // In All, a surface with nothing to show is a line, not an empty block —
  // but it is always a line. The chips carry the same fact; this is the one
  // an operator reads without hunting for it.
  const withHits = sources.filter((s) => s.hits.length > 0);
  const quiet = all ? sources.filter((s) => s.hits.length === 0) : [];
  const blocks = all ? withHits : sources;

  if (all && withHits.length === 0) {
    return (
      <>
        <Card className="border-dashed">
          <EmptyState
            icon={<Radio className="size-5" aria-hidden />}
            title="Nothing on any surface matches what you sell right now."
          >
            Every surface was asked; none of them has anything live against your terms this minute.
            Pasting a link still attaches, and sellers you follow are checked against these same
            sources.
          </EmptyState>
        </Card>
        <QuietSources sources={quiet} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {blocks.map((s) => (
          <section key={s.surface} aria-label={surfaceLabel(s.surface)}>
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-[13px] font-medium">{surfaceLabel(s.surface)}</h3>
              {/* A surface that could not answer counted nothing, so it says
                  nothing. "0 matches" is a measurement nobody made. */}
              {s.unavailable ? null : (
                <span className="num text-[11.5px] text-text-muted">
                  {s.hits.length} match{s.hits.length === 1 ? "" : "es"}
                </span>
              )}
            </div>
            {/* One line, always: an operator should never have to guess
                whether they are looking at an API or a page scrape. */}
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-muted">{s.method}</p>
            {s.hits.length === 0 ? (
              s.unavailable ? null : (
                <p className="mt-2 text-[12.5px] text-text-muted">
                  Nothing live here matches your terms right now.
                </p>
              )
            ) : (
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {s.hits.map((h) => (
                  <HitCard
                    key={`${h.surface}:${h.id}`}
                    hit={h}
                    prepared={preparedBy.get(h.id) ?? null}
                    preparing={preparing.includes(h.id)}
                    watching={watching.includes(`${h.surface}:${h.id}`)}
                    onAct={() => onAct(h)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
      <QuietSources sources={quiet} />
    </>
  );
}

/** The surfaces with nothing to show, named rather than dropped. */
function QuietSources({ sources }: { sources: DiscoverSourceResult[] }) {
  if (sources.length === 0) return null;
  const silent = sources.filter((s) => !s.unavailable).map((s) => surfaceLabel(s.surface));
  const closed = sources.filter((s) => s.unavailable);
  return (
    <p className="mt-6 text-[11.5px] leading-relaxed text-text-muted">
      {silent.length ? <>Nothing matched on {silent.join(", ")}. </> : null}
      {closed.length ? (
        <>
          Not answering:{" "}
          {closed
            .map(
              (s) =>
                `${surfaceLabel(s.surface)}${s.unavailable?.missing ? ` (${s.unavailable.missing})` : ""}`,
            )
            .join(", ")}
          . Select one above to see what it needs.
        </>
      ) : null}
    </p>
  );
}

/**
 * One hit, on any surface.
 *
 * Four rules hold here and each of them was broken by the grid this replaces:
 * the surface is named on the card, `null` viewers and `null` host draw NOTHING
 * (a zero is a measurement nobody made), the matched terms are shown as the
 * reason this card exists, and there is exactly one action — the one this
 * surface actually supports.
 */
export function HitCard({
  hit,
  prepared,
  preparing,
  watching,
  onAct,
}: {
  hit: DiscoverHit;
  prepared?: PreparedShow | null;
  preparing?: boolean;
  watching?: boolean;
  onAct: () => void;
}) {
  const empty = prepared && prepared.items === 0;
  const done = hit.action === "prepare" ? Boolean(prepared) : watching;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-1.5">
        <Badge>{surfaceLabel(hit.surface)}</Badge>
        {hit.liveNow ? (
          <Badge tone="bad" className="gap-1.5">
            <span aria-hidden className="anim-live size-1.5 rounded-full bg-bad" />
            LIVE
          </Badge>
        ) : null}
        {/* Null viewers draw nothing at all. The old grid rendered a missing
            count as "0", on fifty cards, which reads as a dead platform. */}
        {hit.viewers != null ? (
          <span className="num ml-auto flex items-center gap-1 text-[11px] text-text-muted">
            <Users className="size-3" aria-hidden />
            {hit.viewers}
          </span>
        ) : null}
      </div>

      <p className="line-clamp-2 text-[12.5px] leading-snug font-medium">{hit.title}</p>
      {hit.host ? <p className="num truncate text-[11.5px] text-text-muted">{hit.host}</p> : null}

      {/* The reason it is in front of you, in the operator's own words. */}
      {hit.why.length ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-text-muted">matched</span>
          {hit.why.map((w) => (
            <Badge key={`${w.term}:${w.where}`} tone="accent" title={`matched in the ${w.where}`}>
              {w.term}
            </Badge>
          ))}
        </div>
      ) : null}

      {prepared ? (
        <p
          className={cn("flex items-start gap-1.5 text-[11.5px]", empty ? "text-warn" : "text-ok")}
        >
          {empty ? (
            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-3 shrink-0" aria-hidden />
          )}
          {empty ? "agent ready, catalog empty" : `${prepared.items} lots in its own agent`}
          {prepared.catalogId && !empty ? (
            <Link
              to="/knowledge"
              search={{ id: prepared.catalogId }}
              className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
            >
              Open knowledge <ArrowRight className="size-3" aria-hidden />
            </Link>
          ) : null}
        </p>
      ) : null}

      <div className="mt-auto flex gap-1.5 pt-1">
        <Button
          size="sm"
          variant={done ? "secondary" : "primary"}
          onClick={onAct}
          disabled={preparing || done}
          title={actionHint(hit)}
          className="flex-1"
        >
          {preparing ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : done ? (
            <Check className="size-3" aria-hidden />
          ) : (
            <Sparkles className="size-3" aria-hidden />
          )}
          {preparing
            ? "Preparing…"
            : done
              ? hit.action === "prepare"
                ? "Prepared"
                : "Watching"
              : actionLabel(hit)}
        </Button>
      </div>
    </Card>
  );
}

// ── prepared ────────────────────────────────────────────────────────────────

function PreparedRow({
  p,
  onDrop,
  onAttach,
}: {
  p: PreparedShow;
  onDrop: () => void;
  onAttach: () => void;
}) {
  return (
    <Card className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Badge tone={p.items ? "ok" : "warn"}>{p.items} lots</Badge>
        <span className="min-w-0 flex-1 truncate text-[13px]">{p.title}</span>
        <span className="num hidden shrink-0 text-[11.5px] text-text-muted sm:block">
          {p.agentId ? `agent ${p.agentId.slice(0, 8)}` : "no agent"}
        </span>
        <Button size="sm" onClick={onAttach}>
          Monitor
        </Button>
        <button
          type="button"
          onClick={onDrop}
          aria-label={`Drop ${p.title}`}
          title="Deletes this show's agent and its catalog"
          className="grid size-[26px] shrink-0 place-items-center rounded-sm text-text-muted hover:bg-bad/10 hover:text-bad"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
      {/* Warnings are the honest half. A prepared show with an empty catalog
          must say why, or it looks identical to one that worked. */}
      {p.warnings.map((w) => (
        <p
          key={w}
          className="flex items-start gap-1.5 pl-1 text-[11.5px] leading-relaxed text-warn"
        >
          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
          {w}
        </p>
      ))}
      {p.warnings.length === 0 && p.items > 0 ? (
        <p className="pl-1 text-[11.5px] text-text-muted">
          Built from {p.sellerHandle ? `@${p.sellerHandle}` : "this seller"}&apos;s active listings
          {p.tags.length ? ` · ${p.tags.join(" · ")}` : ""}. Prices are re-read live when the show
          starts.
        </p>
      ) : null}
    </Card>
  );
}
