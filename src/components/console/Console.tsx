import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useShowStream } from "@/hooks/useShowStream";
import type { AutonomyLevel, ResearchCard } from "@/lib/types";
import { TopBar } from "./TopBar";
import { ChatColumn } from "./ChatColumn";
import { ProposalQueue } from "./ProposalQueue";
import { ShowRail } from "./ShowRail";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsOverlay } from "./ShortcutsOverlay";

function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

export function Console() {
  const store = useShowStream();
  const { show, listings, chat, live, recent, actions, audit, metrics, flashed, connection } = store;

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewerDelta, setViewerDelta] = useState(0);
  const prevViewers = useRef<number | null>(null);
  const verifyRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!show) return;
    if (prevViewers.current !== null && prevViewers.current !== show.viewers)
      setViewerDelta(show.viewers - prevViewers.current);
    prevViewers.current = show.viewers;
  }, [show]);

  const decidable = useMemo(
    () => live.filter((p) => p.status !== "drafting"),
    [live],
  );

  useEffect(() => {
    if (focusedId && decidable.some((p) => p.id === focusedId)) return;
    setFocusedId(decidable[0]?.id ?? null);
  }, [decidable, focusedId]);

  const pinned = listings.find((l) => l.id === show?.pinnedListingId) ?? null;
  const queue = useMemo(
    () =>
      (show?.lotQueue ?? [])
        .map((id) => listings.find((l) => l.id === id))
        .filter((l): l is NonNullable<typeof l> => Boolean(l)),
    [show, listings],
  );

  const move = useCallback(
    (dir: 1 | -1) => {
      if (decidable.length === 0) return;
      const i = decidable.findIndex((p) => p.id === focusedId);
      const next = Math.min(decidable.length - 1, Math.max(0, (i === -1 ? 0 : i) + dir));
      setFocusedId(decidable[next].id);
      setEditingId(null);
    },
    [decidable, focusedId],
  );

  const send = useCallback(
    (id: string, text?: string) => {
      setEditingId(null);
      void api.sendProposal(id, text);
    },
    [],
  );

  const research = useCallback(
    (query: string): Promise<ResearchCard> => api.research(query, show?.pinnedListingId ?? undefined),
    [show],
  );

  const setAutonomy = useCallback((level: AutonomyLevel) => {
    void api.setAutonomy(level);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (shortcutsOpen) setShortcutsOpen(false);
        else if (editingId) setEditingId(null);
        return;
      }
      if (isTyping() || paletteOpen) return;

      const focused = decidable.find((p) => p.id === focusedId);
      switch (e.key) {
        case "j":
        case "J":
        case "ArrowDown":
          e.preventDefault();
          move(1);
          break;
        case "k":
        case "K":
        case "ArrowUp":
          e.preventDefault();
          move(-1);
          break;
        case "Enter":
          if (focused && focused.status !== "blocked") {
            e.preventDefault();
            send(focused.id);
          }
          break;
        case "e":
        case "E":
          if (focused) {
            e.preventDefault();
            setEditingId(focused.id);
          }
          break;
        case "x":
        case "X":
          if (focused) {
            e.preventDefault();
            void api.dismissProposal(focused.id);
          }
          break;
        case "r":
        case "R":
          if (focused && focused.status !== "blocked") {
            e.preventDefault();
            void api.regenerateProposal(focused.id);
          }
          break;
        case "a":
        case "A": {
          const top = actions.find((x) => x.status === "proposed" && x.preflight.ok);
          if (top) {
            e.preventDefault();
            void api.approveAction(top.id);
          }
          break;
        }
        case "u":
        case "U": {
          const undoable = actions.find(
            (x) =>
              x.status === "committed" &&
              x.undoableUntil &&
              new Date(x.undoableUntil).getTime() > Date.now(),
          );
          if (undoable) {
            e.preventDefault();
            void api.rollbackAction(undoable.id);
          }
          break;
        }
        case "?":
          e.preventDefault();
          setShortcutsOpen((o) => !o);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, decidable, editingId, focusedId, move, paletteOpen, send, shortcutsOpen]);

  if (!show)
    return (
      <div className="grid h-screen place-items-center text-[12px] text-text-muted">
        Connecting to the show stream…
      </div>
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <TopBar
        show={show}
        metrics={metrics}
        connection={connection}
        viewerDelta={viewerDelta}
        onAutonomy={setAutonomy}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] xl:grid-cols-[300px_1fr_380px]">
        <div className="hidden min-h-0 xl:block">
          <ChatColumn
            chat={chat}
            onInject={(text) => void api.injectChat("you", text)}
            onHoverProposal={setHighlightedId}
            linkedProposalIds={new Set(live.map((p) => p.id))}
          />
        </div>

        <div className="relative flex min-h-0 flex-col">
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className="absolute top-1.5 left-2 z-20 flex h-6 items-center gap-1 rounded-[4px] border border-hairline-strong bg-panel px-1.5 text-[11px] text-text-muted hover:text-text xl:hidden"
          >
            <PanelLeft className="size-3" aria-hidden /> Chat
          </button>
          <ProposalQueue
            live={live}
            recent={recent}
            focusedId={focusedId}
            editingId={editingId}
            highlightedId={highlightedId}
            onFocus={setFocusedId}
            onSend={send}
            onEdit={setEditingId}
            onCancelEdit={() => setEditingId(null)}
            onDismiss={(id) => void api.dismissProposal(id)}
            onRegenerate={(id) => void api.regenerateProposal(id)}
          />
          {drawerOpen ? (
            <div className="anim-in absolute inset-y-0 left-0 z-30 w-[300px] xl:hidden">
              <ChatColumn
                chat={chat}
                onInject={(text) => void api.injectChat("you", text)}
                onHoverProposal={setHighlightedId}
                linkedProposalIds={new Set(live.map((p) => p.id))}
              />
            </div>
          ) : null}
        </div>

        <ShowRail
          pinned={pinned}
          queue={queue}
          flashed={flashed}
          actions={actions}
          audit={audit}
          onApprove={(id) => void api.approveAction(id)}
          onReject={(id) => void api.rejectAction(id)}
          onRollback={(id) => void api.rollbackAction(id)}
        />
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onResearch={research}
        pinnedTitle={pinned?.title ?? null}
        onQuickAction={(a) => {
          if (a === "research_pinned" && pinned) {
            void research(pinned.title);
          }
          if (a === "autonomy") {
            setPaletteOpen(false);
          }
          if (a === "verify") {
            setPaletteOpen(false);
            verifyRef.current?.click();
          }
        }}
      />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
