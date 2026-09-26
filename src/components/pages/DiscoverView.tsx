/**
 * Discover — what is live, on every surface, that has anything to do with what
 * you sell.
 *
 * This replaces a tab labelled "Discover · eBay Live" that drew a grid of
 * whatever was on air on one platform. Two things were wrong with it.
 *
 * It read ONE of the five surfaces an operator can discover on, and the code
 * said so in a comment: "the
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
import { operatorMessage, operatorRefusal } from "@/lib/copy";
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
  interestSlug,
  isWatched,
  legacyDiscover,
  mergeRooms,
  roomSurfacesIn,
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
  SurfaceRoom,
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
  // The standing watch, as the SERVER holds it. This used to be a list of
  // keys this page had pressed, which a reload forgot — so the button came
  // back, the same subreddit could be added twice, and nothing on this screen
  // said whether the first one had taken.
  const [rooms, setRooms] = useState<SurfaceRoom[]>([]);
  const [refreshed, setRefreshed] = useState<{ at: Date; hits: number } | null>(null);

  const read = useCallback(async (refresh: boolean) => {
    // Home is read either way: it carries the sessions already prepared, which
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

    // Only the surfaces that actually offered a room to watch, and only after
    // we know which those are — reading every surface's watch list to draw a
    // grid of eBay shows would be four requests for nothing.
    // The empty state needs to tell "no listings yet" from "you removed every
    // term", and only the interests endpoint carries that count. Asked for
    // once, and only when the answer is both empty and silent about it.
    if (asked.view && asked.view.catalogs == null && asked.view.interests.length === 0) {
      const set = await api.interests().catch(() => null);
      if (set) setPayload((p) => (p ? { ...p, catalogs: set.catalogs } : p));
    }

    const needed = roomSurfacesIn(next.sources);
    if (needed.length === 0) {
      setRooms([]);
      return;
    }
    const lists = await Promise.all(needed.map((id) => api.rooms(id).catch(() => [])));
    setRooms(lists.flat());
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
      setError(operatorMessage(e));
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
        setPayload((p) => (p ? { ...p, ...saved } : p));
        await read(false);
      } catch (e) {
        setPayload((p) => (p ? { ...p, interests: before } : p));
        setError(operatorMessage(e));
      }
    },
    [interests, read],
  );

  const addInterest = useCallback(
    (term: string) => {
      const t = term.trim();
      if (!t) return;
      // The slug is the identity, so it is what an add is checked against:
      // "Pokémon" and "pokémon" are one term, not two chips.
      const slug = interestSlug(t);
      if (interests.some((i) => i.slug === slug)) return;
      // A provisional slug, replaced by the server's own when the write
      // answers. `weight: 0` is honest — nothing they typed has been counted
      // against their listings yet.
      void writeInterests([
        ...interests,
        { slug, term: t, origin: "own", pinned: false, weight: 0 },
      ]);
    },
    [interests, writeInterests],
  );

  const removeInterest = useCallback(
    (slug: string) => void writeInterests(interests.filter((i) => i.slug !== slug)),
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
          // Already prepared: the button under the finger says Monitor, and it
          // means it. Attaching is the next step and it is instant — the agent
          // and the catalog are the thing preparing built.
          if (preparedBy.has(hit.id)) {
            onAttach(hit.url || hit.id);
            return;
          }
          const legacy = hit.legacy;
          // The id is the only field the server needs; the rest is what the
          // legacy payload happens to carry, and it fills in only where the
          // server's own grid has nothing. Sending `sellerHandle: null` no
          // longer erases the handle a preparation is entirely built from.
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
          // The add answers with that surface's whole watch list, so the state
          // this screen draws is the state the server just confirmed — not an
          // assumption that the press worked.
          const list = await api.addRoom(hit.surface, hit.id);
          setRooms((prev) => mergeRooms(prev, hit.surface, list));
          return;
        }
        if (hit.action === "attach") {
          onAttach(hit.url || hit.id);
          return;
        }
        if (hit.url) window.open(hit.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        setError(operatorMessage(e));
      }
    },
    [onAttach, preparedBy, read],
  );

  const sources = payload?.sources ?? [];
  const shown = filter === "all" ? sources : sources.filter((s) => s.surface === filter);
  const total = hitsFor(sources, "all").length;
  const selected = filter === "all" ? null : sourceFor(sources, filter);

  // Interests are the question every source was asked. With none there is no
  // question — and the screen used to stop there, on all five surfaces at
  // once, under a heading promising what is live on what you sell. A seller
  // opening this on their first day read that as a broken product, and they
  // were not wrong: nothing on the page moved, and nothing said why.
  //
  // So the server now answers the only honest question left — what is simply
  // live — and marks it `unmatched`. This screen draws the explanation ABOVE
  // that list rather than instead of it. The rule the audits were about is
  // untouched: no card claims a reason, because none of them have one.
  const noInterests = mode === "index" && interests.length === 0;

  return (
    <div className="mb-10">
      <div className="flex flex-wrap items-baseline gap-2">
        {/* The heading is a claim about the list under it, so it cannot be a
            constant. With no terms nothing below was matched against anything,
            and "on what you sell" would be the single most misleading sentence
            on the page. */}
        <SectionHeading
          hint={
            noInterests
              ? "No terms yet, so nothing below has been matched against anything — it is what the surfaces we can read have on air. Add a term, or load a catalog, and every card starts naming the terms it matched."
              : "Every surface asked the same question: given what you sell, what is worth your attention right now — and why. The terms come from your catalogs; each card names the ones it matched."
          }
        >
          {noInterests ? "Live right now" : "Live right now, on what you sell"}
        </SectionHeading>
        <span className="ml-auto flex items-center gap-2">
          {busy ? (
            <span className="text-[12px] text-text-muted">asking every surface…</span>
          ) : refreshed ? (
            <span className="anim-fade text-[12px] text-text-muted" key={refreshed.at.getTime()}>
              {/* "12 matches" over a list matched against nothing is the same
                  false claim as the heading, in smaller type. */}
              {refreshed.hits}{" "}
              {noInterests
                ? `live · read `
                : `match${refreshed.hits === 1 ? "" : "es"} · read `}
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
          selected, and nothing about it is red: an unset key is not a fault.
          It borrows the SHAPE of the sentence Today's surface table uses and
          not its content, which is a different fact — Discover's gate is
          whatever it takes to READ a surface, and the table's is whatever it
          takes to attach to one. Twitch is the case that proves they must not
          be reconciled: app credentials let an operator browse it, and a
          connected account is what lets them attach, so both sentences are
          true at once and each belongs where it is. */}
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
        ) : (
          <>
            {/* The explanation goes ABOVE the list, not instead of it. An
                operator with no terms still gets to see what is on air and
                prepare one — that is the whole first-run path — and the one
                thing that must not happen is the grid being passed off as a
                match, which is what the note and the empty `why` on every
                card between them prevent. */}
            {noInterests ? <NoInterests catalogs={payload?.catalogs ?? null} /> : null}
            <SourceResults
              sources={shown}
              all={filter === "all"}
              preparedBy={preparedBy}
              preparing={home?.preparing ?? []}
              isWatched={(h) => isWatched(rooms, h)}
              onAct={(h) => void act(h)}
            />
          </>
        )}
      </div>

      {/* Prepared sessions that are no longer on any grid still matter: the agent
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
                    .catch((e) => setError(operatorMessage(e)))
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
  /** By slug: the identity, not the spelling. */
  onRemove: (slug: string) => void;
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
            key={i.slug}
            title={interestOrigin(i)}
            className="inline-flex items-center gap-1.5 rounded-sm bg-elevated py-[3px] pr-1 pl-2 text-[12px] leading-[14px] font-medium"
          >
            {i.term}
            {/* The weight IS the provenance, visibly: how many of their own
                listings carry the term. A term they typed weighs nothing yet,
                and a drawn zero would read as a term that found nothing. */}
            {i.origin === "derived" && i.weight > 0 ? (
              <span className="num text-[11px] text-text-muted">{i.weight}</span>
            ) : null}
            <button
              type="button"
              onClick={() => onRemove(i.slug)}
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
          <>These are terms you added; none were derived from your listings yet. </>
        ) : null}
        Removing a derived term keeps it removed: the next catalog import will not bring it back.
      </p>
    </section>
  );
}

/**
 * No interests, and therefore no honest question to ask any surface.
 *
 * Two different facts live here and they want different things from the
 * operator. No catalogs at all is "we do not know what you sell", and the
 * answer is Knowledge. Catalogs with no terms means every derived term was
 * removed — which is allowed, and stays removed — and the answer is the add
 * box, not another trip to a page that is already full.
 */
export function NoInterests({ catalogs }: { catalogs: number | null }) {
  const emptied = catalogs != null && catalogs > 0;
  return (
    <Card className="mb-4 border-dashed">
      <EmptyState
        icon={<Sparkles className="size-5" aria-hidden />}
        title={emptied ? "Every term has been removed." : "We do not know what you sell yet."}
        action={
          emptied ? null : (
            <Link to="/knowledge">
              <Button variant="primary">
                Open Knowledge <ArrowRight className="size-3" aria-hidden />
              </Button>
            </Link>
          )
        }
      >
        {emptied ? (
          <>
            Your {catalogs} catalog{catalogs === 1 ? "" : "s"} are loaded, and every term derived
            from them has been removed — which sticks: importing again will not bring them back. Add
            one above and Discover can go back to ranking what is below by how much of it you
            actually sell. Until then it is simply what is on air.
          </>
        ) : (
          <>
            Discovery asks every surface one question — given what you sell, what is worth your
            attention right now — and the terms come from your listings. Below is everything the
            surfaces we can read have on air, in no particular order and matched against nothing:
            none of it is a recommendation. You can prepare any of it. Load a catalog, or add a term
            above, and these become the shows that have something to do with you.
          </>
        )}
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
          title={operatorRefusal(s.unavailable?.reason) ?? s.method}
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
        {operatorRefusal(source.unavailable?.reason)}
        {line ? <span className="block text-text-muted">{line}</span> : null}
        {source.unavailable?.missing ? (
          <span className="block text-text-muted">
            That is what Discover needs to READ this surface. Attaching a session to one can need
            more — the surface table on Today carries that gate.
          </span>
        ) : null}
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
  isWatched,
  onAct,
}: {
  sources: DiscoverSourceResult[];
  all: boolean;
  preparedBy: Map<string, PreparedShow>;
  preparing: string[];
  isWatched: (hit: DiscoverHit) => boolean;
  onAct: (hit: DiscoverHit) => void;
}) {
  // In All, a surface with nothing to show is a line, not an empty block —
  // but it is always a line. The chips carry the same fact; this is the one
  // an operator reads without hunting for it.
  const withHits = sources.filter((s) => s.hits.length > 0);
  const quiet = all ? sources.filter((s) => s.hits.length === 0) : [];
  const blocks = all ? withHits : sources;

  if (all && withHits.length === 0) {
    // Nothing was asked of anything, so nothing failed to match: the silence
    // belongs to the surfaces, not to the operator's terms. Saying otherwise
    // would blame a catalog they have not loaded yet for an empty night.
    const unmatched = sources.every((s) => s.unmatched);
    return (
      <>
        <Card className="border-dashed">
          <EmptyState
            icon={<Radio className="size-5" aria-hidden />}
            title={
              unmatched
                ? "Nothing is live on any surface we can read right now."
                : "Nothing on any surface matches what you sell right now."
            }
          >
            {unmatched ? (
              <>
                Every surface was asked and none of them has anything on air this minute. Pasting a
                link still attaches, and the surfaces that need a key say so above.
              </>
            ) : (
              <>
                Every surface was asked; none of them has anything live against your terms this
                minute. Pasting a link still attaches, and sellers you follow are checked against
                these same sources.
              </>
            )}
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
                  {/* "12 matches" over a list that was matched against nothing
                      is the same false claim as the heading, per surface. */}
                  {s.hits.length}{" "}
                  {s.unmatched ? "live" : `match${s.hits.length === 1 ? "" : "es"}`}
                </span>
              )}
            </div>
            {/* One line, always: an operator should never have to guess
                whether they are looking at an API or a page scrape. */}
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-muted">{s.method}</p>
            {s.hits.length === 0 ? (
              s.unavailable ? null : (
                <p className="mt-2 text-[12.5px] text-text-muted">
                  {/* With no terms there is nothing for a room to fail to
                      match, so the absence is the surface's, not the
                      operator's. */}
                  {s.unmatched
                    ? "Nothing is live here right now."
                    : "Nothing live here matches your terms right now."}
                </p>
              )
            ) : (
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {s.hits.map((h) => (
                  <HitCard
                    key={`${h.surface}:${h.id}`}
                    hit={h}
                    // Both of these are read ONLY for the action that owns
                    // them. A Reddit thread and an eBay event can collide on
                    // an id, and asking "is this room watched" about a thread
                    // is asking the wrong table about the wrong thing.
                    prepared={h.action === "prepare" ? (preparedBy.get(h.id) ?? null) : null}
                    preparing={h.action === "prepare" && preparing.includes(h.id)}
                    watching={h.action === "watch-room" && isWatched(h)}
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
  // What "already done" means is a property of the ACTION, not of the surface.
  // An `open` hit is a link: it is never done, and a card that said "Watching"
  // over a Reddit thread would be claiming a watch nothing is holding.
  //
  // Preparing is the exception, because it is not an end. A prepared show has
  // an agent and a catalog and the only thing left to do with it is WATCH it —
  // so the card that said "Prepared" and went grey was a dead end at the exact
  // moment the operator had somewhere to go, with the way there parked in a
  // list further down the page. It offers the next step instead.
  const readyToWatch = hit.action === "prepare" && Boolean(prepared);
  const done = hit.action === "watch-room" ? Boolean(watching) : false;

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
          ) : readyToWatch ? (
            <Radio className="size-3" aria-hidden />
          ) : (
            <Sparkles className="size-3" aria-hidden />
          )}
          {preparing ? "Preparing…" : done ? "Watching" : readyToWatch ? "Monitor" : actionLabel(hit)}
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
          title="Deletes this session's agent and its catalog"
          className="grid size-[26px] shrink-0 place-items-center rounded-sm text-text-muted hover:bg-bad/10 hover:text-bad"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
      {/* Warnings are the honest half. A prepared session with an empty catalog
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
          {p.tags.length ? ` · ${p.tags.join(" · ")}` : ""}. Prices are re-read live when the
          session starts.
        </p>
      ) : null}
    </Card>
  );
}
