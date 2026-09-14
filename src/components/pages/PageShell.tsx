import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { claimConsole, ensureSession } from "@/lib/api";
import type { Account } from "@/lib/types";
import { AppMenu } from "@/components/app/AppMenu";

/**
 * The frame for the two surfaces that are PAGES rather than rails.
 *
 * Settings and analytics are read between lots, not while a buyer waits — which
 * is exactly why they are not panels in the console. A rail competes with the
 * proposal queue for the operator's attention during a show; a page does not
 * exist until they choose to leave it.
 */
export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
}) {
  // These pages are reachable directly by URL, so they resolve their own
  // session rather than assuming the console ran first.
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    void ensureSession().then(setAccount).catch(() => setAccount(null));
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-hairline bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-1.5 rounded-[4px] border border-hairline-strong px-2 py-1 text-[11px] text-text-secondary hover:text-text"
          >
            <ArrowLeft className="size-3" aria-hidden /> console
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[14px] font-semibold text-text">{title}</h1>
            {subtitle ? <p className="truncate text-[11px] text-text-muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          <AppMenu
            account={account}
            onClaim={() => void claimConsole().then((a) => a && setAccount(a))}
          />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{title}</h2>
      {hint ? <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-text-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A number with its unit and a one-line explanation of what it means. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "ok" | "warn" | "bad" | undefined;
}) {
  return (
    <div className="rounded-[6px] border border-hairline bg-panel px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted">{label}</div>
      <div
        className={cn(
          "num mt-1 text-[18px] tabular-nums",
          tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-text",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] leading-snug text-text-muted">{hint}</div> : null}
    </div>
  );
}
