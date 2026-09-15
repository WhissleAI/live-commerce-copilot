/**
 * The frame every screen sits in.
 *
 * Before this, each surface invented its own header — four patterns, three
 * content widths — and the only navigation in the product was an account
 * dropdown. You could not get from Analytics to Cost without going through it,
 * and no screen told you where you were.
 *
 * Three deliberate calls:
 *
 *  1. Navigation is a 52px RAIL, not a top bar. Vertical is the scarce axis in
 *     a console — it was already spending 92px of chrome plus six 36px section
 *     bars — and a rail costs 3.6% of the width and none of the height.
 *  2. A 28px LIVE STRIP rides above every screen that is not the console while
 *     a show is on air. Opening Cost mid-show used to mean losing all awareness
 *     that two proposals were queued and one was blocked.
 *  3. One INSPECTOR, right-docked. Every "tell me more" — a guard verdict, a
 *     fact, an audit entry, a sent reply — opens the same panel, instead of the
 *     five popover systems that grew up around them.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  FileText,
  MonitorPlay,
  PackageSearch,
  Search,
  SlidersHorizontal,
  Tv,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, API_BASE, ensureSession, signedIn } from "@/lib/api";
import { LogoMark } from "@/components/brand/Logo";
import type { Account, ShowSummary } from "@/lib/types";
import { Banner, Key } from "@/components/ui/kit";
import { BUILD_ID } from "@/generated/buildId";
import { CommandBar, type Command } from "@/components/app/CommandBar";

export type { Command };

export type Section =
  "shows" | "console" | "catalog" | "reports" | "analytics" | "cost" | "settings" | "account";

/**
 * Six destinations became five, and one of them is conditional.
 *
 *  · Home is the shows list, the paste box and Discover — everything a seller
 *    does between shows. It replaced "Shows", whose Live/Past/Following tabs
 *    were three views of the same list.
 *  · Console only exists while a show is on air. A rail button that opens
 *    "nothing is on air" is a button that lies about having somewhere to go.
 *  · Reports is not a destination: every finished show on Home carries its
 *    Report button, and Analytics lists them by show.
 */
const RAIL: { id: Section; label: string; to: string; icon: typeof Tv }[] = [
  { id: "shows", label: "Home", to: "/", icon: Tv },
  { id: "console", label: "Console", to: "/console", icon: MonitorPlay },
  { id: "catalog", label: "Catalog", to: "/catalog", icon: PackageSearch },
  { id: "analytics", label: "Analytics", to: "/analytics", icon: BarChart3 },
  { id: "cost", label: "Cost", to: "/cost", icon: Wallet },
  { id: "settings", label: "Settings", to: "/settings", icon: SlidersHorizontal },
];

export interface Tab {
  label: string;
  /** Omitted for a tab that is a view of the same route. */
  to?: string;
  count?: number | null;
  active?: boolean;
  onClick?: () => void;
}

/** Which show, if any, is on air — so every screen can say so. */
export function useLiveShow(): ShowSummary | null {
  const [live, setLive] = useState<ShowSummary | null>(null);
  useEffect(() => {
    let stop = false;
    const read = async () => {
      const shows = await api.shows().catch(() => [] as ShowSummary[]);
      // Only a show that is actually on air drives the strip and the rail
      // dot; an ended eBay show used to keep both lit.
      const onAir = shows.filter((s) => s.status === "live");
      if (!stop) setLive(onAir.find((s) => s.source === "ebaylive") ?? onAir[0] ?? null);
    };
    void read();
    const t = setInterval(read, 15_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);
  return live;
}

/**
 * Is the backend there. Every screen reads from it, and a screen that cannot
 * reach it renders as "nothing yet" — an empty shows list, a quiet console —
 * which is the wrong thing to show for a server that is down. Polled slowly
 * while healthy and quickly while not, so recovery is noticed within seconds.
 */
/**
 * Is a newer build deployed than the one this tab is running?
 *
 * Checked when the tab is (re)focused and every few minutes: a tab left open
 * across a deploy keeps its old code, and "the button does nothing" was the
 * old bundle, not the button. Says so with a Reload rather than reloading
 * under someone mid-task.
 */
function useNewerBuild(): boolean {
  const [newer, setNewer] = useState(false);
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const r = await fetch(`/build.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const { id } = (await r.json()) as { id?: string };
        if (!stopped && id && id !== BUILD_ID) setNewer(true);
      } catch {
        /* offline or a preview server without the file: nothing to say */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const t = setInterval(() => void check(), 3 * 60_000);
    void check();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(t);
    };
  }, []);
  return newer;
}

function useBackendHealth(): { ok: boolean; detail: string | null } {
  const [state, setState] = useState<{ ok: boolean; detail: string | null }>({
    ok: true,
    detail: null,
  });
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const probe = async () => {
      let ok = true;
      let detail: string | null = null;
      try {
        const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
        ok = r.ok;
        if (!ok) detail = `HTTP ${r.status}`;
      } catch (e) {
        ok = false;
        detail = (e as Error).message || "no response";
      }
      if (stop) return;
      setState({ ok, detail });
      timer = setTimeout(probe, ok ? 30_000 : 5_000);
    };
    void probe();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return state;
}

function Rail({ section }: { section: Section }) {
  const live = useLiveShow();
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    void ensureSession()
      .then(setAccount)
      .catch(() => setAccount(null));
  }, []);

  return (
    <nav
      aria-label="Sections"
      className="flex w-[52px] shrink-0 flex-col items-center gap-1 bg-panel py-2.5 shadow-[1px_0_0_var(--hairline)]"
    >
      <Link to="/" className="mb-1.5 grid size-9 place-items-center" title="SideStage">
        <LogoMark size={22} />
      </Link>

      {RAIL.filter((r) => r.id !== "console" || live || section === "console").map((r) => {
        const on = r.id === section;
        return (
          <Link
            key={r.id}
            to={r.to}
            title={r.label}
            aria-label={r.label}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative grid size-9 place-items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
              on ? "bg-elevated text-text" : "text-text-muted hover:bg-elevated hover:text-text",
            )}
          >
            <r.icon className="size-4" aria-hidden />
            {r.id === "console" && live ? (
              <span
                aria-hidden
                className="anim-live absolute top-1.5 right-1.5 size-1.5 rounded-full bg-bad"
              />
            ) : null}
          </Link>
        );
      })}

      <span className="mt-auto" />
      <Link
        to="/account"
        title={account ? `${account.displayName} · account` : "Account"}
        aria-label="Account"
        aria-current={section === "account" ? "page" : undefined}
        className={cn(
          "grid size-9 place-items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
          section === "account"
            ? "bg-elevated text-text"
            : "text-text-muted hover:bg-elevated hover:text-text",
        )}
      >
        <UserRound className="size-4" aria-hidden />
      </Link>
    </nav>
  );
}

/** `● LIVE 01:12:36 · Denim Vault · 2 awaiting · 1 blocked · Return to console` */
function LiveStrip({ show }: { show: ShowSummary }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - new Date(show.startedAt).getTime()) / 1000));
  const clock = [Math.floor(elapsed / 3600), Math.floor((elapsed % 3600) / 60), elapsed % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-2.5 bg-bad/[0.06] px-4 shadow-[0_1px_0_oklch(0.5468_0.2093_27.4/0.18)]"
      role="status"
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="anim-live size-1.5 rounded-full bg-bad" />
        <span className="text-[11px] font-semibold tracking-[0.04em] text-bad">LIVE</span>
      </span>
      <span className="num text-[12px]">{clock}</span>
      <span className="min-w-0 truncate text-[12px] text-text-secondary">{show.title}</span>
      {show.awaiting || show.blocked ? (
        <span className="shrink-0 text-[12px] text-text-muted">
          {show.awaiting ?? 0} awaiting
          {show.blocked ? ` · ${show.blocked} blocked` : ""}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void navigate({ to: "/console" })}
        className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xs px-1.5 py-0.5 text-[12px] text-text-secondary hover:bg-bad/10 hover:text-text"
      >
        Return to console <Key>⌘2</Key>
      </button>
    </div>
  );
}

export function AppShell({
  section,
  title,
  subtitle,
  actions,
  tabs,
  banner,
  inspector,
  inspectorTitle = "Inspector",
  onCloseInspector,
  children,
  /** What ⌘K can do on this screen, on top of navigation. */
  commands,
  /** The console manages its own scrolling and its own strip. */
  bare = false,
}: {
  section: Section;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: Tab[];
  banner?: ReactNode;
  inspector?: ReactNode;
  inspectorTitle?: ReactNode;
  onCloseInspector?: () => void;
  children: ReactNode;
  commands?: Command[];
  bare?: boolean;
}) {
  const live = useLiveShow();
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = useState(false);
  const health = useBackendHealth();
  const newerBuild = useNewerBuild();

  // No session, no app: every screen inside the shell needs a signed-in
  // seller. The landing page and the auth pages live outside it.
  useEffect(() => {
    if (!signedIn()) {
      void navigate({ to: "/login" });
      return;
    }
    void ensureSession().then((a) => {
      // `ensureSession` forgets the token only on a refusal; a null with the
      // token still present is a network problem, not a sign-out.
      if (!a && !signedIn()) void navigate({ to: "/login" });
    });
  }, [navigate]);

  // ⌘K belongs to the shell, not to a screen: the header promises it everywhere,
  // so it has to work everywhere. ⌘O is the same bar, opened to switch shows.
  // ⌘1…⌘7 are the rail in order.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      if (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "o") {
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= RAIL.length) {
        e.preventDefault();
        void navigate({ to: RAIL[n - 1]!.to });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas print:block print:h-auto print:overflow-visible">
      <div className="contents print:hidden">
        <Rail section={section} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {newerBuild ? (
          <Banner
            tone="neutral"
            title="A newer SideStage is deployed"
            action={
              <button type="button" onClick={() => window.location.reload()} className="underline">
                Reload
              </button>
            }
          >
            This tab is still running the build it opened with. Reload when convenient — nothing
            here is lost, and a show on air keeps running on eBay either way.
          </Banner>
        ) : null}
        {!health.ok ? (
          <Banner
            tone="bad"
            title="Cannot reach the copilot backend"
            action={
              <button type="button" onClick={() => window.location.reload()} className="underline">
                Retry
              </button>
            }
          >
            {API_BASE} — {health.detail ?? "no response"}. A show that is on air keeps running on
            eBay; this console is simply not attached to it. Retrying every 5 s; nothing is sent
            while disconnected.
          </Banner>
        ) : null}
        {banner}
        {live && section !== "console" ? (
          <div className="contents print:hidden">
            <LiveStrip show={live} />
          </div>
        ) : null}

        {title ? (
          <header className="flex h-11 shrink-0 items-center gap-3 bg-panel px-4 shadow-[0_1px_0_var(--hairline)]">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-semibold tracking-[-0.008em]">{title}</h1>
              {subtitle ? (
                <p className="truncate text-[11.5px] text-text-muted">{subtitle}</p>
              ) : null}
            </div>
            <span className="flex shrink-0 items-center gap-2">
              <CommandHint onClick={() => setCommandOpen(true)} />
              {actions}
            </span>
          </header>
        ) : null}

        {tabs?.length ? (
          <nav
            aria-label="Views"
            className="flex h-[34px] shrink-0 items-center gap-4 bg-panel px-4 shadow-[0_1px_0_var(--hairline)]"
          >
            {tabs.map((t) =>
              t.to ? (
                <Link
                  key={t.label}
                  to={t.to}
                  className={cn(
                    "flex h-[34px] items-center gap-1.5 text-[12.5px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
                    t.active
                      ? "font-medium text-text shadow-[inset_0_-2px_0_var(--accent)]"
                      : "text-text-muted hover:text-text hover:shadow-[inset_0_-2px_0_var(--hairline-strong)]",
                  )}
                >
                  {t.label}
                  {t.count != null ? (
                    <span className="num text-[11px] text-text-faint">{t.count}</span>
                  ) : null}
                </Link>
              ) : (
                <button
                  key={t.label}
                  type="button"
                  onClick={t.onClick}
                  aria-pressed={t.active}
                  className={cn(
                    "flex h-[34px] items-center gap-1.5 text-[12.5px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
                    t.active
                      ? "font-medium text-text shadow-[inset_0_-2px_0_var(--accent)]"
                      : "text-text-muted hover:text-text hover:shadow-[inset_0_-2px_0_var(--hairline-strong)]",
                  )}
                >
                  {t.label}
                  {t.count != null ? (
                    <span className="num text-[11px] text-text-faint">{t.count}</span>
                  ) : null}
                </button>
              ),
            )}
          </nav>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <main
            className={cn(
              "min-w-0 flex-1 print:overflow-visible",
              bare ? "flex flex-col" : "scroll-thin overflow-y-auto",
            )}
          >
            {bare ? (
              children
            ) : (
              <div className="anim-fade mx-auto w-full max-w-[1100px] px-6 py-5">{children}</div>
            )}
          </main>

          {inspector ? (
            <aside className="scroll-thin w-[380px] shrink-0 overflow-y-auto bg-panel shadow-[-1px_0_0_var(--hairline)]">
              <div className="flex h-11 items-center justify-between gap-2 px-4 shadow-[0_1px_0_var(--hairline)]">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                  {inspectorTitle}
                </span>
                <span className="flex items-center gap-2">
                  <Key>I</Key>
                  <button
                    type="button"
                    onClick={onCloseInspector}
                    aria-label="Close inspector"
                    className="text-text-muted hover:text-text"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              </div>
              <div className="p-4">{inspector}</div>
            </aside>
          ) : null}
        </div>
      </div>

      <CommandBar
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        {...(commands ? { commands } : {})}
      />
    </div>
  );
}

function CommandHint({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden items-center gap-2 rounded-sm bg-elevated px-2.5 py-1.5 text-[12px] text-text-muted hover:text-text lg:flex"
    >
      <Search className="size-3" aria-hidden />
      Search or run a command
      <Key className="ml-2">⌘K</Key>
    </button>
  );
}
