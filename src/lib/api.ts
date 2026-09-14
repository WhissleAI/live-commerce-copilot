/**
 * The single place any URL appears. When VITE_USE_MOCKS === "true" every call is
 * served by the in-browser mock driver; otherwise the identical surface hits the
 * real endpoints with no component changes.
 */
import { getMockDriver } from "./mockStream";
import type {
  Account,
  Analytics,
  BillingSnapshot,
  SellerGuardrailPolicy,
  SettingsView,
  CatalogSummary,
  SessionStart,
  ShowSummary,
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
/** Exported so the console can link to backend-served pages (the audio bridge). */
export const API_BASE = BASE;
export const USE_MOCKS =
  ((import.meta.env["VITE_USE_MOCKS"] as string | undefined) ?? "true") === "true";

const url = (path: string) => `${BASE}${path}`;

// ── session ─────────────────────────────────────────────────────────────────
//
// The backend attributes every write to an account, so the console holds a
// bearer token. A guest is minted on first load and can WATCH everything; the
// operator claims the console to send replies and approve actions.
//
// localStorage, not sessionStorage: the token identifies the seller across
// tabs and reloads, and losing it on every refresh would mean a new anonymous
// account in the audit log each time.
const TOKEN_KEY = "sidestage.token";

export function authToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(t: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* a private window still works for the length of this page */
  }
}

let memoryToken: string | null = null;

function bearer(): Record<string, string> {
  const t = authToken() ?? memoryToken;
  return t ? { authorization: `Bearer ${t}` } : {};
}

/** Mint a guest session if this browser has none. Called once on boot. */
export async function ensureSession(): Promise<Account | null> {
  if (USE_MOCKS) return null;
  const existing = authToken();
  if (existing) {
    const me = await get<{ account: Account | null }>("/api/auth/me").catch(() => ({ account: null }));
    // A token the server no longer knows (expired, or a rebuilt database) is
    // not a session. Fall through and mint a fresh one rather than leaving the
    // console silently unable to act.
    if (me.account) return me.account;
  }
  const s = await post<{ token: string; account: Account }>("/api/auth/guest");
  setToken(s.token);
  memoryToken = s.token;
  return s.account;
}

/** "This is my show" — promote the guest holding this session to operator. */
export async function claimConsole(displayName?: string): Promise<Account | null> {
  const r = await post<{ account: Account | null }>("/api/auth/claim", { displayName });
  return r.account;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  // Declaring `content-type: application/json` with NO body makes Fastify reject
  // the request as malformed JSON — a 400 on every bodyless command the console
  // sends: regenerate, dismiss, approve, reject, rollback, detach, activate.
  // Send the header only when there is something to parse.
  const init: RequestInit = body === undefined
    ? { method: "POST", headers: bearer() }
    : {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer() },
        body: JSON.stringify(body),
      };

  const res = await fetch(url(path), init);
  if (!res.ok) {
    // Surface what the server said. A bare status code sent us chasing the
    // wrong layer for an afternoon.
    const detail = await res.text().catch(() => "");
    throw new Error(`${path} failed: ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as T;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "PUT",
    headers: { "content-type": "application/json", ...bearer() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail ? detail.slice(0, 400) : `${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(url(path), { headers: bearer() });
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
  // Host speech from the Whissle listen-only session, and the set of shows this
  // backend is watching.
  "transcript",
  // The loudness envelope behind the audio timeline. Missing from this list is
  // why the strip said "no audio yet" while transcripts streamed in beside it:
  // the server emitted every frame and the browser had never asked for them.
  "levels",
  "shows",
  "show",
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

  // ── session setup ─────────────────────────────────────────────────────────
  // Mock mode has no backend to ask, so it reports no catalogs and the console
  // skips the launcher entirely.
  catalogs: (): Promise<CatalogSummary[]> => (USE_MOCKS ? Promise.resolve([]) : get(`/api/catalogs`)),

  shows: (): Promise<ShowSummary[]> => (USE_MOCKS ? Promise.resolve([]) : get(`/api/shows`)),

  /**
   * Attach to a live eBay show.
   *
   * `catalogId` is OPTIONAL and only meaningful when the show is the operator's
   * own. Without it the copilot grounds in the stream itself — every lot the
   * host puts on screen — which is the only honest inventory for a show you do
   * not own.
   */
  startSession: (input: { url: string; catalogId?: string }): Promise<SessionStart> =>
    post(`/api/shows/attach`, input),

  endSession: (showId: string): Promise<{ ok: boolean; shows: ShowSummary[] }> =>
    post(`/api/shows/${encodeURIComponent(showId)}/detach`),

  activateShow: (showId: string): Promise<ShowSummary> =>
    post(`/api/shows/${encodeURIComponent(showId)}/activate`),

  /** Wallet + consumption + this app's own gateway meter. Mock mode has no
   *  account behind it, so it reports nothing rather than inventing a balance. */
  billing: (days = 7): Promise<BillingSnapshot | null> =>
    USE_MOCKS ? Promise.resolve(null) : get(`/api/billing?days=${days}`),

  analytics: (days = 7): Promise<Analytics> => get(`/api/analytics?days=${days}`),

  settings: (): Promise<SettingsView> => get(`/api/settings`),

  /** Saving re-arms Layer B here AND re-pushes Layer A to the agent, then reads
   *  back what the gateway says is armed — which is what comes back in `armed`. */
  saveSettings: (p: Partial<SellerGuardrailPolicy>): Promise<SettingsView> => put(`/api/settings`, p),

  resetSettings: (): Promise<SettingsView> => post(`/api/settings/reset`),
};

/** Chat backlog for mock mode only — the real stream sends it in `hello`. */
export function mockChatBacklog(): ChatMessage[] {
  return USE_MOCKS ? getMockDriver().backlogMessages : [];
}
