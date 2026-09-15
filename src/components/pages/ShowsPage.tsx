/**
 * Shows — what is on air, what is behind you, and how to attach to one.
 *
 * This replaces the launcher's "open a show" list, which could only ever see
 * shows the server still held in memory. A session that ended was gone from the
 * UI entirely, and the DELETE endpoint that removes a session and its Whissle
 * agent had existed for weeks with nothing calling it.
 *
 * Four views, and they are ranked by how reliably they get you into a show:
 * pasting a link always works, your own shows are a database read, following is
 * a handle matched against the live grid, and discovery IS the live grid — which
 * eBay refuses often. The page never presents them as equivalent.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Trash2,
  Tv,
  UserPlus,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DiscoveredShow, ShowRow, ShowSummary } from "@/lib/types";
import { AppShell, type Tab } from "@/components/app/AppShell";
import {
  Badge,
  BadgeButton,
  Button,
  Card,
  EmptyState,
  Key,
  SectionHeading,
  Skeleton,
} from "@/components/ui/kit";
import { DeleteShowDialog } from "@/components/app/DeleteShowDialog";
import { DiscoverView } from "./DiscoverView";
import { YourShowCard } from "./YourShowCard";

type View = "live" | "discover";

export function ShowsPage({ view = "live" }: { view?: View }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<View>(view);
  useEffect(() => setTab(view), [view]);
  const [rows, setRows] = useState<ShowRow[] | null>(null);
  const [watched, setWatched] = useState<ShowSummary[]>([]);
  const [url, setUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ShowRow | null>(null);

  const load = useCallback(async () => {
    const [r, w] = await Promise.all([
      api.reports(50).catch(() => [] as ShowRow[]),
      api.shows().catch(() => [] as ShowSummary[]),
    ]);
    setRows(r);
    setWatched(w);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A grid read takes the better part of a minute, and it is running in the
  // background rather than on this request. Poll until it lands so the rows
  // settle without the operator pressing anything.

  const live = useMemo(() => rows?.filter((r) => r.status === "live") ?? [], [rows]);
  const past = useMemo(() => rows?.filter((r) => r.status !== "live") ?? [], [rows]);

  const eventId = useMemo(() => {
    const t = url.trim();
    if (/^[A-Za-z0-9]{16}$/.test(t)) return t;
    return t.match(/\/ebaylive\/events\/([A-Za-z0-9]{10,})/)?.[1] ?? null;
  }, [url]);

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
          // A show that was never prepared has no catalog and no agent. Prepare
          // it here (about a minute: the seller's listings are read into a
          // catalog and a knowledge base) and attach once that lands.
          if (!/prepare the agent/i.test((e as Error).message)) throw e;
          const eventId = value.match(/\/ebaylive\/events\/([A-Za-z0-9]{10,})/)?.[1] ?? (/^[A-Za-z0-9]{16}$/.test(value) ? value : null);
          if (!eventId) throw e;
          setError("Preparing this show's agent and catalog first — about a minute…");
          await api.prepareShow({ eventId, title: `eBay Live ${eventId}`, host: "", sellerHandle: null, tags: [], thumbnailUrl: null });
          setError(null);
          res = await api.startSession({ url: value });
        }
        await navigate({ to: "/setup", search: { showId: res.showId } });
      } catch (e) {
        setError((e as Error).message);
        setStarting(false);
      }
    },
    [navigate, starting, url],
  );

  // Two views, not four. Live, Past and Following were three cuts of the one
  // list below — a show is a row here whether it is on air or behind you,
  // and a followed seller who goes live shows up on Discover.
  const tabs: Tab[] = [
    {
      label: "Your shows",
      count: rows?.length ?? null,
      active: tab === "live",
      onClick: () => setTab("live"),
    },
    { label: "Discover", active: tab === "discover", onClick: () => setTab("discover") },
  ];

  return (
    <AppShell
      section="shows"
      title="Home"
      subtitle={
        rows === null ? "reading your shows…" : `${live.length} on air · ${past.length} behind you`
      }
      tabs={tabs}
    >
      {tab === "live" ? (
        <>
          {/* the seller's own setup first: the PRD's user runs HER show ------ */}
          <YourShowCard />

          {/* attach ------------------------------------------------------- */}
          <SectionHeading hint="Paste the stream. The copilot builds the lineup from the show itself — every lot the host puts on screen becomes inventory it can answer from, versioned as the auction moves.">
            Monitor a live show
          </SectionHeading>

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
                aria-label="eBay Live show URL"
                placeholder="https://www.ebay.com/ebaylive/events/…/stream"
                className="num w-full rounded-sm bg-panel px-3 py-2.5 text-[13px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
              />
              <div className="num mt-1.5 h-4 text-[11px] text-text-muted">
                {url.trim()
                  ? eventId
                    ? `event ${eventId} — a new agent is created for this stream`
                    : "that does not look like an eBay Live show URL"
                  : ""}
              </div>
            </div>
            <Button
              size="md"
              variant="primary"
              onClick={() => void start()}
              disabled={!eventId || starting}
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

          {/* your shows --------------------------------------------------- */}
          <div className="mt-8 mb-10">
            <SectionHeading hint="Deleting a session deletes its Whissle agent and everything that agent learned. A session whose report failed to build is still listed — that is the one you most want to look at.">
              Your shows
            </SectionHeading>

            <div className="mt-3 flex flex-col gap-1.5">
              {rows === null ? (
                <>
                  <Skeleton className="h-[52px]" />
                  <Skeleton className="h-[52px]" />
                  <Skeleton className="h-[52px]" />
                </>
              ) : rows.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<Tv className="size-5" aria-hidden />}
                    title="Paste a live show to begin."
                    action={
                      <Button onClick={() => document.getElementById("stream-url")?.focus()}>
                        Paste a stream
                      </Button>
                    }
                  >
                    The copilot learns the lineup from the show itself. Nothing to install, and a
                    show you do not own is monitored read-only — nothing is ever written to a
                    listing.
                  </EmptyState>
                </Card>
              ) : (
                rows.map((r) => (
                  <ShowRowCard
                    key={r.showId}
                    row={r}
                    watched={watched.some((w) => w.showId === r.showId)}
                    onOpen={() =>
                      void api.activateShow(r.showId).then(() => navigate({ to: "/console" }))
                    }
                    onDelete={() => setDeleting(r)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      {tab === "discover" ? <DiscoverView onAttach={(url) => void start(url)} /> : null}

      {deleting ? (
        <DeleteShowDialog
          row={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            void load();
          }}
        />
      ) : null}
    </AppShell>
  );
}

function ShowRowCard({
  row,
  watched,
  onOpen,
  onDelete,
}: {
  row: ShowRow;
  watched: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const live = row.status === "live";
  const started = new Date(row.startedAt);
  return (
    <Card className="flex items-center gap-3 px-3 py-2.5 transition-shadow duration-150 hover:z2">
      {live ? (
        <Badge tone="bad" className="gap-1.5">
          <span aria-hidden className="anim-live size-1.5 rounded-full bg-bad" />
          LIVE
        </Badge>
      ) : row.hasReport ? (
        <Badge>ended</Badge>
      ) : (
        <Badge tone="warn" title="The session ended but its report never generated">
          no report
        </Badge>
      )}

      <span className="min-w-0 flex-1 truncate text-[13px]">
        {row.title}
        {!watched && live ? (
          <span className="ml-2 text-[11.5px] text-text-muted">not attached</span>
        ) : null}
      </span>

      <span className="num hidden shrink-0 text-[11.5px] text-text-muted sm:block">
        {live
          ? `${row.viewers} watching`
          : [
              started.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
              row.durationMin != null
                ? `${Math.floor(row.durationMin / 60)}h ${row.durationMin % 60}m`
                : null,
              row.answered != null ? `${row.answered} answered` : null,
              row.blocked ? `${row.blocked} blocked` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
      </span>

      {live ? (
        <Button size="sm" onClick={onOpen}>
          Open console
        </Button>
      ) : row.hasReport ? (
        <Link to="/reports/$showId" params={{ showId: row.showId }}>
          <Button size="sm">Report</Button>
        </Link>
      ) : (
        <Button size="sm" disabled title="No report was generated for this session">
          Report
        </Button>
      )}

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${row.title}`}
        title="Delete this session and its agent"
        className="grid size-[26px] shrink-0 place-items-center rounded-sm text-text-muted hover:bg-bad/10 hover:text-bad"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </Card>
  );
}
