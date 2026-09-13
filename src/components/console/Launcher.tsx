import { useEffect, useMemo, useState } from "react";
import { Loader2, Radio, Package, ArrowRight, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { CatalogSummary, ShowSummary } from "@/lib/types";

/**
 * Session setup.
 *
 * The copilot needs two things before it is useful, and neither can be guessed:
 * WHICH inventory the seller is selling tonight, and WHICH live show to listen
 * to. eBay Live only renders the lot currently on the block, so without a
 * catalog the copilot can answer about exactly one item; and a catalog with no
 * show has nothing to listen to. So this screen asks for both, once, and starts
 * the session in a single call.
 */
export function Launcher({
  onStarted,
  existing,
  onResume,
}: {
  onStarted: (showId: string) => void;
  existing: ShowSummary[];
  onResume: (showId: string) => void;
}) {
  const [catalogs, setCatalogs] = useState<CatalogSummary[] | null>(null);
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .catalogs()
      .then((c) => {
        setCatalogs(c);
        setCatalogId((prev) => prev ?? c[0]?.id ?? null);
      })
      .catch((e) => setError(`Could not reach the copilot backend — ${e.message}`));
  }, []);

  const selected = useMemo(
    () => catalogs?.find((c) => c.id === catalogId) ?? null,
    [catalogs, catalogId],
  );

  const eventId = useMemo(() => {
    const t = url.trim();
    if (/^[A-Za-z0-9]{16}$/.test(t)) return t;
    return t.match(/\/ebaylive\/events\/([A-Za-z0-9]{10,})/)?.[1] ?? null;
  }, [url]);

  const canStart = Boolean(catalogId && eventId && !starting);

  async function start() {
    if (!canStart || !catalogId) return;
    setStarting(true);
    setError(null);
    try {
      const res = await api.startSession({ url: url.trim(), catalogId });
      onStarted(res.showId);
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  // Every show the server is holding, live or seeded. Filtering to `ebaylive`
  // stranded the demo show: it is the one the walkthrough, the stale-price
  // failure path and the whole write/rollback spike run on, and there was no
  // way into it from the UI without a real eBay stream on air.
  const liveShows = existing;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-3xl">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
            <Radio className="h-3.5 w-3.5" />
            SideStage
          </div>
          <h1 className="text-[22px] font-semibold leading-tight">Start a monitoring session</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick what you are selling, then the live show to listen to.
          </p>
        </header>

        {/* ── 1. catalog ─────────────────────────────────────────────── */}
        <section className="mb-6">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              1 · Catalog
            </span>
            <span className="text-xs text-muted-foreground">
              the inventory the copilot answers from
            </span>
          </div>

          {catalogs === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground border border-border rounded-md p-4">
              <Loader2 className="h-4 w-4 animate-spin" /> loading catalogs…
            </div>
          ) : catalogs.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-border rounded-md p-4">
              No catalogs found. Add one under <code className="text-foreground">fixtures/catalogs/</code>.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {catalogs.map((c) => {
                const on = c.id === catalogId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCatalogId(c.id)}
                    aria-pressed={on}
                    className={`text-left rounded-md border p-4 transition-colors ${
                      on
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-[13px] truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.seller.name} · {c.seller.handle}
                        </div>
                      </div>
                      <Package
                        className={`h-4 w-4 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`}
                      />
                    </div>
                    <div className="mt-3 text-[11px] font-mono tabular-nums text-muted-foreground">
                      {c.itemCount} items · {c.policyCount} policies
                    </div>
                    {c.sample.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {c.sample.slice(0, 3).map((s) => (
                          <li key={s.title} className="text-[11px] text-muted-foreground truncate">
                            {s.title}{" "}
                            <span className="font-mono tabular-nums">{formatMoney(s.priceCents)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 2. show ────────────────────────────────────────────────── */}
        <section className="mb-6">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              2 · Live show
            </span>
            <span className="text-xs text-muted-foreground">
              paste an eBay Live URL from{" "}
              <a
                href="https://www.ebay.com/ebaylive"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                ebay.com/ebaylive
              </a>
            </span>
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void start();
            }}
            placeholder="https://www.ebay.com/ebaylive/events/gmqxTwJPXDeKbGRE/stream"
            spellCheck={false}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm font-mono
                       placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="mt-1.5 h-4 text-[11px] font-mono text-muted-foreground">
            {url.trim() && (eventId ? `event ${eventId}` : "that does not look like an eBay Live show URL")}
          </div>
        </section>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={() => void start()}
          disabled={!canStart}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium
                     text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
        >
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {starting ? "attaching to the stream…" : "Start monitoring"}
        </button>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground max-w-xl">
          A show you do not own is monitored <strong className="text-foreground">read-only</strong>:
          the copilot drafts replies and proposes actions, but cannot write to the listing and never
          posts anything back to eBay.
        </p>

        {/* ── resume ─────────────────────────────────────────────────── */}
        {liveShows.length > 0 && (
          <section className="mt-10 border-t border-border pt-6">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3">
              Open a show
            </div>
            <ul className="space-y-1.5">
              {liveShows.map((s) => (
                <li key={s.showId}>
                  <button
                    onClick={() => onResume(s.showId)}
                    className="w-full text-left rounded-md border border-border px-3 py-2.5 text-sm
                               hover:border-muted-foreground/40 flex items-center justify-between gap-3"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{s.title}</span>
                      {s.source !== "ebaylive" && (
                        <span className="shrink-0 rounded-[3px] border border-border px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          demo
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-[11px] text-muted-foreground">
                      {s.viewers} viewers · {s.listings} listings
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
