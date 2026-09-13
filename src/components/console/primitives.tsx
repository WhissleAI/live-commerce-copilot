import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { INTENT_HUE, INTENT_LABEL } from "@/lib/format";
import type { ChatIntent } from "@/lib/types";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "num inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-hairline-strong bg-canvas px-1 text-[10px] leading-none text-text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function SectionHeader({
  title,
  children,
  className,
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center justify-between gap-2 border-b border-hairline px-3",
        className,
      )}
    >
      <span className="section-header">{title}</span>
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
            "anim-in absolute z-50 w-72 rounded-md border border-hairline-strong bg-elevated p-2.5 text-[12px] leading-snug text-text-secondary",
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

export function IntentBadge({
  intent,
  className,
  animate = false,
}: {
  intent: ChatIntent;
  className?: string;
  animate?: boolean;
}) {
  const hue = INTENT_HUE[intent];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[4px] border px-1.5 text-[10px] leading-4 font-medium",
        animate && "anim-in",
        className,
      )}
      style={{
        color: `oklch(0.78 0.09 ${hue})`,
        borderColor: `oklch(0.42 0.06 ${hue})`,
        backgroundColor: `oklch(0.26 0.03 ${hue})`,
      }}
    >
      {INTENT_LABEL[intent]}
    </span>
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

export function ConsoleButton({
  children,
  variant = "ghost",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-[4px] border px-2 text-[12px] font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" &&
          "border-accent bg-accent text-accent-foreground hover:bg-accent/85",
        variant === "secondary" &&
          "border-hairline-strong bg-elevated text-text hover:border-text-muted",
        variant === "ghost" &&
          "border-transparent bg-transparent text-text-secondary hover:bg-elevated hover:text-text",
        variant === "danger" && "border-bad/50 bg-transparent text-bad hover:bg-bad/10",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
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
