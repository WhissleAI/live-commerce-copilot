/**
 * The single place any URL appears. When VITE_USE_MOCKS === "true" every call is
 * served by the in-browser mock driver; otherwise the identical surface hits the
 * real endpoints with no component changes.
 */
import { getMockDriver } from "./mockStream";
import type {
  ActionProposal,
  AuditEntry,
  AutonomyLevel,
  ChatMessage,
  ConnectionState,
  Metrics,
  ReplyProposal,
  ResearchCard,
  ShowState,
  StreamEvent,
} from "./types";

const BASE = (import.meta.env["VITE_API_BASE"] as string | undefined) ?? "http://localhost:8790";
export const USE_MOCKS =
  ((import.meta.env["VITE_USE_MOCKS"] as string | undefined) ?? "true") === "true";

const url = (path: string) => `${BASE}${path}`;

async function post<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: "POST", headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url(path), init);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

const STREAM_EVENTS = [
  "hello",
  "chat",
  "proposal",
  "action",
  "listing",
  "audit",
  "metrics",
  "context",
] as const;

/**
 * Subscribe to the show stream. Handles reconnect with backoff and reports
 * connection state so the top bar can show `reconnecting…`.
 */
export function subscribeStream(
  onEvent: (e: StreamEvent) => void,
  onState: (s: ConnectionState) => void,
): () => void {
  if (USE_MOCKS) {
    onState("open");
    return getMockDriver().subscribe(onEvent);
  }

  let closed = false;
  let attempt = 0;
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    onState(attempt === 0 ? "connecting" : "reconnecting");
    source = new EventSource(url("/api/stream"));

    source.onopen = () => {
      attempt = 0;
      onState("open");
    };

    STREAM_EVENTS.forEach((name) => {
      source?.addEventListener(name, (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          onEvent({ type: name, data } as StreamEvent);
        } catch {
          /* ignore malformed frame */
        }
      });
    });

    source.onerror = () => {
      source?.close();
      source = null;
      if (closed) return;
      onState("reconnecting");
      const delay = Math.min(15_000, 500 * 2 ** attempt++);
      timer = setTimeout(connect, delay);
    };
  };

  connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    source?.close();
  };
}

export const api = {
  sendProposal: (id: string, text?: string): Promise<ReplyProposal> =>
    USE_MOCKS
      ? getMockDriver().sendProposal(id, text)
      : post(`/api/proposals/${id}/send`, { text }),

  dismissProposal: (id: string): Promise<ReplyProposal> =>
    USE_MOCKS ? getMockDriver().dismissProposal(id) : post(`/api/proposals/${id}/dismiss`),

  regenerateProposal: (id: string): Promise<ReplyProposal> =>
    USE_MOCKS ? getMockDriver().regenerateProposal(id) : post(`/api/proposals/${id}/regenerate`),

  approveAction: (id: string): Promise<ActionProposal> =>
    USE_MOCKS ? getMockDriver().approveAction(id) : post(`/api/actions/${id}/approve`),

  rejectAction: (id: string): Promise<ActionProposal> =>
    USE_MOCKS ? getMockDriver().rejectAction(id) : post(`/api/actions/${id}/reject`),

  rollbackAction: (id: string): Promise<ActionProposal> =>
    USE_MOCKS ? getMockDriver().rollbackAction(id) : post(`/api/actions/${id}/rollback`),

  setAutonomy: (level: AutonomyLevel): Promise<ShowState> =>
    USE_MOCKS ? getMockDriver().setAutonomy(level) : post(`/api/autonomy`, { level }),

  injectChat: (author: string, text: string): Promise<ChatMessage> =>
    USE_MOCKS
      ? getMockDriver().injectChat(author, text)
      : post(`/api/chat/inject`, { author, text }),

  research: (query: string, listingId?: string): Promise<ResearchCard> =>
    USE_MOCKS
      ? getMockDriver().research(query, listingId)
      : post(`/api/research`, { query, listingId }),

  audit: (limit = 200): Promise<AuditEntry[]> =>
    USE_MOCKS ? getMockDriver().getAudit() : get(`/api/audit?limit=${limit}`),

  metrics: (): Promise<Metrics> => (USE_MOCKS ? getMockDriver().getMetrics() : get(`/api/metrics`)),
};

/** Chat backlog for mock mode only — the real stream sends it in `hello`. */
export function mockChatBacklog(): ChatMessage[] {
  return USE_MOCKS ? getMockDriver().backlogMessages : [];
}
