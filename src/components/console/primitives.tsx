import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, TopicBadge } from "@/components/ui/kit";
import type { ChatIntent } from "@/lib/types";

/** Re-exported so console code keeps its old name while there is one key cap. */
export { Key as Kbd } from "@/components/ui/kit";

/**
 * A pane's label line.
 *
 * This used to be a full-width 36px bar with a 1px rule and a tracked-uppercase
 * word. Six of them in a 900px console is 216px of chrome — a quarter of the
 * viewport — before a single piece of operator content. Now it is a 26px
 * borderless line inside the pane's own padding, and the panes are separated by
 * a gutter instead of a rule.
 */
export function SectionHeader({
  title,
  leading,
  children,
  className,
}: {
  title: string;
  /** Sits before the title. Narrow layouts put a drawer toggle here rather than
   *  floating one over the row, which used to land on top of the counts. */
  leading?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex h-[26px] shrink-0 items-center justify-between gap-2 px-3", className)}
    >
      <span className="flex min-w-0 items-center gap-2">
        {leading}
        <span className="section-header">{title}</span>
      </span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/** Hover/focus popover. `interactive` keeps it open while the pointer is inside. */
export function Hover({
  children,
  content,
  side = "bottom",
  align = "start",
  interactive = false,
  className,
  panelClassName,
}: {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  interactive?: boolean;
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          className={cn(
            "anim-in absolute z-50 w-72 rounded-md bg-panel p-3 text-[12.5px] leading-snug text-text-secondary z3",
            interactive ? "pointer-events-auto" : "pointer-events-none",
            side === "bottom" ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]",
            align === "start" && "left-0",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "end" && "right-0",
            panelClassName,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

/** Kept as a name because the console calls it this; the geometry, the hues and
 *  the speech-act dot all live in the one shared badge now. */
export function IntentBadge({
  intent,
  speechAct,
  dropReason,
  className,
  animate = false,
}: {
  intent: ChatIntent;
  speechAct?: string | null | undefined;
  dropReason?: string | undefined;
  className?: string;
  animate?: boolean;
}) {
  return (
    <TopicBadge
      intent={intent}
      speechAct={speechAct}
      dropReason={dropReason}
      className={cn(animate && "anim-in", className)}
    />
  );
}

export function Bar({
  ratio,
  tone,
  className,
}: {
  ratio: number;
  tone: "ok" | "warn" | "bad" | "accent";
  className?: string;
}) {
  const color =
    tone === "ok"
      ? "var(--color-ok)"
      : tone === "warn"
        ? "var(--color-warn)"
        : tone === "bad"
          ? "var(--color-bad)"
          : "var(--color-accent)";
  return (
    <span className={cn("block h-1 w-full overflow-hidden rounded-[2px] bg-hairline", className)}>
      <span
        className="block h-full rounded-[2px] transition-[width] duration-150 ease-out"
        style={{ width: `${Math.min(100, Math.max(2, ratio * 100))}%`, background: color }}
      />
    </span>
  );
}

/** The console's own name for the shared button. Three heights exist — 24 in a
 *  row, 28 by default, 36 for a primary call — and nothing else. */
export function ConsoleButton({
  children,
  variant = "ghost",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <Button variant={variant} size="sm" className={className} {...rest}>
      {children}
    </Button>
  );
}

export function Dots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 rounded-full bg-text-muted"
          style={{ animation: `ss-dot 1.4s ${i * 0.16}s ease-in-out infinite` }}
        />
      ))}
    </span>
  );
}
