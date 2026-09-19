/**
 * ⌘K — go somewhere, do something, find a show.
 *
 * The shell advertised "Search or run a command ⌘K" in every header while ⌘K
 * opened a product-research box that only existed on the console. Two different
 * things were wearing one shortcut, and the one the chrome promised was the one
 * that did not exist.
 *
 * So: ⌘K is the product's command surface — every rail destination, the actions
 * of whatever screen you are on, and a search over your shows that goes to the
 * console for a live one and the report for a finished one. Research keeps its
 * own palette on ⌘J, where a research box belongs.
 *
 * Commands come from two places and are merged: the shell contributes
 * navigation, the screen contributes its own verbs through `commands`. Nothing
 * here knows what a proposal is.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CornerDownLeft,
  FileText,
  Hash,
  MonitorPlay,
  PackageSearch,
  Radio,
  Search,
  SlidersHorizontal,
  Speech,
  SquarePen,
  Tv,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ShowRow } from "@/lib/types";
import { Badge, Key } from "@/components/ui/kit";

export interface Command {
  id: string;
  label: string;
  /** One short clause. A command that needs a sentence is a screen, not a command. */
  hint?: string;
  group: string;
  icon: LucideIcon;
  keys?: string;
  run: () => void;
}

const NAV: { id: string; label: string; to: string; icon: LucideIcon; keys: string }[] = [
  { id: "go_shows", label: "Home", to: "/", icon: Tv, keys: "⌘1" },
  { id: "go_console", label: "Console", to: "/console", icon: MonitorPlay, keys: "⌘2" },
  { id: "go_drafts", label: "Drafts", to: "/drafts", icon: SquarePen, keys: "⌘3" },
  { id: "go_catalog", label: "Catalog", to: "/catalog", icon: PackageSearch, keys: "⌘4" },
  { id: "go_rooms", label: "Rooms", to: "/rooms", icon: Hash, keys: "⌘5" },
  { id: "go_persona", label: "Persona", to: "/persona", icon: Speech, keys: "⌘6" },
  { id: "go_analytics", label: "Analytics", to: "/analytics", icon: BarChart3, keys: "⌘7" },
  { id: "go_cost", label: "Cost", to: "/cost", icon: Wallet, keys: "⌘8" },
  { id: "go_settings", label: "Settings", to: "/settings", icon: SlidersHorizontal, keys: "⌘9" },
];

/** Subsequence match — "anlt" finds "Analytics", which is how people type here. */
function fuzzy(needle: string, hay: string): boolean {
  const n = needle.toLowerCase();
  const h = hay.toLowerCase();
  let i = 0;
  for (const ch of h) if (ch === n[i]) i += 1;
  return i === n.length;
}

export function CommandBar({
  open,
  onClose,
  commands = [],
}: {
  open: boolean;
  onClose: () => void;
  /** What the current screen can do. Merged above navigation when it is short. */
  commands?: Command[];
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [shows, setShows] = useState<ShowRow[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    // Read the shows once per opening, not once per keystroke: a search over
    // fifty rows is a filter, not a query.
    void api
      .reports(50)
      .then(setShows)
      .catch(() => setShows([]));
  }, [open]);

  const items = useMemo<Command[]>(() => {
    const nav: Command[] = NAV.map((n) => ({
      id: n.id,
      label: n.label,
      group: "Go to",
      icon: n.icon,
      keys: n.keys,
      run: () => void navigate({ to: n.to }),
    }));

    const showCmds: Command[] = (shows ?? []).slice(0, 40).map((s) => ({
      id: `show_${s.showId}`,
      label: s.title,
      hint:
        s.status === "live"
          ? "on air — open the console"
          : s.hasReport
            ? "finished — open the report"
            : "finished, no report was generated",
      group: "Shows",
      icon: s.status === "live" ? Radio : FileText,
      run: () => {
        if (s.status === "live") {
          void api.activateShow(s.showId).then(() => navigate({ to: "/console" }));
        } else if (s.hasReport) {
          void navigate({ to: "/reports/$showId", params: { showId: s.showId } });
        } else {
          void navigate({ to: "/" });
        }
      },
    }));

    const all = [...commands, ...nav, ...showCmds];
    const q = query.trim();
    if (!q) return all.filter((c) => c.group !== "Shows").concat(showCmds.slice(0, 3));
    return all.filter((c) => fuzzy(q, `${c.label} ${c.group}`));
  }, [commands, navigate, query, shows]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  if (!open) return null;

  const groups = items.reduce<{ name: string; items: { c: Command; i: number }[] }[]>(
    (acc, c, i) => {
      const last = acc[acc.length - 1];
      if (last && last.name === c.group) last.items.push({ c, i });
      else acc.push({ name: c.group, items: [{ c, i }] });
      return acc;
    },
    [],
  );

  const fire = (c: Command) => {
    onClose();
    c.run();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center bg-canvas/75 pt-[12vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command bar"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-in flex max-h-[62vh] w-[620px] max-w-[92vw] flex-col overflow-hidden rounded-lg bg-panel z4"
      >
        <div className="flex shrink-0 items-center gap-2.5 px-3.5 shadow-[0_1px_0_var(--hairline)]">
          <Search className="size-3.5 shrink-0 text-text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
                e.preventDefault();
                setCursor((c) => (items.length ? (c + 1) % items.length : 0));
              } else if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
                e.preventDefault();
                setCursor((c) => (items.length ? (c - 1 + items.length) % items.length : 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const c = items[cursor];
                if (c) fire(c);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            spellCheck={false}
            placeholder="Go to a screen, run a command, find a show…"
            aria-label="Command"
            className="h-11 min-w-0 flex-1 bg-transparent text-[13px] text-text placeholder:text-text-faint focus:outline-none"
          />
          <Key className="shrink-0">esc</Key>
        </div>

        <ul ref={listRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <li className="px-2.5 py-6 text-center text-[12.5px] text-text-muted">
              Nothing matches “{query}”.
            </li>
          ) : (
            groups.map((g) => (
              <li key={g.name}>
                <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-[0.06em] text-text-faint uppercase">
                  {g.name}
                </p>
                <ul>
                  {g.items.map(({ c, i }) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        data-i={i}
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => fire(c)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-[7px] text-left",
                          i === cursor ? "bg-elevated text-text" : "text-text-secondary",
                        )}
                      >
                        <c.icon
                          className={cn(
                            "size-3.5 shrink-0",
                            i === cursor ? "text-accent" : "text-text-muted",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">{c.label}</span>
                        {c.hint ? (
                          <span className="hidden shrink-0 text-[11.5px] text-text-muted sm:block">
                            {c.hint}
                          </span>
                        ) : null}
                        {c.keys ? <Key className="shrink-0">{c.keys}</Key> : null}
                        {i === cursor && !c.keys ? (
                          <CornerDownLeft className="size-3 shrink-0 text-text-muted" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>

        <div className="flex shrink-0 items-center gap-3 px-3.5 py-2 text-[11.5px] text-text-muted shadow-[0_-1px_0_var(--hairline)]">
          <span className="flex items-center gap-1.5">
            <Key>↑</Key>
            <Key>↓</Key>
            move
          </span>
          <span className="flex items-center gap-1.5">
            <Key>↵</Key>
            run
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Badge>⌘J</Badge>
            research a product
            <ArrowRight className="size-3" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}
