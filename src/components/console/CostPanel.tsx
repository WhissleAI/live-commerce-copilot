import { useCallback, useEffect, useState } from "react";
import { operatorMessage } from "@/lib/copy";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api";
import type { BillingSnapshot, DoorReport, GatewayDoor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConsoleButton, SectionHeader } from "./primitives";

/**
 * What the copilot costs — the operator's answer to "can I afford to run this".
 *
 * Three sources, kept visually apart because conflating them is how a dashboard
 * ends up quoting a token count as a price:
 *
 *   BALANCE   dollars, from the Whissle wallet. The only real money on screen.
 *   CONSUMED  tokens / seconds / characters, org-wide, from the platform meter.
 *   THIS APP  our own count of every call SideStage made, per session.
 *
 * The third exists because the platform cannot do it: `/usage/sessions` returns
 * `agent_id: null` for text turns, so there is no way to ask the gateway what
 * one session cost. We count our own calls instead, which is exact — we are the
 * one making them — and say so rather than implying the number came from
 * billing.
 */

const DOOR_LABEL: Record<GatewayDoor, string> = {
  chat_turn: "Buyer replies",
  utility_turn: "Session context",
  voice_start: "Host audio",
  // It is a knowledge-base upload, and the rail calls that page Knowledge.
  kb_upload: "Knowledge sync",
  // Metered since visual perception shipped, rendered nowhere until now.
  visual_read: "Camera reads",
  billing: "This panel",
};

const usd = (n: number | null | undefined) => (n == null ? "—" : `$${n.toFixed(n < 1 ? 4 : 2)}`);

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "bad" | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span
        className={cn(
          "num text-[12px] tabular-nums",
          tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-text",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** A read that failed says WHY. An empty panel and a missing scope must not
 *  look the same — that distinction is the difference between "you have spent
 *  nothing" and "your key cannot see the bill". */
function ReadFailure({
  what,
  error,
}: {
  what: string;
  error: { status: number; message: string };
}) {
  return (
    <div className="flex items-start gap-2 rounded-[4px] border border-warn/40 bg-warn/5 px-2 py-1.5">
      <AlertTriangle className="mt-[2px] size-3 shrink-0 text-warn" aria-hidden />
      <p className="text-[11px] leading-relaxed text-text-secondary">
        {/* CONTENT-23: this printed "{what} unavailable (403) — {message}".
            A status code is for whoever is reading the network tab. */}
        <span className="text-warn">{what} unavailable</span> —{" "}
        {operatorMessage(error.message ? new Error(error.message) : undefined, what)}
      </p>
    </div>
  );
}

function DoorRow({ door, report }: { door: GatewayDoor; report: DoorReport | undefined }) {
  // A backend that has never opened a door (an older build without
  // visual_read, say) sends no report for it; that is "nothing", not a crash.
  if (!report?.calls) return null;
  return (
    <div className="border-t border-hairline py-1.5 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] text-text-secondary">{DOOR_LABEL[door]}</span>
        <span className="num text-[12px] tabular-nums text-text">{report.calls}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
        <span className="num tabular-nums">p50 {report.p50Ms}ms</span>
        <span className="num tabular-nums">p95 {report.p95Ms}ms</span>
        {report.failures > 0 && (
          <span className="num tabular-nums text-bad">{report.failures} failed</span>
        )}
      </div>
      {/* Cleared the moment the door succeeds again, so a gateway rollout does
          not leave "service unavailable" on screen minutes after it ended. */}
      {report.lastError && (
        <p className="mt-1 truncate text-[10px] text-bad" title={report.lastError}>
          {report.lastError}
        </p>
      )}
    </div>
  );
}

export function CostPanel({ showId, onClose }: { showId: string | null; onClose: () => void }) {
  const [data, setData] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .billing(7)
      .then((d) => {
        setData(d);
        setFailed(null);
      })
      .catch((e: Error) => setFailed(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // A session is 60–120 minutes and the wallet moves slowly; polling harder than
    // this would spend gateway calls to watch gateway spend.
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const wallet = data?.wallet ?? null;
  const meter = data?.meter ?? null;
  const showSpend = showId ? data?.spend?.[showId] : undefined;
  const showCalls = showId ? meter?.byShow?.[showId] : undefined;

  const llm = data?.usage?.totals.find((t) => t.service === "llm") ?? null;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-hairline bg-panel">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <h2 className="text-[12px] font-medium text-text">This session</h2>
        <div className="flex items-center gap-1">
          <ConsoleButton onClick={load} aria-label="Refresh cost" disabled={loading}>
            <RefreshCw className={cn("size-3", loading && "animate-spin")} aria-hidden />
          </ConsoleButton>
          <ConsoleButton onClick={onClose} aria-label="Close cost panel">
            <X className="size-3" aria-hidden />
          </ConsoleButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {failed && (
          <p className="mt-3 text-[11px] text-bad">Could not reach the backend — {failed}</p>
        )}

        {/* ── what THIS session cost ──────────────────────────────────────────────────── */}
        <SectionHeader title="Spent this session" className="-mx-3" />
        {showCalls ? (
          <>
            <Row label="Whissle calls" value={String(showCalls.calls)} />
            <Row
              label="Failed"
              value={String(showCalls.failures)}
              tone={showCalls.failures ? "warn" : undefined}
            />
            <Row label="Context sent" value={`${compact(showCalls.contextChars)} chars`} />
            {showSpend && (
              <>
                <Row label="Wallet moved" value={`≤ ${usd(showSpend.spentUsd)}`} />
                {/* The caveat travels with the number, never only in the docs. */}
                <p className="mt-1 text-[10px] leading-relaxed text-text-muted">
                  Measured from the wallet since this session started at{" "}
                  {new Date(showSpend.openedAt).toLocaleTimeString()}. An upper bound: the wallet is
                  account-wide, so anything else running under this account is inside it. Account
                  totals are on{" "}
                  <a href="/analytics" className="text-accent hover:underline">
                    Analytics
                  </a>
                  .
                </p>
              </>
            )}
          </>
        ) : (
          <p className="py-1 text-[11px] text-text-muted">No gateway calls yet this session.</p>
        )}

        {/* ── the money ──────────────────────────────────────────────────── */}
        <SectionHeader title="Balance" className="-mx-3 mt-4" />
        {data?.walletError ? (
          <ReadFailure what="Wallet" error={data.walletError} />
        ) : (
          <>
            <Row
              label="Available"
              value={usd(wallet?.availableUsd)}
              tone={wallet?.lowBalance ? "bad" : undefined}
            />
            {wallet?.heldUsd ? <Row label="Held" value={usd(wallet.heldUsd)} /> : null}
            {wallet?.freeTestRemainingUsd ? (
              <Row label="Free test credit" value={usd(wallet.freeTestRemainingUsd)} />
            ) : null}
            {wallet?.ratePerMinUsd ? (
              <Row label="Voice rate" value={`${usd(wallet.ratePerMinUsd)}/min`} />
            ) : null}
            {wallet && !wallet.paymentsEnabled && (
              <p className="mt-1 text-[10px] text-warn">
                Payments are off — the agent stops answering when the balance runs out.
              </p>
            )}
          </>
        )}

        {/* ── our own calls, by door ─────────────────────────────────────── */}
        <SectionHeader title="Calls by purpose" className="-mx-3 mt-4" />
        {meter && meter.totals.calls > 0 ? (
          <div>
            {(Object.keys(DOOR_LABEL) as GatewayDoor[]).map((d) => (
              <DoorRow key={d} door={d} report={meter.doors[d]} />
            ))}
          </div>
        ) : (
          <p className="py-1 text-[11px] text-text-muted">Nothing measured yet.</p>
        )}

        {/* ── org-wide consumption ───────────────────────────────────────── */}
        <SectionHeader title="Account, last 7 days" className="-mx-3 mt-4" />
        {data?.usageError ? (
          <ReadFailure what="Usage" error={data.usageError} />
        ) : llm ? (
          <>
            <Row label="LLM tokens" value={compact(llm.quantity)} />
            <Row label="Turns billed" value={compact(llm.events)} />
            {llm.promptTokens != null && (
              <Row
                label="Prompt → completion"
                value={`${compact(llm.promptTokens)} → ${compact(llm.completionTokens ?? 0)}`}
              />
            )}
            {data?.usage?.totals
              .filter((t) => t.service !== "llm" && t.quantity > 0)
              .map((t) => (
                <Row
                  key={t.service}
                  label={t.service.replace(/_/g, " ")}
                  value={`${compact(t.quantity)} ${t.unit ?? ""}`.trim()}
                />
              ))}
          </>
        ) : (
          <p className="py-1 text-[11px] text-text-muted">No consumption recorded.</p>
        )}

        {/* The honest note about what these numbers are and are not. */}
        {data && (
          <p className="mt-4 border-t border-hairline pt-2 text-[10px] leading-relaxed text-text-muted">
            {data.attribution.note}
          </p>
        )}
      </div>
    </aside>
  );
}
