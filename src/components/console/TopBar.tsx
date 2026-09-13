import { useState } from "react";
import { Radio, Users, ArrowUp, ArrowDown, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMs, formatPct, formatSeconds } from "@/lib/format";
import type { AutonomyLevel, ConnectionState, Metrics, ShowState } from "@/lib/types";
import { Bar, ConsoleButton, Hover } from "./primitives";
import { useNow } from "@/hooks/useNow";

const LEVELS: { level: AutonomyLevel; short: string; name: string; def: string }[] = [
  {
    level: "L0_OBSERVE",
    short: "L0",
    name: "Observe",
    def: "Copilot classifies chat but suggests nothing.",
  },
  {
    level: "L1_SUGGEST",
    short: "L1",
    name: "Suggest",
    def: "Copilot drafts replies; you send every one.",
  },
  {
    level: "L2_ONE_TAP",
    short: "L2",
    name: "One-tap",
    def: "Drafts are pre-approved for one keystroke send.",
  },
  {
    level: "L3_AUTO_REPLY",
    short: "L3",
    name: "Auto-reply",
    def: "Replies in allow-listed intents that pass every guardrail send themselves.",
  },
  {
    level: "L4_AUTO_ACT",
    short: "L4",
    name: "Auto-act",
    def: "Bounded actions (stock fixes, markdowns above your floor) execute themselves, with undo.",
  },
];

function LatencyMeter({ metrics }: { metrics: Metrics }) {
  const { p50, p95, p99, budgetMs, breaches } = metrics.latency;
  const ratio = p95 / budgetMs;
  const tone = ratio < 0.6 ? "ok" : ratio <= 1 ? "warn" : "bad";
  const color =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-bad";
  return (
    <Hover
      side="bottom"
      align="center"
      content={
        <div className="space-y-1">
          <div className="section-header mb-1.5">Reply latency</div>
          {(
            [
              ["p50", p50],
              ["p95", p95],
              ["p99", p99],
              ["budget", budgetMs],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{k}</span>
              <span className="num text-text">{formatMs(v)}</span>
            </div>
          ))}
          <div className="flex justify-between">
            <span>budget breaches</span>
            <span className="num text-text">{breaches}</span>
          </div>
          <div className="flex justify-between">
            <span>cache hit rate</span>
            <span className="num text-text">{formatPct(metrics.cacheHitRate)}</span>
          </div>
        </div>
      }
    >
      <span
        tabIndex={0}
        className="flex items-center gap-2 rounded-[4px] px-1.5 py-1 hover:bg-elevated"
        aria-label={`p95 latency ${formatMs(p95)} of ${formatMs(budgetMs)} budget`}
      >
        <span className="section-header">p95</span>
        <span className={cn("num text-[16px] leading-none font-medium", color)}>
          {Math.round(p95)}ms
        </span>
        <span className="w-16">
          <Bar ratio={ratio} tone={tone} />
        </span>
      </span>
    </Hover>
  );
}

function AutonomyLadder({
  level,
  onChange,
}: {
  level: AutonomyLevel;
  onChange: (l: AutonomyLevel) => void;
}) {
  const selectedIndex = LEVELS.findIndex((l) => l.level === level);
  const [pendingConfirm, setPendingConfirm] = useState<AutonomyLevel | null>(null);

  return (
    <div
      className="flex items-center overflow-hidden rounded-[4px] border border-hairline-strong"
      role="radiogroup"
      aria-label="Autonomy level"
    >
      {LEVELS.map((l, i) => {
        const selected = i === selectedIndex;
        const dimmed = i > selectedIndex;
        const needsConfirm = l.level === "L3_AUTO_REPLY" || l.level === "L4_AUTO_ACT";
        return (
          <Hover
            key={l.level}
            side="bottom"
            align={i > 2 ? "end" : "start"}
            interactive={needsConfirm}
            content={
              <div>
                <div className="mb-1 text-text">
                  <span className="num">{l.short}</span> {l.name}
                </div>
                <p>{l.def}</p>
                {needsConfirm && !selected ? (
                  <div className="mt-2 flex items-center gap-2 border-t border-hairline pt-2">
                    <span className="text-text-muted">Requires confirmation.</span>
                    <ConsoleButton
                      variant="primary"
                      className="h-6"
                      onClick={() => {
                        setPendingConfirm(null);
                        onChange(l.level);
                      }}
                    >
                      Enable
                    </ConsoleButton>
                  </div>
                ) : null}
              </div>
            }
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                if (needsConfirm && !selected) {
                  setPendingConfirm(l.level);
                  return;
                }
                onChange(l.level);
              }}
              className={cn(
                "flex h-7 items-center gap-1 border-r border-hairline px-2 text-[11px] transition-colors duration-150 ease-out last:border-r-0",
                selected
                  ? "bg-accent text-accent-foreground"
                  : "bg-panel text-text-secondary hover:bg-elevated hover:text-text",
                dimmed && !selected && "hatch text-text-muted",
                pendingConfirm === l.level && "ring-1 ring-accent ring-inset",
              )}
            >
              <span className="num">{l.short}</span>
              <span className="hidden xl:inline">{l.name}</span>
            </button>
          </Hover>
        );
      })}
    </div>
  );
}

export function TopBar({
  show,
  metrics,
  connection,
  viewerDelta,
  onAutonomy,
}: {
  show: ShowState;
  metrics: Metrics | null;
  connection: ConnectionState;
  viewerDelta: number;
  onAutonomy: (l: AutonomyLevel) => void;
}) {
  const now = useNow();
  const elapsed = (now - new Date(show.startedAt).getTime()) / 1000;

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-hairline bg-panel px-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="truncate text-[13px] font-semibold text-text">{show.title}</h1>
        <span className="truncate text-[12px] text-text-muted">{show.sellerHandle}</span>
      </div>

      <div className="flex items-center gap-1.5 rounded-[4px] border border-bad/40 bg-bad/10 px-2 py-1">
        <span className="anim-live size-1.5 rounded-full bg-bad" />
        <span className="text-[11px] font-semibold tracking-wide text-bad">LIVE</span>
        <span className="num text-[12px] text-text">{formatSeconds(elapsed)}</span>
      </div>

      <div className="flex items-center gap-1.5 text-text-secondary">
        <Users className="size-3.5" aria-hidden />
        <span className="num text-[13px] text-text">{show.viewers}</span>
        <span
          className={cn(
            "num flex items-center text-[11px]",
            viewerDelta >= 0 ? "text-ok" : "text-bad",
          )}
        >
          {viewerDelta >= 0 ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          )}
          {Math.abs(viewerDelta)}
        </span>
      </div>

      {metrics ? <LatencyMeter metrics={metrics} /> : null}

      <AutonomyLadder level={show.autonomyLevel} onChange={onAutonomy} />

      {connection !== "open" ? (
        <span className="flex items-center gap-1.5 rounded-[4px] border border-warn/40 bg-warn/10 px-2 py-1 text-[11px] text-warn">
          <Link2Off className="size-3" aria-hidden />
          reconnecting…
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[11px] text-text-muted">
          <Radio className="size-3" aria-hidden />
          stream
        </span>
      )}

      <div className="ml-auto flex items-center gap-3 text-[11px] text-text-muted">
        {metrics ? (
          <>
            <span>
              sent <span className="num text-text-secondary">{metrics.sent}</span>
            </span>
            <span>
              auto <span className="num text-text-secondary">{metrics.autoSent}</span>
            </span>
            <span>
              blocked <span className="num text-text-secondary">{metrics.blocked}</span>
            </span>
            <span>
              undone <span className="num text-text-secondary">{metrics.actionsRolledBack}</span>
            </span>
          </>
        ) : null}
      </div>
    </header>
  );
}
