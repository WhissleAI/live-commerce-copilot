/**
 * The single place any URL appears. When VITE_USE_MOCKS === "true" every call is
 * served by the in-browser mock driver; otherwise the identical surface hits the
 * real endpoints with no component changes.
 */
import { getMockDriver } from "./mockStream";
import { withRemote } from "./surfaces";
import type {
  DraftsQueue,
  DraftStatus,
  LearnReport,
  Persona,
  PersonaView,
  SurfaceDraft,
  SurfaceId,
  SurfaceInfo,
  SurfaceRoom,
  VoiceCorpusDoc,
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
  ShowRow,
  ShowReport,
  ShowRecord,
  ShowTimeline,
  PrdMetrics,
  PromotionReadiness,
  CatalogReadiness,
  CatalogFit,
  BudgetState,
  AnalyticsOverview,
  CatalogMarket,
  DiscoveredShow,
  DiscoveryReason,
  HomeView,
  EbayImportResult,
  EbayResult,
  EbayStatus,
  FollowingResponse,
  CostSnapshot,
  DryRunResult,
  Listing,
} from "./types";

const BASE = (import.meta.env["VITE_API_BASE"] as string | undefined) ?? "http://localhost:8790";
/** Exported so the console can link to backend-served pages (the audio bridge). */
export const API_BASE = BASE;
/** For the two places a header cannot go: EventSource and the bridge page. */
export function tokenQuery(): string {
  const t = authToken() ?? memoryToken;
  return t ? `token=${encodeURIComponent(t)}` : "";
}
// Mocks are opt-in. Defaulting to "true" meant any build without the variable
// set — a preview, a fresh clone — shipped the scripted stream as if it were
// a product. In dev with nothing set you still get mocks; a build never does.
export const USE_MOCKS =
  ((import.meta.env["VITE_USE_MOCKS"] as string | undefined) ??
    (import.meta.env.DEV ? "true" : "false")) === "true";

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
export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* no storage */
  }
}

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

/** The signed-in account, or null. Never mints anything: signing in is a page. */
export async function ensureSession(): Promise<Account | null> {
  const t = authToken() ?? memoryToken;
  if (!t) return null;
  try {
    const me = await get<{ account: Account | null }>("/api/auth/me");
    if (me.account) return me.account;
  } catch (e) {
    // Only a refusal forgets the token. A network blip or a backend mid-deploy
    // must not sign the seller out — that is what "login does not stick" was.
    if ((e as { status?: number }).status === 401) clearToken();
    return null;
  }
  clearToken();
  return null;
}

export function signedIn(): boolean {
  return Boolean(authToken() ?? memoryToken);
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<Account> {
  const s = await post<{ token: string; account: Account }>("/api/auth/register", {
    email,
    password,
    displayName,
  });
  setToken(s.token);
  memoryToken = s.token;
  return s.account;
}

export async function login(email: string, password: string): Promise<Account> {
  const s = await post<{ token: string; account: Account }>("/api/auth/login", { email, password });
  setToken(s.token);
  memoryToken = s.token;
  return s.account;
}

export async function logout(): Promise<void> {
  await post("/api/auth/logout").catch(() => {});
  clearToken();
  memoryToken = null;
}

/**
 * What the server said, as a sentence.
 *
 * Every helper here used to surface `res.text()` raw, so a refusal arrived in
 * the UI as `{"error":"the demo show cannot be deleted"}` — the JSON braces
 * rendered inside the dialog, in front of the operator. The server answers with
 * `{ error }` on every path; read it.
 */
async function failure(res: Response, path: string): Promise<ApiError> {
  const text = await res.text().catch(() => "");
  let message = text.trim();
  const status = res.status;
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    body = parsed as Record<string, unknown>;
    const said = parsed.error ?? parsed.message;
    if (typeof said === "string" && said.trim()) message = said.trim();
  } catch {
    /* not JSON — the text is the best we have */
  }
  // A status with no body is still more useful than an empty string.
  const err = new Error(
    message ? message.slice(0, 400) : `${path} failed: ${res.status}`,
  ) as ApiError;
  err.status = status;
  // The whole payload, not just its first sentence. A refusal that names the
  // environment variable it needs is useless if the client keeps only the
  // sentence and throws the name away — which is what "failed to open twitch"
  // used to be on the other side of this boundary.
  err.body = body;
  const code = body?.["code"];
  if (typeof code === "string") err.code = code;
  return err;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  body?: Record<string, unknown> | null;
}

/**
 * Was that a surface we know about but cannot reach?
 *
 * The backend answers a missing key with a 409 naming the variable. The whole
 * value of that is the NAME, so it is read out here once rather than parsed at
 * three call sites — and a 409 that is not this shape reads as null, so nothing
 * claims to know which key is missing when the server never said.
 */
export function surfaceUnavailable(
  e: unknown,
): { surface: string | null; missing: string | null; message: string } | null {
  const err = e as ApiError | undefined;
  if (!err || err.status !== 409) return null;
  const body = err.body ?? {};
  const named = err.code === "surface-unavailable" || typeof body["missing"] === "string";
  if (!named) return null;
  const surface = typeof body["surface"] === "string" ? body["surface"] : null;
  const missing = typeof body["missing"] === "string" ? body["missing"] : null;
  return { surface, missing, message: err.message };
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  // Declaring `content-type: application/json` with NO body makes Fastify reject
  // the request as malformed JSON — a 400 on every bodyless command the console
  // sends: regenerate, dismiss, approve, reject, rollback, detach, activate.
  // Send the header only when there is something to parse.
  const init: RequestInit =
    body === undefined
      ? { method: "POST", headers: bearer() }
      : {
          method: "POST",
          headers: { "content-type": "application/json", ...bearer() },
          body: JSON.stringify(body),
        };

  const res = await fetch(url(path), init);
  // Surface what the server said. A bare status code sent us chasing the wrong
  // layer for an afternoon.
  if (!res.ok) throw await failure(res, path);
  return (await res.json()) as T;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "PUT",
    headers: { "content-type": "application/json", ...bearer() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await failure(res, path);
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(url(path), { headers: bearer() });
  if (!res.ok) throw await failure(res, path);
  return (await res.json()) as T;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(url(path), { method: "DELETE", headers: bearer() });
  if (!res.ok) throw await failure(res, path);
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
  // The listen session's health as the backend sees it: loud audio with no
  // transcript for a while is `stalled`, and the console says so instead of
  // showing a frozen last line.
  "listen",
  // The loudness envelope behind the audio timeline. Missing from this list is
  // why the strip said "no audio yet" while transcripts streamed in beside it:
  // the server emitted every frame and the browser had never asked for them.
  "levels",
  "shows",
  "show",
  // Ingest health, and the server's refusal when the show id is unknown. Both
  // were emitted and neither was heard — the same class of bug as `levels`.
  "source",
  "stream_error",
  // The spend cap and the low-balance warning. Emitted by the server on every
  // wallet read; never subscribed to, so the banner that stops a show from
  // draining a wallet quietly could not render. Same class of bug as `levels`.
  "budget",
] as const;

/**
 * Subscribe to the show stream. Handles reconnect with backoff and reports
 * connection state so the top bar can show `reconnecting…`.
 */
export function subscribeStream(
  onEvent: (e: StreamEvent) => void,
  onState: (s: ConnectionState) => void,
  /** Which show to follow. Omitted, the server picks whichever show it
   *  considers active — which makes two tabs on two shows impossible, and is
   *  not what a console that was opened FROM a show meant to ask for. */
  showId?: string | null,
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
    // EventSource cannot carry a header, so the session rides in the query.
    source = new EventSource(
      url(`/api/stream?${showId ? `showId=${encodeURIComponent(showId)}&` : ""}${tokenQuery()}`),
    );

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
      // Only a real transport failure. `onerror` also fires for a server event
      // literally named "error" — which is why the server's is `stream_error`
      // — and for anything else the browser routes here while the connection is
      // still open. Closing a live stream on one of those put the console in a
      // permanent reconnect loop showing a skeleton.
      if (source && source.readyState === EventSource.OPEN) return;
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

/**
 * A list, whichever way the server chose to wrap it.
 *
 * Half this API answers with a bare array and half with `{ rooms: [...] }`, and
 * the surface endpoints are being written in parallel with this file. Guessing
 * wrong should cost an empty list, not a `.map of undefined` inside a render.
 */
function asArray<T>(raw: unknown, key: string): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const inner = (raw as Record<string, unknown> | null)?.[key];
  return Array.isArray(inner) ? (inner as T[]) : [];
}

const asRooms = (raw: unknown): SurfaceRoom[] => asArray<SurfaceRoom>(raw, "rooms");

const EMPTY_DRAFTS_QUEUE: DraftsQueue = {
  surface: null,
  status: null,
  waiting: { total: 0, bySurface: [] },
  drafts: [],
};

/**
 * The queue, made safe to render.
 *
 * `origin` is the field the card prints and the server always sends it — but a
 * row that arrives without one must not put the word "undefined" where a
 * subreddit goes, so it is synthesised from `room` here, once, rather than
 * with a fallback at every call site.
 */
function asDraftsQueue(raw: unknown): DraftsQueue {
  const o = (raw ?? {}) as Partial<DraftsQueue>;
  const drafts = asArray<SurfaceDraft>(raw, "drafts").map((d) => ({
    ...d,
    origin: d.origin ?? {
      kind: d.surface === "dm" ? ("session" as const) : ("room" as const),
      id: d.room ?? "",
      label: d.room ?? "",
    },
    room: d.origin?.label ?? d.room ?? "",
  }));
  const waiting = o.waiting?.bySurface
    ? { total: o.waiting.total ?? 0, bySurface: o.waiting.bySurface }
    : // No envelope: count what arrived, so the heading is never blank.
      {
        total: drafts.filter((d) => (d.status ?? "open") === "open").length,
        bySurface: [] as { surface: SurfaceId; count: number }[],
      };
  return {
    surface: o.surface ?? null,
    status: o.status ?? null,
    waiting,
    drafts,
  };
}

const EMPTY_PERSONA_VIEW: PersonaView = { persona: null, voice: { total: 0, docs: [] } };

/** The persona and its corpus, however the payload was shaped. A persona sent
 *  bare rather than in an envelope still reads, and a missing corpus reads as
 *  an empty one rather than as a crash inside a render. */
function asPersonaView(raw: unknown): PersonaView {
  if (!raw || typeof raw !== "object") return EMPTY_PERSONA_VIEW;
  const o = raw as {
    persona?: unknown;
    voice?: { total?: number; docs?: unknown };
    name?: unknown;
  };
  const persona =
    o.persona && typeof o.persona === "object"
      ? (o.persona as Persona)
      : typeof o.name === "string"
        ? (raw as Persona)
        : null;
  const docs = Array.isArray(o.voice?.docs) ? (o.voice.docs as VoiceCorpusDoc[]) : [];
  return { persona, voice: { total: o.voice?.total ?? docs.length, docs } };
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
  catalogs: (): Promise<CatalogSummary[]> =>
    USE_MOCKS ? Promise.resolve([]) : get(`/api/catalogs`),

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

  /** One live show's analytics, by the second. `showId` names it; without one
   *  the server picks whichever show is active. */
  analytics: (days = 7, showId?: string): Promise<Analytics> =>
    get(`/api/analytics?days=${days}${showId ? `&showId=${encodeURIComponent(showId)}` : ""}`),

  settings: (): Promise<SettingsView> => get(`/api/settings`),

  /** Saving re-arms Layer B here AND re-pushes Layer A to the agent, then reads
   *  back what the gateway says is armed — which is what comes back in `armed`. */
  saveSettings: (p: Partial<SellerGuardrailPolicy>): Promise<SettingsView> =>
    put(`/api/settings`, p),

  resetSettings: (): Promise<SettingsView> => post(`/api/settings/reset`),

  // ── surfaces that existed server-side and had no caller ───────────────────
  //
  // Seven endpoints were built, tested, and never fetched. `endSession` was
  // the worst of it: the server handed back the finished report and the client
  // dropped it on the floor and reloaded the page.

  /** Every show behind this seller, with its report summary when it has one. */
  reports: (limit = 50): Promise<ShowRow[]> =>
    USE_MOCKS ? Promise.resolve([]) : get(`/api/reports?limit=${limit}`),

  /** The post-session report for one show — engagement, safety, inventory,
   *  actions, the gaps list and every PRD metric. */
  report: (showId: string): Promise<ShowReport> =>
    get(`/api/shows/${encodeURIComponent(showId)}/report`),

  /** The show on one clock — utterances, frames, audio chunks — for the
   *  report's playable timeline. Works after the show has ended. */
  timeline: (showId: string): Promise<ShowTimeline> =>
    get(`/api/shows/${encodeURIComponent(showId)}/timeline`),
  /** Ask the show's agent for the fuller per-frame readings, in the background. */
  describeTimeline: (showId: string): Promise<{ ok: boolean; describing: boolean }> =>
    post(`/api/shows/${encodeURIComponent(showId)}/timeline/describe`),

  /** The evidence behind a report: every comment, proposal, action and audit
   *  entry, from the tables that kept them. */
  record: (showId: string): Promise<ShowRecord> =>
    get(`/api/shows/${encodeURIComponent(showId)}/record`),

  /** Everything about one show as one JSON document. A link, not a fetch:
   *  the browser downloads it. */
  // The export is a cross-origin URL: a browser ignores `download` on those,
  // and an <a> cannot send a bearer header. Fetch it and hand back a blob.
  exportUrl: (showId: string): string =>
    `${BASE}/api/shows/${encodeURIComponent(showId)}/export?${tokenQuery()}`,
  exportBlob: async (showId: string): Promise<Blob> => {
    const res = await fetch(url(`/api/shows/${encodeURIComponent(showId)}/export`), {
      headers: bearer(),
    });
    if (!res.ok) throw await failure(res, "export");
    return res.blob();
  },
  // Media is loaded by <img> and <audio>, which cannot send a bearer header,
  // so the session travels in the query string the way the stream's does.
  frameUrl: (showId: string, seq: number): string =>
    `${BASE}/api/shows/${encodeURIComponent(showId)}/media/frames/${seq}?${tokenQuery()}`,
  audioUrl: (showId: string, seq: number): string =>
    `${BASE}/api/shows/${encodeURIComponent(showId)}/media/audio/${seq}?${tokenQuery()}`,

  /** Deletes the session, its chat, its audit chain — and the Whissle agent it
   *  owned. The dialog has to say all three before this is called. */
  deleteShow: (
    showId: string,
  ): Promise<{ ok: boolean; showId: string; agent: { ok: boolean; detail?: string } }> =>
    del(`/api/shows/${encodeURIComponent(showId)}`),

  /** PRD §4, computed per show. */
  prd: (showId?: string): Promise<PrdMetrics> =>
    get(`/api/show/prd${showId ? `?showId=${encodeURIComponent(showId)}` : ""}`),

  /** Has this seller earned the next rung — over THEIR shows. */
  autonomyReadiness: (showId?: string): Promise<PromotionReadiness> =>
    get(`/api/autonomy/readiness${showId ? `?showId=${encodeURIComponent(showId)}` : ""}`),

  /** Blockers and warnings, before a session starts. */
  /** `showId` lets readiness judge the SHOW's agent rather than whatever the
   *  catalog file remembers — a prepared or running show has its own. */
  catalogReadiness: (catalogId: string, showId?: string): Promise<CatalogReadiness> =>
    get(
      `/api/catalogs/${encodeURIComponent(catalogId)}/readiness${showId ? `?showId=${encodeURIComponent(showId)}` : ""}`,
    ),

  /** Does this catalog match what the show is actually putting on screen? */
  showFit: (showId?: string): Promise<CatalogFit> =>
    get(`/api/show/fit${showId ? `?showId=${encodeURIComponent(showId)}` : ""}`),

  /**
   * Mark a sent reply wrong.
   *
   * The PRD's one unmeasurable metric, and the operator is the only source it
   * has. Counted in the report as a floor and recorded in the audit chain.
   */
  flagProposal: (id: string, reason: string): Promise<{ ok: boolean }> =>
    post(`/api/proposals/${id}/flag`, { reason }),

  /** Draft for a comment the admission gate dropped. The gate is right about
   *  nearly everything and wrong about some; this is how the operator argues. */
  answerDropped: (messageId: string): Promise<ChatMessage> =>
    post(`/api/chat/${encodeURIComponent(messageId)}/answer`),

  /** Tell the copilot what is actually on screen. One human correction fixes
   *  every answer that would have been wrong after it. */
  nameLot: (listingId: string, title: string): Promise<Listing> =>
    post(`/api/listings/${encodeURIComponent(listingId)}/name`, { title }),

  /** Ask what it would say, against the catalog as it stands, sending nothing. */
  dryRun: (question: string): Promise<DryRunResult> => post(`/api/dry-run`, { question }),

  /** Cost with a history — one row per finished session, plus the live wallet. */
  cost: (days = 30): Promise<CostSnapshot> => get(`/api/cost?days=${days}`),

  /** Cross-show analytics. Needs no live show. */
  analyticsOverview: (days = 30): Promise<AnalyticsOverview> =>
    get(`/api/analytics/overview?days=${days}`),

  /** Everything the home surface needs in one read: what is on air, what we
   *  have prepared for, and what is being watched. */
  home: (refresh = false): Promise<HomeView> =>
    USE_MOCKS
      ? Promise.resolve({
          live: [],
          discovery: {
            reason: "ok" as const,
            session: { present: false, savedAt: null, ageHours: null, stale: false, path: "" },
          },
          prepared: [],
          preparing: [],
          watching: [],
        })
      : get(`/api/home${refresh ? "?refresh=1" : ""}`),

  /** One seller's eBay Live page — live now plus what they have scheduled. */
  sellerShows: (
    handle: string,
  ): Promise<{ handle: string; shows: DiscoveredShow[]; reason: DiscoveryReason }> =>
    get(`/api/shows/seller/${encodeURIComponent(handle)}`),

  /** Build a catalog and an agent for an event before it starts. Returns as
   *  soon as the work is queued — it takes the better part of a minute. */
  prepareShow: (s: {
    eventId: string;
    title: string;
    host?: string;
    sellerHandle?: string | null;
    tags?: string[];
    thumbnailUrl?: string | null;
  }): Promise<{ eventId: string; status: string }> => post("/api/shows/prepare", s),

  /** Drops the prepared show, its catalog file and its agent. */
  dropPrepared: (eventId: string): Promise<{ agent: { ok: boolean; detail: string } | null }> =>
    del(`/api/shows/prepared/${encodeURIComponent(eventId)}`),

  /** The whole catalog priced against the market. Cached server-side and never
   *  blocking on eBay: a miss comes back `checking` and this is polled. */
  catalogMarket: (catalogId: string, warm = false): Promise<CatalogMarket> =>
    get(`/api/catalogs/${encodeURIComponent(catalogId)}/market${warm ? "?warm=1" : ""}`),
  /** A direct search of eBay's live catalog. This one does wait — a human typed
   *  it and nothing is watching a queue. */
  ebaySearch: (
    q: string,
    opts: { sold?: boolean; limit?: number } = {},
  ): Promise<{ basis: "sold" | "asking"; query: string; rows: EbayResult[] }> =>
    get(
      `/api/ebay/search?q=${encodeURIComponent(q)}&limit=${opts.limit ?? 12}${opts.sold ? "&sold=1" : ""}`,
    ),

  // ── eBay ────────────────────────────────────────────────────────────────
  /** What the application reaches, split into read and write capabilities. */
  ebayStatus: (): Promise<EbayStatus> => get("/api/ebay/status"),
  /** Returns the consent URL rather than redirecting: a 302 out of an XHR is a
   *  silent failure. The caller opens it. */
  ebayConnect: (): Promise<{ url: string; state: string }> => post("/api/ebay/connect"),
  ebayDisconnect: (): Promise<{ ok: boolean }> => del("/api/ebay/connect"),
  ebayImport: (body?: { catalogId?: string; limit?: number }): Promise<EbayImportResult> =>
    post("/api/ebay/import", body ?? {}),
  /** Arm a show's writes against real listings, or put them back on the mock. */
  setWriteTarget: (
    showId: string,
    target: "mock" | "ebay",
  ): Promise<{ showId: string; writeTarget: "mock" | "ebay" }> =>
    post(`/api/shows/${encodeURIComponent(showId)}/write-target`, { target }),

  /** Close a gap: write the answer a question should have had into the catalog,
   *  so the next show is grounded on it — and this one, if it is still live. */
  answerGap: (
    catalogId: string,
    body: { question: string; answer: string; showId?: string; tags?: string },
  ): Promise<{ qa: { id: string; question: string; answer: string }; appliedLive: boolean }> =>
    post(`/api/catalogs/${encodeURIComponent(catalogId)}/qa`, body),

  /** Where the live show stands against the seller's per-show spend cap. The
   *  console also gets this pushed on the `budget` stream event the moment it
   *  trips; this is for screens that are not the console. */
  budget: (showId?: string): Promise<BudgetState> =>
    USE_MOCKS
      ? Promise.resolve({
          spentUsd: null,
          capUsd: null,
          capped: false,
          balanceUsd: null,
          lowBalance: false,
          readAt: null,
          error: null,
        })
      : get(`/api/budget${showId ? `?showId=${encodeURIComponent(showId)}` : ""}`),

  // ── surfaces ──────────────────────────────────────────────────────────────

  /**
   * Every surface this build knows how to watch, and whether it can right now.
   *
   * Answers in either shape the backend might send — a bare array, or an
   * envelope — and folds whatever comes back over the built-in table, so the
   * console has a complete answer the moment it renders and a better one when
   * this lands. A failure is not an error here: it is "the server has not
   * shipped this yet", and the table is the answer.
   */
  surfaces: async (): Promise<SurfaceInfo[]> => withRemote(await api.surfacesRaw()),

  /**
   * The registry's own answer, unfolded — or null when it did not answer.
   *
   * `surfaces()` folds the reply over the built-in table so the console always
   * has a complete one, which is right for a layout that must not flicker and
   * wrong for a screen that has to tell "the server did not mention this
   * surface" from "the server is not there". The registry returns the adapters
   * that EXIST; a surface absent from a real answer has no adapter, and
   * rendering it with the table's optimistic defaults would draw it as ready.
   */
  surfacesRaw: async (): Promise<SurfaceInfo[] | null> => {
    if (USE_MOCKS) return null;
    const raw = await get<unknown>("/api/surfaces").catch(() => null);
    return Array.isArray(raw)
      ? (raw as SurfaceInfo[])
      : Array.isArray((raw as { surfaces?: unknown } | null)?.surfaces)
        ? ((raw as { surfaces: unknown[] }).surfaces as SurfaceInfo[])
        : null;
  },

  /** The rooms watched on one surface — a subreddit, a channel — and whether a
   *  human has turned posting on for each. */
  rooms: (surface: SurfaceId): Promise<SurfaceRoom[]> =>
    USE_MOCKS
      ? Promise.resolve([])
      : get<unknown>(`/api/surfaces/${encodeURIComponent(surface)}/rooms`).then(asRooms),

  addRoom: (
    surface: SurfaceId,
    room: string,
    patch: { posting?: boolean } = {},
  ): Promise<SurfaceRoom[]> =>
    post<unknown>(`/api/surfaces/${encodeURIComponent(surface)}/rooms`, { room, ...patch }).then(
      asRooms,
    ),

  /** Turning posting on is a decision a human makes, one room at a time. */
  setRoomPosting: (surface: SurfaceId, room: string, posting: boolean): Promise<SurfaceRoom[]> =>
    post<unknown>(`/api/surfaces/${encodeURIComponent(surface)}/rooms`, { room, posting }).then(
      asRooms,
    ),

  removeRoom: (surface: SurfaceId, room: string): Promise<SurfaceRoom[]> =>
    del<unknown>(
      `/api/surfaces/${encodeURIComponent(surface)}/rooms?room=${encodeURIComponent(room)}`,
    ).then(asRooms),

  // ── drafts ────────────────────────────────────────────────────────────────

  /**
   * Every reply waiting on the operator, across every surface we will not post
   * to — one endpoint, one shape.
   *
   * This used to read `/api/drafts` AND `/api/followups` and merge them here,
   * because the first did not exist yet and the second was the whole inbox.
   * It does exist now, and follow-ups are INSIDE it — so the merge that was
   * once the only way to see both would double-count every follow-up: once
   * from the queue, once from the inbox it already contains.
   *
   * `waiting` is the whole account's queue whatever the filters say. It is
   * built by the same function that builds `/api/home` → `now.drafts`, so the
   * count under this page's heading and the count on home are the same number
   * by construction. Filters shape `drafts` only, and a per-surface tab must
   * not move the number above it.
   */
  drafts: async (
    opts: { surface?: SurfaceId; status?: DraftStatus } = {},
  ): Promise<DraftsQueue> => {
    if (USE_MOCKS) return EMPTY_DRAFTS_QUEUE;
    const q = new URLSearchParams();
    if (opts.surface) q.set("surface", opts.surface);
    if (opts.status) q.set("status", opts.status);
    const raw = await get<unknown>(`/api/drafts${q.size ? `?${q}` : ""}`).catch(() => null);
    return asDraftsQueue(raw);
  },

  /**
   * The operator pasted it in themselves. Recorded, never inferred — we cannot
   * see the subreddit, so the person who sent it is the only honest source.
   *
   * One route for every surface. The `dm` special case that used to live here
   * was a workaround for `/api/drafts/:id/sent` 404ing on anything that was
   * not a follow-up; it resolves both id namespaces itself now.
   */
  markDraftSent: (id: string): Promise<unknown> =>
    post(`/api/drafts/${encodeURIComponent(id)}/sent`),

  dismissDraft: (id: string): Promise<unknown> =>
    post(`/api/drafts/${encodeURIComponent(id)}/dismiss`),

  // ── persona ───────────────────────────────────────────────────────────────

  /**
   * Who the copilot is speaking as, and the corpus of the operator's own words.
   *
   * The two travel together and are not the same kind of thing: the persona is
   * edited, the corpus is learned. A 404 is "you have not written one", which
   * is an empty state and not a failure.
   */
  persona: (): Promise<PersonaView> =>
    USE_MOCKS
      ? Promise.resolve(EMPTY_PERSONA_VIEW)
      : get<unknown>("/api/persona")
          .then(asPersonaView)
          .catch((e: ApiError) => {
            if (e.status === 404) return EMPTY_PERSONA_VIEW;
            throw e;
          }),

  /**
   * A PARTIAL update. The server merges what it is given, so a PUT that omits
   * `boundaries` leaves them alone rather than clearing them — which means the
   * caller must send only what changed, and never the whole object "to be
   * safe". Sending the whole object is how a second tab's edit gets reverted by
   * a first tab that was open before it.
   */
  savePersona: (p: Partial<Persona>): Promise<PersonaView> =>
    put<unknown>("/api/persona", p).then(asPersonaView),

  /**
   * Read the operator's own past sends into the voice corpus.
   *
   * Answers with how many were indexed and which shows they came from. The
   * count has been spelled two ways across the two sides of this boundary, so
   * both are read and neither is assumed.
   */
  learnPersona: async (): Promise<LearnReport & PersonaView> => {
    const raw = await post<unknown>("/api/persona/learn");
    const r = (raw ?? {}) as Partial<LearnReport> & { learned?: number };
    const shows = Array.isArray(r.shows)
      ? r.shows.filter(
          (s): s is LearnReport["shows"][number] => Boolean(s) && typeof s === "object",
        )
      : [];
    return {
      total: r.total ?? 0,
      // `learned` was this count's name in the contract and `indexed` is its
      // name in the server. Read both; assume neither.
      indexed: r.indexed ?? r.learned ?? 0,
      shows,
      pasted: r.pasted ?? 0,
      ...asPersonaView(raw),
    };
  },

  /** Sellers you follow. Same grid, same best-effort — the response says when
   *  it was last read so the console never implies a check it did not make. */
  following: (): Promise<FollowingResponse> =>
    USE_MOCKS
      ? Promise.resolve({ sellers: [], checkedAt: null, checking: false })
      : get("/api/following"),
  follow: (handle: string, note?: string): Promise<FollowingResponse> =>
    post("/api/following", { handle, ...(note ? { note } : {}) }),
  unfollow: (handle: string): Promise<FollowingResponse> =>
    del(`/api/following/${encodeURIComponent(handle)}`),
  /** Forces a fresh grid read. Slow by nature — it drives a real browser. */
  refreshFollowing: (): Promise<FollowingResponse> => post("/api/following/refresh", {}),
};

/** Chat backlog for mock mode only — the real stream sends it in `hello`. */
export function mockChatBacklog(): ChatMessage[] {
  return USE_MOCKS ? getMockDriver().backlogMessages : [];
}
