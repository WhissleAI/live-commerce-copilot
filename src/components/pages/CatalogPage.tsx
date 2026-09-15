/**
 * Catalog — what you are selling, priced against what it is actually worth.
 *
 * Market data used to exist only inside the research palette: one lot, only
 * when someone asked, gone when the palette closed. That is the wrong shape for
 * the job it serves. A seller prepares before a show — they want the whole
 * lineup, with the market beside it, while there is still time to change a
 * price.
 *
 * The one thing this page refuses to do is show a delta without showing the
 * match behind it. A lot that reads "+661% above market" because a Travis Scott
 * colorway matched three generic Air Jordan 1s is not overpriced; it is
 * unmatched, and those are opposite instructions. So every row carries what the
 * comparison actually found — the query, the sample count, the spread — and a
 * thin match is labelled rather than quietly averaged into a number.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { CatalogMarket, CatalogSummary, EbayResult, MarketRow } from "@/lib/types";
import { AppShell, type Tab } from "@/components/app/AppShell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionHeading,
  Skeleton,
  StatTile,
} from "@/components/ui/kit";

type View = "lineup" | "search";

export function CatalogPage({ initialId }: { initialId?: string | undefined } = {}) {
  const [catalogs, setCatalogs] = useState<CatalogSummary[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(initialId ?? null);
  const [market, setMarket] = useState<CatalogMarket | null>(null);
  const [view, setView] = useState<View>("lineup");

  useEffect(() => {
    void api
      .catalogs()
      .then((c) => {
        setCatalogs(c);
        // A deep link to a catalog that no longer exists falls back to the first.
        setChosen((cur) => (cur && c.some((x) => x.id === cur) ? cur : (c[0]?.id ?? null)));
      })
      .catch(() => setCatalogs([]));
  }, []);

  const current = useMemo(() => catalogs?.find((c) => c.id === chosen) ?? null, [catalogs, chosen]);

  const read = useCallback(
    async (warm: boolean) => {
      if (!chosen) return;
      const m = await api.catalogMarket(chosen, warm).catch(() => null);
      if (m) setMarket(m);
    },
    [chosen],
  );

  // Warm on arrival, then poll only while something is still being looked up.
  useEffect(() => {
    setMarket(null);
    void read(true);
  }, [read]);
  useEffect(() => {
    if (!market?.pending) return;
    const t = setInterval(() => void read(false), 4000);
    return () => clearInterval(t);
  }, [market?.pending, read]);

  const rows = market?.rows ?? [];
  const priced = rows.filter((r) => r.market && r.market.samples > 0);
  const stock = rows.reduce((a, r) => a + r.qty, 0);
  const listed = rows.reduce((a, r) => a + r.priceCents * r.qty, 0);
  const sold = priced.filter((r) => r.market!.basis === "sold").length;

  const tabs: Tab[] = [
    {
      label: "Lineup",
      count: rows.length,
      active: view === "lineup",
      onClick: () => setView("lineup"),
    },
    { label: "Search eBay", active: view === "search", onClick: () => setView("search") },
  ];

  return (
    <AppShell
      section="catalog"
      title="Catalog"
      subtitle={
        market === null
          ? "reading your inventory…"
          : market.pending
            ? `${rows.length} lots · checking ${market.pending} against eBay…`
            : `${rows.length} lots · ${priced.length} matched on eBay`
      }
      tabs={tabs}
      actions={
        <>
          {catalogs && catalogs.length > 1 ? (
            <select
              value={chosen ?? ""}
              onChange={(e) => setChosen(e.target.value)}
              aria-label="Catalog"
              className="rounded-sm bg-elevated px-2 py-1.5 text-[12.5px] focus:outline-none focus:ring-[1.5px] focus:ring-accent"
            >
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {catalogLabel(c)}
                </option>
              ))}
            </select>
          ) : null}
          <Button onClick={() => void read(true)} disabled={Boolean(market?.pending)}>
            {market?.pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            Re-check
          </Button>
        </>
      }
    >
      {view === "search" ? <EbaySearch /> : null}
      {view === "lineup" && current ? <Provenance catalog={current} /> : null}

      {view === "lineup" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile
              label="Lots"
              value={market === null ? "—" : String(rows.length)}
              hint={`${stock} in stock across them`}
            />
            <StatTile
              label="Listed value"
              value={market === null ? "—" : formatMoney(listed)}
              hint="your prices × quantity on hand"
            />
            <StatTile
              label="Matched on eBay"
              value={market === null ? "—" : `${priced.length}/${rows.length}`}
              hint={
                sold
                  ? `${sold} against completed sales, the rest against active listings`
                  : "against active listings — no completed sales matched"
              }
            />
            <StatTile
              label="Priced above market"
              value={
                market === null ? "—" : String(priced.filter((r) => (r.deltaPct ?? 0) > 15).length)
              }
              hint="more than 15% over the median — check the match before the price"
            />
          </div>

          {market?.note && !market.error ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">{market.note}</p>
          ) : null}
          {market?.error ? (
            <Card tone="bad" className="mt-3 flex items-start gap-2 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
              <span className="text-[12.5px]">{market.error}</span>
            </Card>
          ) : null}

          <div className="mt-8">
            <SectionHeading hint="Every row says what it was matched against, because a delta is only as good as the comparison behind it — three generic results for a rare colorway is an unmatched lot, not an overpriced one.">
              The lineup, against the market
            </SectionHeading>

            <Card className="mt-3 overflow-hidden">
              {market === null ? (
                <div className="flex flex-col gap-2 p-4">
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4" />
                </div>
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={<PackageSearch className="size-5" aria-hidden />}
                  title="This catalog has no items."
                >
                  Import your eBay listings from Settings → eBay, or add a catalog file.
                </EmptyState>
              ) : (
                <div className="scroll-thin overflow-x-auto">
                  <table className="w-full min-w-[720px] text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11px] text-text-muted">
                        <th className="px-4 py-2 font-medium">Lot</th>
                        <th className="px-3 py-2 text-right font-medium">Your price</th>
                        <th className="px-3 py-2 text-right font-medium">Market</th>
                        <th className="px-3 py-2 text-right font-medium">Delta</th>
                        <th className="px-4 py-2 font-medium">Matched on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <MarketRowLine key={r.sku} row={r} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

function MarketRowLine({ row }: { row: MarketRow }) {
  const m = row.market;
  const matched = m && m.samples > 0;
  // Three or fewer comparables is a hint, not a market. Saying so is the
  // difference between a seller trusting a delta and checking it.
  const thin = matched && m.samples <= 3;

  return (
    <tr className="shadow-[0_1px_0_var(--hairline)] last:shadow-none">
      <td className="max-w-[280px] px-4 py-2.5">
        <div className="truncate">{row.title}</div>
        <div className="num text-[11px] text-text-muted">
          {row.sku} · {row.qty} in stock
        </div>
      </td>
      <td className="num px-3 py-2.5 text-right">{formatMoney(row.priceCents)}</td>
      <td className="num px-3 py-2.5 text-right">
        {row.checking ? (
          <span className="text-[11.5px] text-text-muted">checking…</span>
        ) : matched ? (
          <>
            <div>{formatMoney(m.medianCents)}</div>
            <div className="text-[11px] text-text-muted">
              {formatMoney(m.lowCents)}–{formatMoney(m.highCents)}
            </div>
          </>
        ) : (
          <span className="text-[11.5px] text-text-muted">no match</span>
        )}
      </td>
      <td className="num px-3 py-2.5 text-right">
        {matched && row.deltaPct != null ? (
          <span
            className={cn(
              Math.abs(row.deltaPct) <= 10
                ? "text-ok"
                : Math.abs(row.deltaPct) <= 30
                  ? "text-warn"
                  : "text-bad",
            )}
          >
            {row.deltaPct > 0 ? "+" : ""}
            {row.deltaPct}%
          </span>
        ) : (
          <span className="text-text-faint">—</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {matched ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={m.basis === "sold" ? "ok" : "neutral"}>
              {m.basis === "sold" ? "sold" : "asking"}
            </Badge>
            <span className="num text-[11.5px] text-text-muted">
              {m.samples} × “{m.query}”
            </span>
            {thin ? (
              <Badge
                tone="warn"
                title="Too few comparables to call this a market — treat the delta as a hint"
              >
                thin
              </Badge>
            ) : null}
          </span>
        ) : m ? (
          <span className="num text-[11.5px] text-text-muted">nothing matched “{m.query}”</span>
        ) : (
          <span className="text-[11.5px] text-text-muted">queued</span>
        )}
      </td>
    </tr>
  );
}

/** "Kicks by Rae · @kicksbyrae" — and what kind of catalog it is, in one line. */
function catalogLabel(c: CatalogSummary): string {
  const who = c.seller?.handle ? ` · @${c.seller.handle.replace(/^@+/, "")}` : "";
  const kind =
    c.origin?.kind === "prepared"
      ? " · prepared show"
      : c.origin?.kind === "imported"
        ? " · your listings"
        : c.origin?.kind === "seed"
          ? " · demo"
          : "";
  return `${c.name}${who}${kind}`;
}

/**
 * Where this lineup came from, and the way back. A catalog named after an
 * event id told nobody which show it was; this says the show, the host, when
 * it was prepared, and links to the show on Discover.
 */
function Provenance({ catalog }: { catalog: CatalogSummary }) {
  const o = catalog.origin;
  if (!o) return null;
  if (o.kind === "prepared") {
    const who = o.sellerHandle ? `@${o.sellerHandle.replace(/^@+/, "")}` : o.host;
    return (
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-secondary">
        <Badge tone="neutral">prepared show</Badge>
        <span>
          Lineup of <span className="font-medium text-text">{o.showTitle}</span>
          {who ? <> by {who}</> : null}
          {o.preparedAt ? (
            <>
              {" "}
              · prepared{" "}
              {new Date(o.preparedAt).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </>
          ) : (
            <> · its preparation is no longer on Discover; the lineup stays until you delete it</>
          )}
        </span>
        <Link
          to="/"
          search={{ view: "discover" }}
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Open on Discover <ArrowRight className="size-3" aria-hidden />
        </Link>
        <a
          href={`https://www.ebay.com/ebaylive/events/${o.eventId}/stream`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-text-muted hover:text-text"
        >
          The show on eBay <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    );
  }
  if (o.kind === "imported") {
    return (
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-secondary">
        <Badge tone="neutral">your listings</Badge>
        <span>Imported from the eBay account @{o.handle.replace(/^@+/, "")}.</span>
        <Link
          to="/settings"
          search={{ tab: "ebay" }}
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Re-import on Settings <ArrowRight className="size-3" aria-hidden />
        </Link>
      </p>
    );
  }
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-2 text-[12.5px] text-text-secondary">
      <Badge tone="neutral">demo</Badge>
      <span>
        A seeded catalog that ships with SideStage — real inventory shapes, not a real seller.
      </span>
    </p>
  );
}

/**
 * Search eBay directly.
 *
 * The lineup answers "what is my stock worth". This answers the other question
 * a seller asks while a lot is on the block — "what else is out there" — and it
 * is the one place in the product that waits on eBay, because a person typed a
 * query and pressed enter.
 */
function EbaySearch() {
  const [q, setQ] = useState("");
  const [sold, setSold] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    basis: "sold" | "asking";
    query: string;
    rows: EbayResult[];
  } | null>(null);

  const median = useMemo(() => {
    const p = (result?.rows ?? []).map((r) => r.priceCents).sort((a, b) => a - b);
    if (!p.length) return 0;
    return p.length % 2
      ? p[(p.length - 1) / 2]!
      : Math.round((p[p.length / 2 - 1]! + p[p.length / 2]!) / 2);
  }, [result]);

  async function run() {
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.ebaySearch(q.trim(), { sold, limit: 20 }));
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeading hint="Completed sales are what things went for; active listings are what sellers hope for. They price a lot differently, so this asks you which one you want rather than blending them.">
        Search eBay
      </SectionHeading>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          spellCheck={false}
          aria-label="Search eBay"
          placeholder="Air Jordan 1 Chicago"
          className="min-w-[240px] flex-1 rounded-sm bg-panel px-3 py-2.5 text-[13px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
        />
        <span className="flex items-center gap-1.5">
          <Button
            variant={sold ? "primary" : "secondary"}
            size="md"
            onClick={() => setSold(true)}
            title="Completed sales in the last 90 days"
          >
            Sold
          </Button>
          <Button variant={sold ? "secondary" : "primary"} size="md" onClick={() => setSold(false)}>
            Active
          </Button>
        </span>
        <Button size="md" onClick={() => void run()} disabled={!q.trim() || busy}>
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Search className="size-3.5" aria-hidden />
          )}
          Search
        </Button>
      </div>

      {error ? (
        <Card tone="bad" className="mt-3 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
          <span className="text-[12.5px]">{error}</span>
        </Card>
      ) : null}

      {result ? (
        <Card className="mt-4 overflow-hidden">
          <div className="flex flex-wrap items-baseline gap-2 px-4 py-3 shadow-[0_1px_0_var(--hairline)]">
            <span className="num text-[20px] leading-none">
              {result.rows.length ? formatMoney(median) : "—"}
            </span>
            <span className="text-[12px] text-text-muted">
              {result.rows.length
                ? `median across ${result.rows.length} ${result.basis === "sold" ? "completed sales" : "active listings"}`
                : `nothing ${result.basis === "sold" ? "sold" : "listed"} matched “${result.query}”`}
            </span>
            <Badge className="ml-auto" tone={result.basis === "sold" ? "ok" : "neutral"}>
              {result.basis === "sold" ? "sold prices" : "asking prices"}
            </Badge>
          </div>
          <ul>
            {result.rows.map((r) => (
              <li
                key={r.itemId}
                className="flex items-center gap-3 px-4 py-2 shadow-[0_1px_0_var(--hairline)] last:shadow-none"
              >
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{r.title}</span>
                {r.condition ? (
                  <span className="hidden shrink-0 text-[11.5px] text-text-muted sm:block">
                    {r.condition}
                  </span>
                ) : null}
                {r.soldAt ? (
                  <span className="num hidden shrink-0 text-[11.5px] text-text-muted sm:block">
                    {new Date(r.soldAt).toISOString().slice(0, 10)}
                  </span>
                ) : null}
                <span className="num shrink-0 text-[12.5px]">{formatMoney(r.priceCents)}</span>
                {r.itemWebUrl ? (
                  <a
                    href={r.itemWebUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label="Open on eBay"
                    className="shrink-0 text-text-muted hover:text-text"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
