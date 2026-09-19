import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Keyboard,
  PanelLeft,
  PanelRight,
  Search,
  ShieldCheck,
  Radio,
  Sliders,
  Wallet,
  X,
} from "lucide-react";
import { api, API_BASE, USE_MOCKS, ensureSession, tokenQuery } from "@/lib/api";
import { cn } from "@/lib/utils";
import { isTypingIn, modalOpen, shortcutActs } from "@/lib/keys";
import { LOAD_FAILED, operatorMessage, streamTitle } from "@/lib/copy";
import { useShowStream } from "@/hooks/useShowStream";
import {
  capabilitiesOf,
  consoleLayout,
  guardOrderFor,
  surfaceLabel,
  surfaceOf,
} from "@/lib/surfaces";
import type {
  Account,
  AutonomyLevel,
  BudgetState,
  ConnectionState,
  ResearchCard,
  SourceStatus,
  SurfaceInfo,
} from "@/lib/types";
import { TopBar } from "./TopBar";
import { ChatColumn } from "./ChatColumn";
import { ProposalQueue } from "./ProposalQueue";
import { ShowRail } from "./ShowRail";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { LegendOverlay, legendSeen, markLegendSeen } from "./LegendOverlay";
import { TranscriptPanel } from "./TranscriptPanel";
import { ThreadPanel } from "./ThreadPanel";
import { CostPanel } from "./CostPanel";
import { Link } from "@tanstack/react-router";
import { AppShell, type Command } from "@/components/app/AppShell";
import { Inspector, inspectorTitle, type InspectorSubject } from "@/components/app/Inspector";
import { Banner, Button, Card, EmptyState, Skeleton } from "@/components/ui/kit";
import { ToastRail, useToasts } from "@/components/app/ToastRail";

export function Console() {
  const store = useShowStream();
  const {
    show,
    listings,
    chat,
    live,
    recent,
    actions,
    audit,
    metrics,
    flashed,
    connection,
    transcript,
    levels,
    seller,
    shows,
    source,
    streamError,
    budget,
    greeted,
  } = store;
  const navigate = useNavigate();
  const toasts = useToasts();
  // Every write goes through here. A 409 (the guards refused), 404 (not your
  // session), 403 (you cannot write here) or 500 used to be an unhandled
  // rejection: the button did nothing and the operator learned nothing.
  const failed = useCallback(
    (what: string) => (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      toasts.push({ tone: "bad", text: `${what} — ${msg}` });
    },
    [toasts],
  );

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Below 1024 the session rail is a drawer rather than a column. */
  const [railOpen, setRailOpen] = useState(false);
  // Shown once per browser, the first time a card could possibly appear.
  const [legendOpen, setLegendOpen] = useState(() => !legendSeen());
  const closeLegend = useCallback(() => {
    markLegendSeen();
    setLegendOpen(false);
  }, []);
  const [costOpen, setCostOpen] = useState(false);
  // Every "tell me more" in this console opens the same panel. It and the cost
  // column are the same real estate, so opening one closes the other rather
  // than wrapping the grid onto a second row.
  const [inspect, setInspect] = useState<InspectorSubject | null>(null);
  const openInspect = useCallback((s: InspectorSubject | null) => {
    setInspect(s);
    if (s) setCostOpen(false);
  }, []);
  const toggleCost = useCallback(() => {
    setCostOpen((v) => {
      if (!v) setInspect(null);
      return !v;
    });
  }, []);
  // Something is open on the right, so the chat column gives up its width
  // one breakpoint later than usual.
  const sidePanel = inspect !== null || costOpen;

  // Who this console is acting as. Minted on first load so the audit chain can
  // answer "who approved that markdown" — it could not, when every write was
  // anonymous.
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    void ensureSession()
      .then(setAccount)
      .catch(() => setAccount(null));
  }, []);

  /**
   * What this surface can do, and therefore what this console is.
   *
   * The static table answers immediately — a layout that waits on a fetch
   * flickers through the wrong shape on every reload, and the shape it would
   * flicker through is the eBay Live one on a surface that is not eBay Live.
   * `GET /api/surfaces` refines it when it lands, and a backend that has not
   * shipped that endpoint yet changes nothing.
   */
  const [remoteSurfaces, setRemoteSurfaces] = useState<SurfaceInfo[] | null>(null);
  useEffect(() => {
    void api
      .surfaces()
      .then(setRemoteSurfaces)
      .catch(() => setRemoteSurfaces(null));
  }, []);

  const surfaceId = surfaceOf(show);
  const caps = useMemo(
    () => capabilitiesOf(surfaceId, remoteSurfaces),
    [surfaceId, remoteSurfaces],
  );
  const layout = useMemo(() => consoleLayout(caps), [caps]);
  const guardOrder = useMemo(() => guardOrderFor(caps), [caps]);

  const [viewerDelta, setViewerDelta] = useState(0);
  const prevViewers = useRef<number | null>(null);

  useEffect(() => {
    if (!show) return;
    if (prevViewers.current !== null && prevViewers.current !== show.viewers)
      setViewerDelta(show.viewers - prevViewers.current);
    prevViewers.current = show.viewers;
  }, [show]);

  const decidable = useMemo(() => live.filter((p) => p.status !== "drafting"), [live]);

  /** The branch above whichever proposal is focused, for the thread panel. A
   *  proposal carries its own thread on an async surface and carries none on a
   *  live one, which is what the panel's empty state says. */
  const focusedThread = useMemo(
    () => [...live, ...recent].find((p) => p.id === focusedId)?.thread ?? null,
    [live, recent, focusedId],
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
      setFocusedId(decidable[next]!.id);
      setEditingId(null);
    },
    [decidable, focusedId],
  );

  const send = useCallback(
    (id: string, text?: string) => {
      setEditingId(null);
      void api
        .sendProposal(id, text)
        .then((p) => {
          toasts.push({ tone: "ok", text: `Reply sent to ${p.message.author}` });
        })
        .catch(failed("Not sent"));
    },
    [toasts],
  );

  /** The PRD's unmeasurable metric, made measurable by the only person who can
   *  see it. A floor, and the report says so. */
  const flagWrong = useCallback(
    (id: string, reason: string) => {
      void api
        .flagProposal(id, reason)
        .then(() => {
          toasts.push({ tone: "warn", text: `Flagged as wrong · ${reason}` });
        })
        .catch(failed("Not flagged"));
    },
    [toasts],
  );

  /** The gate dropped it and the operator disagrees. */
  const answerDropped = useCallback(
    (messageId: string) => {
      void api
        .answerDropped(messageId)
        .then(() => {
          toasts.push({ tone: "neutral", text: "Drafting an answer for a dropped comment" });
        })
        .catch(failed("Could not answer"));
    },
    [toasts],
  );

  const research = useCallback(
    (query: string): Promise<ResearchCard> =>
      api.research(query, show?.pinnedListingId ?? undefined),
    [show],
  );

  const setAutonomy = useCallback((level: AutonomyLevel) => {
    void api.setAutonomy(level).catch(failed("Autonomy unchanged"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      // ⌘J, not ⌘K: ⌘K is the shell's command bar, which every header promises.
      // Research is one thing you can do, not the way into everything.
      if (cmd && e.key.toLowerCase() === "j") {
        // It may always close itself; it may not open behind the legend.
        if (!paletteOpen && modalOpen()) return;
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        // The legend is first because it is the one that opens by itself, so
        // it is the one an operator presses Escape at without being asked.
        if (legendOpen) closeLegend();
        else if (paletteOpen) setPaletteOpen(false);
        else if (shortcutsOpen) setShortcutsOpen(false);
        else if (editingId) setEditingId(null);
        else if (inspect) setInspect(null);
        else if (costOpen) setCostOpen(false);
        return;
      }
      // `?` is the console's own overlay, so it must be able to close itself
      // while it is the thing on screen. It is still a character, though.
      if (e.key === "?" && !isTypingIn(document.activeElement)) {
        if (!shortcutsOpen && modalOpen()) return;
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }
      // One rule, in `lib/keys`: no modal up, not typing, and — for Enter
      // only — no button already claiming the key.
      if (!shortcutActs(e.key)) return;

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
          // Bare Enter sends only a reply the guards allowed outright. A
          // needs_review card's button says "Send anyway" for a reason: that
          // decision takes a click, not a reflex.
          if (focused && focused.status === "ready") {
            e.preventDefault();
            send(focused.id);
          } else if (focused && focused.status === "needs_review") {
            e.preventDefault();
            toasts.push({
              tone: "warn",
              text: "This reply was revised by a guard — use Send anyway to send it",
            });
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
            void api.dismissProposal(focused.id).catch(failed("Not dismissed"));
          }
          break;
        case "r":
        case "R":
          if (focused && focused.status !== "blocked") {
            e.preventDefault();
            void api.regenerateProposal(focused.id).catch(failed("Not regenerated"));
          }
          break;
        case "a":
        case "A": {
          const top = actions.find((x) => x.status === "proposed" && x.preflight.ok);
          if (top) {
            e.preventDefault();
            void api.approveAction(top.id).catch(failed("Not approved"));
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
            void api
              .rollbackAction(undoable.id)
              .then(() => toasts.push({ tone: "neutral", text: "Rolled back" }))
              .catch(failed("Not rolled back"));
          }
          break;
        }
        case "i":
        case "I":
          if (focused) {
            e.preventDefault();
            openInspect(
              inspect?.kind === "proposal" && inspect.id === focused.id
                ? null
                : { kind: "proposal", id: focused.id },
            );
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    actions,
    closeLegend,
    costOpen,
    decidable,
    editingId,
    focusedId,
    inspect,
    legendOpen,
    move,
    openInspect,
    paletteOpen,
    send,
    shortcutsOpen,
  ]);

  // Detaching is for a surface we hold a connection to. The scripted session is
  // just left where it is, so you can walk back into it.
  const liveSession = Boolean(show) && surfaceId !== "simulated";

  // What ⌘K can do while you are on the console. Everything here already had a
  // single-key shortcut or a button; the command bar is the surface for the
  // operator who has not memorised either yet.
  const commands = useMemo<Command[]>(
    () => [
      {
        id: "console_research",
        label: "Research a product",
        hint: "comps, spec diff, a price to say out loud",
        group: "On this session",
        icon: Search,
        keys: "⌘J",
        run: () => setPaletteOpen(true),
      },
      {
        id: "console_verify",
        label: "Verify the audit chain",
        hint: "re-hash every entry end to end",
        group: "On this session",
        icon: ShieldCheck,
        run: () => window.dispatchEvent(new Event("sidestage:verify-chain")),
      },
      {
        id: "console_cost",
        label: costOpen ? "Hide what this session is costing" : "Show what this session is costing",
        group: "On this session",
        icon: Wallet,
        run: toggleCost,
      },
      {
        id: "console_autonomy",
        label: "Change the autonomy level",
        hint: "the ladder lives in the session bar",
        group: "On this session",
        icon: Sliders,
        run: () => document.getElementById("autonomy-picker")?.click(),
      },
      {
        id: "console_legend",
        label: "What the pills mean",
        hint: "how to read a proposal card",
        group: "On this session",
        icon: BookOpen,
        run: () => setLegendOpen(true),
      },
      {
        id: "console_shortcuts",
        label: "Keyboard shortcuts",
        group: "On this session",
        icon: Keyboard,
        keys: "?",
        run: () => setShortcutsOpen(true),
      },
    ],
    [costOpen, toggleCost],
  );

  // Attaching to a session is a Sessions job now, not a screen the console owns —
  // the launcher used to be the only way in and the only way out, which is why
  // a seeded session could strand the operator inside it. And "is there a session"
  // is not a flag in this tab's storage: it is whether the server is streaming
  // one, which is the only version of that question with a true answer.
  // Nothing on air is a real state, and it says so.
  //
  // It used to be impossible: a seeded session was created on every boot, so the
  // console always had a scripted auction to render and a seller could not tell
  // a working product from an idle one. With that gone, an empty console is the
  // honest answer — and it is an answer, not a bounce to another screen, because
  // the operator clicked Console.
  if (!show) {
    // `open` fires before `hello`, so the empty state used to flash for every
    // real session. Idle means the server answered and there is nothing on air.
    //
    // CONTENT-22: `streamError` used to be folded into `idle`, so a broken
    // stream rendered "Nothing is on air." — the console confidently reporting
    // an empty product while the thing that would have told it otherwise was
    // the thing that failed. Absent and failed are two states.
    const failed = Boolean(streamError);
    const idle = connection === "open" && greeted;
    return (
      <AppShell
        section="console"
        title="Console"
        subtitle={
          failed
            ? "the session stream could not be read"
            : idle
              ? "no session is on air"
              : "connecting to the session stream…"
        }
      >
        {failed ? (
          <Card tone="bad" className="mt-6">
            <EmptyState
              icon={<AlertTriangle className="size-5 text-bad" aria-hidden />}
              title={LOAD_FAILED.title}
              action={
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Reload
                </Button>
              }
            >
              {operatorMessage(streamError, "The session stream")} This is not the same as
              nothing being on air — whatever was running is still running.
            </EmptyState>
          </Card>
        ) : idle ? (
          <Card className="mt-6">
            <EmptyState
              icon={<Radio className="size-5" aria-hidden />}
              title="Nothing is on air."
              action={
                <Link to="/">
                  <Button variant="primary">
                    Monitor a session <ArrowRight className="size-3.5" aria-hidden />
                  </Button>
                </Link>
              }
            >
              Paste a session, a channel or a thread on Home and the copilot attaches to it — it
              builds what it knows from the conversation itself, and this console fills as people
              start asking.
            </EmptyState>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-[60%]" />
            <Skeleton className="h-3 w-[45%]" />
            <Skeleton className="h-3 w-[52%]" />
          </div>
        )}
      </AppShell>
    );
  }

  // The console keeps the rail like every other screen, but no live strip —
  // it IS the live session — and no content bar, because the session bar below is
  // that bar. `bare` hands it the full column and its own scrolling.
  return (
    <AppShell
      section="console"
      bare
      commands={commands}
      banner={
        <IngestBanner
          source={source}
          streamError={streamError}
          connection={connection}
          budget={budget}
        />
      }
      {...(inspect
        ? {
            inspectorTitle: inspectorTitle(inspect, [...live, ...recent]).title,
            inspector: (
              <Inspector subject={inspect} proposals={[...live, ...recent]} audit={audit} />
            ),
            onCloseInspector: () => setInspect(null),
          }
        : {})}
    >
      <TopBar
        show={show}
        seller={seller}
        metrics={metrics}
        connection={connection}
        viewerDelta={viewerDelta}
        onAutonomy={setAutonomy}
        // Always present. Gating this on `liveSession` meant a seeded session had
        // no way out of the console at all, and once the choice persisted
        // across reloads the operator was simply stuck in it. Leaving a session is
        // not a live-stream feature, it is how you get back to your shows.
        //
        // Detaching, though, IS live-only: a monitored eBay stream holds a
        // browser page that should be released, while a seeded session is just
        // left where it is so you can walk back into it.
        onEndSession={() => {
          if (liveSession) {
            // The server writes the report as part of detaching; land on it
            // rather than reloading into an empty console.
            const id = show.id;
            void api
              .endSession(id)
              .then(() => navigate({ to: "/reports/$showId", params: { showId: id } }))
              .catch(failed("Could not end the session"));
          } else {
            void navigate({ to: "/" });
          }
        }}
        endSessionLabel={liveSession ? "End session" : "Switch session"}
        costOpen={costOpen}
        onToggleCost={toggleCost}
        account={account}
        latencyMeter={layout.latencyMeter}
        surface={{ id: surfaceId, label: surfaceLabel(surfaceId) }}
      />

      {/* The cost rail is a COLUMN, not an overlay: it is read against the
          latency meter and the action queue, and a panel that covers them
          answers "what is this costing" while hiding "what is it doing".
          Declared on the grid rather than by the child, or a fourth child
          wraps onto a second row. */}
      <div
        className={cn(
          "relative grid min-h-0 flex-1 gap-2 bg-canvas p-2",
          // Three bands, and the order things are given up in is the order they
          // matter least while a buyer is waiting:
          //   ≥1280  chat · proposals · session rail
          //   ≥1024  proposals · session rail, chat in a sheet
          //   <1024  proposals only, both in sheets
          // The queue is the product; it is the one column that never folds.
          //
          // The inspector (a 380px aside outside this grid) and the cost column
          // are the same real estate and never open together. Either one takes
          // the chat column's width until 1536px, where there is room for both;
          // in between, chat is the same sheet it is below 1280 — one tap away,
          // never gone.
          inspect
            ? "grid-cols-[1fr] lg:grid-cols-[1fr_340px] 2xl:grid-cols-[260px_1fr_340px]"
            : costOpen
              ? "grid-cols-[1fr] lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_340px_300px] 2xl:grid-cols-[260px_1fr_340px_300px]"
              : "grid-cols-[1fr] lg:grid-cols-[1fr_380px] xl:grid-cols-[300px_1fr_380px]",
        )}
      >
        {/* Left rail: what is coming IN — the buyers typing, and the host talking. */}
        <div
          className={cn(
            "hidden min-h-0 flex-col overflow-hidden rounded-md bg-panel z1",
            sidePanel ? "2xl:flex" : "xl:flex",
          )}
        >
          <div className="flex min-h-0 flex-[3] flex-col">
            <ChatColumn
              chat={chat}
              onInject={(text) => void api.injectChat("you", text).catch(failed("Not injected"))}
              onHoverProposal={setHighlightedId}
              linkedProposalIds={new Set(live.map((p) => p.id))}
              onAnswerDropped={answerDropped}
            />
          </div>
          {/* The lower half of the incoming rail is whatever this surface
              actually carries: the host's voice where there is one, the branch
              above the comment where the conversation is a tree, and nothing at
              all where it is neither — in which case chat takes the column. */}
          {layout.hostAudio ? (
            <div className="flex min-h-0 flex-[2] flex-col">
              <TranscriptPanel
                transcript={transcript}
                levels={levels}
                context={store.context}
                listen={store.listen}
                bridgeUrl={
                  USE_MOCKS
                    ? null
                    : `${API_BASE}/audio-bridge?showId=${encodeURIComponent(show.id)}&${tokenQuery()}`
                }
              />
            </div>
          ) : layout.threadPanel ? (
            <div className="flex min-h-0 flex-[2] flex-col">
              <ThreadPanel thread={focusedThread} room={show.room ?? null} />
            </div>
          ) : null}
        </div>

        <div className="relative flex min-h-0 flex-col overflow-hidden rounded-md bg-panel z1">
          <ProposalQueue
            leading={
              <button
                type="button"
                onClick={() => setDrawerOpen((o) => !o)}
                className={cn(
                  "flex h-[22px] shrink-0 items-center gap-1 rounded-sm bg-elevated px-1.5 text-[11px] text-text-muted hover:text-text",
                  sidePanel ? "2xl:hidden" : "xl:hidden",
                )}
              >
                <PanelLeft className="size-3" aria-hidden /> Chat
              </button>
            }
            trailing={
              /* The pinned lot, the action queue and the chain are not optional
                 information — below 1024 they are one tap away, not gone. */
              <button
                type="button"
                onClick={() => setRailOpen((o) => !o)}
                className="flex h-[22px] shrink-0 items-center gap-1 rounded-sm bg-elevated px-1.5 text-[11px] text-text-muted hover:text-text lg:hidden"
              >
                <PanelRight className="size-3" aria-hidden /> Session
              </button>
            }
            live={live}
            recent={recent}
            focusedId={focusedId}
            editingId={editingId}
            highlightedId={highlightedId}
            onFocus={setFocusedId}
            onSend={send}
            onEdit={setEditingId}
            onCancelEdit={() => setEditingId(null)}
            onDismiss={(id) => void api.dismissProposal(id).catch(failed("Not dismissed"))}
            onRegenerate={(id) => void api.regenerateProposal(id).catch(failed("Not regenerated"))}
            onFlag={flagWrong}
            onInspect={(id) => openInspect({ kind: "proposal", id })}
            guardOrder={guardOrder}
            deliverable={layout.deliverable}
          />
          {drawerOpen ? (
            <div
              className={cn(
                "anim-in absolute inset-y-0 left-0 z-30 w-[300px] z3",
                sidePanel ? "2xl:hidden" : "xl:hidden",
              )}
            >
              <ChatColumn
                chat={chat}
                onInject={(text) => void api.injectChat("you", text)}
                onHoverProposal={setHighlightedId}
                linkedProposalIds={new Set(live.map((p) => p.id))}
                onAnswerDropped={answerDropped}
              />
            </div>
          ) : null}
        </div>

        {/* One instance, two layouts: a column at ≥1024, an overlay below it.
            Two instances would mean two subscriptions to the verify-chain
            event and two chains verified on one click. */}
        <div
          className={cn(
            "flex min-h-0 flex-col overflow-hidden rounded-md bg-panel",
            railOpen
              ? "absolute inset-y-2 right-2 z-30 w-[340px] z3 lg:static lg:inset-auto lg:z-auto lg:w-auto lg:z1"
              : "hidden lg:flex lg:z1",
          )}
        >
          {railOpen ? (
            // The drawer gets its own close row rather than a floating ✕: the
            // rail's first row already carries the lot version, and the two
            // landed on each other.
            <div className="flex h-[26px] shrink-0 items-center justify-between px-3 shadow-[0_1px_0_var(--hairline)] lg:hidden">
              <span className="section-header">Session</span>
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                aria-label="Close the session rail"
                className="text-text-muted hover:text-text"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
          <ShowRail
            pinned={pinned}
            queue={queue}
            flashed={flashed}
            actions={actions}
            audit={audit}
            onApprove={(id) => void api.approveAction(id).catch(failed("Not approved"))}
            onReject={(id) => void api.rejectAction(id).catch(failed("Not rejected"))}
            onRollback={(id) => void api.rollbackAction(id).catch(failed("Not rolled back"))}
            onRename={(id, title) => {
              void api
                .nameLot(id, title)
                .then((l) => toasts.push({ tone: "ok", text: `Lot named · ${l.title}` }));
            }}
            onInspect={(seq) => openInspect({ kind: "audit", seq })}
            showLots={layout.lotRail}
          />
        </div>

        {/* Opened on demand rather than resident: cost is a question the seller
            asks between lots, not something to watch while a buyer waits. */}
        {costOpen && (
          <div className="absolute inset-y-2 right-2 z-30 min-h-0 w-[320px] overflow-hidden rounded-md z3 xl:static xl:inset-auto xl:z-auto xl:w-auto xl:z1">
            <CostPanel showId={show.id} onClose={() => setCostOpen(false)} />
          </div>
        )}
      </div>

      <ToastRail toasts={toasts} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onResearch={research}
        pinnedTitle={pinned?.title ?? null}
        onQuickAction={(a) => {
          if (a === "autonomy") {
            setPaletteOpen(false);
            setShortcutsOpen(false);
            window.setTimeout(() => document.getElementById("autonomy-picker")?.click(), 50);
          }
          if (a === "verify") {
            setPaletteOpen(false);
            window.dispatchEvent(new Event("sidestage:verify-chain"));
          }
        }}
      />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <LegendOverlay open={legendOpen} onClose={closeLegend} />
    </AppShell>
  );
}

/**
 * Ingest health, in the one place a banner is allowed.
 *
 * The server has emitted a `source` event since the watcher was written and the
 * browser never subscribed, so a watcher that had stopped reading the lot card
 * looked exactly like a quiet chat. Silence that looks like calm is the worst
 * failure mode a trust product has.
 */
/** Dollars, or an honest dash. A null balance is "we could not read it". */
function money(usd: number | null | undefined): string {
  return usd == null ? "—" : `$${usd.toFixed(2)}`;
}

function IngestBanner({
  source,
  streamError,
  connection,
  budget,
}: {
  source: SourceStatus | null;
  streamError: string | null;
  connection: ConnectionState;
  budget: BudgetState | null;
}) {
  // The cap outranks everything else here. A console that has stopped drafting
  // must say so above any other condition — "the watcher is retrying" is not
  // the reason the queue went quiet.
  if (budget?.capped) {
    return (
      <Banner
        tone="bad"
        title="This session reached its spend cap — the copilot has stopped drafting"
        icon={<AlertTriangle className="size-3.5" aria-hidden />}
      >
        {money(budget.spentUsd)} of {money(budget.capUsd)}, measured as a wallet delta and so an
        upper bound, not an invoice. Questions still arrive and are recorded; nothing is drafted.
        Raise the cap in Settings · Automation to carry on.
      </Banner>
    );
  }
  if (budget?.lowBalance) {
    return (
      <Banner tone="warn" title="The workspace wallet is running low">
        {money(budget.balanceUsd)} left. The copilot keeps working until the balance runs out, and
        then every draft fails at the gateway rather than degrading quietly.
      </Banner>
    );
  }
  if (streamError) {
    // CONTENT-31: this used to title every failure "The server does not know
    // that show" — a dropped socket, an expired session and a 500 all got the
    // same confident wrong sentence, with the real one demoted below it. The
    // title comes from the failure now, and `operatorMessage` is the only
    // thing allowed to turn a route-and-status into a sentence.
    return (
      <Banner
        tone="bad"
        title={streamTitle(streamError)}
        icon={<AlertTriangle className="size-3.5" aria-hidden />}
      >
        {operatorMessage(streamError, "The session stream")}
      </Banner>
    );
  }
  if (connection !== "open") {
    return (
      <Banner tone="neutral" title="Reconnecting to the session stream…">
        Chat and lot changes backfill on reconnect. Nothing is sent while disconnected.
      </Banner>
    );
  }
  if (source && (source.state === "failing" || (source.consecutiveFailures ?? 0) > 1)) {
    return (
      <Banner
        tone="warn"
        title="The watcher cannot read the lot card"
        icon={<AlertTriangle className="size-3.5" aria-hidden />}
      >
        {source.detail ?? "Retrying"} — the copilot still answers from the catalog and from what you
        say out loud, but it will not see a price change until this clears.
      </Banner>
    );
  }
  return null;
}
