import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, Check, Eye, SlidersHorizontal, UserRound, Wallet } from "lucide-react";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One menu for everything that is not the live show.
 *
 * These used to be four separate chips competing for the top bar during a show —
 * account, analytics, guardrails, cost — which is exactly the wrong trade: the
 * bar is read at a glance while a buyer waits, and none of those four are read
 * then. Collapsing them behind the identity leaves the bar for the things that
 * change second to second (viewers, latency, autonomy) and gives the rest one
 * predictable place.
 *
 * The identity is the trigger on purpose. "Who am I acting as" and "what can I
 * do" are the same question, and a guest finding out they cannot send by
 * clicking Send is a worse answer than the menu saying so.
 */
export function AppMenu({
  account,
  onClaim,
  onToggleCost,
  costOpen,
}: {
  account: Account | null;
  onClaim?: (() => void) | undefined;
  /** Only the console has a cost rail to toggle; elsewhere this is absent. */
  onToggleCost?: (() => void) | undefined;
  costOpen?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const guest = account?.kind === "guest";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={account ? `Acting as ${account.displayName}` : "Starting a session…"}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11px] transition-colors",
          guest
            ? "border-warn/50 bg-warn/10 text-warn hover:bg-warn/15"
            : "border-hairline-strong text-text-secondary hover:text-text",
        )}
      >
        {guest ? <Eye className="size-3" aria-hidden /> : <UserRound className="size-3" aria-hidden />}
        <span className="max-w-[10rem] truncate">
          {account ? (guest ? "watching" : account.displayName) : "…"}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="anim-in absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-[6px] border border-hairline bg-panel shadow-lg"
        >
          <div className="border-b border-hairline px-3 py-2.5">
            <div className="text-[12px] font-medium text-text">
              {account?.displayName ?? "No session"}
            </div>
            <div className="mt-0.5 text-[10px] leading-snug text-text-muted">
              {guest
                ? "A guest can watch the show and read every proposal, but cannot send a reply or approve an action."
                : account
                  ? "Signed in as the operator. Replies you send and actions you approve are recorded against this account."
                  : "The console mints a session on load."}
            </div>
            {guest && onClaim ? (
              <button
                type="button"
                onClick={() => {
                  onClaim();
                  setOpen(false);
                }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[4px] border border-accent bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground hover:bg-accent/85"
              >
                <Check className="size-3" aria-hidden /> take control
              </button>
            ) : null}
          </div>

          <nav className="py-1">
            <Item to="/analytics" icon={<BarChart3 className="size-3.5" aria-hidden />} onDone={() => setOpen(false)}>
              Analytics
              <Sub>answered rate, guard blocks, what the agent did, cost</Sub>
            </Item>
            <Item to="/settings" icon={<SlidersHorizontal className="size-3.5" aria-hidden />} onDone={() => setOpen(false)}>
              Guardrails
              <Sub>never-say list, discount cap, what is armed on the agent</Sub>
            </Item>
            {onToggleCost ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onToggleCost();
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-[12px] text-text hover:bg-elevated"
              >
                <Wallet className="mt-[1px] size-3.5 shrink-0 text-text-muted" aria-hidden />
                <span>
                  {costOpen ? "Hide cost rail" : "Cost rail"}
                  <Sub>this show&rsquo;s gateway calls, beside the live queue</Sub>
                </span>
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}

function Item({
  to,
  icon,
  children,
  onDone,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onDone: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onDone}
      className="flex items-start gap-2.5 px-3 py-2 text-[12px] text-text hover:bg-elevated"
    >
      <span className="mt-[1px] shrink-0 text-text-muted">{icon}</span>
      <span>{children}</span>
    </Link>
  );
}

const Sub = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-0.5 block text-[10px] leading-snug text-text-muted">{children}</span>
);
