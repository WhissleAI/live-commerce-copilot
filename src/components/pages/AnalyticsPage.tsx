import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { api, ensureSession } from "@/lib/api";
import type { Analytics } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConsoleButton } from "@/components/console/primitives";
import { PageShell, Section, Stat } from "./PageShell";

/**
 * Three questions a seller actually has, in the order they ask them.
 *
 *   Did it help?        answered rate, time-to-answer, what it sent
 *   Can I trust it?     which guard blocked what, rollbacks, chain integrity
 *   What does it cost?  the wallet, and the agent's own per-turn trace
 *
 * The third section is the one that has never existed. `/api/sessions/{id}/trace`
 * is the richest source on the platform — per turn it names the provider and
 * model that answered, whether it failed over, the latency and the tokens — and
 * nothing in this app read it until now. "The copilot is slow" and "hop 0 went
 * to gpt-oss-120b, took 916 ms on 3,830 input tokens" are different sentences,
 * and only one of them is actionable.
 */
const ms = (n: number) => `${Math.round(n)}ms`;
const pctText = (n: number) => `${Math.round(n * 100)}%`;

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function AnalyticsPage() {
  const [d, setD] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureSession().catch(() => null);
      setD(await api.analytics(7));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!d) {
    return (
      <PageShell title="Analytics">
        <p className="text-[12px] text-text-muted">{error ?? "Reading the show…"}</p>
      </PageShell>
    );
  }

  const c = d.copilot;
  const guardBlocks = Object.entries(c.guardBlocks).filter(([, n]) => n > 0);
  const totalBlocks = guardBlocks.reduce((a, [, n]) => a + n, 0);

  return (
    <PageShell
      title="Analytics"
      subtitle={`${d.showId}${d.agentId ? ` · agent ${d.agentId.slice(0, 8)}` : ""}`}
      actions={
        <ConsoleButton variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className={cn("size-3", loading && "animate-spin")} aria-hidden /> refresh
        </ConsoleButton>
      }
    >
      {error ? <p className="mb-6 text-[12px] text-bad">{error}</p> : null}

      <Section title="Did it help" hint="What the copilot answered, and how fast.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Answered rate" value={pctText(c.answeredRate)} hint="of admitted questions sent" />
          <Stat label="Proposals" value={String(c.proposals)} hint={`${c.sent} sent · ${c.dismissed} dismissed`} />
          <Stat
            label="Time to answer p95"
            value={ms(c.latency.p95)}
            tone={c.latency.p95 > c.latency.budgetMs ? "warn" : "ok"}
            hint={`budget ${ms(c.latency.budgetMs)} · ${c.latency.breaches} breaches`}
          />
          <Stat label="Cache hit rate" value={pctText(c.cacheHitRate)} hint="repeat questions answered free" />
        </div>
      </Section>

      <Section
        title="Can I trust it"
        hint="Every guard runs on every reply, so these counts are independent — a reply can be caught by more than one."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Blocked" value={String(c.blocked)} tone={c.blocked ? "warn" : undefined} hint="never reached a buyer" />
          <Stat label="Actions committed" value={String(c.actionsCommitted)} />
          <Stat
            label="Rolled back"
            value={String(c.actionsRolledBack)}
            tone={c.actionsRolledBack ? "warn" : undefined}
          />
          <Stat
            label="Audit chain"
            value={c.auditChain.ok ? `intact · ${c.auditChain.height}` : `broken at ${c.auditChain.brokenAt}`}
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
                    <span className="w-32 shrink-0 text-[11px] text-text">{guard.replace(/_/g, " ")}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline">
                      <span
                        className="block h-full rounded-full bg-warn"
                        style={{ width: `${Math.max(4, (n / totalBlocks) * 100)}%` }}
                      />
                    </span>
                    <span className="num w-8 shrink-0 text-right text-[11px] tabular-nums text-text-secondary">{n}</span>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-text-muted">No guard has blocked a reply in this show yet.</p>
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
              <Stat label="Turns" value={String(d.agent.turns)} hint={`${d.agent.sessions} sessions`} />
              <Stat label="Gateway p50 / p95" value={`${ms(d.agent.latency.p50)} / ${ms(d.agent.latency.p95)}`} hint={`max ${ms(d.agent.latency.max)}`} />
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
                        <td className="num px-3 py-1.5 text-right tabular-nums text-text-secondary">{m.turns}</td>
                        <td className="num px-3 py-1.5 text-right tabular-nums text-text-secondary">{compact(m.tokens)}</td>
                        <td className="num px-3 py-1.5 text-right tabular-nums text-text-secondary">{ms(m.p50Ms)}</td>
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
                      <tr key={`${t.sessionId}-${t.hop}-${i}`} className="border-b border-hairline last:border-0">
                        <td className="max-w-[22rem] truncate px-3 py-1.5 text-text-secondary" title={t.title}>
                          {t.title}
                          {t.failedOver ? <span className="ml-1.5 text-warn">failed over</span> : null}
                        </td>
                        <td className="num px-3 py-1.5 text-right tabular-nums text-text-secondary">{ms(t.latencyMs)}</td>
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

      <Section title="What it costs" hint="Wallet balance is the only real money here; the rest is consumption.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat
            label="Available"
            value={d.cost.wallet?.availableUsd != null ? `$${d.cost.wallet.availableUsd.toFixed(2)}` : "—"}
            tone={d.cost.wallet?.lowBalance ? "bad" : undefined}
            hint={d.cost.walletError?.message}
          />
          <Stat
            label="This show"
            value={`≤ $${(d.cost.spend[d.showId]?.spentUsd ?? 0).toFixed(4)}`}
            hint="upper bound — the wallet is workspace-wide"
          />
          <Stat label="Gateway calls" value={String(d.cost.meter.byShow[d.showId]?.calls ?? 0)} hint="counted by this app" />
          <Stat
            label="Workspace LLM"
            value={compact(d.cost.usage?.totals.find((t) => t.service === "llm")?.quantity ?? 0)}
            hint={`tokens, last ${d.cost.usage?.days ?? 7} days`}
          />
        </div>
      </Section>
    </PageShell>
  );
}
