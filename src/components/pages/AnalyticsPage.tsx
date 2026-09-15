/**
 * Analytics — how the copilot is doing, across every show it has run.
 *
 * This page used to read one live runtime and, with nothing on air, said "no
 * show is being monitored". That is the wrong answer to "how is it doing": the
 * answer is mostly in the shows that already happened, and those are persisted.
 *
 * Three tabs, in the order a seller asks:
 *
 *   Overview   sums and rates over every finished show in the window — the
 *              numbers the PRD promises, measured, and the same tomorrow.
 *   Autonomy   the ladder: what is unlocked, and each criterion's progress.
 *              Computed server-side since the ladder shipped; rendered here for
 *              the first time.
 *   Live       the show on air right now, by the second. Only when there is one.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { api, ensureSession } from "@/lib/api";
import { formatMoney, GUARD_LABEL } from "@/lib/format";
import type { Analytics, AnalyticsOverview, GuardName, PromotionReadiness } from "@/lib/types";
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
import { cn } from "@/lib/utils";
import { Section, Stat } from "./PageShell";

const ms = (n: number) => `${Math.round(n)}ms`;
const pctText = (n: number) => `${Math.round(n * 100)}%`;

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

type View = "overview" | "topics" | "autonomy" | "live";
const WINDOWS = [7, 30, 90] as const;

export function AnalyticsPage() {
  const [view, setView] = useState<View>("overview");
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const [o, setO] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureSession().catch(() => null);
      setO(await api.analyticsOverview(days));
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
    { label: "Overview", active: view === "overview", onClick: () => setView("overview") },
    { label: "Topics", active: view === "topics", onClick: () => setView("topics") },
    { label: "Autonomy", active: view === "autonomy", onClick: () => setView("autonomy") },
    ...(o?.liveShowId
      ? [{ label: "Live show", active: view === "live", onClick: () => setView("live") }]
      : []),
  ];

  return (
    <AppShell
      section="analytics"
      title="Analytics"
      subtitle={
        o
          ? `${o.shows.finished} shows that finished in the last ${o.window.days} days · ${o.shows.hoursOnAir}h on air`
          : "reading your shows…"
      }
      tabs={tabs}
      actions={
        <>
          <span className="flex items-center gap-1">
            {WINDOWS.map((w) => (
              <Button
                key={w}
                size="sm"
                variant={days === w ? "primary" : "secondary"}
                onClick={() => setDays(w)}
              >
                {w}d
              </Button>
            ))}
          </span>
          <Button onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        </>
      }
    >
      {error ? (
        <Card tone="bad" className="mb-4 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
          <span className="text-[12.5px]">{error}</span>
        </Card>
      ) : null}

      {view === "overview" ? <Overview o={o} /> : null}
      {view === "topics" ? <Topics o={o} /> : null}
      {view === "autonomy" ? <Autonomy r={o?.readiness ?? null} loaded={o !== null} /> : null}
      {view === "live" && o?.liveShowId ? <LiveShowAnalytics showId={o.liveShowId} /> : null}
    </AppShell>
  );
}

function Overview({ o }: { o: AnalyticsOverview | null }) {
  if (!o) {
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        <Skeleton className="h-[92px]" />
        <Skeleton className="h-[92px]" />
        <Skeleton className="h-[92px]" />
        <Skeleton className="h-[92px]" />
      </div>
    );
  }
  if (o.shows.finished === 0) {
    return (
      <Card>
        <EmptyState title={`No shows finished in the last ${o.window.days} days.`}>
          Analytics is built from the report each session leaves behind. Monitor a show, end it, and
          this fills in.
        </EmptyState>
      </Card>
    );
  }

  const e = o.engagement;
  const s = o.safety;
  const guards = Object.entries(s.byGuard)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxGuard = Math.max(1, ...guards.map(([, n]) => n));

  return (
    <>
      <SectionHeading hint="Across every finished show in the window. Answered means a drafted reply you actually sent; a question nothing could ground is a gap in the reports, never an answer.">
        Did it help
      </SectionHeading>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <StatTile
          label="Answered rate"
          value={pctText(e.answeredRate)}
          target="target >85%"
          targetMet={e.answeredRate > 0.85}
          hint={`${e.answered} of ${e.questionsAsked} questions asked`}
        />
        <StatTile
          label="Worst p95"
          value={ms(e.worstP95Ms)}
          target="target <2s"
          targetMet={e.worstP95Ms < 2000}
          hint={
            e.medianOfMediansMs
              ? `median of per-show medians ${ms(e.medianOfMediansMs)}`
              : "no per-show medians recorded yet"
          }
        />
        <StatTile
          label="Comments seen"
          value={compact(e.commentsSeen)}
          hint={`${e.questionsAsked} were questions · ${o.shows.hoursOnAir}h on air`}
        />
        <StatTile
          label="Cache hit rate"
          value={pctText(e.cacheHitRate)}
          hint="repeat questions answered free"
        />
      </div>

      <div className="mt-8">
        <SectionHeading hint="Every guard runs on every reply, so these counts are independent — one reply can be caught by more than one. Flagged wrong is what you marked after sending: a floor, never a total.">
          Can I trust it
        </SectionHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <StatTile
            label="Block rate"
            value={pctText(s.blockRate)}
            target="target <2%"
            targetMet={s.blockRate < 0.02}
            hint={`${s.blocked} blocked · ${s.revised} revised · ${s.abstained} abstained`}
          />
          <StatTile
            label="Flagged wrong"
            value={String(s.flaggedWrong)}
            {...(s.flaggedWrong ? { tone: "warn" as const } : {})}
            hint="marked by you after sending"
          />
          <StatTile
            label="Rolled back"
            value={String(o.actions.rolledBack)}
            hint={`${o.actions.committed} committed · ${o.actions.failed} failed`}
          />
          <StatTile
            label="Audit chains intact"
            value={`${s.chainsIntact}/${o.shows.finished - o.shows.withoutReport}`}
            tone={s.chainsIntact === o.shows.finished - o.shows.withoutReport ? "ok" : "bad"}
            hint="hash-verified end to end, per show"
          />
        </div>

        {guards.length ? (
          <Card className="mt-3 px-4 py-3">
            <div className="text-[12px] text-text-muted">Which guard caught it</div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {guards.map(([g, n]) => (
                <li key={g} className="flex items-center gap-3 text-[12px]">
                  <span className="w-24 shrink-0">
                    {GUARD_LABEL[g as GuardName] ?? g.replace(/_/g, " ")}
                  </span>
                  <span className="h-1.5 min-w-0 flex-1 rounded-full bg-hairline">
                    <span
                      className="block h-1.5 rounded-full bg-warn"
                      style={{ width: `${(n / maxGuard) * 100}%` }}
                    />
                  </span>
                  <span className="num w-8 text-right">{n}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="mt-8">
        <SectionHeading hint="Hammer value of everything that closed while a show was on air, booked from lot-state transitions the copilot observed. Shows recorded before PRD metrics existed carry no GMV and are counted, not zeroed.">
          What it was worth
        </SectionHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <StatTile
            label="Gross GMV"
            value={formatMoney(o.gmv.grossCents)}
            hint={`${o.gmv.lotsSold} lots closed across ${o.gmv.showsWithGmv} shows`}
          />
          <StatTile
            label="Per show hour"
            value={
              o.shows.hoursOnAir
                ? formatMoney(Math.round(o.gmv.grossCents / o.shows.hoursOnAir))
                : "—"
            }
            hint="gross ÷ hours on air"
          />
          <StatTile
            label="Median decision"
            value={o.operator.medianDecisionMs == null ? "—" : ms(o.operator.medianDecisionMs)}
            target="target <2s"
            {...(o.operator.medianDecisionMs != null
              ? { targetMet: o.operator.medianDecisionMs < 2000 }
              : {})}
            hint="card shown → you sent or dismissed"
          />
          <StatTile
            label="Edit rate"
            value={o.operator.editRate == null ? "—" : pctText(o.operator.editRate)}
            target="target <20%"
            {...(o.operator.editRate != null ? { targetMet: o.operator.editRate < 0.2 } : {})}
            hint="your revealed opinion of draft quality"
          />
        </div>
      </div>

      <div className="mt-8">
        <SectionHeading hint="Newest first. A show without a report is listed — that is the one to open.">
          By show
        </SectionHeading>
        <Card className="mt-3 overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-text-muted">
                  <th className="px-4 py-2 font-medium">Show</th>
                  <th className="px-3 py-2 text-right font-medium">On air</th>
                  <th className="px-3 py-2 text-right font-medium">Answered</th>
                  <th className="px-3 py-2 text-right font-medium">p95</th>
                  <th className="px-3 py-2 text-right font-medium">Blocked</th>
                  <th className="px-3 py-2 text-right font-medium">GMV</th>
                  <th className="px-4 py-2 font-medium">Chain</th>
                </tr>
              </thead>
              <tbody>
                {o.perShow.map((r) => (
                  <tr key={r.showId} className="shadow-[0_1px_0_var(--hairline)] last:shadow-none">
                    <td className="max-w-[300px] px-4 py-2">
                      <Link
                        to="/reports/$showId"
                        params={{ showId: r.showId }}
                        className="block truncate hover:underline"
                      >
                        {r.title}
                      </Link>
                      <span className="num text-[11px] text-text-muted">
                        {new Date(r.startedAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </td>
                    <td className="num px-3 py-2 text-right">
                      {r.durationMin
                        ? `${Math.floor(r.durationMin / 60)}h ${r.durationMin % 60}m`
                        : "—"}
                    </td>
                    <td className="num px-3 py-2 text-right">{pctText(r.answeredRate)}</td>
                    <td
                      className={cn(
                        "num px-3 py-2 text-right",
                        r.p95LatencyMs > 2000 && "text-bad",
                      )}
                    >
                      {r.p95LatencyMs ? ms(r.p95LatencyMs) : "—"}
                    </td>
                    <td className="num px-3 py-2 text-right">{r.blocked}</td>
                    <td className="num px-3 py-2 text-right">
                      {r.gmvCents == null ? (
                        <span className="text-text-faint">—</span>
                      ) : (
                        formatMoney(r.gmvCents)
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.durationMin === 0 ? (
                        <Badge tone="warn">no report</Badge>
                      ) : r.chainOk ? (
                        <Badge tone="ok">intact</Badge>
                      ) : (
                        <Badge tone="bad">broken</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

/**
 * Where it is strong, and where it is not — by topic.
 *
 * This is the table that decides what belongs on the auto-reply allow-list.
 * Today that list is a constant in the ladder; the last column says what the
 * constant currently allows, and the rest is the evidence it should be argued
 * from. Rates are over proposals: a comment the gate dropped never got a topic.
 */
function Topics({ o }: { o: AnalyticsOverview | null }) {
  if (!o) return <Skeleton className="h-[200px]" />;
  if (!o.byIntent.length) {
    return (
      <Card>
        <EmptyState title="No proposals in this window.">
          Topics are counted from the replies the copilot drafted on finished shows.
        </EmptyState>
      </Card>
    );
  }
  const worstAbstain = [...o.byIntent].sort((a, b) => b.abstainedRate - a.abstainedRate)[0];
  return (
    <>
      <SectionHeading hint="By topic, across every finished show in the window. The last column is what the ladder allows to auto-send at L3; the columns before it are the evidence that allow-list should be argued from.">
        Where it is strong, and where it is not
      </SectionHeading>
      <Card className="mt-3 overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted">
                <th className="px-4 py-2 font-medium">Topic</th>
                <th className="px-3 py-2 text-right font-medium">Asked</th>
                <th className="px-3 py-2 text-right font-medium">Answered</th>
                <th className="px-3 py-2 text-right font-medium">Abstained</th>
                <th className="px-3 py-2 text-right font-medium">Blocked</th>
                <th className="px-3 py-2 text-right font-medium">Edited</th>
                <th className="px-4 py-2 font-medium">Auto-reply</th>
              </tr>
            </thead>
            <tbody>
              {o.byIntent.map((r) => (
                <tr key={r.intent} className="shadow-[0_1px_0_var(--hairline)] last:shadow-none">
                  <td className="px-4 py-2">{r.intent.replace(/_/g, " ")}</td>
                  <td className="num px-3 py-2 text-right">{r.asked}</td>
                  <td className="num px-3 py-2 text-right">{pctText(r.answeredRate)}</td>
                  <td
                    className={cn(
                      "num px-3 py-2 text-right",
                      r.abstainedRate > 0.25 && "text-warn",
                    )}
                  >
                    {pctText(r.abstainedRate)}
                  </td>
                  <td className="num px-3 py-2 text-right">{r.blocked}</td>
                  <td className="num px-3 py-2 text-right">{pctText(r.editedRate)}</td>
                  <td className="px-4 py-2">
                    {r.autoReply === "allow-listed" ? (
                      <Badge tone="ok">allow-listed</Badge>
                    ) : (
                      <Badge title="Price and discount move during a show; a wrong answer there costs real money. Other topics are not on the list yet.">
                        never
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {worstAbstain && worstAbstain.abstainedRate > 0.2 ? (
        <p className="mt-3 text-[12px] text-text-secondary">
          <span className="capitalize">{worstAbstain.intent.replace(/_/g, " ")}</span> abstains on{" "}
          {pctText(worstAbstain.abstainedRate)} of what it is asked — that is a field the catalog
          does not carry, and it is the same finding each report's gaps list makes.
        </p>
      ) : null}
    </>
  );
}

/**
 * The ladder, with each criterion's real progress.
 *
 * Computed server-side since the ladder shipped and never rendered — the tab
 * existed with an empty click handler. A rung that is locked says what would
 * unlock it, in the numbers it is measured in.
 */
function Autonomy({ r, loaded }: { r: PromotionReadiness | null; loaded: boolean }) {
  if (!loaded) return <Skeleton className="h-[200px]" />;
  if (!r) {
    return (
      <Card>
        <EmptyState title="Readiness could not be computed.">
          The ladder is scored from your own finished shows. Finish one, and the criteria are judged
          against its numbers.
        </EmptyState>
      </Card>
    );
  }
  return (
    <>
      <SectionHeading hint="Each rung unlocks from your own finished shows, on the criteria below. Nothing here is a switch: a rung you have not earned is locked, and the reason is a number.">
        The autonomy ladder
      </SectionHeading>
      <div className="mt-3 flex flex-col gap-3">
        <Card className="flex items-center gap-3 px-4 py-3">
          <Badge tone="accent">{r.current}</Badge>
          <span className="text-[12.5px]">
            {r.next
              ? r.ready
                ? `Eligible for ${r.next} — switch it on from the console's show bar.`
                : `Not yet eligible for ${r.next}. Every criterion below has to be met on your own finished shows.`
              : "At the top of what can be unlocked. L4 unlocks when a show writes to eBay (Settings · eBay) and the rollback criterion holds."}
          </span>
          {r.ready ? (
            <Unlock className="ml-auto size-4 shrink-0 text-ok" aria-hidden />
          ) : (
            <Lock className="ml-auto size-4 shrink-0 text-text-muted" aria-hidden />
          )}
        </Card>
        <Card className="divide-y divide-hairline">
          {r.criteria.map((c) => {
            const met = c.state === "met";
            const unknown = c.state === "unknown";
            // Evidence first: a criterion cannot be met on too few shows, and
            // "0 of 3 shows" is a more useful reason than "not met".
            const evidence = Math.min(1, c.showsRequired ? c.showsSeen / c.showsRequired : 1);
            return (
              <div key={`${c.to}-${c.label}`} className="flex items-start gap-3 px-4 py-3">
                {met ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                ) : (
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      unknown ? "text-text-muted" : "text-warn",
                    )}
                    aria-hidden
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[12.5px] font-medium">{c.label}</span>
                    <Badge>{c.to}</Badge>
                    <span className="num ml-auto text-[11.5px] text-text-muted">
                      {c.value == null ? "—" : c.value} · {c.target}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-text-muted">{c.detail}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 min-w-0 flex-1 rounded-full bg-hairline">
                      <span
                        className={cn("block h-1.5 rounded-full", met ? "bg-ok" : "bg-accent")}
                        style={{ width: `${Math.round(evidence * 100)}%` }}
                      />
                    </span>
                    <span className="num shrink-0 text-[11px] text-text-muted">
                      {c.showsSeen}/{c.showsRequired} shows
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}

/** The show on air, by the second — the original page, scoped to one show. */
function LiveShowAnalytics({ showId }: { showId: string }) {
  const [d, setD] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    const read = () =>
      api
        .analytics(7, showId)
        .then((a) => !stop && setD(a))
        .catch((e) => !stop && setError((e as Error).message));
    void read();
    const t = setInterval(read, 10_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [showId]);

  if (error) return <p className="text-[12.5px] text-bad">{error}</p>;
  if (!d) return <Skeleton className="h-[200px]" />;

  const c = d.copilot;
  const guardBlocks = Object.entries(c.guardBlocks).filter(([, n]) => n > 0);
  const totalBlocks = guardBlocks.reduce((a, [, n]) => a + n, 0);

  return (
    <>
      <Section title="Did it help" hint="What the copilot answered, and how fast.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat
            label="Answered rate"
            value={pctText(c.answeredRate)}
            hint="of admitted questions sent"
          />
          <Stat
            label="Proposals"
            value={String(c.proposals)}
            hint={`${c.sent} sent · ${c.dismissed} dismissed`}
          />
          <Stat
            label="Time to answer p95"
            value={ms(c.latency.p95)}
            tone={c.latency.p95 > c.latency.budgetMs ? "warn" : "ok"}
            hint={`budget ${ms(c.latency.budgetMs)} · ${c.latency.breaches} breaches`}
          />
          <Stat
            label="Cache hit rate"
            value={pctText(c.cacheHitRate)}
            hint="repeat questions answered free"
          />
        </div>
      </Section>

      <Section
        title="Can I trust it"
        hint="Every guard runs on every reply, so these counts are independent — a reply can be caught by more than one."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat
            label="Blocked"
            value={String(c.blocked)}
            tone={c.blocked ? "warn" : undefined}
            hint="never reached a buyer"
          />
          <Stat label="Actions committed" value={String(c.actionsCommitted)} />
          <Stat
            label="Rolled back"
            value={String(c.actionsRolledBack)}
            tone={c.actionsRolledBack ? "warn" : undefined}
          />
          <Stat
            label="Audit chain"
            value={
              c.auditChain.ok
                ? `intact · ${c.auditChain.height}`
                : `broken at ${c.auditChain.brokenAt}`
            }
            tone={c.auditChain.ok ? "ok" : "bad"}
            hint={c.auditChain.reason ?? "hash-chained, verified end to end"}
          />
        </div>

        {totalBlocks > 0 ? (
          <div className="mt-3 rounded-[6px] border border-hairline bg-panel p-3">
            <div className="text-[11px] text-text-secondary">Which guard caught it</div>
            <div className="mt-2 space-y-1.5">
              {guardBlocks
                .sort((a, b) => b[1] - a[1])
                .map(([guard, n]) => (
                  <div key={guard} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-[11px] text-text">
                      {guard.replace(/_/g, " ")}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline">
                      <span
                        className="block h-full rounded-full bg-warn"
                        style={{ width: `${Math.max(4, (n / totalBlocks) * 100)}%` }}
                      />
                    </span>
                    <span className="num w-8 shrink-0 text-right text-[11px] tabular-nums text-text-secondary">
                      {n}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-text-muted">
            No guard has blocked a reply in this show yet.
          </p>
        )}

        <div className="mt-3 flex items-start gap-2 rounded-[6px] border border-hairline bg-panel px-3 py-2">
          {d.policy.armedOnAgent === d.policy.neverSayRules ? (
            <ShieldCheck className="mt-[2px] size-3.5 shrink-0 text-ok" aria-hidden />
          ) : (
            <ShieldAlert className="mt-[2px] size-3.5 shrink-0 text-text-muted" aria-hidden />
          )}
          <p className="text-[11px] leading-relaxed text-text-secondary">
            <span className="num">{d.policy.neverSayRules}</span> never-say rules are checked here;{" "}
            <span className="num">{d.policy.armedOnAgent}</span> are armed on the agent itself. The
            difference is deliberate — rules that depend on whether a listing carries an
            authentication certificate cannot be enforced by a string matcher with no catalog
            access. Discount cap: <span className="num">{d.policy.maxDiscountPct}%</span>.
          </p>
        </div>
      </Section>

      <Section
        title="What the agent did"
        hint="Per turn, from the Whissle session trace: which provider and model answered, whether it failed over, and what it cost in tokens."
      >
        {!d.agent ? (
          <p className="text-[11px] text-text-muted">This show has no agent configured.</p>
        ) : d.agent.error ? (
          <div className="flex items-start gap-2 rounded-[6px] border border-warn/40 bg-warn/5 px-3 py-2">
            <AlertTriangle className="mt-[2px] size-3.5 shrink-0 text-warn" aria-hidden />
            <p className="text-[11px] leading-relaxed text-text-secondary">{d.agent.error}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat
                label="Turns"
                value={String(d.agent.turns)}
                hint={`${d.agent.sessions} sessions`}
              />
              <Stat
                label="Gateway p50 / p95"
                value={`${ms(d.agent.latency.p50)} / ${ms(d.agent.latency.p95)}`}
                hint={`max ${ms(d.agent.latency.max)}`}
              />
              <Stat
                label="Failovers"
                value={String(d.agent.failovers)}
                tone={d.agent.failovers ? "warn" : "ok"}
                hint="turns a second provider had to answer"
              />
              <Stat
                label="Tokens in → out"
                value={`${compact(d.agent.inputTokens)} → ${compact(d.agent.outputTokens)}`}
                hint="grounding dominates the bill"
              />
            </div>

            {d.agent.byModel.length ? (
              <div className="mt-3 overflow-x-auto rounded-[6px] border border-hairline bg-panel">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-hairline text-left text-text-muted">
                      <th className="px-3 py-1.5 font-normal">Model</th>
                      <th className="px-3 py-1.5 font-normal">Provider</th>
                      <th className="px-3 py-1.5 text-right font-normal">Turns</th>
                      <th className="px-3 py-1.5 text-right font-normal">Tokens</th>
                      <th className="px-3 py-1.5 text-right font-normal">p50</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.agent.byModel.map((m) => (
                      <tr key={m.model} className="border-b border-hairline last:border-0">
                        <td className="num px-3 py-1.5 text-text">{m.model}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{m.provider}</td>
                        <td className="num px-3 py-1.5 text-right tabular-nums text-text-secondary">
                          {m.turns}
                        </td>
                        <td className="num px-3 py-1.5 text-right tabular-nums text-text-secondary">
                          {compact(m.tokens)}
                        </td>
                        <td className="num px-3 py-1.5 text-right tabular-nums text-text-secondary">
                          {ms(m.p50Ms)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {d.agent.recent.length ? (
              <div className="mt-3 overflow-x-auto rounded-[6px] border border-hairline bg-panel">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-hairline text-left text-text-muted">
                      <th className="px-3 py-1.5 font-normal">Turn</th>
                      <th className="px-3 py-1.5 text-right font-normal">Latency</th>
                      <th className="px-3 py-1.5 text-right font-normal">In → out</th>
                      <th className="px-3 py-1.5 font-normal">Ended</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.agent.recent.slice(0, 12).map((t, i) => (
                      <tr
                        key={`${t.sessionId}-${t.hop}-${i}`}
                        className="border-b border-hairline last:border-0"
                      >
                        <td
                          className="max-w-[22rem] truncate px-3 py-1.5 text-text-secondary"
                          title={t.title}
                        >
                          {t.title}
                          {t.failedOver ? (
                            <span className="ml-1.5 text-warn">failed over</span>
                          ) : null}
                        </td>
                        <td className="num px-3 py-1.5 text-right tabular-nums text-text-secondary">
                          {ms(t.latencyMs)}
                        </td>
                        <td className="num px-3 py-1.5 text-right tabular-nums text-text-secondary">
                          {compact(t.inputTokens)} → {compact(t.outputTokens)}
                        </td>
                        <td className="px-3 py-1.5 text-text-muted">
                          {/* `max_tokens` means the reply was CUT OFF, which is a
                              truncated answer to a buyer, not a neutral fact. */}
                          <span className={cn(t.stopReason === "max_tokens" && "text-warn")}>
                            {t.stopReason ?? "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </Section>
    </>
  );
}
