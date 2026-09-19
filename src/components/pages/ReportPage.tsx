/**
 * The post-session report.
 *
 * Every field on this page was already computed, stored and served — engagement,
 * safety by guard with real block examples, inventory, actions, the gaps list
 * and all of PRD §4 — and nothing in the client ever asked for it. `endSession`
 * received the finished report from the server and threw it away, then reloaded
 * the page. This is the single largest built-but-unreachable surface in the
 * pair, and it is one fetch and one screen.
 *
 * It reads against the PRD's own targets rather than in isolation, because
 * "78% answered" means nothing until you know the target is 85% and the
 * seller's own baseline was 34%.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Download,
  Info,
  Lock,
  Mic,
  Sparkles,
  Unlock,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatMoney, GUARD_LABEL, GUARD_ORDER } from "@/lib/format";
import type {
  CatalogSummary,
  Conclusion,
  GuardName,
  HostSummary,
  HostTrajectoryPoint,
  PlatformSessionSummary,
  PromotionReadiness,
  ShowRecord,
  ShowReport,
  Verdict,
} from "@/lib/types";
import { capabilitiesOf, guardOrderFor } from "@/lib/surfaces";
import {
  NOTHING_BLOCKED,
  READINESS_UNAVAILABLE,
  SENT_MEANS_REPLIES,
  SENT_MEANS_SUMMARY,
} from "@/lib/copy";
import { ReportTimeline, pretty } from "./ReportTimeline";
import { AppShell, type Tab } from "@/components/app/AppShell";
import {
  Badge,
  BadgeButton,
  Button,
  Card,
  EmptyState,
  GuardPill,
  SectionHeading,
  Skeleton,
  StatTile,
} from "@/components/ui/kit";

/**
 * One vocabulary, the same as the server's and the console's:
 *   signals · what was measured from the show (utterances, frames, audio)
 *   proposals · replies drafted; verdicts · what the guards said about them
 *   actions · writes to listings; gaps · questions nothing could ground
 *   conclusion · what the agent concluded; next actions · what to do before
 *   the next show.
 */
type View = "summary" | "replies" | "blocked" | "actions" | "gaps" | "audit" | "timeline";

const ms = (n: number) => (n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(2)}s`);
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function ReportPage({ showId }: { showId: string }) {
  const [report, setReport] = useState<ShowReport | null>(null);
  const [record, setRecord] = useState<ShowRecord | null>(null);
  const [readiness, setReadiness] = useState<PromotionReadiness | null>(null);
  // Export PDF prints the page. Every tab is a section of one report, so
  // while printing all of them render, in order, instead of the active one.
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const on = () => setPrinting(true);
    const off = () => setPrinting(false);
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    return () => {
      window.removeEventListener("beforeprint", on);
      window.removeEventListener("afterprint", off);
    };
  }, []);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  async function exportJson() {
    setExporting(true);
    try {
      // The export is cross-origin, so an <a download> is ignored and cannot
      // carry the session header. Fetch it and save the blob.
      const blob = await api.exportBlob(showId);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${showId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (e) {
      setLoadError(`Export failed — ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("summary");

  useEffect(() => {
    let stop = false;
    setReport(null);
    setError(null);
    api
      .report(showId)
      .then((r) => !stop && setReport(r))
      .catch((e: Error) => !stop && setError(e.message));
    // The evidence behind the counts, and the rung this show counts toward.
    // Each is its own read, and neither failing hides the report.
    api
      .record(showId)
      .then((r) => !stop && setRecord(r))
      .catch(
        (e) => !stop && setLoadError(`The record could not be read — ${(e as Error).message}`),
      );
    api
      .autonomyReadiness()
      .then((r) => !stop && setReadiness(r))
      .catch(() => {
        /* the rung is decoration on this page; the Autonomy tab reports it */
      });
    return () => {
      stop = true;
    };
  }, [showId]);

  const guardRows = useMemo(() => {
    if (!report) return [];
    const entries = Object.entries(report.safety.byGuard).filter(([, n]) => n > 0);
    const max = Math.max(1, ...entries.map(([, n]) => n));
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([guard, n]) => ({ guard: guard as GuardName, n, ratio: n / max }));
  }, [report]);

  const tabs: Tab[] = [
    { label: "Summary", active: view === "summary", onClick: () => setView("summary") },
    {
      label: "Replies",
      count: record?.proposals.length ?? null,
      active: view === "replies",
      onClick: () => setView("replies"),
    },
    {
      label: "Blocked",
      count: report?.safety.blocked ?? null,
      active: view === "blocked",
      onClick: () => setView("blocked"),
    },
    {
      label: "Actions",
      count: record?.actions.length ?? null,
      active: view === "actions",
      onClick: () => setView("actions"),
    },
    {
      label: "Gaps",
      count: report?.gaps.unanswered.length ?? null,
      active: view === "gaps",
      onClick: () => setView("gaps"),
    },
    {
      label: "Audit",
      count: record?.audit.length ?? null,
      active: view === "audit",
      onClick: () => setView("audit"),
    },
    {
      label: "Timeline",
      count: report?.media ? report.media.utterances + report.media.frames : null,
      active: view === "timeline",
      onClick: () => setView("timeline"),
    },
  ];

  if (error) {
    return (
      <AppShell section="reports" title="Report" subtitle={showId}>
        <Card>
          <EmptyState
            icon={<AlertTriangle className="size-5 text-warn" aria-hidden />}
            title="No report for this session"
            action={
              <Link to="/">
                <BadgeButton>Back to Home</BadgeButton>
              </Link>
            }
          >
            {error}. A report is built when a session ends — if the session ended badly the report
            may never have generated, and the show is still listed so you can see that it happened.
          </EmptyState>
        </Card>
      </AppShell>
    );
  }

  if (!report) {
    return (
      <AppShell section="reports" title="Building the report…" subtitle={showId}>
        <div className="grid gap-3 sm:grid-cols-4">
          <Skeleton className="h-[92px]" />
          <Skeleton className="h-[92px]" />
          <Skeleton className="h-[92px]" />
          <Skeleton className="h-[92px]" />
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Skeleton className="h-3 w-[70%]" />
          <Skeleton className="h-3 w-[52%]" />
          <Skeleton className="h-3 w-[61%]" />
        </div>
      </AppShell>
    );
  }

  const e = report.engagement;

  // A drafted card is a measurement even when nothing was sent.
  const drafted = record?.proposals.length ?? 0;
  // A report written before the PRD metrics shipped has no `prd` block, and a
  // report is never regenerated — it is a statement about a finished show. So
  // everything that needs it is conditional, and says why it is absent.
  const prd = report.prd ?? null;
  const ended = new Date(report.endedAt);

  return (
    <AppShell
      section="reports"
      title={report.title}
      subtitle={`${ended.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${Math.floor(report.durationMin / 60)}h ${report.durationMin % 60}m · ${report.source}${report.generatedAt ? "" : " · report pending"}`}
      tabs={tabs}
      actions={
        <>
          <BadgeButton
            title="Everything about this session as one JSON file — report, every reply, action and audit entry, and the timeline"
            onClick={() => void exportJson()}
            disabled={exporting}
          >
            <Download className="size-3" aria-hidden /> {exporting ? "Exporting…" : "Export JSON"}
          </BadgeButton>
          <BadgeButton onClick={() => window.print()} title="Prints every section of the summary">
            Export PDF
          </BadgeButton>
        </>
      }
    >
      {loadError ? (
        <p className="mb-3 text-[12.5px] text-bad" role="alert">
          {loadError}
        </p>
      ) : null}
      {view === "summary" || printing ? (
        <>
          {/* did it help --------------------------------------------------- */}
          <SectionHeading hint={SENT_MEANS_SUMMARY}>
            Did it help
          </SectionHeading>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <StatTile
              label="Answered rate"
              value={pct(e.answeredRate)}
              target="target >85%"
              targetMet={e.answeredRate > 0.85}
              hint={`${e.answered} of ${e.questionsAsked} admitted questions answerable · ${e.sent} sent`}
            />
            <StatTile
              label="Time to answer p95"
              // Question typed → sendable reply on screen. A show with no
              // answerable question has no latency, not a zero-millisecond one.
              value={e.answered && e.p95LatencyMs > 0 ? ms(e.p95LatencyMs) : "—"}
              {...(e.answered && e.p95LatencyMs > 0
                ? { target: "target <2s", targetMet: e.p95LatencyMs < 2000 }
                : {})}
              hint={
                e.answered && e.p95LatencyMs > 0
                  ? `median ${ms(e.medianLatencyMs)} · cache hit ${pct(e.cacheHitRate)} · ${e.sent} sent`
                  : "nothing was answerable, so there is no time to report"
              }
            />
            <StatTile
              label="Operator touches"
              value={prd ? prd.operatorLoad.interactions : "—"}
              hint={prd ? "every send, edit and dismiss" : "not recorded in this report"}
              {...(prd
                ? { target: "target <25", targetMet: prd.operatorLoad.interactions < 25 }
                : {})}
            />
            <StatTile
              label="Median decision"
              value={
                prd?.operatorLoad.medianDecisionMs == null
                  ? "—"
                  : ms(prd.operatorLoad.medianDecisionMs)
              }
              hint="card shown → you sent or dismissed"
              {...(prd?.operatorLoad.medianDecisionMs != null
                ? { target: "target <2s", targetMet: prd.operatorLoad.medianDecisionMs < 2000 }
                : {})}
            />
          </div>

          {/* what the host did --------------------------------------------- */}
          <HostSection
            host={report.host}
            platform={report.platform}
            onTimeline={() => setView("timeline")}
          />

          {/* what it was worth --------------------------------------------- */}
          {prd ? (
            <div className="mt-8">
              <SectionHeading hint="Hammer value of everything that closed while you were on air, booked from the lot-state transitions the copilot observed — not a sum over current listing state, which would answer a different question every time it was asked.">
                What it was worth
              </SectionHeading>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <StatTile
                  label="Gross this session"
                  value={formatMoney(prd.gmv.grossCents)}
                  hint={`${prd.gmv.lotsSold} lots closed`}
                />
                <StatTile
                  label="Per session hour"
                  value={
                    prd.gmv.perShowHourCents == null ? "—" : formatMoney(prd.gmv.perShowHourCents)
                  }
                  hint={
                    prd.gmv.perShowHourCents == null
                      ? "withheld under 15 minutes — a rate extrapolated from four minutes is noise"
                      : `${prd.gmv.hours.toFixed(2)} hours on air`
                  }
                />
                <StatTile
                  label="Operational edits"
                  value={prd.operatorLoad.operationalEdits}
                  target="target 8–12"
                  targetMet={
                    prd.operatorLoad.operationalEdits >= 8 &&
                    prd.operatorLoad.operationalEdits <= 12
                  }
                  hint={`${report.actions.committed} committed · ${report.actions.rolledBack} undone`}
                />
                <Card className="px-4 py-3.5">
                  <div className="section-header">Sold lots that had a question answered</div>
                  <div className="mt-2.5 flex flex-col gap-2">
                    <Bar
                      label="with an answer"
                      value={prd.gmv.sellThroughWithAnswer.withAnswer}
                      total={prd.gmv.sellThroughWithAnswer.total}
                      tone="ok"
                    />
                    <Bar
                      label="with none"
                      value={
                        prd.gmv.sellThroughWithAnswer.total -
                        prd.gmv.sellThroughWithAnswer.withAnswer
                      }
                      total={prd.gmv.sellThroughWithAnswer.total}
                    />
                  </div>
                  <p className="mt-2.5 text-[11.5px] leading-snug text-text-muted">
                    A correlation on one show, not a causal claim — which is exactly why the pilot
                    tracks it across sellers against their own baseline.
                  </p>
                </Card>
              </div>
            </div>
          ) : (
            <Card className="mt-8 flex gap-2.5 bg-elevated px-4 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
              <p className="text-[12px] leading-relaxed text-text-secondary">
                This report was written before the PRD metrics were computed, and a report is never
                regenerated — it is a statement about a show that has finished. GMV, operator load
                and the trust rates are missing from this one; they are present on every show
                recorded since.
              </p>
            </Card>
          )}

          {/* can I trust it ------------------------------------------------- */}
          {prd ? (
            <div className="mt-8">
              <SectionHeading hint="The four numbers that decide whether you climb the autonomy ladder. Every guard runs on every reply, so these counts are independent — one reply can be caught by more than one.">
                Can I trust it
              </SectionHeading>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <StatTile
                  label="Block rate"
                  value={pct(prd.trust.blockRate)}
                  target="target <2%"
                  targetMet={prd.trust.blockRate < 0.02}
                  hint="a high rate means weak grounding, not strong guards"
                />
                <StatTile
                  label="Edit rate"
                  value={pct(prd.trust.editRate)}
                  target="target <20%"
                  targetMet={prd.trust.editRate < 0.2}
                  hint="your revealed opinion of draft quality"
                />
                <StatTile
                  label="Rollback rate"
                  value={pct(prd.trust.rollbackRate)}
                  target="target <10%"
                  targetMet={prd.trust.rollbackRate < 0.1}
                  hint="higher means preflight is too permissive"
                />
                <StatTile
                  label="Audit chain"
                  value={
                    report.safety.auditChain.ok
                      ? "intact"
                      : `broken at ${report.safety.auditChain.brokenAt}`
                  }
                  tone={report.safety.auditChain.ok ? "ok" : "bad"}
                  hint={`${report.safety.auditChain.height} entries, hash-verified end to end`}
                />
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.35fr]">
                <Card className="px-4 py-3.5">
                  <div className="section-header">Which guard caught it — blocked or revised</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {guardRows.length === 0 ? (
                      <p className="text-[12.5px] text-text-muted">
                        No guard caught anything on this show.
                      </p>
                    ) : (
                      guardRows.map((g) => (
                        <div key={g.guard} className="flex items-center gap-2.5">
                          <span className="w-20 shrink-0 text-[12.5px]">
                            {GUARD_LABEL[g.guard] ?? g.guard.replace(/_/g, " ")}
                          </span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline">
                            <span
                              className="block h-full rounded-full bg-warn"
                              style={{ width: `${Math.max(4, g.ratio * 100)}%` }}
                            />
                          </span>
                          <span className="num w-5 shrink-0 text-right text-[12px] text-text-secondary">
                            {g.n}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3.5 flex gap-3.5 pt-2.5 text-[12px] text-text-muted shadow-[0_-1px_0_var(--hairline)]">
                    <span className="pt-2.5">
                      blocked <span className="num text-text">{report.safety.blocked}</span>
                    </span>
                    <span className="pt-2.5">
                      revised <span className="num text-text">{report.safety.revised}</span>
                    </span>
                    <span className="pt-2.5">
                      abstained <span className="num text-text">{report.safety.abstained}</span>
                    </span>
                  </div>
                </Card>

                <Card className="px-4 py-3.5">
                  <div className="section-header">What it stopped, in full</div>
                  <div className="mt-3 flex flex-col gap-3">
                    {report.safety.examples.length === 0 ? (
                      <p className="text-[12.5px] text-text-muted">{NOTHING_BLOCKED.session}</p>
                    ) : (
                      report.safety.examples.map((x, i) => (
                        <div key={i} className="border-l-2 border-bad pl-3">
                          <p className="text-[12px] text-text-muted">{x.question}</p>
                          <p className="mt-1 text-[12.5px] leading-snug text-text-muted line-through">
                            {x.draft}
                          </p>
                          <p className="num mt-1 text-[11.5px] text-bad">
                            {GUARD_LABEL[x.guard as GuardName] ?? x.guard} · {x.reason}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              <UnmeasurableNote report={report} />
            </div>
          ) : null}

          {/* what the agent concluded ----------------------------------------- */}
          <ConclusionSection c={report.conclusion} />

          {/* fix before the next show — the short form; the tab has the list --- */}
          <div className="mt-8">
            <SectionHeading hint="The part worth acting on. The gaps tab has every question and a place to answer it; this is the rung the session counted toward.">
              Fix before the next show
            </SectionHeading>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
              <Card className="flex items-center gap-3 px-4 py-3">
                <span className="num text-[20px] leading-none">
                  {report.gaps.unanswered.length}
                </span>
                <span className="min-w-0 flex-1 text-[12.5px] text-text-secondary">
                  distinct questions the catalog could not ground,{" "}
                  {report.gaps.unanswered.reduce((a, g) => a + g.asked, 0)} times asked.
                </span>
                <BadgeButton tone="accent" onClick={() => setView("gaps")}>
                  Answer them
                </BadgeButton>
              </Card>
              <NextRung r={readiness} />
            </div>
          </div>
        </>
      ) : null}

      {view === "replies" || printing ? (
        <Replies record={record} surface={report?.source ?? null} />
      ) : null}
      {view === "actions" || printing ? <Actions record={record} /> : null}
      {view === "audit" || printing ? <Audit record={record} /> : null}
      {view === "timeline" || printing ? (
        <>
          <SectionHeading hint="Every signal the session produced, on one clock: what the host said with the emotion and intent measured on it, what the camera showed and what the agent read from it, and the audio to play it back.">
            The show, played back
          </SectionHeading>
          <div className="mt-3">
            <ReportTimeline showId={showId} />
          </div>
        </>
      ) : null}

      {view === "blocked" || printing ? (
        <>
          <SectionHeading
            hint={
              report.safety.examples.length < report.safety.blocked
                ? `${report.safety.examples.length} of ${report.safety.blocked} blocked replies are kept as examples; the Replies tab lists every one with its verdict. This is the list to read when the block rate moves.`
                : "Every reply a guard refused, with the fact it contradicted. This is the list to read when the block rate moves."
            }
          >
            Blocked replies
          </SectionHeading>
          <div className="mt-3 flex flex-col gap-2">
            {report.safety.examples.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Check className="size-5 text-ok" aria-hidden />}
                  title={NOTHING_BLOCKED.title}
                >
                  Every draft cleared every guard that ran on this session.
                </EmptyState>
              </Card>
            ) : (
              report.safety.examples.map((x, i) => (
                <Card key={i} tone="bad" className="px-4 py-3">
                  <p className="text-[12px] text-text-muted">{x.question}</p>
                  <p className="mt-1.5 text-[13px] leading-snug text-text-muted line-through">
                    {x.draft}
                  </p>
                  <p className="num mt-2 text-[12px] text-bad">
                    {GUARD_LABEL[x.guard as GuardName] ?? x.guard} · {x.reason}
                  </p>
                </Card>
              ))
            )}
          </div>
        </>
      ) : null}

      {view === "gaps" || printing ? <Gaps report={report} /> : null}
    </AppShell>
  );
}

/**
 * How the host worked the show — from the host's own speech.
 *
 * The voice head measures the SELLER's delivery: energy, and what kind of
 * speech act each utterance was. That is a style, and over a show it is a
 * trajectory — not a sentiment about buyers. Every number here is a
 * distribution summed as probability mass over the whole show, never a count
 * of top labels: a run of 0.34-confidence "excited" is 34% excited, not
 * "excited 80% of the time". The platform's own account of the same audio
 * session sits beside it when there is one, labelled as a second measurement
 * rather than merged into the first.
 */
function HostSection({
  host,
  platform,
  onTimeline,
}: {
  host: HostSummary | null | undefined;
  platform: PlatformSessionSummary | null | undefined;
  onTimeline: () => void;
}) {
  return (
    <div className="mt-8">
      <SectionHeading hint="The seller's delivery, measured from their own speech through the audio bridge — energy and the kind of speech act, utterance by utterance. These describe how the session was hosted, not what buyers felt.">
        How the host worked the show
      </SectionHeading>
      {!host ? (
        <Card className="mt-3 flex gap-2.5 bg-elevated px-4 py-3">
          <Mic className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
          <p className="text-[12px] leading-relaxed text-text-secondary">
            {host === undefined
              ? "This report was written before host signals were kept, and a report is never regenerated."
              : "Host audio was not captured for this session, so there is nothing to say about how it was hosted. Open the audio bridge next session and this section fills in — pace, delivery, and the moments chat reacted to."}
          </p>
        </Card>
      ) : (
        <>
          {host.style ? (
            <Card className="mt-3 px-4 py-3.5">
              <p className="text-[15px] font-medium leading-snug text-text">{host.style.label}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
                {host.style.detail}
              </p>
            </Card>
          ) : null}

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <StatTile
              label="Speaking"
              value={`${host.utterances}`}
              hint={`utterances over ${Math.floor(host.speakingSpanS / 60)}m ${host.speakingSpanS % 60}s`}
            />
            <StatTile
              label="Pace"
              value={
                host.medianSpeechRate == null
                  ? host.utterances > 0
                    ? "not measured"
                    : "—"
                  : `${Math.round(host.medianSpeechRate)} wpm`
              }
              hint={
                host.medianSpeechRate == null && host.utterances > 0
                  ? "speech rate is computed from utterance length and timing when the gateway sends none; this report predates that"
                  : "median words per minute — 150–170 is conversational"
              }
              {...(host.medianSpeechRate != null
                ? {
                    target: "150–170 wpm",
                    targetMet: host.medianSpeechRate >= 130 && host.medianSpeechRate <= 190,
                  }
                : {})}
            />
            <StatTile
              label="Delivery shifts"
              value={String(host.emotionFlips)}
              hint="utterances whose measured energy state changed — many on a short session is a host pulled around by chat"
            />
            <StatTile
              label="Loudest moment"
              value={host.loudestAtMs == null ? "—" : msClock(host.loudestAtMs)}
              hint={
                host.quietestAtMs == null
                  ? "no loudness measured"
                  : `quietest at ${msClock(host.quietestAtMs)}`
              }
            />
          </div>

          {host.trajectory && host.trajectory.length > 1 ? (
            <Trajectory points={host.trajectory} />
          ) : null}

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Shares title="Style of delivery · intent mix" shares={host.intent} />
            <Shares title="Energy and delivery · measured from the voice" shares={host.emotion} />
          </div>
          <p className="mt-2 text-[11.5px] text-text-muted">
            These describe the seller's delivery over the show, not buyer sentiment.
          </p>

          {platform ? (
            <Card className="mt-3 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-medium">
                  The platform's own read of the same audio
                </span>
                <Badge title={`matched by ${platform.matchedBy}`}>
                  session {platform.sessionId.slice(0, 8)}
                </Badge>
                {platform.dominantEmotion ? (
                  <Badge>delivery · {platform.dominantEmotion}</Badge>
                ) : null}
                {platform.primaryIntent ? <Badge>intent · {platform.primaryIntent}</Badge> : null}
              </div>
              {platform.summary?.summary ? (
                <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
                  {platform.summary.summary}
                </p>
              ) : null}
              {platform.summary?.nextAction ? (
                <p className="mt-1.5 text-[12px] text-text-secondary">
                  <span className="text-text-muted">its next action: </span>
                  {platform.summary.nextAction}
                </p>
              ) : null}
              <p className="mt-2 text-[11.5px] text-text-muted">
                Two measurements of one show, shown as two. The gateway ran its own emotion head
                over the listen-only session; the numbers above are what this app measured utterance
                by utterance.
              </p>
            </Card>
          ) : null}

          <p className="mt-3 text-[11.5px] text-text-muted">
            Every utterance, with its distribution and the frame on screen at the time, is on the{" "}
            <button type="button" onClick={onTimeline} className="text-accent hover:underline">
              timeline
            </button>
            .
          </p>
        </>
      )}
    </div>
  );
}

const msClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const INTENT_ORDER = ["inform", "question", "command", "other"];
const INTENT_FILL: Record<string, string> = {
  inform: "var(--color-accent)",
  question: "oklch(0.72 0.12 250)",
  command: "oklch(0.62 0.15 60)",
  other: "var(--hairline-strong)",
};

/**
 * The seller's delivery over the show: energy as a line, the intent mix as
 * thin stacked bars beneath it, one column per two-minute bucket. Inline SVG,
 * scaled to the viewBox, so it reads at any width.
 */
function Trajectory({ points }: { points: HostTrajectoryPoint[] }) {
  const W = 640;
  const H = 120;
  const LINE_H = 64;
  const BAR_TOP = 78;
  const BAR_H = 30;
  const n = points.length;
  const colW = W / n;
  const keys = INTENT_ORDER.filter((k) => points.some((p) => (p.intent[k] ?? 0) > 0));
  for (const p of points)
    for (const k of Object.keys(p.intent))
      if (!keys.includes(k) && (p.intent[k] ?? 0) > 0) keys.push(k);
  const x = (i: number) => i * colW + colW / 2;
  const y = (e: number) => 6 + (1 - Math.max(0, Math.min(1, e))) * (LINE_H - 12);
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.energy).toFixed(1)}`)
    .join(" ");
  const first = points[0]!;
  const last = points[n - 1]!;
  return (
    <Card className="mt-3 px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="section-header">Delivery over the show</div>
        <span className="num text-[11px] text-text-muted">
          energy {first.energy.toFixed(2)} → {last.energy.toFixed(2)} · {n} two-minute stretches
        </span>
      </div>
      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[120px] w-full min-w-[320px]"
          role="img"
          aria-label="Energy over time with intent mix per stretch"
        >
          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={g}
              x1={0}
              x2={W}
              y1={y(g)}
              y2={y(g)}
              stroke="var(--hairline)"
              strokeWidth={1}
            />
          ))}
          <path
            d={line}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.energy)} r={2.5} fill="var(--color-accent)">
              <title>{`${msClock(p.offsetMs)} · energy ${p.energy.toFixed(2)} · ${p.utterances} utterances${p.wpm ? ` · ${Math.round(p.wpm)} wpm` : ""}`}</title>
            </circle>
          ))}
          {points.map((p, i) => {
            const total = keys.reduce((a, k) => a + (p.intent[k] ?? 0), 0) || 1;
            let acc = 0;
            return keys.map((k) => {
              const h = ((p.intent[k] ?? 0) / total) * BAR_H;
              const rect = (
                <rect
                  key={k}
                  x={i * colW + 1}
                  y={BAR_TOP + acc}
                  width={Math.max(1, colW - 2)}
                  height={h}
                  fill={INTENT_FILL[k] ?? "var(--hairline-strong)"}
                >
                  <title>{`${msClock(p.offsetMs)} · ${k} ${Math.round(((p.intent[k] ?? 0) / total) * 100)}%`}</title>
                </rect>
              );
              acc += h;
              return rect;
            });
          })}
          <text x={0} y={H - 2} fontSize={9} fill="var(--text-muted)">
            {msClock(first.offsetMs)}
          </text>
          <text x={W} y={H - 2} fontSize={9} fill="var(--text-muted)" textAnchor="end">
            {msClock(last.offsetMs)}
          </text>
        </svg>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-accent" /> energy, 0–1
        </span>
        {keys.map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-[2px]"
              style={{ background: INTENT_FILL[k] ?? "var(--hairline-strong)" }}
            />{" "}
            {k}
          </span>
        ))}
      </div>
    </Card>
  );
}

function Shares({ title, shares }: { title: string; shares: { label: string; share: number }[] }) {
  const max = Math.max(0.01, ...shares.map((x) => x.share));
  return (
    <Card className="px-4 py-3.5">
      <div className="section-header">{title}</div>
      <div className="mt-2.5 flex flex-col gap-2">
        {shares.length === 0 ? (
          <p className="text-[12.5px] text-text-muted">The head reported nothing it trusted.</p>
        ) : (
          shares.map((x) => (
            <div key={x.label} className="flex items-center gap-2.5">
              <span className="w-24 shrink-0 truncate text-[12.5px]">{pretty(x.label)}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(2, (x.share / max) * 100)}%` }}
                />
              </span>
              <span className="num w-10 shrink-0 text-right text-[12px] text-text-secondary">
                {Math.round(x.share * 100)}%
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

const OUTCOME_TONE: Record<Conclusion["outcome"], "ok" | "neutral" | "bad" | "warn"> = {
  strong: "ok",
  steady: "neutral",
  rough: "bad",
  quiet: "warn",
};

const KIND_LABEL: Record<Conclusion["nextActions"][number]["kind"], string> = {
  catalog: "catalog",
  pricing: "pricing",
  inventory: "inventory",
  hosting: "hosting",
  policy: "policy",
  setup: "setup",
};

/** What the agent concluded — written by the show's own agent, from this report's evidence and nothing else. */
function ConclusionSection({ c }: { c: Conclusion | null | undefined }) {
  return (
    <div className="mt-8">
      <SectionHeading hint="Written by the session's own agent at the end, from the numbers on this page and the persisted signals — nothing it could not point at. Next actions are typed so they can be sorted and checked off; 'hosting' is the one only the host's audio can produce.">
        What the agent concluded
      </SectionHeading>
      {!c ? (
        <Card className="mt-3 flex gap-2.5 bg-elevated px-4 py-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
          <p className="text-[12px] leading-relaxed text-text-secondary">
            {c === undefined
              ? "This report was written before the agent was asked to conclude, and a report is never regenerated."
              : "The agent did not answer when asked to conclude this session — the gateway was unreachable or the session had no agent. The counts above stand on their own."}
          </p>
        </Card>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <Card className="px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Badge tone={OUTCOME_TONE[c.outcome]}>{c.outcome}</Badge>
              <span className="text-[11.5px] text-text-muted">
                by the show's agent · {new Date(c.at).toLocaleTimeString()}
              </span>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed">{c.summary}</p>
            {c.keyPoints.length ? (
              <ul className="mt-3 flex flex-col gap-1 text-[12.5px] text-text-secondary">
                {c.keyPoints.map((k, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-text-faint">·</span>
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
          <Card>
            <div className="px-4 py-2.5 text-[12px] text-text-muted shadow-[0_1px_0_var(--hairline)]">
              next actions · before the next show
            </div>
            {c.nextActions.length === 0 ? (
              <p className="px-4 py-3 text-[12.5px] text-text-muted">
                The agent had nothing to add to the gaps list.
              </p>
            ) : (
              <ol>
                {c.nextActions.map((a, i) => (
                  <li
                    key={i}
                    className="flex gap-3 px-4 py-2.5 shadow-[0_1px_0_var(--hairline)] last:shadow-none"
                  >
                    <span className="num w-4 shrink-0 pt-0.5 text-[11px] text-text-faint">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[12.5px] font-medium">{a.title}</span>
                        <Badge tone={a.kind === "hosting" ? "accent" : "neutral"}>
                          {KIND_LABEL[a.kind]}
                        </Badge>
                      </span>
                      {a.why ? (
                        <span className="mt-0.5 block text-[11.5px] text-text-muted">{a.why}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/** The rung this session counted toward. Promotion is a decision the seller makes on the console's session bar; this only says whether it is earned. */
function NextRung({ r }: { r: PromotionReadiness | null }) {
  if (!r) {
    return (
      <Card className="flex items-center gap-3 px-4 py-3 text-[12.5px] text-text-muted">
        {READINESS_UNAVAILABLE.title} {READINESS_UNAVAILABLE.body}
      </Card>
    );
  }
  const met = r.criteria.filter((c) => c.state === "met").length;
  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      {r.ready ? (
        <Unlock className="size-4 shrink-0 text-ok" aria-hidden />
      ) : (
        <Lock className="size-4 shrink-0 text-text-muted" aria-hidden />
      )}
      <span className="min-w-0 flex-1 text-[12.5px]">
        {r.next ? (
          <>
            <span className="font-medium">Next rung · {r.next}</span>
            <span className="block text-[11.5px] text-text-muted">
              {r.ready
                ? "earned on your own finished sessions — switch it on from the console's session bar"
                : `${met} of ${r.criteria.length} criteria met on your own finished shows`}
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">At the top of what can be unlocked</span>
            <span className="block text-[11.5px] text-text-muted">
              L4 unlocks when a show writes to eBay and the rollback criterion holds.
            </span>
          </>
        )}
      </span>
      <Link to="/analytics">
        <BadgeButton>Review criteria</BadgeButton>
      </Link>
    </Card>
  );
}

/** Shaped like the table it stands in for, so nothing jumps when it lands. */
function Loading({ what }: { what: string }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label={`Reading ${what}`}>
      <Skeleton className="h-[52px]" />
      <Skeleton className="h-[52px]" />
      <Skeleton className="h-[52px] w-3/4" />
    </div>
  );
}

/** Every proposal the session produced, with its verdicts. */
function Replies({ record, surface }: { record: ShowRecord | null; surface?: string | null }) {
  // CONTENT-20: this iterated the fixed six. A Reddit reply that showed seven
  // pills in the console showed six here, with the room-rules verdict silently
  // dropped — the one guard the operator most needs to see on that surface.
  // Same function the console uses, off the same capability table.
  const order = guardOrderFor(capabilitiesOf(surface));
  if (!record) return <Loading what="the record" />;
  const rows = [...record.proposals].reverse();
  return (
    <>
      <SectionHeading hint={SENT_MEANS_REPLIES}>
        Replies
      </SectionHeading>
      <Card className="mt-3">
        {rows.length === 0 ? (
          <EmptyState title="No replies were drafted.">
            Nothing admitted by the gate reached the copilot.
          </EmptyState>
        ) : (
          <ul>
            {rows.map((p) => (
              <li
                key={p.id}
                className="px-4 py-3 shadow-[0_1px_0_var(--hairline)] last:shadow-none"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-text-muted">
                  <span className="num">{new Date(p.at).toLocaleTimeString()}</span>
                  {p.intent ? <Badge>{p.intent.replace(/_/g, " ")}</Badge> : null}
                  <Badge
                    tone={
                      p.status === "sent" || p.status === "auto_sent"
                        ? "ok"
                        : p.verdict === "block"
                          ? "bad"
                          : p.abstained
                            ? "warn"
                            : "neutral"
                    }
                  >
                    {p.abstained ? "abstained" : p.status.replace(/_/g, " ")}
                  </Badge>
                  {p.edited ? <Badge>edited</Badge> : null}
                  {p.repaired ? <Badge tone="warn">repaired</Badge> : null}
                  {p.flaggedWrong ? (
                    <Badge tone="bad">flagged wrong · {p.flagReason ?? "unspecified"}</Badge>
                  ) : null}
                  <span className="num ml-auto">
                    {p.latencyMs ? `${(p.latencyMs / 1000).toFixed(2)}s` : "—"}
                  </span>
                  <span className="num">conf {p.confidence.toFixed(2)}</span>
                </div>
                <p className="mt-1.5 text-[12px] text-text-muted">
                  <span className="text-text-secondary">{p.author}</span> · {p.question}
                </p>
                <p
                  className={`mt-1 text-[12.5px] leading-snug ${p.verdict === "block" ? "text-text-muted line-through" : ""}`}
                >
                  {p.sentText ?? p.draft}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {order.map((g) => {
                    const hit = p.guards.find((x) => x.guard === g);
                    return (
                      <GuardPill
                        key={g}
                        guard={g}
                        verdict={(hit?.verdict as Verdict | undefined) ?? "n/a"}
                      />
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/** Every write the show proposed, and what became of it. */
function Actions({ record }: { record: ShowRecord | null }) {
  if (!record) return <Loading what="the record" />;
  const rows = [...record.actions].reverse();
  const tone = (s: string): "ok" | "bad" | "warn" | "neutral" =>
    s === "committed"
      ? "ok"
      : s === "failed" || s === "preflight_failed"
        ? "bad"
        : s === "rolled_back"
          ? "warn"
          : "neutral";
  return (
    <>
      <SectionHeading hint="Every listing write the copilot proposed — markdowns, stock fixes, ended listings — with its preflight and what happened. Nothing here ran without a person approving it.">
        Actions
      </SectionHeading>
      <Card className="mt-3">
        {rows.length === 0 ? (
          <EmptyState title="No actions were proposed.">
            The show never called for a listing write.
          </EmptyState>
        ) : (
          <ul>
            {rows.map((a) => (
              <li
                key={a.id}
                className="px-4 py-3 shadow-[0_1px_0_var(--hairline)] last:shadow-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone(a.status)}>{a.status.replace(/_/g, " ")}</Badge>
                  <Badge>{a.kind.replace(/_/g, " ")}</Badge>
                  <span className="min-w-0 flex-1 text-[12.5px]">{a.summary}</span>
                  {a.listingUrl ? (
                    <a
                      href={a.listingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-accent hover:underline"
                    >
                      View on eBay <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : null}
                  <span className="num text-[11px] text-text-muted">
                    {new Date(a.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                {a.rationale ? (
                  <p className="mt-1 text-[11.5px] text-text-muted">{a.rationale}</p>
                ) : null}
                {a.preflight?.checks?.length ? (
                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px]">
                    {a.preflight.checks.map((c) => (
                      <li key={c.name} className={c.ok ? "text-text-secondary" : "text-bad"}>
                        {c.ok ? "✓" : "✕"} {c.name}
                        {c.detail ? (
                          <span className="num text-text-muted"> ({c.detail})</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {a.error ? <p className="mt-1 text-[11.5px] text-bad">{a.error}</p> : null}
                <p className="num mt-1 text-[10.5px] text-text-faint">{a.idempotencyKey}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/** The hash-chained audit, in full. */
function Audit({ record }: { record: ShowRecord | null }) {
  if (!record) return <Loading what="the chain" />;
  const rows = [...record.audit].reverse();
  return (
    <>
      <SectionHeading hint="Every entry in the chain, newest first. Each hashes the one before it, so nothing can be edited or removed without breaking every hash after it — the report's 'intact' is a check over exactly these rows.">
        Audit chain
      </SectionHeading>
      <Card className="mt-3 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="The chain is empty.">
            Nothing happened that needed recording.
          </EmptyState>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12px]">
              <thead>
                <tr className="text-left text-[11px] text-text-muted">
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">At</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">What</th>
                  <th className="px-3 py-2 font-medium">Hash</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.seq} className="shadow-[0_1px_0_var(--hairline)] last:shadow-none">
                    <td className="num px-4 py-1.5 text-text-muted">{e.seq}</td>
                    <td className="num px-3 py-1.5 text-text-muted">
                      {new Date(e.at).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge {...(e.actorType === "copilot" ? { tone: "accent" as const } : {})}>
                        {e.actorType}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="block">{e.summary}</span>
                      <span className="text-[11px] text-text-muted">
                        {e.kind.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="num px-3 py-1.5 text-[11px] text-text-faint">
                      {e.hash.slice(0, 12)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Bar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone?: "ok";
}) {
  const ratio = total ? value / total : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[110px] shrink-0 text-[12px] text-text-secondary">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline">
        <span
          className={`block h-full rounded-full ${tone === "ok" ? "bg-ok" : "bg-hairline-strong"}`}
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </span>
      <span className="num w-14 shrink-0 text-right text-[12px]">
        {value} / {total}
      </span>
    </div>
  );
}

/**
 * The PRD's one unmeasurable metric, stated as what it is.
 *
 * `sentThenContradicted` is a machine proxy — a sent reply whose grounding a
 * later state change broke — and it is NOT the same as "a wrong reply reached a
 * buyer". Both numbers are floors.
 */
function UnmeasurableNote({ report }: { report: ShowReport }) {
  const notMeasured = report.prd?.notMeasured[0];
  const flagged = report.safety.flaggedWrong ?? 0;
  return (
    <Card className="mt-3 flex gap-2.5 bg-elevated px-4 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
      <div>
        <div className="text-[12.5px] font-semibold">
          {notMeasured?.metric ?? "Wrong replies that reached a buyer"} —{" "}
          <span className="text-bad">{flagged} flagged by you</span>, and an unknown number nobody
          caught.
        </div>
        <p className="mt-1 max-w-[900px] text-[12px] leading-relaxed text-text-secondary">
          {notMeasured?.why ??
            "A reply this system judged correct is exactly the reply it cannot mark wrong."}{" "}
          The nearest machine proxy — replies whose grounding a later state change contradicted —
          stands at{" "}
          <span className="num text-text">{report.prd?.trust.sentThenContradicted ?? "—"}</span> for
          this show, and it is not the same thing. Both are floors.
        </p>
      </div>
    </Card>
  );
}

/**
 * A gap, and the one thing worth doing about it.
 *
 * The list has named every unanswered question since the report was written,
 * and there was nothing to do with one — the fix meant editing catalog JSON by
 * hand. Writing the answer here puts it in the catalog, where the next show
 * picks it up as grounding, and into this show too if it is still on air.
 */
function GapRow({
  gap,
  catalogId,
  showId,
}: {
  gap: { question: string; asked: number; reason: string };
  catalogId: string | null;
  showId: string;
}) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!catalogId || !answer.trim()) return;
    setState("saving");
    setError(null);
    try {
      await api.answerGap(catalogId, { question: gap.question, answer: answer.trim(), showId });
      setState("saved");
      setOpen(false);
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    }
  }

  return (
    <li className="shadow-[0_1px_0_var(--hairline)] last:shadow-none">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="num w-7 shrink-0 text-[12px] text-text-muted">×{gap.asked}</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px]">{gap.question}</span>
        <span className="hidden shrink-0 text-[11.5px] text-text-muted sm:block">{gap.reason}</span>
        {state === "saved" ? (
          <Badge tone="ok">in the catalog</Badge>
        ) : catalogId ? (
          <BadgeButton tone={open ? "accent" : "neutral"} onClick={() => setOpen((o) => !o)}>
            Answer
          </BadgeButton>
        ) : (
          <Badge title="No catalog to write the answer into — load one in Setup and it becomes the place these answers live.">
            no catalog
          </Badge>
        )}
      </div>

      {open ? (
        <div className="anim-in px-4 pb-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
            }}
            rows={2}
            autoFocus
            placeholder="The answer this question should have had…"
            className="w-full resize-none rounded-sm bg-canvas px-2.5 py-2 text-[12.5px] leading-relaxed z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={!answer.trim() || state === "saving"}
            >
              {state === "saving" ? "Saving…" : "Add to the catalog"}
            </Button>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <span className="text-[11.5px] text-text-muted">
              {error ?? "Grounds the next session — and this one, if it is still on air."}
            </span>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Gaps({ report }: { report: ShowReport }) {
  const dropped = Object.entries(report.gaps.droppedByGate).sort((a, b) => b[1] - a[1]);

  // A show that ran without a catalog picked still produced gaps worth closing,
  // and the answers have to go somewhere. Rather than disabling the whole
  // section, ask which inventory — it is one question with an obvious default.
  const [catalogs, setCatalogs] = useState<CatalogSummary[]>([]);
  const [chosen, setChosen] = useState<string | null>(report.catalogId ?? null);
  useEffect(() => {
    if (report.catalogId) return;
    void api
      .catalogs()
      .then((c) => {
        setCatalogs(c);
        setChosen((cur) => cur ?? c[0]?.id ?? null);
      })
      .catch(() => setCatalogs([]));
  }, [report.catalogId]);

  return (
    <>
      <SectionHeading hint="The part worth acting on: every question the catalog could not ground an answer for, ranked by how many buyers walked into it. Each line is a field your listings should carry.">
        Fix before the next show
      </SectionHeading>

      {!report.catalogId && catalogs.length > 1 ? (
        <label className="mt-3 flex items-center gap-2 text-[12px] text-text-muted">
          Write answers to
          <select
            value={chosen ?? ""}
            onChange={(e) => setChosen(e.target.value)}
            className="rounded-sm bg-panel px-2 py-1 text-[12.5px] text-text z1 focus:outline-none focus:ring-[1.5px] focus:ring-accent"
          >
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="flex items-center justify-between px-4 py-2.5 text-[12px] text-text-muted shadow-[0_1px_0_var(--hairline)]">
            <span>asked · nothing to ground an answer</span>
            <span className="num">
              {report.gaps.unanswered.reduce((a, g) => a + g.asked, 0)} questions ·{" "}
              {report.gaps.unanswered.length} distinct
            </span>
          </div>
          {report.gaps.unanswered.length === 0 ? (
            <EmptyState title="Nothing went unanswered">
              Every admitted question resolved to something the catalog could stand on.
            </EmptyState>
          ) : (
            <ul>
              {report.gaps.unanswered.map((g, i) => (
                <GapRow key={i} gap={g} catalogId={chosen} showId={report.showId} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="px-4 py-2.5 text-[12px] text-text-muted shadow-[0_1px_0_var(--hairline)]">
            dropped before drafting — the admission gate
          </div>
          <ul className="py-1">
            {dropped.map(([reason, n]) => (
              <li key={reason} className="flex justify-between px-4 py-1.5 text-[12.5px]">
                <span className="min-w-0 truncate">{reason}</span>
                <span className="num text-text-secondary">{n}</span>
              </li>
            ))}
          </ul>
          <p className="px-4 py-2.5 text-[11.5px] leading-relaxed text-text-muted shadow-[0_-1px_0_var(--hairline)]">
            Reply volume is the anti-metric. A system optimising for it would answer the reactions,
            which is what this gate exists to refuse.
          </p>
        </Card>
      </div>

      <Card className="mt-3 flex items-center gap-3 px-4 py-3">
        <Badge tone="accent">next</Badge>
        <p className="min-w-0 flex-1 text-[12.5px] text-text-secondary">
          These carry into your next session's readiness check, so the fix is offered where it can
          still be made.
        </p>
        <Link to="/">
          <BadgeButton tone="accent">
            Start the next show <ArrowUpRight className="size-3" aria-hidden />
          </BadgeButton>
        </Link>
      </Card>
    </>
  );
}
