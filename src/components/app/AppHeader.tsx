import { Radio } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Account } from "@/lib/types";
import { AppMenu } from "./AppMenu";

/**
 * The application header, for every surface that is not the live console.
 *
 * The console has its own top bar because a show needs viewers, latency and the
 * autonomy ladder in the same strip; everything else — the launcher, analytics,
 * guardrails — shares this one, so the wordmark and the account menu do not move
 * between screens.
 */
export function AppHeader({
  account,
  onClaim,
}: {
  account: Account | null;
  onClaim?: (() => void) | undefined;
}) {
  return (
    <header className="border-b border-hairline bg-panel">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-5">
        <Link
          to="/"
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-text-secondary hover:text-text"
        >
          <Radio className="size-3.5" aria-hidden />
          SideStage
        </Link>
        <AppMenu account={account} onClaim={onClaim} />
      </div>
    </header>
  );
}
