/**
 * Readiness — the screen between attaching and answering.
 *
 * `GET /api/catalogs/:id/readiness` has always returned checks that already
 * carry `blocker | warning | info`, including a live read-back of what is armed
 * on the agent. Nothing called it, so the launcher offered "start" with no gate
 * at all: a session could begin with half its grounding missing, which does not
 * fail loudly — it abstains on every question, and reads as a cautious model
 * rather than an absent corpus.
 *
 * Blockers disable the button. Warnings do not, and say what starting without
 * them costs.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Check, ExternalLink, Info, Loader2 } from "lucide-react";
import { api, API_BASE, tokenQuery } from "@/lib/api";
import type { CatalogFit, CatalogReadiness, ShowSummary } from "@/lib/types";
import { AppShell } from "@/components/app/AppShell";
import { Badge, Button, Card, SectionHeading, Skeleton } from "@/components/ui/kit";

export function SetupPage({ showId }: { showId?: string | undefined }) {
  const navigate = useNavigate();
  const [show, setShow] = useState<ShowSummary | null>(null);
  const [readiness, setReadiness] = useState<CatalogReadiness | null>(null);
  const [fit, setFit] = useState<CatalogFit | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const shows = await api.shows().catch(() => [] as ShowSummary[]);
    // An id the server does not know is "not found", not the first show it
    // does know — a readiness page for the wrong show is worse than none.
    const target = showId ? (shows.find((s) => s.showId === showId) ?? null) : (shows[0] ?? null);
    setShow(target);
    const [r, f] = await Promise.all([
      target?.catalogId
        ? api.catalogReadiness(target.catalogId, target.showId).catch(() => null)
        : Promise.resolve(null),
      api.showFit(target?.showId).catch(() => null),
    ]);
    setReadiness(r);
    setFit(f);
    setLoading(false);
  }, [showId]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const checks = readiness?.checks ?? [];
  const blockers = checks.filter((c) => !c.ok && c.severity === "blocker");
  const warnings = checks.filter((c) => !c.ok && c.severity === "warning");
  const bridge = show
    ? `${API_BASE}/audio-bridge?showId=${encodeURIComponent(show.showId)}&${tokenQuery()}`
    : null;

  return (
    <AppShell
      section="home"
      title={show ? "Ready to answer?" : "Monitor a show"}
      subtitle={
        show
          ? "the show is attached and being read — this is what the copilot can and cannot ground before you open the console"
          : "everything below is ingested once, before the copilot answers anything"
      }
      actions={
        // The show is ALREADY attached and ingesting by the time this page
        // exists — attaching happens on Home. The button used to read "Start
        // monitoring" and go grey behind blockers, which told the operator the
        // running show was not running. Blockers degrade answers; they do not
        // gate the console.
        <Button
          size="md"
          variant="primary"
          disabled={!show}
          onClick={() => void navigate({ to: "/console" })}
        >
          <ArrowRight className="size-3.5" aria-hidden />
          {blockers.length ? "Open console anyway" : "Open console"}
        </Button>
      }
    >
      {loading ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[220px]" />
        </div>
      ) : !show ? (
        <Card className="px-4 py-4 text-[12.5px] text-text-muted">
          No show is attached. Paste a stream on Home to begin.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
          <div className="flex flex-col gap-4">
            <Card className="px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="section-header">Stream</span>
                <span className="num text-[11px] text-text-muted">
                  {show.externalId ?? show.showId}
                </span>
                <Badge tone="ok" className="ml-auto">
                  <Check className="size-3" aria-hidden />
                  attached
                </Badge>
              </div>
              <div className="mt-3">
                <p className="text-[13px] font-medium">{show.title}</p>
                <p className="mt-0.5 text-[12px] text-text-muted">
                  {show.sellerHandle} · {show.viewers} watching · {show.listings} lots seen
                </p>
                {show.readOnly ? (
                  <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">
                    A show you do not own is monitored{" "}
                    <strong className="text-text">read-only</strong>: the copilot drafts replies and
                    proposes actions, but never writes to the listing and never posts to eBay.
                  </p>
                ) : null}
              </div>
            </Card>

            {readiness?.carried ? (
              <Card>
                <div className="flex items-center gap-2 px-4 py-3 shadow-[0_1px_0_var(--hairline)]">
                  <span className="section-header">Carried from your last show</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-text-muted">
                    {readiness.carried.title}
                  </span>
                  <Link to="/reports/$showId" params={{ showId: readiness.carried.fromShowId }}>
                    <Badge>open its report</Badge>
                  </Link>
                </div>
                <p className="px-4 pt-2.5 text-[11.5px] leading-relaxed text-text-muted">
                  {readiness.carried.gaps.length} question
                  {readiness.carried.gaps.length === 1 ? "" : "s"} the catalog could not ground last
                  time — this is the last moment to fix them before the same buyers ask again.
                </p>
                <ul className="pb-1">
                  {readiness.carried.gaps.slice(0, 6).map((g, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-1.5 text-[12.5px]">
                      <span className="num w-7 shrink-0 text-[11.5px] text-text-muted">
                        ×{g.asked}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{g.question}</span>
                      <span className="hidden shrink-0 text-[11px] text-text-muted sm:block">
                        {g.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {fit ? (
              <Card className="flex items-center gap-3 px-4 py-3">
                <span className="section-header">Catalog fit</span>
                <Badge
                  tone={
                    fit.verdict === "match"
                      ? "ok"
                      : fit.verdict === "mismatch"
                        ? "bad"
                        : fit.verdict === "weak"
                          ? "warn"
                          : "neutral"
                  }
                >
                  {fit.verdict}
                </Badge>
                <span className="text-[12px] text-text-muted">
                  {fit.verdict === "unknown"
                    ? "not enough lots seen yet to judge"
                    : `${Math.round(fit.overlap * 100)}% of the ${fit.sampled} lots seen resolve against this catalog`}
                </span>
              </Card>
            ) : null}
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 shadow-[0_1px_0_var(--hairline)]">
              <span className="section-header">Readiness</span>
              <span className="flex items-center gap-1.5">
                <Badge tone={blockers.length ? "bad" : "ok"}>{blockers.length} blockers</Badge>
                <Badge tone={warnings.length ? "warn" : "neutral"}>
                  {warnings.length} warnings
                </Badge>
              </span>
            </div>

            {checks.length === 0 ? (
              <p className="px-4 py-4 text-[12.5px] text-text-muted">
                This show grounds in the stream itself — there is no catalog to check. Every lot the
                host puts on screen becomes inventory the copilot can answer from.
              </p>
            ) : (
              <ul>
                {checks.map((c) => (
                  <li
                    key={c.name}
                    className="flex items-start gap-2.5 px-4 py-2.5 shadow-[0_1px_0_var(--hairline)] last:shadow-none"
                  >
                    {c.ok ? (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />
                    ) : c.severity === "blocker" ? (
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
                    ) : c.severity === "warning" ? (
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
                    ) : (
                      <Info className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={
                          c.ok
                            ? "text-[12.5px]"
                            : c.severity === "blocker"
                              ? "text-[12.5px] text-bad"
                              : "text-[12.5px] text-warn"
                        }
                      >
                        {c.name}
                      </span>
                      <span className="num mt-0.5 block text-[11px] leading-snug text-text-muted">
                        {c.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* What eBay expects, spelled out. The check above says a field is
                missing; this says which items and what eBay calls it, because
                "Department" is not guessable from "your catalog is incomplete". */}
            {readiness?.aspects && readiness.aspects.missing.length ? (
              <div className="px-4 py-3 shadow-[0_-1px_0_var(--hairline)]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-medium">
                    eBay requires these in {readiness.aspects.categoryName}
                  </span>
                  {readiness.aspects.required.map((a) => (
                    <Badge
                      key={a}
                      {...(readiness.aspects!.missing.includes(a)
                        ? { tone: "bad" as const }
                        : { tone: "ok" as const })}
                    >
                      {a}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">
                  Buyers filter on these, so a lot missing one does not appear in the search that
                  would have sold it — and the copilot cannot cite a field the catalog does not
                  carry. Category resolved from {readiness.aspects.sampledFrom}.
                </p>
              </div>
            ) : null}

            {bridge ? (
              <div className="px-4 py-3 shadow-[0_-1px_0_var(--hairline)]">
                <a href={bridge} target="_blank" rel="noreferrer">
                  <Button size="sm">
                    <ExternalLink className="size-3" aria-hidden /> Open the audio bridge
                  </Button>
                </a>
                <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">
                  A warning, not a blocker — you can start without it. The copilot then answers from
                  the catalog and chat only, and will not hear “last one in this waist”.
                </p>
              </div>
            ) : null}
          </Card>
        </div>
      )}

      {loading ? null : (
        <p className="mt-4 mb-8 flex items-center gap-2 text-[11.5px] text-text-muted">
          {blockers.length ? (
            <>
              <AlertTriangle className="size-3.5 text-bad" aria-hidden />
              The copilot will abstain on whatever a blocker covers until it is fixed. This page
              re-checks itself.
            </>
          ) : (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Re-checking every 8 seconds while you set up.
            </>
          )}
        </p>
      )}
    </AppShell>
  );
}
