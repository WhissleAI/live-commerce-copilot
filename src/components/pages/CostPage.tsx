/**
 * Cost — the money, with a history.
 *
 * The old cost rail could answer "what is this show costing right now" and
 * nothing at all about last week, because the meter and the wallet-delta window
 * both lived in process memory. Every finished session now writes a row, and
 * this page reads them.
 *
 * This page is YOURS: the shows this account ran, and what they cost this
 * account. The Whissle key behind the backend is shared by every seller on the
 * host, so the workspace wallet is not shown here — it is not your balance.
 *
 * Two kinds of number, kept visually apart because conflating them is how a
 * dashboard ends up quoting a token count as a price:
 *   · CALLS are exact — this app makes them and counts them itself.
 *   · DOLLARS are priced per show on one of two bases, and each row says which:
 *     the wallet's movement while the show ran alone (its real spend), or the
 *     show's calls at the average cost per call measured from shows that did.
 */

import { useCallback, useEffect, useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { BudgetState, CostSnapshot } from "@/lib/types";
import { AppShell, type Tab } from "@/components/app/AppShell";
import {
  BadgeButton,
  Card,
  EmptyState,
  SectionHeading,
  Skeleton,
  StatTile,
} from "@/components/ui/kit";

const usd = (n: number | null | undefined, dp = 2) =>
  n == null ? "—" : `$${n.toFixed(n !== 0 && Math.abs(n) < 0.01 ? 4 : dp)}`;

const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : String(Math.round(n));

const DOOR_LABEL: Record<string, string> = {
  chat_turn: "Buyer replies",
  utility_turn: "Show context",
  voice_start: "Host audio",
  kb_upload: "Catalog sync",
  visual_read: "Camera reads",
  billing: "This page",
};

const BASIS_TITLE: Record<"wallet-exclusive" | "metered" | "none", string> = {
  "wallet-exclusive": "Priced by the wallet's movement while this show ran alone — its real spend.",
  metered:
    "Priced from this show's calls at the average cost per call measured on shows that ran alone.",
  none: "Nothing to price this show on.",
};

/** Which basis a row's dollar figure rests on. Small, beside the number. */
function BasisMark({
  basis,
  inline,
}: {
  basis: "wallet-exclusive" | "metered" | "none";
  inline?: boolean;
}) {
  if (basis === "none") return null;
  return (
    <span
      title={BASIS_TITLE[basis]}
      className={cn(
        "inline-flex cursor-help items-center rounded-[3px] border px-1 font-sans text-[9.5px] uppercase tracking-wider",
        basis === "wallet-exclusive"
          ? "border-ok/40 text-ok"
          : "border-hairline-strong text-text-muted",
        inline && "mx-0.5 align-middle",
      )}
    >
      {basis === "wallet-exclusive" ? "wallet" : "metered"}
    </span>
  );
}

/**
 * The cap, where the money is.
 *
 * A limit that only appears on the settings page is a limit nobody sees until
 * it fires. This is the same number the pipeline enforces, read from the same
 * endpoint, so the cost page and the console can never disagree about it.
 */
function CapLine() {
  const [b, setB] = useState<BudgetState | null>(null);
  useEffect(() => {
    let stop = false;
    const read = () =>
      api
        .budget()
        .then((x) => !stop && setB(x))
        .catch(() => {});
    void read();
    const t = setInterval(read, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (!b || b.capUsd == null) return null;
  const pct = b.spentUsd == null ? 0 : Math.min(100, (b.spentUsd / b.capUsd) * 100);
  return (
    <Card className="mt-3 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[12.5px] font-medium">
          {b.capped ? "Spend cap reached — drafting is stopped" : "This show, against your cap"}
        </span>
        <span className="num ml-auto text-[12px] text-text-secondary">
          {b.spentUsd == null ? "—" : `$${b.spentUsd.toFixed(2)}`} of ${b.capUsd.toFixed(2)}
        </span>
      </div>
      <span className="mt-2 block h-1.5 rounded-full bg-hairline">
        <span
          className={cn("block h-1.5 rounded-full", b.capped ? "bg-bad" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">
        {b.error
          ? `The wallet could not be read — ${b.error}. The cap cannot fire on a number we do not have.`
          : b.readAt
            ? `Wallet read ${new Date(b.readAt).toLocaleTimeString()}. The cap is checked against the upper bound, so it trips early rather than late.`
            : "The wallet has not been read yet this session."}
      </p>
    </Card>
  );
}

export function CostPage() {
  const [data, setData] = useState<CostSnapshot | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.cost(days));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: Tab[] = [
    { label: "Last 7 days", active: days === 7, onClick: () => setDays(7) },
    { label: "Last 30 days", active: days === 30, onClick: () => setDays(30) },
    { label: "Last 90 days", active: days === 90, onClick: () => setDays(90) },
  ];

  const t = data?.totals;

  return (
    <AppShell
      section="cost"
      title="Cost"
      subtitle={
        data ? `Your shows · ${t?.shows ?? 0} shows · last ${days} days` : "reading the meter…"
      }
      tabs={tabs}
      actions={
        <BadgeButton onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "size-3 animate-spin" : "size-3"} aria-hidden /> Refresh
        </BadgeButton>
      }
    >
      {error ? (
        <Card tone="bad" className="mb-4 px-4 py-3 text-[12.5px] text-bad">
          Could not read cost — {error}
        </Card>
      ) : null}

      <SectionHeading hint="What your shows cost you. Calls are exact — this app counts them. Dollars are priced per show, and each row says on what basis.">
        Your money
      </SectionHeading>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {!data ? (
          <>
            <Skeleton className="h-[92px]" />
            <Skeleton className="h-[92px]" />
            <Skeleton className="h-[92px]" />
          </>
        ) : (
          <>
            <StatTile
              label={`Your spend, ${days} days`}
              value={usd(t?.estimatedUsd)}
              hint={`${t?.shows ?? 0} shows · ${Math.floor((t?.minutes ?? 0) / 60)}h ${(t?.minutes ?? 0) % 60}m on air${
                t?.metered ? ` · ${t.metered} priced from calls` : ""
              }`}
            />
            <StatTile
              label="Per hour on air"
              value={usd(t?.perHourUsd)}
              hint={
                t?.showsWithoutWallet
                  ? `${t.showsWithoutWallet} show${t.showsWithoutWallet === 1 ? "" : "s"} could not be priced`
                  : "your spend over your time on air"
              }
            />
            <StatTile
              label="Per answered reply"
              value={t?.perAnsweredUsd == null ? "—" : `$${t.perAnsweredUsd.toFixed(4)}`}
              hint={`${t?.answered ?? 0} replies sent in the period`}
            />
          </>
        )}
      </div>

      {data ? (
        <Card className="mt-3 flex gap-2.5 bg-elevated px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
          <p className="text-[12px] leading-relaxed text-text-secondary">{data.attribution.note}</p>
        </Card>
      ) : null}

      <CapLine />

      {/* by show ---------------------------------------------------------- */}
      <div className="mt-8">
        <SectionHeading hint="What each night cost, beside what it did. The last column is the one worth watching over time.">
          By show
        </SectionHeading>
        <Card className="mt-3 overflow-hidden">
          {!data ? (
            <Skeleton className="h-[160px]" />
          ) : data.shows.length === 0 ? (
            <EmptyState title="No finished shows in this window">
              A row is written when a session closes. Shows that are still on air appear in the
              console's cost rail until they end.
            </EmptyState>
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11.5px] text-text-muted shadow-[0_1px_0_var(--hairline)]">
                    <th className="px-4 py-2.5 font-medium">Show</th>
                    <th className="px-4 py-2.5 font-medium">Ended</th>
                    <th className="px-4 py-2.5 text-right font-medium">On air</th>
                    <th className="px-4 py-2.5 text-right font-medium">Calls</th>
                    <th className="px-4 py-2.5 text-right font-medium">Context chars</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                    <th className="px-4 py-2.5 text-right font-medium">Answered</th>
                    <th className="px-4 py-2.5 text-right font-medium">Per reply</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shows.map((s) => (
                    <tr key={s.showId} className="text-text-secondary even:bg-canvas/60">
                      <td className="max-w-[280px] truncate px-4 py-2.5 text-text">{s.title}</td>
                      <td className="px-4 py-2.5">
                        {new Date(s.closedAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="num px-4 py-2.5 text-right">
                        {Math.floor(s.durationMin / 60)}h{" "}
                        {String(s.durationMin % 60).padStart(2, "0")}m
                      </td>
                      <td className="num px-4 py-2.5 text-right">{s.calls}</td>
                      <td className="num px-4 py-2.5 text-right">{compact(s.contextChars)}</td>
                      <td className="num px-4 py-2.5 text-right">
                        {s.estimatedUsd == null ? (
                          <span title="nothing to price this show on">—</span>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-1">
                            {usd(s.estimatedUsd, 2)}
                            <BasisMark basis={s.basis} />
                          </span>
                        )}
                      </td>
                      <td className="num px-4 py-2.5 text-right">{s.answered}</td>
                      <td className="num px-4 py-2.5 text-right">
                        {s.estimatedUsd == null || !s.answered
                          ? "—"
                          : `$${(s.estimatedUsd / s.answered).toFixed(4)}`}
                      </td>
                    </tr>
                  ))}
                  <tr className="text-text shadow-[0_-1px_0_var(--hairline)]">
                    <td className="px-4 py-2.5 font-medium">{t?.shows} shows</td>
                    <td />
                    <td className="num px-4 py-2.5 text-right">
                      {Math.floor((t?.minutes ?? 0) / 60)}h{" "}
                      {String((t?.minutes ?? 0) % 60).padStart(2, "0")}m
                    </td>
                    <td className="num px-4 py-2.5 text-right">{t?.calls}</td>
                    <td className="num px-4 py-2.5 text-right">{compact(t?.contextChars ?? 0)}</td>
                    <td className="num px-4 py-2.5 text-right">{usd(t?.estimatedUsd)}</td>
                    <td className="num px-4 py-2.5 text-right">{t?.answered}</td>
                    <td className="num px-4 py-2.5 text-right">
                      {t?.perAnsweredUsd == null ? "—" : `$${t.perAnsweredUsd.toFixed(4)}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">
          A show marked <BasisMark basis="wallet-exclusive" inline /> is priced by how much the
          wallet moved while it ran alone (its real spend); one marked{" "}
          <BasisMark basis="metered" inline /> is priced from its calls at the average cost per call
          measured on shows that ran alone.
        </p>
      </div>

      {/* by purpose -------------------------------------------------------- */}
      <div className="mt-8 mb-10 grid gap-4 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <div>
          <SectionHeading hint="Counted by this app, per purpose, with the latency each door actually delivered. These sum to the same total as the table above — they are the same calls, grouped differently.">
            Where the calls go
          </SectionHeading>
          <Card className="mt-3">
            {!data ? (
              <Skeleton className="h-[140px]" />
            ) : Object.keys(data.byDoor).length === 0 ? (
              <EmptyState title="Nothing measured yet">
                Doors are recorded when a session closes.
              </EmptyState>
            ) : (
              <>
                {Object.entries(data.byDoor)
                  .sort((a, b) => b[1].calls - a[1].calls)
                  .map(([door, d]) => (
                    <div
                      key={door}
                      className="flex items-center gap-3 px-4 py-2.5 shadow-[0_1px_0_var(--hairline)] last:shadow-none"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-text">
                        {DOOR_LABEL[door] ?? door.replace(/_/g, " ")}
                      </span>
                      <span className="num w-16 text-right text-[12.5px]">{d.calls}</span>
                      <span className="num w-20 text-right text-[11.5px] text-text-muted">
                        {d.calls ? `${Math.round(d.totalMs / d.calls)}ms avg` : "—"}
                      </span>
                      <span className="num w-14 text-right text-[11.5px]">
                        {d.failures ? <span className="text-bad">{d.failures} failed</span> : "—"}
                      </span>
                    </div>
                  ))}
                <div className="flex items-center gap-3 px-4 py-2.5 text-[12.5px] shadow-[0_-1px_0_var(--hairline)]">
                  <span className="min-w-0 flex-1 text-text-muted">all purposes</span>
                  <span className="num w-16 text-right text-text">
                    {Object.values(data.byDoor).reduce((a, d) => a + d.calls, 0)}
                  </span>
                  <span className="w-20" />
                  <span className="num w-14 text-right text-text">
                    {Object.values(data.byDoor).reduce((a, d) => a + d.failures, 0)}
                  </span>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
