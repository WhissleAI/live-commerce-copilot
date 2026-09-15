/**
 * What is on air, and getting ready for it before it starts.
 *
 * This replaces a tab called "Discover" that never worked and could not have.
 * It scraped the eBay Live grid anonymously; the grid streams client-side and
 * does not stream for anonymous visitors, so it found nothing — and a fallback
 * swept the page for anything shaped like an id, which found eBay's FILTER TAGS
 * and listed "Raw Cards", "$1 Starts" and "Coins & Bullion" as live shows with
 * zero viewers and ids that 404 on attach.
 *
 * With a signed-in session the same page has fifty real shows, with viewer
 * counts, sellers and eBay's own tags. That is what this renders — and the tags
 * are what make the useful part possible: a show can be PREPARED before it
 * starts, because the seller's handle plus their tags is enough to pull their
 * listings and stand up an agent that already knows the lineup.
 *
 * The empty states are the point of the file. "Nobody is on air", "sign in to
 * eBay first" and "we could not look" are three different facts that used to
 * render identically.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Radio,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DiscoveredShow, HomeView, PreparedShow } from "@/lib/types";
import { Badge, Button, Card, EmptyState, SectionHeading, Skeleton } from "@/components/ui/kit";

export function DiscoverView({ onAttach }: { onAttach: (url: string) => void }) {
  const [home, setHome] = useState<HomeView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async (refresh: boolean) => {
    const h = await api.home(refresh).catch(() => null);
    if (h) setHome(h);
  }, []);

  useEffect(() => {
    void read(false);
  }, [read]);

  // Poll only while something is being prepared — each one is a minute of
  // Browse calls and an agent creation.
  useEffect(() => {
    if (!home?.preparing.length) return;
    const t = setInterval(() => void read(false), 5000);
    return () => clearInterval(t);
  }, [home?.preparing.length, read]);

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

  async function prepare(s: DiscoveredShow) {
    setError(null);
    try {
      await api.prepareShow({
        eventId: s.eventId,
        title: s.title,
        host: s.host ?? "",
        sellerHandle: s.sellerHandle ?? null,
        tags: s.tags ?? [],
        thumbnailUrl: s.thumbnailUrl ?? null,
      });
      await read(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const reason = home?.discovery.reason;
  const preparedBy = new Map((home?.prepared ?? []).map((p) => [p.eventId, p]));

  return (
    <div className="mb-10">
      <div className="flex flex-wrap items-baseline gap-2">
        <SectionHeading hint="eBay Live needs a signed-in session to show anything at all — the grid streams client-side and streams nothing to an anonymous visitor. Preparing a show builds its catalog from the seller's listings and gives it its own agent, so attaching later is grounded from the first question.">
          Live on eBay right now
        </SectionHeading>
        <span className="ml-auto flex items-center gap-2">
          {home?.discovery.session.present ? (
            <Badge tone={home.discovery.session.stale ? "warn" : "ok"}>
              session {home.discovery.session.ageHours}h old
            </Badge>
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

      <div className="mt-3">
        {home === null ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-[188px]" />
            <Skeleton className="h-[188px]" />
            <Skeleton className="h-[188px]" />
          </div>
        ) : home.live.length === 0 ? (
          <NothingOnAir reason={reason} busy={busy} onRefresh={() => void refresh()} />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {home.live.map((s) => (
              <ShowCard
                key={s.eventId}
                show={s}
                prepared={preparedBy.get(s.eventId) ?? null}
                preparing={home.preparing.includes(s.eventId)}
                preparedBy={preparedBy}
                preparingIds={home.preparing}
                onPrepare={() => void prepare(s)}
                onPrepareOther={(u) => void prepare(u)}
                onAttach={() => onAttach(s.url)}
                onAttachUrl={onAttach}
                onDrop={() => void api.dropPrepared(s.eventId).then(() => read(false))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Prepared shows that are no longer on the grid still matter: the agent
          and catalog exist and are what make attaching instant next time. */}
      {home?.prepared.length ? (
        <div className="mt-8">
          <SectionHeading hint="Each of these has its own Whissle agent carrying its own catalog. Deleting one deletes that agent and everything in it.">
            Prepared
          </SectionHeading>
          <div className="mt-3 flex flex-col gap-1.5">
            {home.prepared.map((p) => (
              <PreparedRow
                key={p.eventId}
                p={p}
                onDrop={() => void api.dropPrepared(p.eventId).then(() => read(false))}
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

/** Three different facts, three different instructions. */
function NothingOnAir({
  reason,
  busy,
  onRefresh,
}: {
  reason: HomeView["discovery"]["reason"] | undefined;
  busy: boolean;
  onRefresh: () => void;
}) {
  if (reason === "no-session" || reason === "stale-session" || reason === "signed-out") {
    return (
      <Card className="border-dashed">
        <EmptyState
          icon={<Radio className="size-5" aria-hidden />}
          title={
            reason === "signed-out"
              ? "eBay has signed this session out."
              : reason === "stale-session"
                ? "The eBay session has gone stale."
                : "Sign in to eBay once to see what is live."
          }
        >
          {reason === "signed-out" && (
            <>
              eBay ends a session it sees from a new address — a session signed in on a laptop and
              replayed from a server, for one. The fix is to sign in from the address the server
              will use, and keep using it.{" "}
            </>
          )}
          eBay Live shows nothing at all to a signed-out visitor — not a short list, nothing. Run{" "}
          <code className="num rounded-sm bg-elevated px-1.5 py-0.5">npm run ebay:signin</code> in
          the server repo; a browser opens, you sign in yourself, and the session is saved. Nothing
          types a credential for you and none is stored.
        </EmptyState>
      </Card>
    );
  }
  return (
    <Card className="border-dashed">
      <EmptyState
        icon={<Radio className="size-5" aria-hidden />}
        title={
          reason === "blocked" ? "eBay refused the live grid from this network." : "Nobody is on air."
        }
        action={
          <Button onClick={onRefresh} disabled={busy}>
            <RefreshCw className="size-3.5" aria-hidden /> Try again
          </Button>
        }
      >
        {reason === "blocked"
          ? "eBay served the anonymous grid to a session it still reports as signed in. Pasting a show link still attaches and monitors from here; to browse and prepare shows, run the copilot on your own machine, where the session holds."
          : "Pasting a show link always works, and sellers you follow are checked against this same grid."}
      </EmptyState>
    </Card>
  );
}

function ShowCard({
  show,
  prepared,
  preparing,
  preparedBy,
  preparingIds,
  onPrepare,
  onPrepareOther,
  onAttach,
  onAttachUrl,
  onDrop,
}: {
  show: DiscoveredShow;
  prepared: PreparedShow | null;
  preparing: boolean;
  preparedBy: Map<string, PreparedShow>;
  preparingIds: string[];
  onPrepare: () => void;
  onPrepareOther: (s: DiscoveredShow) => void;
  onAttach: () => void;
  onAttachUrl: (url: string) => void;
  onDrop: () => void;
}) {
  const empty = prepared && prepared.items === 0;
  // This seller's other shows — the scheduled ones live only on their own
  // page, which is a page read, so it is fetched when asked and not before.
  const [schedule, setSchedule] = useState<DiscoveredShow[] | null | "loading">(null);
  const upcoming =
    schedule && schedule !== "loading"
      ? schedule.filter((x) => x.eventId !== show.eventId && x.status === "scheduled")
      : [];

  async function loadSchedule() {
    if (!show.sellerHandle || schedule === "loading") return;
    setSchedule("loading");
    const r = await api.sellerShows(show.sellerHandle).catch(() => null);
    setSchedule(r?.shows ?? []);
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative h-24 bg-elevated">
        {show.thumbnailUrl ? (
          <img src={show.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : null}
        <span className="absolute top-2 left-2">
          {show.status === "scheduled" ? (
            <Badge tone="accent">{show.startsAt ?? "scheduled"}</Badge>
          ) : (
            <Badge tone="bad" className="gap-1.5">
              <span aria-hidden className="anim-live size-1.5 rounded-full bg-bad" />
              LIVE
            </Badge>
          )}
        </span>
        {show.viewers ? (
          <span className="num absolute top-2 right-2 flex items-center gap-1 rounded-sm bg-panel/90 px-1.5 py-0.5 text-[11px]">
            <Users className="size-3" aria-hidden />
            {show.viewers}
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-[12.5px] leading-snug font-medium">{show.title}</p>
        <p className="num truncate text-[11.5px] text-text-muted">
          {show.host || show.sellerHandle || "—"}
        </p>
        {show.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {show.tags.slice(0, 3).map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        ) : null}

        {show.sellerHandle ? (
          <div className="text-[11.5px]">
            {schedule === null ? (
              <button
                type="button"
                onClick={() => void loadSchedule()}
                className="text-text-muted hover:text-text"
              >
                What else has {show.host || "this seller"} scheduled?
              </button>
            ) : schedule === "loading" ? (
              <span className="flex items-center gap-1.5 text-text-muted">
                <Loader2 className="size-3 animate-spin" aria-hidden /> reading their page…
              </span>
            ) : upcoming.length === 0 ? (
              <span className="text-text-muted">nothing else scheduled</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {upcoming.map((u) => {
                  const p = preparedBy.get(u.eventId) ?? null;
                  const busy = preparingIds.includes(u.eventId);
                  return (
                    <li
                      key={u.eventId}
                      className="flex items-center gap-2 rounded-sm bg-elevated px-2 py-1"
                    >
                      <Badge tone="accent">{u.startsAt ?? "scheduled"}</Badge>
                      <span className="min-w-0 flex-1 truncate">{u.title}</span>
                      {p ? (
                        <Badge tone={p.items ? "ok" : "warn"}>{p.items} lots</Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onPrepareOther(u)}
                          disabled={busy}
                          className="shrink-0 text-accent hover:underline disabled:opacity-50"
                        >
                          {busy ? "preparing…" : "prepare"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onAttachUrl(u.url)}
                        className="shrink-0 text-text-muted hover:text-text"
                      >
                        monitor
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {prepared ? (
          <div className="mt-auto">
            <p
              className={cn(
                "flex items-start gap-1.5 text-[11.5px]",
                empty ? "text-warn" : "text-ok",
              )}
            >
              {empty ? (
                <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              ) : (
                <CheckCircle2 className="mt-0.5 size-3 shrink-0" aria-hidden />
              )}
              {empty ? "agent ready, catalog empty" : `${prepared.items} lots in its own agent`}
            </p>
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" variant="primary" onClick={onAttach} className="flex-1">
                Monitor <ArrowRight className="size-3" aria-hidden />
              </Button>
              <button
                type="button"
                onClick={onDrop}
                aria-label="Drop this prepared show"
                title="Deletes its agent and catalog"
                className="grid size-7 shrink-0 place-items-center rounded-sm text-text-muted hover:bg-bad/10 hover:text-bad"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex gap-1.5">
            <Button size="sm" onClick={onPrepare} disabled={preparing} className="flex-1">
              {preparing ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3" aria-hidden />
              )}
              {preparing ? "Preparing…" : "Prepare agent"}
            </Button>
            <Button size="sm" onClick={onAttach}>
              Monitor
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

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
