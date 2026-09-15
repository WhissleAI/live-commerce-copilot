import { useEffect, useRef, useState } from "react";
import {
  Radio,
  Users,
  ArrowUp,
  ArrowDown,
  Link2Off,
  LogOut,
  Lock,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMs, formatPct, formatSeconds } from "@/lib/format";
import type {
  Account,
  AutonomyLevel,
  ConnectionState,
  Metrics,
  SellerProfile,
  ShowState,
} from "@/lib/types";
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
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-bad";
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

/**
 * The copilot→automation ladder, as a menu.
 *
 * It was five segmented buttons wide enough to need two lines of label, taking
 * a third of the show bar to display four rungs the operator changes maybe
 * twice a session. A menu shows the one that is ACTIVE — which is the thing
 * they check at a glance — and puts the rest one click away with room for the
 * definition that makes each rung meaningful.
 *
 * The confirmation on the auto rungs survives the change: L3 and L4 let the
 * copilot act without a human, and that is not a thing to enable by mis-click.
 */
function AutonomyLadder({
  level,
  onChange,
}: {
  level: AutonomyLevel;
  onChange: (l: AutonomyLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<AutonomyLevel | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const current = LEVELS.find((l) => l.level === level) ?? LEVELS[0]!;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(null);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(null);
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const auto = level === "L3_AUTO_REPLY" || level === "L4_AUTO_ACT";

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        // Addressable, so ⌘K's "change the autonomy level" has something to open.
        id="autonomy-picker"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${current.name} — ${current.def}`}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-[4px] border px-2 text-[11px] transition-colors",
          // An autonomy level that can act without a human reads as a state, not
          // a setting — so it is coloured while the manual rungs are quiet.
          auto
            ? "border-warn/50 bg-warn/10 text-warn"
            : "border-hairline-strong bg-panel text-text-secondary hover:text-text",
        )}
      >
        <span className="num">{current.short}</span>
        <span className="hidden lg:inline">{current.name}</span>
        <ChevronDown className="size-3 opacity-60" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          onKeyDown={(e) => {
            const items = Array.from(
              box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
            );
            const i = items.findIndex((el) => el === document.activeElement);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const next =
                e.key === "ArrowDown"
                  ? (i + 1) % items.length
                  : (i - 1 + items.length) % items.length;
              items[next]?.focus();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className="anim-in absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-[6px] border border-hairline bg-panel shadow-lg"
        >
          {LEVELS.map((l) => {
            const selected = l.level === level;
            const needsConfirm = l.level === "L3_AUTO_REPLY" || l.level === "L4_AUTO_ACT";
            return (
              <div key={l.level} className="border-b border-hairline last:border-b-0">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    if (needsConfirm && !selected) {
                      setConfirming(l.level);
                      return;
                    }
                    onChange(l.level);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-elevated",
                    selected && "bg-accent/5",
                  )}
                >
                  <span
                    className={cn(
                      "num mt-[1px] w-5 shrink-0 text-[11px]",
                      selected ? "text-accent" : "text-text-muted",
                    )}
                  >
                    {l.short}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn("block text-[12px]", selected ? "text-accent" : "text-text")}
                    >
                      {l.name}
                      {selected && (
                        <span className="ml-1.5 text-[10px] text-text-muted">active</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-text-muted">
                      {l.def}
                    </span>
                  </span>
                </button>

                {confirming === l.level && (
                  <div className="flex items-center gap-2 border-t border-hairline bg-warn/5 px-3 py-2">
                    <span className="text-[10px] leading-snug text-warn">
                      This lets the copilot act without you. Sure?
                    </span>
                    <ConsoleButton
                      variant="primary"
                      className="ml-auto h-6"
                      onClick={() => {
                        onChange(l.level);
                        setConfirming(null);
                        setOpen(false);
                      }}
                    >
                      Enable
                    </ConsoleButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TopBar({
  show,
  seller,
  metrics,
  connection,
  viewerDelta,
  onAutonomy,
  onEndSession,
  endSessionLabel,
  onToggleCost,
  costOpen,
  account,
  onClaim,
}: {
  show: ShowState;
  seller?: SellerProfile | null;
  metrics: Metrics | null;
  connection: ConnectionState;
  viewerDelta: number;
  onAutonomy: (l: AutonomyLevel) => void;
  /** Leaves the console for the show picker. Always available. */
  onEndSession?: (() => void) | undefined;
  endSessionLabel?: string;
  onToggleCost: () => void;
  costOpen: boolean;
  account?: Account | null;
  onClaim?: () => void;
}) {
  const now = useNow();
  const elapsed = (now - new Date(show.startedAt).getTime()) / 1000;

  return (
    // sticky + z-40 so the bar survives any scrolling context around it, and so
    // the account menu — which is absolutely positioned inside this header —
    // renders OVER the panes below. No overflow here on purpose: a clipping
    // context would cut that menu off at the header's own edge.
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-hairline bg-panel px-3">
      {/* The show's name gets the room. Two chips used to sit here saying "eBay
          Live" and "read-only" — one restating the source already implied by the
          title, the other a permanent state that never changes during a session.
          Both are now the title's own tooltip and a single lock glyph, which
          leaves the one thing that differs between shows actually readable. */}
      {/* Priority order when the bar runs out of room, and it is the reverse of
          what it used to be: chips held their width while the show's NAME
          shrank to nothing. The name is the one thing that differs between two
          consoles, so it is the last thing dropped — everything measurable is
          also on a screen of its own. */}
      <div className="flex min-w-[120px] flex-1 items-baseline gap-2">
        <h1
          title={
            (show.readOnly
              ? "A monitored stream — the copilot drafts replies and proposes actions, but cannot write to the listing and never posts to eBay. "
              : "") + (show.source === "ebaylive" ? "Source: eBay Live." : "")
          }
          className="flex min-w-0 items-baseline gap-1.5 text-[13px] font-semibold text-text"
        >
          {show.readOnly && <Lock className="size-3 shrink-0 text-text-muted" aria-hidden />}
          <span className="truncate">{show.title}</span>
        </h1>
        <span className="shrink-0 truncate text-[12px] text-text-muted">
          {seller?.name ?? show.sellerHandle}
        </span>
        {onEndSession && (
          <button
            type="button"
            onClick={onEndSession}
            title="Leave this show and pick another"
            className="hidden shrink-0 items-center gap-1 rounded-[4px] border border-hairline-strong px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text sm:flex"
          >
            <LogOut className="size-2.5" aria-hidden /> {endSessionLabel ?? "End session"}
          </button>
        )}
      </div>

      {show.status === "ended" ? (
        <div className="flex items-center gap-1.5 rounded-[4px] border border-hairline bg-elevated px-2 py-1">
          <span className="text-[11px] font-semibold tracking-wide text-text-muted">ENDED</span>
          <span className="num text-[12px] text-text-secondary">{formatSeconds(elapsed)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-[4px] border border-bad/40 bg-bad/10 px-2 py-1">
          <span className="anim-live size-1.5 rounded-full bg-bad" />
          <span className="text-[11px] font-semibold tracking-wide text-bad">LIVE</span>
          <span className="num text-[12px] text-text">{formatSeconds(elapsed)}</span>
        </div>
      )}

      <div className="hidden items-center gap-1.5 text-text-secondary lg:flex">
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

      {metrics ? (
        <span className="hidden lg:flex">
          <LatencyMeter metrics={metrics} />
        </span>
      ) : null}

      <AutonomyLadder level={show.autonomyLevel} onChange={onAutonomy} />

      {/* Cost stays a first-class control on the show bar. It was folded into
          the account menu, which put the one number that changes while a show
          runs two clicks away — and made it look absent. */}
      <button
        type="button"
        onClick={onToggleCost}
        aria-pressed={costOpen}
        title="What this show is costing — balance, gateway calls, latency by purpose"
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11px] transition-colors",
          costOpen
            ? "border-accent bg-accent/10 text-accent"
            : "border-hairline-strong text-text-secondary hover:text-text",
        )}
      >
        <Wallet className="size-3" aria-hidden /> Cost
      </button>

      {connection !== "open" ? (
        <span className="flex items-center gap-1.5 rounded-[4px] border border-warn/40 bg-warn/10 px-2 py-1 text-[11px] text-warn">
          <Link2Off className="size-3" aria-hidden />
          Reconnecting…
        </span>
      ) : (
        <span className="hidden items-center gap-1 text-[11px] text-text-muted xl:flex">
          <Radio className="size-3" aria-hidden />
          Stream
        </span>
      )}

      <div className="ml-auto hidden items-center gap-3 text-[11px] text-text-muted xl:flex">
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
