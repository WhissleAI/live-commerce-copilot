/**
 * What the pills mean — once, on the first session, and on demand after that.
 *
 * The console is dense by design: six guard pills, a topic badge, a confidence
 * bar and a latency figure on every card. Each is legible once you know it and
 * opaque before that, and nothing in the product ever said what they were. A
 * seller's first session is the worst possible time to be guessing whether a grey
 * "– price" means passed, skipped or broken.
 *
 * Shown automatically once (remembered per browser), and after that it is a
 * command: ⌘K → "What the pills mean". Never shown a second time by itself —
 * an explainer that reappears is a nag.
 */

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Button, GuardPill, Key } from "@/components/ui/kit";
import { GUARD_MEANS, GUARD_ORDER } from "@/lib/format";
import type { GuardName } from "@/lib/types";

/**
 * The two guards that do not run everywhere.
 *
 * They are listed with the other six rather than in a section of their own —
 * they are the same kind of thing and they leave the same kind of pill — but a
 * pill an operator has never seen on their console needs to say why, or its
 * absence reads as something missing rather than as something that did not
 * apply.
 */
const SURFACE_GUARDS: { guard: GuardName; only: string }[] = [
  {
    guard: "community_rule",
    only: "only where the room has rules of its own — a subreddit, a channel",
  },
  { guard: "sponsor", only: "only where a sponsored segment has approved copy to check against" },
];

const SEEN_KEY = "sidestage.legend.v1";

export function legendSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Private windows and blocked site data throw here. Showing the legend one
    // extra time is a better failure than crashing the console.
    return false;
  }
}

export function markLegendSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* nothing to remember it with — fine */
  }
}

const GUARDS: { mark: string; tone: string; name: string; means: string }[] = [
  {
    mark: "✓",
    tone: "border-ok/45 bg-ok/12 text-ok",
    name: "passed",
    means: "the guard ran on this draft and had no objection",
  },
  {
    mark: "!",
    tone: "border-warn/45 bg-warn/12 text-warn",
    name: "revised",
    means: "it sent the draft back once; what you see is the re-grounded version",
  },
  {
    mark: "✕",
    tone: "border-bad/50 bg-bad/12 text-bad",
    name: "blocked",
    means: "the reply cannot be sent — the card says which claim failed and why",
  },
  {
    mark: "–",
    tone: "border-hairline-strong bg-canvas text-text-muted",
    name: "not applicable",
    means: "nothing in this reply for that guard to check, so it did not run",
  },
];

export function LegendOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-canvas/80 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="What the pills mean"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-in w-[560px] max-w-full overflow-hidden rounded-lg bg-panel z4"
      >
        <div className="flex items-center gap-2 px-4 py-3 shadow-[0_1px_0_var(--hairline)]">
          <h2 className="flex-1 text-[14px] font-semibold">Reading a proposal card</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-text"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <section>
            <p className="text-[12.5px] leading-relaxed text-text-secondary">
              Six guards run on every drafted reply, in order, and each leaves a pill — plus two
              more on surfaces that have them. The pills are the reply&apos;s receipt: they say what
              was checked, not what the model thought.
            </p>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {GUARDS.map((g) => (
                <li key={g.name} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px]",
                      g.tone,
                    )}
                  >
                    <span className="num">{g.mark}</span> price
                  </span>
                  <span className="w-[88px] shrink-0 text-[12px] font-medium">{g.name}</span>
                  <span className="min-w-0 flex-1 text-[12px] text-text-secondary">{g.means}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* What each guard is FOR. The marks above say how to read a pill;
              this says what the pill is about — and it is the only place the
              two surface-specific guards can be met before they appear. */}
          <section>
            <div className="section-header">what each one checks</div>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {GUARD_ORDER.map((g) => (
                <li key={g} className="flex items-start gap-2.5">
                  <span className="w-[92px] shrink-0">
                    <GuardPill guard={g} verdict="allow" />
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] leading-snug text-text-secondary">
                    {GUARD_MEANS[g]}
                  </span>
                </li>
              ))}
              {SURFACE_GUARDS.map(({ guard, only }) => (
                <li key={guard} className="flex items-start gap-2.5">
                  <span className="w-[92px] shrink-0">
                    <GuardPill guard={guard} verdict="allow" />
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] leading-snug text-text-secondary">
                    {GUARD_MEANS[guard]}
                    <span className="block text-[11px] text-text-muted">{only}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="text-[12.5px] leading-relaxed text-text-secondary">
              The chips above them are the facts the answer stands on — a listing field, a policy
              clause, a past answer. Hover one to read it; press <Key>I</Key> to open the whole
              story of a reply in the inspector.
            </p>
          </section>

          <section className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">topic</Badge>
            <span className="text-[12px] text-text-secondary">
              what the buyer asked about — price, stock, sizing, shipping.
            </span>
          </section>

          <section className="flex flex-wrap items-center gap-2">
            <span className="num text-[12px] text-text-secondary">0.86</span>
            <span className="flex gap-0.5" aria-hidden>
              <span className="h-2 w-1 rounded-[1px] bg-ok" />
              <span className="h-2 w-1 rounded-[1px] bg-ok" />
              <span className="h-2 w-1 rounded-[1px] bg-ok" />
            </span>
            <span className="text-[12px] text-text-secondary">
              confidence, and beside it how long the reply took against the two-second budget.
            </span>
          </section>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 shadow-[0_-1px_0_var(--hairline)]">
          <span className="flex-1 text-[11.5px] text-text-muted">
            This is shown once. <Key>⌘K</Key> brings it back.
          </span>
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
