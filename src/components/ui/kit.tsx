/**
 * The eight primitives everything else is built from.
 *
 * Before this file the proposal card existed three times — console, anatomy
 * sheet, marketing page — and diverged three ways: four pill heights, three
 * radii and a 2px baseline jitter between two badges sitting on the same row.
 * Every inconsistency traced back to the same cause, which was that there was
 * no component, only copies.
 *
 * Rules that hold here and are not negotiable per-screen:
 *   · nothing below 11px, and 11px only on figures (`num`)
 *   · a badge has no border — it is a tint, so it never needs one
 *   · anything already sitting on its own surface has no outline either
 *   · an action is never a 20px chip; the floor for a hit target is 26px
 */

import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { GUARD_LABEL, INTENT_HUE, INTENT_LABEL } from "@/lib/format";
import type { ChatIntent, GuardName, Verdict } from "@/lib/types";

// ── badge ───────────────────────────────────────────────────────────────────

export type BadgeTone = "neutral" | "ok" | "warn" | "bad" | "accent";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-elevated text-text-secondary",
  // Darkened against their own tint: `--ok` on an ok wash was ~4.3:1.
  ok: "bg-ok/13 text-[oklch(0.46_0.13_147.8)]",
  warn: "bg-warn/15 text-[oklch(0.49_0.115_71.5)]",
  bad: "bg-bad/13 text-[oklch(0.48_0.19_27.4)]",
  accent: "bg-accent/10 text-accent",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-[3px] text-[12px] leading-[14px] font-medium whitespace-nowrap",
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A badge that is also a button. The flag-wrong control was an unlabelled 11px
 * glyph with a `title` attribute — for the one number the report cannot measure
 * on its own — and half the report's calls to action were 20px tall.
 */
export function BadgeButton({
  tone = "neutral",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BadgeTone }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-[12px] font-medium whitespace-nowrap",
        BADGE_TONE[tone],
        "enabled:hover:brightness-[0.94] enabled:active:brightness-[0.9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45",
        className,
      )}
      {...rest}
    >
      {/* `children` is destructured out of `rest`, so a self-closing button here
          rendered every BadgeButton in the product as an empty chip. */}
      {children}
    </button>
  );
}

/**
 * Topic, as a tint. The hues were re-spaced: "discount" used to sit at hue 20,
 * two degrees from the red that means blocked, on the one screen where red is
 * load-bearing. Topics now start at 105 and step 30–40°, and `other` carries no
 * hue at all, because it is not a topic.
 */
export function TopicBadge({
  intent,
  speechAct,
  dropReason,
  className,
}: {
  intent: ChatIntent;
  speechAct?: string | null | undefined;
  dropReason?: string | undefined;
  className?: string | undefined;
}) {
  const hue = INTENT_HUE[intent];
  const answerable = speechAct === "query" || speechAct === "command";
  const neutral = hue === null;
  return (
    <span
      title={
        (speechAct
          ? `${INTENT_LABEL[intent]} · ${ACT_NOTE[speechAct] ?? speechAct}`
          : INTENT_LABEL[intent]) + (dropReason ? ` — ${dropReason}` : "")
      }
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-[3px] text-[12px] leading-[14px] font-medium whitespace-nowrap",
        className,
      )}
      style={
        neutral
          ? undefined
          : { color: `oklch(0.44 0.13 ${hue})`, backgroundColor: `oklch(0.955 0.030 ${hue})` }
      }
      data-neutral={neutral ? "" : undefined}
    >
      {speechAct ? (
        <span
          aria-hidden
          className={cn(
            "size-[5px] rounded-full",
            answerable ? "bg-current" : "border border-current opacity-50",
          )}
        />
      ) : null}
      {INTENT_LABEL[intent]}
    </span>
  );
}

/** How an utterance reads on the speech-act axis — the host metadata's own
 *  vocabulary, so both sides of the room compare. */
const ACT_NOTE: Record<string, string> = {
  query: "a question — answerable",
  command: "asks for an action — answerable",
  inform: "a statement",
  greeting: "a greeting",
  wish: "wants the item, but asked nothing",
  other: "unclassified",
};

// ── guard pill ──────────────────────────────────────────────────────────────

export const GUARD_MARK: Record<Verdict | "n/a", string> = {
  allow: "✓",
  revise: "!",
  block: "✕",
  "n/a": "–",
};

export const GUARD_TONE: Record<Verdict | "n/a", BadgeTone> = {
  allow: "ok",
  revise: "warn",
  block: "bad",
  "n/a": "neutral",
};

/**
 * The pill, as a class string, for the two places that cannot use `GuardPill`
 * itself — the console's hover-wrapped strip and the legend's swatch column.
 *
 * CONTENT-42. Both of those hand-rolled their own copies with raw `text-ok` /
 * `text-warn` / `text-bad` on a `/12` wash at 10px, measuring 4.01 / 3.77 /
 * 4.49 against white. `BADGE_TONE` above was darkened for exactly this reason
 * and measures 5.66 / 5.31 / 5.83; the console never picked it up, and
 * `styles.css:86-88` records that "a guardrail pill's COLOUR is the whole
 * signal". So the failing copies are gone and both read from here. 11px is
 * this file's floor and the pill now respects it.
 */
export const GUARD_PILL_CLASS: Record<Verdict | "n/a", string> = {
  allow: `${BADGE_TONE.ok} border border-ok/45`,
  revise: `${BADGE_TONE.warn} border border-warn/45`,
  block: `${BADGE_TONE.bad} border border-bad/50`,
  "n/a": "bg-canvas text-text-muted border border-hairline-strong",
};

/** What a verdict is called out loud. The mark is a glyph and says nothing. */
export const VERDICT_WORD: Record<Verdict | "n/a", string> = {
  allow: "passed",
  revise: "revised",
  block: "blocked",
  "n/a": "did not apply",
};

/** Fixed order, fixed position, and `–` explicitly not a failure. The best
 *  idea in the product; most teams ship a single safe/unsafe badge. */
export function GuardPill({
  guard,
  verdict,
  className,
}: {
  guard: GuardName;
  verdict: Verdict | "n/a";
  className?: string;
}) {
  return (
    <Badge tone={GUARD_TONE[verdict]} className={cn("px-2", className)}>
      <span className="num" aria-hidden>
        {GUARD_MARK[verdict]}
      </span>
      <span aria-hidden>{GUARD_LABEL[guard]}</span>
      {/* The mark is a glyph. "✕ price" is what a screen reader was given for
          the one thing this product exists to show. */}
      <span className="sr-only">
        {GUARD_LABEL[guard]} {VERDICT_WORD[verdict]}
      </span>
    </Badge>
  );
}

// ── key ─────────────────────────────────────────────────────────────────────

export function Key({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "num inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-xs bg-elevated px-1.5 text-[11px] leading-none text-text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

// ── surfaces ────────────────────────────────────────────────────────────────

export function Card({
  children,
  className,
  tone,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  /** A card that carries state keeps its colour as a 1px edge — the only place
   *  a border survives, because here it IS the signal. */
  tone?: "ok" | "warn" | "bad" | "accent";
  onClick?: () => void;
}) {
  const edge =
    tone === "ok"
      ? "ring-1 ring-ok/40 bg-ok/[0.04]"
      : tone === "warn"
        ? "ring-1 ring-warn/45 bg-warn/[0.05]"
        : tone === "bad"
          ? "ring-1 ring-bad/45 bg-bad/[0.05]"
          : tone === "accent"
            ? "ring-[1.5px] ring-accent"
            : "z1";
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-md bg-panel",
        edge,
        // A card that does something says so on hover, and can be reached
        // and pressed from the keyboard like any other control.
        onClick &&
          "cursor-pointer transition-[box-shadow,transform] duration-150 hover:z2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("section-header", className)}>{children}</div>;
}

export function SectionHeading({
  children,
  hint,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="section-heading">{children}</h2>
      {hint ? (
        <p className="mt-1.5 max-w-[720px] text-[12.5px] leading-relaxed text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** A number with its unit, its target, and one line of what it means. */
export function StatTile({
  label,
  value,
  hint,
  tone,
  target,
  targetMet,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ok" | "warn" | "bad";
  /** The PRD's own number, shown beside the measurement rather than in a doc. */
  target?: string;
  targetMet?: boolean;
}) {
  return (
    <div className="rounded-md bg-panel px-4 py-3.5 z1">
      <div className="section-header">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={cn(
            "num text-[20px] leading-none",
            tone === "bad"
              ? "text-bad"
              : tone === "warn"
                ? "text-warn"
                : tone === "ok"
                  ? "text-ok"
                  : "text-text",
          )}
        >
          {value}
        </span>
        {target ? (
          <span
            className={cn(
              "num rounded-xs px-1.5 py-[2px] text-[11px]",
              targetMet
                ? "bg-ok/13 text-[oklch(0.46_0.13_147.8)]"
                : "bg-warn/15 text-[oklch(0.49_0.115_71.5)]",
            )}
          >
            {target}
          </span>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-1.5 text-[11.5px] leading-snug text-text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

// ── button ──────────────────────────────────────────────────────────────────

type ButtonSize = "xs" | "sm" | "md";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const SIZE: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-[12px]",
  sm: "h-7 px-2.5 text-[12.5px]",
  md: "h-9 px-3.5 text-[13px]",
};

// `enabled:` so a disabled button stops reacting to the pointer as well as
// looking dim — the two used to disagree, and a greyed button that still lit
// up on hover read as "try again".
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground enabled:hover:bg-accent/90 enabled:active:bg-accent/80 z1",
  secondary:
    "bg-elevated text-text enabled:hover:brightness-[0.95] enabled:active:brightness-[0.9]",
  ghost:
    "text-text-secondary enabled:hover:bg-elevated enabled:hover:text-text enabled:active:bg-hairline",
  danger: "bg-bad/12 text-[oklch(0.48_0.19_27.4)] enabled:hover:bg-bad/18 enabled:active:bg-bad/25",
};

export function Button({
  size = "sm",
  variant = "secondary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: ButtonSize; variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-sm font-medium whitespace-nowrap",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45",
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
}

// ── states ──────────────────────────────────────────────────────────────────

/** Empty, loading and failed are the three states an operator meets first, and
 *  the old design drew none of them. */
export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
      {icon ? <span className="text-text-faint">{icon}</span> : null}
      <div className="text-[15px] font-semibold">{title}</div>
      {children ? (
        <p className="max-w-[420px] text-[12.5px] leading-relaxed text-text-muted">{children}</p>
      ) : null}
      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "anim-shimmer block rounded-xs bg-[linear-gradient(90deg,var(--hairline)_0%,var(--elevated)_50%,var(--hairline)_100%)]",
        className,
      )}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 animate-spin rounded-full border-2 border-hairline border-t-accent",
        className,
      )}
    />
  );
}

/** One banner shape for every "something is wrong and here is the fix". */
export function Banner({
  tone,
  title,
  children,
  action,
  icon,
}: {
  tone: "bad" | "warn" | "neutral";
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-4",
        tone === "bad"
          ? "bg-bad/[0.07] text-bad shadow-[0_1px_0_oklch(0.5468_0.2093_27.4/0.18)]"
          : tone === "warn"
            ? "bg-warn/[0.07] text-warn shadow-[0_1px_0_oklch(0.5812_0.1264_71.5/0.2)]"
            : "bg-elevated text-text-secondary shadow-[0_1px_0_var(--hairline)]",
      )}
      style={{ minHeight: "var(--strip)" }}
      role={tone === "bad" ? "alert" : undefined}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="text-[12px] font-medium">{title}</span>
      {children ? (
        <span className="min-w-0 truncate text-[12px] text-text-muted">{children}</span>
      ) : null}
      {action ? <span className="ml-auto flex shrink-0 items-center gap-2">{action}</span> : null}
    </div>
  );
}
