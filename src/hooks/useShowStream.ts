import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mockChatBacklog, subscribeStream } from "@/lib/api";
import type {
  SellerProfile,
  ShowSummary,
  TranscriptSegment,
  ActionProposal,
  AuditEntry,
  ChatMessage,
  ConnectionState,
  Listing,
  Metrics,
  ReplyProposal,
  ShowContext,
  ShowState,
  BudgetState,
  SourceStatus,
  StreamEvent,
} from "@/lib/types";

const MAX_CHAT = 220;
const MAX_TRANSCRIPT = 120;
/** ~2 minutes at 10 Hz. The strip shows recent audio, not the whole show. */
const MAX_LEVELS = 1200;
const MAX_RECENT = 20;

export interface ShowStore {
  connection: ConnectionState;
  /** The server has said `hello` at least once on this connection. `open`
   *  fires before it, which is why "Nothing is on air" flashed on every show. */
  greeted: boolean;
  show: ShowState | null;
  listings: Listing[];
  chat: ChatMessage[];
  proposals: ReplyProposal[];
  actions: ActionProposal[];
  audit: AuditEntry[];
  metrics: Metrics | null;
  context: ShowContext | null;
  /** Host speech from the Whissle listen-only session, oldest first. */
  transcript: TranscriptSegment[];
  levels: number[];
  /** Who is selling, from the catalog loaded at setup. */
  seller: SellerProfile | null;
  /** Every show this backend is watching. */
  shows: ShowSummary[];
  /** ids of listings whose fields changed recently, for the flash highlight */
  flashed: Record<string, number>;
  /** What the ingest watcher is doing. Silence from the watcher and a quiet
   *  chat used to look identical; now the show bar can tell them apart. */
  source: SourceStatus | null;
  /** Null until the server has read the wallet at least once. */
  budget: BudgetState | null;
  /** The server's refusal — an unknown show id, most often. */
  streamError: string | null;
}

function upsert<T extends { id: string }>(list: T[], item: T, newestFirst = false): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return newestFirst ? [item, ...list] : [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

export function useShowStream(showId?: string | null) {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [show, setShow] = useState<ShowState | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>(() => mockChatBacklog());
  const [proposals, setProposals] = useState<ReplyProposal[]>([]);
  const [actions, setActions] = useState<ActionProposal[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [context, setContext] = useState<ShowContext | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [levels, setLevels] = useState<number[]>([]);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [shows, setShows] = useState<ShowSummary[]>([]);
  const [flashed, setFlashed] = useState<Record<string, number>>({});
  const [source, setSource] = useState<SourceStatus | null>(null);
  const [budget, setBudget] = useState<BudgetState | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [greeted, setGreeted] = useState(false);
  const listingsRef = useRef<Listing[]>([]);
  listingsRef.current = listings;

  const apply = useCallback((e: StreamEvent) => {
    switch (e.type) {
      case "hello": {
        // A `hello` after a reconnect, or after switching shows, must REPLACE
        // rather than preserve: keeping the previous arrays was leaking one
        // show's proposals into another's console.
        setShow(e.data.show);
        setSeller(e.data.seller ?? null);
        setListings(e.data.listings);
        // Per-connection state goes too: the previous show's audio strip,
        // loudness, ingest health, cap state and "server does not know that
        // show" banner all outlived a reconnect or a switch.
        setTranscript([]);
        setLevels([]);
        setSource(null);
        setBudget(null);
        setStreamError(null);
        setGreeted(true);
        // Mock mode seeds its own backlog; the server sends the real tail here.
        if (e.data.chat) setChat(e.data.chat.slice(-MAX_CHAT));
        setProposals(e.data.proposals);
        setActions(e.data.actions);
        setAudit(e.data.audit);
        setMetrics(e.data.metrics);
        setContext(e.data.context);
        break;
      }
      case "show":
        setShow(e.data);
        break;
      case "shows":
        setShows(e.data);
        break;
      case "transcript":
        setTranscript((prev) => [...prev, e.data].slice(-MAX_TRANSCRIPT));
        break;
      case "levels":
        // A rolling window, not a log. This is 10 Hz and its only consumer is a
        // strip showing the last couple of minutes.
        setLevels((prev) => [...prev, ...e.data.levels].slice(-MAX_LEVELS));
        break;
      case "chat":
        setChat((prev) => upsert(prev, e.data).slice(-MAX_CHAT));
        break;
      case "proposal":
        setProposals((prev) => upsert(prev, e.data));
        break;
      case "action":
        setActions((prev) => upsert(prev, e.data, true));
        break;
      case "listing": {
        const prevListing = listingsRef.current.find((l) => l.id === e.data.id);
        if (prevListing && prevListing.version !== e.data.version)
          setFlashed((f) => ({ ...f, [e.data.id]: Date.now() }));
        setListings((prev) => upsert(prev, e.data));
        break;
      }
      case "audit":
        setAudit((prev) => (prev.some((a) => a.seq === e.data.seq) ? prev : [...prev, e.data]));
        break;
      case "metrics":
        setMetrics(e.data);
        break;
      case "context":
        setContext(e.data);
        break;
      case "source":
        setSource(e.data);
        break;
      case "budget":
        setBudget(e.data);
        break;
      case "stream_error":
        setStreamError(e.data.error);
        break;
    }
  }, []);

  // Follow the show this console was opened for, not whichever one the server
  // happens to consider active.
  useEffect(() => subscribeStream(apply, setConnection, showId ?? null), [apply, showId]);

  const live = useMemo(
    () =>
      proposals
        .filter((p) => ["drafting", "ready", "needs_review", "blocked"].includes(p.status))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [proposals],
  );

  const recent = useMemo(
    () =>
      proposals
        .filter((p) => p.status === "sent" || p.status === "auto_sent")
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, MAX_RECENT),
    [proposals],
  );

  const store: ShowStore = {
    connection,
    greeted,
    show,
    listings,
    chat,
    budget,
    proposals,
    actions,
    audit,
    metrics,
    context,
    transcript,
    levels,
    seller,
    shows,
    flashed,
    source,
    streamError,
  };

  return { ...store, live, recent, setShow, setListings, setProposals, setActions, setAudit };
}
