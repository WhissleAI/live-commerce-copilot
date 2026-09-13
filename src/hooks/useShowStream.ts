import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mockChatBacklog, subscribeStream } from "@/lib/api";
import type {
  ActionProposal,
  AuditEntry,
  ChatMessage,
  ConnectionState,
  Listing,
  Metrics,
  ReplyProposal,
  ShowContext,
  ShowState,
  StreamEvent,
} from "@/lib/types";

const MAX_CHAT = 220;
const MAX_RECENT = 20;

export interface ShowStore {
  connection: ConnectionState;
  show: ShowState | null;
  listings: Listing[];
  chat: ChatMessage[];
  proposals: ReplyProposal[];
  actions: ActionProposal[];
  audit: AuditEntry[];
  metrics: Metrics | null;
  context: ShowContext | null;
  /** ids of listings whose fields changed recently, for the flash highlight */
  flashed: Record<string, number>;
}

function upsert<T extends { id: string }>(list: T[], item: T, newestFirst = false): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return newestFirst ? [item, ...list] : [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

export function useShowStream() {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [show, setShow] = useState<ShowState | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>(() => mockChatBacklog());
  const [proposals, setProposals] = useState<ReplyProposal[]>([]);
  const [actions, setActions] = useState<ActionProposal[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [context, setContext] = useState<ShowContext | null>(null);
  const [flashed, setFlashed] = useState<Record<string, number>>({});
  const listingsRef = useRef<Listing[]>([]);
  listingsRef.current = listings;

  const apply = useCallback((e: StreamEvent) => {
    switch (e.type) {
      case "hello": {
        setShow(e.data.show);
        setListings((prev) => (prev.length ? prev : e.data.listings));
        setProposals((prev) => (prev.length ? prev : e.data.proposals));
        setActions((prev) => (prev.length ? prev : e.data.actions));
        setAudit((prev) => (prev.length ? prev : e.data.audit));
        setMetrics(e.data.metrics);
        setContext(e.data.context);
        break;
      }
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
    }
  }, []);

  useEffect(() => subscribeStream(apply, setConnection), [apply]);

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
    show,
    listings,
    chat,
    proposals,
    actions,
    audit,
    metrics,
    context,
    flashed,
  };

  return { ...store, live, recent, setShow, setListings, setProposals, setActions, setAudit };
}
