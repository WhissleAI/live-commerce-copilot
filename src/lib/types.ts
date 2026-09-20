export type AutonomyLevel =
  "L0_OBSERVE" | "L1_SUGGEST" | "L2_ONE_TAP" | "L3_AUTO_REPLY" | "L4_AUTO_ACT";

export type ChatIntent =
  | "price_question"
  | "availability"
  | "sizing"
  | "shipping"
  | "returns"
  | "authenticity"
  | "comparison"
  | "discount_request"
  | "hype"
  | "other";

export type GuardName =
  | "price"
  | "availability"
  | "policy"
  | "claim_grounding"
  | "tone"
  | "pii"
  // Surface-specific. Both answer `n/a` on a surface that does not use them,
  // which is how every guard already behaves with nothing to check — so a live
  // commerce reply's guard row reads exactly as it did before these existed.
  | "community_rule"
  | "sponsor";
export type Verdict = "allow" | "revise" | "block";

// ── surfaces ────────────────────────────────────────────────────────────────
//
// A surface is WHERE a conversation happens. Mirrors `src/surfaces/types.ts`
// and `src/retrieval/corpus.ts` in the backend.
//
// The console reads capabilities rather than asking "is this eBay Live?",
// because every question it used to answer by naming the surface — is there a
// lot rail, is there a latency meter, can a reply be sent at all — is really a
// question about what the surface can DO.

export type SurfaceId =
  "simulated" | "ebaylive" | "whatnot" | "tiktoklive" | "twitch" | "youtubelive" | "reddit" | "dm";

export type Tempo = "live" | "async";

/** What KIND of ground truth a fact came out of. */
export type CorpusKind =
  "listing" | "policy" | "schedule" | "sponsor" | "product" | "community" | "qa";

/**
 * Who puts one particular reply in front of the person who asked.
 *
 * NOT the same question as `SurfaceCapabilities.delivery`. That one is what a
 * surface would permit; this is what the server will actually do with THIS
 * proposal, having also asked whether a delivery path is wired into the
 * process that drafted it. The backend's `Pipeline.deliveryFor`
 * (`src/pipeline/pipeline.ts`) is the only place it is decided, and today it
 * answers `"human"` everywhere, because nothing wires a deliverer.
 */
export type ReplyDelivery = "api" | "human";

/** What a surface can do, so the UI and the guards stop guessing. */
export interface SurfaceCapabilities {
  tempo: Tempo;
  /** Can a reply be delivered by us, or only drafted for a human to send? */
  delivery: "api" | "draft-only";
  /** Does this surface carry the operator's audio / video? */
  perception: { audio: boolean; video: boolean };
  /** Which action kinds exist here at all. */
  actions: readonly ActionKind[];
  /** Which corpora ground a reply here. */
  corpora: readonly CorpusKind[];
  /** Rules the COMMUNITY imposes, retrieved per room / subreddit / channel. */
  communityRules: boolean;
}

/**
 * One row of `GET /api/surfaces`.
 *
 * `available` and `missing` are the honest half: an adapter ships whether or
 * not its keys do, and "Twitch needs TWITCH_CLIENT_ID" is a different fact from
 * "Twitch is not a thing". Both optional — a backend that has not shipped them
 * yet reads as available, which is what every surface was before keys existed.
 */
export interface SurfaceInfo {
  id: SurfaceId;
  label: string;
  capabilities: SurfaceCapabilities;
  /**
   * Wired in this build AND with something to open — which is not the same as
   * "this surface exists". The follow-up inbox is the case that separates them:
   * it is built out of a show that has already ended, so it has no `open()` and
   * putting it in the paste box would hand the operator a 409.
   */
  attachable?: boolean;
  /** False when a key is missing. Absent means "the server did not say". */
  available?: boolean;
  /** The environment variable that would fix it. */
  missing?: string | null;
}

export interface ShowState {
  id: string;
  title: string;
  sellerHandle: string;
  startedAt: string;
  viewers: number;
  pinnedListingId: string | null;
  lotQueue: string[];
  autonomyLevel: AutonomyLevel;
  undoWindowS: number;
  /** Which surface this conversation is on. Named `source` since the first
   *  migration, when the only answers were the scripted show and eBay Live. */
  source?: SurfaceId;
  /** The same axis under its newer name. Present from migration 018; absent on
   *  a backend that has not shipped it, where `source` is the answer. */
  surface?: SurfaceId;
  /** The id within the surface: an eBay Live event, a channel, a thread. */
  externalId?: string | null;
  /** A monitored stream we do not own: every write action is refused. */
  readOnly?: boolean;
  status?: "live" | "ended";
  /** The room this show is in — a subreddit, a channel — when it has one. */
  room?: string | null;
}

/** Who is selling, from the catalog chosen at setup. */
export interface SellerProfile {
  handle: string;
  name: string;
  about: string;
  voice: string;
}

/** A seller inventory the operator can run a session against. */
export interface CatalogSummary {
  id: string;
  name: string;
  seller: SellerProfile;
  itemCount: number;
  policyCount: number;
  sample: { title: string; priceCents: number }[];
  /** Where this catalog came from — a prepared show, your own listings, or a demo. */
  origin?:
    | {
        kind: "prepared";
        eventId: string;
        showTitle: string;
        host: string;
        sellerHandle: string | null;
        /** Null when the preparation itself is gone and only the lineup remains. */
        preparedAt: string | null;
      }
    | { kind: "imported"; handle: string }
    | { kind: "seed" };
}

/** A show this backend is watching. */
export interface ShowSummary {
  showId: string;
  /** The Whissle agent answering for this show — one per stream. */
  agentId?: string;
  catalogId?: string | null;
  title: string;
  sellerHandle: string;
  source: SurfaceId;
  /** The surface column, when the backend has it. Falls back to `source`. */
  surface?: SurfaceId;
  externalId: string | null;
  readOnly: boolean;
  /** Where approved writes actually land. Shown, never inferred. */
  writeTarget?: "mock" | "ebay";
  status: "live" | "ended";
  /** When it went on air — the live strip counts from this. */
  startedAt: string;
  viewers: number;
  listings: number;
  proposals: number;
  /** What is waiting for the operator, so a screen that is not the console can
   *  still say "2 awaiting · 1 blocked". */
  awaiting?: number;
  blocked?: number;
}

/**
 * An acoustic distribution from Whissle's metadata head.
 *
 * Never a bare label. The gateway's own note on this head says accuracy
 * degrades sharply on low-arousal states, so showing one word as fact would
 * present a coin flip as certainty. Render the spread, and mark the FLIP —
 * the moment the top read changed is the thing an operator can act on.
 */
export interface SignalDistribution {
  topLabel: string;
  topP: number;
  topK: { label: string; p: number }[];
  changed: boolean;
  prevLabel: string | null;
  heldMs: number | null;
  flips: number | null;
  trusted: boolean;
}

/** One finalized segment of the HOST's speech, from the Whissle listen-only
 *  session, with whatever voice metadata rode alongside it. */
export interface AudioLevels {
  showId: string;
  at: string;
  /** RMS per ~100ms window, 0..1. */
  levels: number[];
}

export interface TranscriptSegment {
  showId?: string;
  text: string;
  emotion: SignalDistribution | null;
  intent: SignalDistribution | null;
  speechRate: number | null;
  at: string;
  /** Loudness envelope measured while this was being said, 0..1 per ~100ms. */
  levels?: number[] | null;
}

/** Result of starting a monitoring session. */
export interface SessionStart {
  showId: string;
  show: ShowState;
  catalog: {
    catalogId: string;
    catalogName: string;
    created: number;
    updated: number;
    policies: number;
    seller: SellerProfile;
  } | null;
}

export interface Listing {
  id: string;
  sku: string;
  title: string;
  brand: string;
  model: string;
  colorway: string;
  size: string;
  condition: "DS" | "VNDS" | "USED";
  priceCents: number;
  floorPriceCents: number;
  costCents: number;
  qty: number;
  soldThisShow: number;
  views: number;
  state: "draft" | "queued" | "live" | "ended";
  pinned: boolean;
  version: number;
  imageUrl: string;
  /** The listing's page on eBay, when it has one. */
  url?: string | null;
  shippingProfile: string;
  authenticated: boolean;
  certId: string | null;
  updatedAt: string;
}

/** The speech act of a comment — the same vocabulary Whissle's metadata head
 *  uses for the host's audio, so both sides of the room read on one axis. */
export type SpeechAct = "query" | "command" | "inform" | "greeting" | "wish" | "other";

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  at: string;
  /** WHAT the comment is about. */
  intent: ChatIntent | null;
  /** WHAT KIND of utterance it is — same axis as the host's voice metadata,
   *  so a buyer querying and the host informing read on one scale. */
  speechAct?: SpeechAct | null;
  admitted: boolean;
  dropReason?: string;
  proposalId?: string;
}

export type EvidenceSource =
  | "listing"
  | "policy"
  | "catalog"
  | "qa"
  | "market"
  | "host"
  /** The operator's own past sends, learned into the voice corpus. Never
   *  grounding for a claim — see `ReplyProposal.styleRef`. */
  | "persona";

export interface Evidence {
  factId: string;
  source: EvidenceSource;
  /** WHICH ground truth this came out of. The console renders a community rule
   *  differently from a price, because one is a constraint on the reply and the
   *  other is an answer in it. Absent on anything recorded before corpora
   *  existed, which was all listing. */
  corpus?: CorpusKind;
  label: string;
  text: string;
  score: number;
  listingVersion?: number;
  /** The listing on eBay, when the fact came from one that has a page. */
  url?: string | null;
}

export interface GuardResult {
  guard: GuardName;
  verdict: Verdict | "n/a";
  reason?: string;
  detail?: { expected?: string; found?: string };
}

export interface Claim {
  text: string;
  factId: string;
  supported: boolean;
}

export interface SpanBreakdown {
  admitMs: number;
  classifyMs: number;
  retrieveMs: number;
  composeMs: number;
  guardMs: number;
  repairMs: number;
  totalMs: number;
  cacheHit: boolean;
  budgetMs: number;
  overBudget: boolean;
}

export interface ReplyProposal {
  id: string;
  message: ChatMessage;
  status: "drafting" | "ready" | "needs_review" | "blocked" | "sent" | "auto_sent" | "dismissed";
  draft: string;
  claims: Claim[];
  evidence: Evidence[];
  guards: GuardResult[];
  verdict: Verdict;
  confidence: number;
  repaired: boolean;
  spans: SpanBreakdown;
  createdAt: string;
  /**
   * What accepting this reply will DO — the server's answer, per proposal.
   *
   * Decided by the backend from the surface AND from whether a delivery path
   * is wired (`Pipeline.deliveryFor`), never by this client from the
   * capability table: eBay Live declared `delivery: "api"` for months with no
   * code anywhere posting a character to eBay, and the console rendered a
   * primary Send and a "Reply sent to @buyer" toast off that declaration.
   *
   * Optional because a backend older than the field says nothing — and ABSENT
   * READS AS `"human"`. The costly failure is a Send button over a reply
   * nothing delivers; a Copy button over a reply that could have been sent
   * costs a paste.
   */
  delivery?: ReplyDelivery;
  sentText?: string;
  /** One of the operator's own past answers, cited as a STYLE reference and
   *  never as grounding. Rendered muted, below the guards it must not compete
   *  with: "written the way you answered this in March". */
  styleRef?: StyleRef | null;
  /** The thread this reply is for, on an async surface. */
  thread?: ThreadContext | null;
}

export type ActionKind =
  // live commerce
  | "push_listing"
  | "swap_pinned"
  | "markdown_price"
  | "adjust_stock"
  | "end_listing"
  // creator surfaces
  | "create_clip"
  | "mark_highlight"
  | "run_poll"
  | "shoutout"
  | "pin_message"
  // async surfaces
  | "post_reply"
  | "send_dm"
  | "flag_for_human";

export interface PreflightCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ActionProposal {
  id: string;
  kind: ActionKind;
  listingId: string;
  listingTitle: string;
  summary: string;
  rationale: string;
  params: Record<string, unknown>;
  before: Record<string, unknown>;
  status:
    | "proposed"
    | "preflight_failed"
    | "approved"
    | "committing"
    | "committed"
    | "failed"
    | "rolled_back"
    | "rejected";
  preflight: { ok: boolean; checks: PreflightCheck[] };
  idempotencyKey: string;
  undoableUntil: string | null;
  error?: string;
  createdAt: string;
}

export interface AuditEntry {
  seq: number;
  at: string;
  hash: string;
  prevHash: string;
  kind:
    | "action_proposed"
    | "action_preflight_failed"
    | "action_committed"
    | "action_failed"
    | "action_rolled_back"
    | "reply_sent"
    | "reply_blocked"
    | "autonomy_changed";
  actorType: "copilot" | "seller" | "system";
  summary: string;
  detail: Record<string, unknown>;
}

export interface Metrics {
  proposals: number;
  sent: number;
  autoSent: number;
  dismissed: number;
  blocked: number;
  guardBlocks: Record<GuardName, number>;
  latency: { p50: number; p95: number; p99: number; budgetMs: number; breaches: number };
  cacheHitRate: number;
  answeredRate: number;
  actionsCommitted: number;
  actionsRolledBack: number;
}

export interface ShowContext {
  currentTopic: string;
  listingInFocus: string | null;
  recentPoints: string[];
  /** Inferred from what was SAID. */
  tone: string | null;
  /** Measured from HOW it was said — a distribution, carried only while the
   *  metadata head reports it trusted. */
  voice: SignalDistribution | null;
  /** A one-line reading of the show's VIDEO. Context, never provenance. */
  onScreen: { text: string; at: string } | null;
  /** The seller's delivery over the last few minutes, derived from the voice
   *  distributions — a style, not a sentiment. */
  style?: HostStyle | null;
  updatedAt: string;
}

export interface Comp {
  title: string;
  /** What this comparable is priced at, on the basis below. */
  priceCents: number;
  /** When it sold. Null for an active listing, which has not. */
  soldAt: string | null;
  condition: string;
  size: string;
  /** `sold` is what someone paid; `asking` is what someone hopes for. They move
   *  differently and a seller prices against them differently. */
  basis: "sold" | "asking";
  url?: string;
}

export interface ResearchCard {
  query: string;
  listingId: string | null;
  headline: string;
  comps: Comp[];
  medianCents: number;
  /** What `medianCents` is a median OF. "none" when nothing was found. */
  marketBasis: "sold" | "asking" | "none";
  marketSource: "ebay-sold" | "ebay-active" | "seeded" | "checking" | "none";
  suggestion: string;
  specDiff?: { attribute: string; ours: string; theirs: string }[];
  latencyMs: number;
  evidence: Evidence[];
}

/** Payload of the `hello` SSE event. */
export interface HelloPayload {
  showId?: string;
  seller?: SellerProfile | null;
  catalogId?: string | null;
  show: ShowState;
  listings: Listing[];
  /** The tail of the firehose, so a console opened mid-show is not blank. */
  chat?: ChatMessage[];
  proposals: ReplyProposal[];
  actions: ActionProposal[];
  audit: AuditEntry[];
  metrics: Metrics;
  context: ShowContext;
}

export type StreamEvent =
  | { type: "hello"; data: HelloPayload }
  | { type: "transcript"; data: TranscriptSegment }
  | { type: "shows"; data: ShowSummary[] }
  | { type: "show"; data: ShowState }
  | { type: "levels"; data: AudioLevels }
  | { type: "chat"; data: ChatMessage }
  | { type: "proposal"; data: ReplyProposal }
  | { type: "action"; data: ActionProposal }
  | { type: "listing"; data: Listing }
  | { type: "audit"; data: AuditEntry }
  | { type: "metrics"; data: Metrics }
  | { type: "context"; data: ShowContext }
  // Ingest health from the eBay Live watcher. Emitted since the watcher was
  // written and never subscribed to, so a stream that stopped reading the lot
  // card looked exactly like a quiet chat.
  | { type: "source"; data: SourceStatus }
  // What this show has cost against the seller's cap, and whether the cap has
  // stopped the copilot drafting. Server-side: the console never computes it.
  | { type: "budget"; data: BudgetState }
  // The host-audio path's health: loud audio with no transcript is `stalled`.
  | { type: "listen"; data: ListenHealth }
  // The server says so when the show id it was asked for does not exist. The
  // browser used to ignore it and sit on an empty stream forever.
  | { type: "stream_error"; data: { error: string } };

/**
 * The seller's per-show spend cap, and where this show stands against it.
 *
 * `spentUsd` is an upper bound, not an invoice: spend is a wallet delta and the
 * wallet is workspace-wide. Every surface that renders it says so.
 */
export interface BudgetState {
  showId?: string;
  spentUsd: number | null;
  capUsd: number | null;
  capped: boolean;
  balanceUsd: number | null;
  lowBalance: boolean;
  readAt: string | null;
  error: string | null;
}

/** What the ingest watcher is doing, as reported by the server. */
export interface SourceStatus {
  source: "ebaylive" | "simulated" | string;
  eventId?: string;
  state?: "connecting" | "connected" | "failing" | "stopped";
  detail?: string;
  lastReadAt?: string;
  consecutiveFailures?: number;
}

export type ConnectionState = "connecting" | "open" | "reconnecting";

// ── what the copilot is costing ──────────────────────────────────────────────
//
// Mirrors GET /api/billing. Three sources kept deliberately apart: the wallet
// is dollars, usage is consumption, and the meter is this app's own per-show
// call count — which exists because the platform's usage rows carry no agent_id
// for text turns and so cannot attribute a cost to one show.

export interface Wallet {
  balanceUsd: number | null;
  availableUsd: number | null;
  heldUsd: number | null;
  ratePerMinUsd: number | null;
  freeTestRemainingUsd: number | null;
  lowBalance: boolean;
  paymentsEnabled: boolean;
}

export interface UsageTotal {
  service: string;
  quantity: number;
  unit: string | null;
  events: number;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface DoorReport {
  calls: number;
  failures: number;
  totalMs: number;
  contextChars: number;
  lastStatus: number | null;
  lastError: string | null;
  lastErrorAt: string | null;
  p50Ms: number;
  p95Ms: number;
  meanMs: number;
}

export type GatewayDoor =
  | "chat_turn"
  | "utility_turn"
  | "voice_start"
  | "kb_upload"
  | "billing"
  // Camera reads. The meter has counted these since visual perception shipped;
  // the client's door list did not include it, so every frame was metered and
  // then displayed nowhere.
  | "visual_read";

export interface BillingSnapshot {
  wallet: Wallet | null;
  /** Why a read failed. A missing scope and a zero balance are different facts. */
  walletError: { status: number; message: string } | null;
  usage: {
    days: number;
    totals: UsageTotal[];
    daily: { day: string; service: string; quantity: number }[];
  } | null;
  usageError: { status: number; message: string } | null;
  meter: {
    since: string;
    doors: Record<GatewayDoor, DoorReport>;
    totals: { calls: number; failures: number; contextChars: number };
    byShow: Record<string, { calls: number; failures: number; contextChars: number }>;
  };
  spend: Record<string, { openedAt: string; openingUsd: number; spentUsd: number }>;
  attribution: { perShow: string; note: string };
}

/** Who the console is acting as. Every account is a seller; there are no guests. */
export interface Account {
  id: string;
  kind: "seller";
  handle: string;
  displayName: string;
  email?: string | null;
}

// ── settings ────────────────────────────────────────────────────────────────

export interface NeverSayRule {
  pattern: string;
  regex?: boolean;
  why: string;
  /** Stays app-side: the gateway matcher has no catalog access, so this rule
   *  cannot be pushed without blanket-blocking a phrase that is true for a
   *  certified listing. */
  unlessCertified?: boolean;
}

export interface SellerGuardrailPolicy {
  neverSay: NeverSayRule[];
  redactPii: boolean;
  onViolation: string;
  maxDiscountPct: number;
  maxReplyChars: number;
  allowMarkdown: boolean;
  allowEmoji: boolean;
  hypePhrases: string[];
  languageMode: "auto" | "fixed";
  holdForApproval: string[];

  /** What the copilot may use. Each source off is a class of question it will
   *  abstain on rather than guess at — and the switch is honoured at the door,
   *  not in the UI. */
  ingest: {
    hostAudio: boolean;
    cameraFrames: boolean;
    webResearch: boolean;
    priorAnswers: boolean;
  };

  /** How much it may do on its own. All of these were env-only until now, so
   *  changing where a show starts meant editing a file and restarting. */
  automation: {
    startingRung: "L0_OBSERVE" | "L1_SUGGEST" | "L2_ONE_TAP" | "L3_AUTO_REPLY" | "L4_AUTO_ACT";
    confidenceFloor: number;
    undoWindowS: number;
    actionBudget: number;
    warnBalanceUsd: number;
    perShowCapUsd: number | null;
  };
}

/** What the gateway reports as armed after a push — read back, not assumed. */
export interface ArmedReport {
  ok: boolean;
  items: { label: string; value: unknown }[];
  error?: string;
  agentId?: string;
}

export interface SettingsView {
  policy: SellerGuardrailPolicy;
  defaults: SellerGuardrailPolicy;
  overrides: Partial<SellerGuardrailPolicy>;
  armed: ArmedReport | null;
  updatedAt: string | null;
}

// ── analytics ───────────────────────────────────────────────────────────────

export interface TurnEvent {
  hop: number;
  provider: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  failedOver: boolean;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
  sessionId: string;
  title: string;
  at: string;
}

export interface AgentActivity {
  sessions: number;
  turns: number;
  failovers: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  latency: { p50: number; p95: number; max: number };
  byModel: { model: string; provider: string; turns: number; tokens: number; p50Ms: number }[];
  recent: TurnEvent[];
  error?: string;
}

/** Analytics across every finished show in a window. Every number is a sum
 *  or a rate over persisted reports — it exists whether or not a show is live
 *  and it is the same number tomorrow. */
export interface AnalyticsOverview {
  window: { days: number; from: string; to: string };
  shows: { finished: number; withoutReport: number; hoursOnAir: number };
  engagement: {
    commentsSeen: number;
    questionsAsked: number;
    answered: number;
    sent: number;
    answeredRate: number;
    /** A median of per-show medians — a shape, not a median. */
    medianOfMediansMs: number;
    worstP95Ms: number;
    cacheHitRate: number;
  };
  safety: {
    blocked: number;
    revised: number;
    abstained: number;
    flaggedWrong: number;
    byGuard: Record<string, number>;
    blockRate: number;
    chainsIntact: number;
  };
  actions: { proposed: number; committed: number; rolledBack: number; failed: number };
  gmv: { grossCents: number; lotsSold: number; showsWithGmv: number };
  operator: { medianDecisionMs: number | null; editRate: number | null };
  /** Where it is strong and where it is not, by topic — the evidence the
   *  auto-reply allow-list should be argued from. */
  byIntent: {
    intent: string;
    asked: number;
    answeredRate: number;
    abstainedRate: number;
    blocked: number;
    editedRate: number;
    autoReply: "allow-listed" | "never";
  }[];
  perShow: {
    showId: string;
    title: string;
    startedAt: string;
    durationMin: number;
    answeredRate: number;
    p95LatencyMs: number;
    blocked: number;
    flaggedWrong: number;
    gmvCents: number | null;
    chainOk: boolean;
  }[];
  liveShowId: string | null;
  readiness: PromotionReadiness | null;
}

export interface Analytics {
  showId: string;
  agentId: string | null;
  copilot: Metrics & {
    auditChain: { ok: boolean; height: number; brokenAt?: number; reason?: string };
    actionsByStatus: Record<string, number>;
  };
  agent: AgentActivity | null;
  cost: {
    wallet: Wallet | null;
    walletError: { status: number; message: string } | null;
    usage: { days: number; totals: UsageTotal[] } | null;
    usageError: { status: number; message: string } | null;
    meter: BillingSnapshot["meter"];
    spend: BillingSnapshot["spend"];
  };
  policy: { maxDiscountPct: number; neverSayRules: number; armedOnAgent: number };
}

// ── surfaces that existed server-side before they existed here ───────────────
//
// Seven endpoints were built and tested with no caller. These are their shapes,
// mirrored from `src/shows/sessionRecord.ts`, `src/shows/prdMetrics.ts`,
// `src/shows/readiness.ts` and `src/autonomy/promotion.ts` in the backend.

/** One row in "your shows" — a session, with its report summary when it has
 *  one. A session whose report failed to generate is still a row: that is the
 *  show you most want to look at. */
export interface ShowRow {
  showId: string;
  title: string;
  source: string;
  status: "live" | "ended" | string;
  startedAt: string;
  viewers: number;
  agentId: string | null;
  generatedAt: string | null;
  durationMin: number | null;
  questionsAsked: number | null;
  answered: number | null;
  sent: number | null;
  blocked: number | null;
  hasReport: boolean;
}

export interface PrdMetrics {
  gmv: {
    grossCents: number;
    lotsSold: number;
    hours: number;
    /** Null below 15 minutes: a rate extrapolated from four minutes is noise
     *  wearing a decimal point. */
    perShowHourCents: number | null;
    answeredQuestionRate: number;
    timeToAnswerP95Ms: number;
    sellThroughWithAnswer: { withAnswer: number; total: number; rate: number };
  };
  operatorLoad: {
    interactions: number;
    medianDecisionMs: number | null;
    operationalEdits: number;
  };
  trust: {
    blockRate: number;
    editRate: number;
    rollbackRate: number;
    /** The nearest machine proxy for "a wrong reply reached a buyer", and
     *  deliberately NOT the same thing. */
    sentThenContradicted: number;
  };
  notMeasured: { metric: string; why: string }[];
}

export interface ShowReport {
  showId: string;
  /** The inventory this show ran on — where an answer to a gap gets written.
   *  Absent on reports generated before the gap loop existed. */
  catalogId?: string | null;
  title: string;
  source: string;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  generatedAt?: string;
  engagement: {
    commentsSeen: number;
    questionsAsked: number;
    answered: number;
    sent: number;
    answeredRate: number;
    medianLatencyMs: number;
    p95LatencyMs: number;
    cacheHitRate: number;
  };
  safety: {
    blocked: number;
    revised: number;
    abstained: number;
    /** What the OPERATOR marked wrong after it was sent — the only human source
     *  the accuracy number has, and a floor rather than a total. */
    flaggedWrong?: number;
    flagReasons?: Record<string, number>;
    byGuard: Record<string, number>;
    auditChain: { ok: boolean; height: number; brokenAt?: number };
    examples: { question: string; draft: string; guard: string; reason: string }[];
  };
  inventory: { lotsObserved: number; lotsEnded: number; priceChanges: number; peakViewers: number };
  actions: { proposed: number; committed: number; rolledBack: number; failed: number };
  /** The part worth acting on: every question the catalog could not ground. */
  gaps: {
    unanswered: { question: string; asked: number; reason: string }[];
    droppedByGate: Record<string, number>;
  };
  /** Optional on purpose: reports stored before the PRD metrics existed have no
   *  `prd` block, and a report is a statement about a show that has finished —
   *  it is never regenerated. The page degrades rather than crashing on its own
   *  history. */
  prd?: PrdMetrics;
  /**
   * What the host did — measured from their own speech, not from chat.
   * Absent on reports written before signals were kept; null when host audio
   * was never captured for this show. The page says which.
   */
  host?: HostSummary | null;
  /** The platform's own account of the audio session, when it produced one. */
  platform?: PlatformSessionSummary | null;
  /** What was kept for the timeline. */
  media?: { utterances: number; frames: number; audioChunks: number; audioSeconds: number };
  /** What the agent concluded. Null when it could not answer. */
  conclusion?: Conclusion | null;
}

/** A share is probability mass over every utterance, never a label count. */
export interface LabelShare {
  label: string;
  share: number;
}

/** How the seller delivered the show — a style, not a sentiment. */
export interface HostStyle {
  label: string;
  detail: string;
}

/** One two-minute bucket of the host's delivery. `energy` is 0..1. */
export interface HostTrajectoryPoint {
  offsetMs: number;
  utterances: number;
  energy: number;
  intent: Record<string, number>;
  emotion: Record<string, number>;
  wpm: number | null;
}

export interface HostSummary {
  utterances: number;
  speakingSpanS: number;
  intent: LabelShare[];
  emotion: LabelShare[];
  medianSpeechRate: number | null;
  emotionFlips: number;
  loudestAtMs: number | null;
  quietestAtMs: number | null;
  /** Absent on reports written before style was derived. */
  style?: HostStyle | null;
  trajectory?: HostTrajectoryPoint[];
}

export interface PlatformSessionSummary {
  sessionId: string;
  matchedBy: "room" | "agent" | "window";
  createdAt: string;
  durationSec: number;
  turns: number;
  summary: {
    summary: string | null;
    outcome: string | null;
    disposition: string | null;
    nextAction: string | null;
    recommendedAction: string | null;
    confidence: string | null;
    keyPoints: string[];
  } | null;
  emotion: LabelShare[];
  intent: LabelShare[];
  dominantEmotion: string | null;
  primaryIntent: string | null;
  recordingPath: string | null;
}

export type NextActionKind = "catalog" | "pricing" | "inventory" | "hosting" | "policy" | "setup";

export interface NextAction {
  kind: NextActionKind;
  title: string;
  why: string;
}

export interface Conclusion {
  summary: string;
  outcome: "strong" | "steady" | "rough" | "quiet";
  keyPoints: string[];
  nextActions: NextAction[];
  by: "agent";
  at: string;
}

/** The show on one clock: milliseconds from `startedAt`. */
export interface Utterance {
  seq: number;
  at: string;
  offsetMs: number;
  text: string;
  emotion: SignalDistribution | null;
  intent: SignalDistribution | null;
  speechRate: number | null;
  levels: number[] | null;
}

export interface TimelineFrame {
  seq: number;
  at: string;
  offsetMs: number;
  /** The twelve-word live reading, what the copilot used as show context. */
  reading: string;
  /** The fuller post-show reading; null until the describer has run. */
  description: string | null;
  bytes: number;
}

/** The host-audio path's health, from the backend's `listen` event. */
export interface ListenHealth {
  showId: string;
  at: string;
  state: "ok" | "stalled" | "reconnecting";
  detail: string;
}

export interface TimelineAudio {
  seq: number;
  at: string;
  offsetMs: number;
  durationMs: number;
  bytes: number;
  mime: string;
}

export interface ShowTimeline {
  showId: string;
  host: HostSummary | null;
  utterances: Utterance[];
  frames: TimelineFrame[];
  audio: TimelineAudio[];
  /** True while the describer is still writing frame descriptions. */
  describing?: boolean;
}

/** The evidence behind a report, from the tables that kept it. */
export interface RecordedProposal {
  id: string;
  messageId: string | null;
  at: string;
  decidedAt: string | null;
  author: string;
  question: string;
  intent: string | null;
  draft: string;
  sentText: string | null;
  status: string;
  verdict: string;
  confidence: number;
  abstained: boolean;
  repaired: boolean;
  edited: boolean;
  latencyMs: number;
  cacheHit: boolean;
  guards: { guard: string; verdict: string; reason?: string }[];
  evidence: unknown[];
  flaggedWrong: boolean;
  flagReason: string | null;
}

export interface RecordedAction {
  id: string;
  kind: string;
  createdAt: string;
  status: string;
  listingId: string | null;
  listingTitle: string | null;
  /** The listing on eBay, when it has a page. */
  listingUrl?: string | null;
  summary: string;
  rationale: string | null;
  preflight: { ok?: boolean; checks?: { name: string; ok: boolean; detail?: string }[] } | null;
  error: string | null;
  idempotencyKey: string;
}

export interface RecordedAudit {
  seq: number;
  at: string;
  kind: string;
  actorType: string;
  actorId: string | null;
  summary: string;
  hash: string;
  prevHash: string | null;
  detail: unknown;
}

export interface RecordedChat {
  id: string;
  at: string;
  author: string;
  text: string;
  intent: string | null;
  speechAct: string | null;
  admitted: boolean;
  dropReason: string | null;
}

export interface ShowRecord {
  showId: string;
  chat: RecordedChat[];
  proposals: RecordedProposal[];
  actions: RecordedAction[];
  audit: RecordedAudit[];
}

/** A rung's promotion criterion. `unknown` never reads as met — nobody climbs
 *  the ladder on missing data. */
export interface PromotionCriterion {
  to: AutonomyLevel;
  label: string;
  showsRequired: number;
  showsSeen: number;
  value: number | null;
  target: string;
  state: "met" | "not_met" | "unknown";
  detail: string;
}

export interface PromotionReadiness {
  current: AutonomyLevel;
  next: AutonomyLevel | null;
  ready: boolean;
  criteria: PromotionCriterion[];
}

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  detail: string;
  /** A blocker disables Start; a warning does not. Drawing them identically is
   *  how a seller starts a show with no knowledge base. */
  severity: "blocker" | "warning" | "info";
}

/** What eBay says a listing in this category must carry, against what the
 *  catalog does. Null when eBay could not be asked — which is "not checked",
 *  never "nothing missing". */
/** What the eBay application can and cannot do, split by capability because
 *  reads and writes need different things and must not be shown as one state. */
export interface EbayStatus {
  configured: boolean;
  env: "sandbox" | "production" | string;
  marketplaceId: string;
  token: boolean;
  browse: boolean;
  taxonomy: boolean;
  /** Always false until eBay approves the app for Marketplace Insights. */
  soldComps: boolean;
  error: string | null;
  write: {
    connected: boolean;
    connectedAt: string | null;
    scopes: string[];
    /** What is missing before a seller can even be asked to consent. */
    blockers: string[];
  };
}

export interface EbayImportResult {
  catalogId: string;
  items: number;
  skipped: { sku: string; why: string }[];
  path: string;
}

/** One catalog lot, priced against what eBay says it is worth. */
export interface MarketRow {
  sku: string;
  title: string;
  priceCents: number;
  qty: number;
  /** The item's page on eBay, when the catalog came from there. */
  url?: string | null;
  market: {
    basis: "sold" | "asking" | "none";
    medianCents: number;
    lowCents: number;
    highCents: number;
    /** One comparable is not a market. Shown, so a delta can be judged. */
    samples: number;
    /** What actually matched. A broad query explains a wild delta. */
    query: string;
    checkedAt: string;
  } | null;
  checking: boolean;
  deltaPct: number | null;
}

export interface CatalogMarket {
  catalogId: string;
  rows: MarketRow[];
  pending: number;
  /** The index is off: nothing more will be matched until this is fixed. */
  error: string | null;
  /** A capability the index is working without — sold comps, in production
   *  until eBay grants Marketplace Insights. Rows still match on asking. */
  note?: string | null;
}

/** A live eBay listing or completed sale, as returned by a direct search. */
export interface EbayResult {
  itemId: string;
  title: string;
  priceCents: number;
  condition: string | null;
  categoryName?: string | null;
  soldAt?: string;
  itemWebUrl: string | null;
}

export interface AspectGap {
  categoryId: string;
  categoryName: string;
  /** Which item resolved the category, and on what query. */
  sampledFrom: string;
  required: string[];
  /** Required aspects NO item can supply — a hole in the catalog's shape. */
  missing: string[];
  /** Items missing at least one, worst first. These are edits, not a rethink. */
  worst: { sku: string; missing: string[] }[];
}

export interface CatalogReadiness {
  catalogId: string;
  agentId: string | null;
  ok: boolean;
  checks: ReadinessCheck[];
  aspects?: AspectGap | null;
  /** The gaps the last show on this catalog left — the last moment to close them. */
  carried?: {
    fromShowId: string;
    title: string;
    endedAt: string;
    gaps: { question: string; asked: number; reason: string }[];
  } | null;
}

export interface CatalogFit {
  verdict: "match" | "weak" | "mismatch" | "unknown";
  overlap: number;
  sampled: number;
  catalogId: string | null;
}

/** A seller you follow, plus what the last grid read could see of them. */
export interface FollowedSeller {
  handle: string;
  note: string | null;
  addedAt: string;
  /** When the live grid last answered at all. Null means it never has. */
  lastCheckedAt: string | null;
  lastSeenLiveAt: string | null;
  live: { eventId: string; title: string; url: string; viewers: number | null } | null;
}

export interface FollowingResponse {
  sellers: FollowedSeller[];
  checkedAt: string | null;
  /** A grid read is running right now. Distinct from "we have never looked". */
  checking: boolean;
}

export interface DiscoveredShow {
  eventId: string;
  title: string;
  url: string;
  /** The seller's display name on the card. */
  host?: string;
  /** The handle in the card's seller link — what a catalog is built from. */
  sellerHandle?: string | null;
  viewers?: number | null;
  thumbnailUrl?: string | null;
  /** eBay's own tags for the show: "$1 Starts", "Pokémon", "Vintage". */
  tags?: string[];
  status?: "live" | "scheduled";
  /** eBay's wording — "Today, 4pm". Relative to the viewer's clock. */
  startsAt?: string | null;
  startedAt?: string | null;
}

/** Why a discovery list is empty. "Sign in" is an action; "nothing on air" is
 *  a fact, and rendering them the same way is how Discover lied for weeks. */
export type DiscoveryReason =
  "ok" | "pending" | "no-session" | "stale-session" | "signed-out" | "blocked" | "stale";

export interface EbayLiveSession {
  present: boolean;
  savedAt: string | null;
  ageHours: number | null;
  stale: boolean;
  path: string;
}

/** An eBay Live event we have built a catalog and an agent for, in advance. */
export interface PreparedShow {
  eventId: string;
  title: string;
  host: string;
  sellerHandle: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  catalogId: string | null;
  agentId: string | null;
  items: number;
  /** What could not be done, kept rather than logged. */
  warnings: string[];
  preparedAt: string;
}

export interface HomeView {
  live: DiscoveredShow[];
  discovery: {
    reason: DiscoveryReason;
    session: EbayLiveSession;
    /** When the live grid was last actually read. Null until a read succeeds. */
    checkedAt?: string | null;
  };
  prepared: PreparedShow[];
  preparing: string[];
  watching: ShowSummary[];

  /**
   * The surface-aware half, added when home stopped being one eBay show.
   *
   * Every key below is OPTIONAL and every one of them is derivable from the
   * keys above plus reads this client already makes — which is the whole
   * point. A tab open on an older server, or a deploy where the frontend
   * lands first, gets the same four bands built out of the legacy payload
   * rather than an empty screen. See `src/lib/home.ts`.
   */
  now?: HomeNow;
  next?: HomeNext;
  behind?: HomeBehind;
  surfaces?: HomeSurfaceRow[];
}

/** A session on air, on any surface. `showId` because the API kept the word. */
export interface HomeLiveSession {
  showId: string;
  surface: SurfaceId;
  title: string;
  host: string;
  startedAt: string;
  awaiting: number;
  blocked: number;
  readOnly: boolean;
}

export interface HomeDraftCount {
  total: number;
  bySurface: { surface: SurfaceId; count: number }[];
}

export interface HomeNow {
  live: HomeLiveSession[];
  drafts: HomeDraftCount;
}

export interface HomeNext {
  prepared: PreparedShow[];
  /** Surfaces with a live grid we can read. Today: eBay Live, and only it. */
  discoverable: SurfaceId[];
}

/** One finished session, with the one number that matters and the top gap. */
export interface HomeReport {
  showId: string;
  surface: SurfaceId;
  title: string;
  /**
   * The report's own end time where there is a report. Where there is not it
   * is APPROXIMATE — the last message the session recorded, else when it
   * started — and `hasReport: false` is what says so.
   */
  endedAt: string;
  /** Null, never zero, on a session whose report never generated: "answered 0"
   *  is a measurement, and nobody made it. */
  answered: number | null;
  blocked: number | null;
  /** The highest-count unanswered question the stored report already holds. */
  topGap: string | null;
  /**
   * False for a session that ended without its report generating.
   *
   * Absent means true: everything in `behind.reports` is a report by
   * definition. The derived path sets it, because a session whose report
   * failed is the one an operator most wants to look at and the old sessions
   * list said so — dropping those rows would quietly lose that.
   */
  hasReport?: boolean;
}

export interface HomeBehind {
  reports: HomeReport[];
  followups: { total: number; ready: number };
}

/** One step of a surface's Before, with the place that finishes it. */
export interface HomeSurfaceStep {
  label: string;
  done: boolean;
  /** An in-app destination. Absent when there is nothing to press. */
  href?: string;
  /** Search params for `href`, when it needs them. */
  search?: Record<string, string>;
  cta?: string;
}

/**
 * One row of the surface table — the phase story for a single surface.
 *
 * `connected` is "has whatever this surface needs to run at all"; `missing`
 * names the environment variable or the consent that is not there, using the
 * same string `SurfaceUnavailable` sends, so the operator reads one wording in
 * both places.
 */
export interface HomeSurfaceRow {
  id: SurfaceId;
  label: string;
  attachable: boolean;
  tempo: Tempo;
  delivery: "api" | "draft-only";
  connected: boolean;
  missing: string | null;
  before: HomeSurfaceStep[];
  during: string;
  after: string;
  /** Async and room-based surfaces: how many rooms are watched. */
  rooms?: number;
}

/** GET /api/cost — the history the live rail cannot have, because the meter
 *  and the spend window both live in process memory. */
export interface CostSnapshot {
  days: number;
  shows: {
    showId: string;
    title: string;
    openedAt: string;
    closedAt: string;
    durationMin: number;
    calls: number;
    failures: number;
    contextChars: number;
    byDoor: Record<string, { calls: number; failures: number; totalMs: number }>;
    /** Null when the wallet could not be read. Null is "unknown", and must
     *  never render as zero. Secondary now: see `estimatedUsd`. */
    walletDeltaUsd: number | null;
    /** This show's cost to this account. `basis` says how it was priced. */
    estimatedUsd: number | null;
    /** wallet-exclusive: the workspace wallet moved while this show ran alone,
     *  so the delta is this show's real spend. metered: calls × the measured
     *  average cost per call from shows that ran alone. none: nothing to price. */
    basis: "wallet-exclusive" | "metered" | "none";
    answered: number;
  }[];
  totals: {
    shows: number;
    calls: number;
    contextChars: number;
    spentUsd: number;
    /** Sum of the rows' `estimatedUsd`. */
    estimatedUsd: number;
    /** How many rows were priced by the metered estimate. */
    metered: number;
    answered: number;
    minutes: number;
    perAnsweredUsd: number | null;
    perHourUsd: number | null;
    showsWithoutWallet: number;
  };
  byDoor: Record<string, { calls: number; failures: number; totalMs: number }>;
  /** Whose costs these are. The page is per account; the key behind it is shared. */
  scope: { accountId: string; handle: string };
  live: Record<string, { calls: number; failures: number; contextChars: number }>;
  attribution: { perShow: string; note: string };
}

/** What the copilot would say, with the same six guards and nothing sent. */
export interface DryRunResult {
  question: string;
  answer: string;
  evidence: Evidence[];
  guards: GuardResult[];
  verdict: Verdict;
  confidence: number;
  abstained: boolean;
  latencyMs: number;
}

// ── the thread, the drafts, the persona and the rooms ───────────────────────
//
// Everything below belongs to surfaces where a conversation is not a live show.
// It is additive: a live-commerce console never asks for any of it, and every
// screen that does degrades to an empty state rather than to a crash when the
// backend has not shipped the endpoint yet.

/**
 * The branch a reply is being written into.
 *
 * `ShowContextEngine` answers "what is happening right now", which is exactly
 * right for a live show and empty for a three-day-old subreddit thread. Here
 * the context is the opening post and the path down to the comment being
 * answered — plus the rules in force, which are a CONSTRAINT on the reply and
 * never a fact to answer from.
 */
export interface ThreadContext {
  threadId: string;
  /** The opening post, then the branch above the message, oldest first. */
  ancestors: { author: string; text: string; at: string }[];
  /** The room: a subreddit, a channel, a conversation. */
  room: string;
  /** Rules in force here, as facts (`corpus: "community"`). */
  rules: Evidence[];
  /** What the room is asking for, summarised. Null when it was not asked. */
  summary: string | null;
}

/** One community rule, and what it did to this draft. */
/**
 * One rule of the room, and what it did to this draft.
 *
 * Two effects, not three. `would_block` — "the rule an earlier draft tripped
 * and this one clears" — cannot happen in this system: the guard chain never
 * returns a revise verdict, so the pipeline's single repair pass is
 * unreachable, so there is never an earlier draft for a rule to have tripped.
 * A field the UI reads and the server can never set is a promise the UI is
 * making on our behalf, and this one had a paragraph of copy behind it.
 */
export interface AppliedRule {
  factId: string;
  label: string;
  text: string;
  effect: "applied" | "blocked";
  /** The guard's own words, on the rule that held it. Null on the others. */
  reason?: string | null;
}

/**
 * A reply we wrote and will not send.
 *
 * On a `draft-only` surface the human IS the sender — that is the whole point
 * of the destination — so a draft carries everything the person needs to decide
 * with: the thread above it, what it is standing on, and which rule of the room
 * would have stopped it.
 */
/**
 * What the operator calls the place a draft came from.
 *
 * The two kinds are genuinely different things and the queue does not pretend
 * otherwise: a Reddit draft comes out of a ROOM still being watched, a
 * follow-up out of a SESSION that ended hours ago. `label` is what a person
 * would say out loud — `r/mechmarket`, or the session's title. `id` is the
 * machine's name for the same thing, kept beside it rather than instead of it,
 * which is what went wrong before: the inbox printed `ebay_47tK1SX0VsiHEXN1`
 * where Reddit printed `r/mechmarket`, and that was our hard-coding, not the
 * server's.
 */
export interface DraftOrigin {
  kind: "room" | "session";
  id: string;
  label: string;
}

/** Where a draft is in the operator's hands. `open` is the only one that
 *  counts as waiting. `blocked` is carried rather than hidden — a guard held
 *  it, and an operator who cannot see that concludes it simply did not
 *  answer. */
export type DraftStatus = "open" | "sent" | "dismissed" | "blocked";

export interface SurfaceDraft {
  id: string;
  surface: SurfaceId;
  origin: DraftOrigin;
  /** `origin.label`, flat, because that is what the card prints. */
  room: string;
  /** The session this draft belongs to: a live watch, or the session a
   *  follow-up came out of. Present on both, so a client never guesses. */
  sessionId?: string;
  /** The comment or post being answered. */
  question: { author: string; text: string; at: string; url?: string | null };
  draft: string;
  createdAt: string;
  /**
   * Everything below is optional on purpose.
   *
   * The follow-up inbox stores a draft the guards ALREADY cleared and keeps no
   * evidence row for it, because a blocked follow-up is never written at all;
   * a Reddit draft carries its thread, its citations and the rules of the room.
   * One card renders both, and a field that is not there is not drawn — not
   * drawn as a zero, which is what "confidence 0.00" would have been.
   */
  thread?: ThreadContext | null;
  evidence?: Evidence[];
  guards?: GuardResult[];
  verdict?: Verdict;
  confidence?: number;
  rules?: AppliedRule[];
  styleRef?: StyleRef | null;
  /** Set by the operator when they have pasted it in themselves. */
  sentAt?: string | null;
  status?: DraftStatus;
}

/**
 * `GET /api/drafts`.
 *
 * `waiting` is the WHOLE account's waiting queue whatever `?surface=` and
 * `?status=` say — it is the number home prints, built by the same function
 * on the server, so the count under the heading and the count on home are the
 * same number by construction rather than by arithmetic that agrees today.
 * The filters shape `drafts` only.
 */
export interface DraftsQueue {
  surface: SurfaceId | null;
  status: DraftStatus | null;
  waiting: HomeDraftCount;
  drafts: SurfaceDraft[];
}

// ── persona ─────────────────────────────────────────────────────────────────

/**
 * One past answer, cited for its MANNER.
 *
 * `label` is the server's own phrasing of when it was written — "Your own words
 * · March 2026" — and it is what the console renders beside the draft. It is
 * never grounding: no claim in a reply stands on it, and it is deliberately
 * kept out of the fact list the model cites from.
 */
export interface StyleRef {
  factId: string;
  text: string;
  label?: string;
  /** Older payloads carried the timestamp rather than a phrase. */
  at?: string | null;
}

export interface PersonaBoundaries {
  never_claim: string[];
  never_discuss: string[];
  must_disclose: string[];
}

export interface PersonaRegister {
  length: "short" | "medium";
  /** 1 is a chat message, 5 is a support ticket. */
  formality: number;
  emoji: boolean;
  notes: string;
}

/** One of the operator's own past sends, learned into the voice corpus. */
export interface VoiceCorpusDoc {
  factId: string;
  /** What they were asked. The corpus is indexed on this as well as the answer:
   *  a past reply about shipping resembles a shipping question through the
   *  question it answered, often sharing no vocabulary with it at all. */
  question: string;
  text: string;
  /** Learned from a send we watched, or pasted in by the operator. */
  origin: "sent" | "pasted" | string;
  showId: string | null;
  showTitle: string | null;
  at: string | null;
}

export interface Persona {
  id?: string;
  name: string;
  about: string;
  voice: string;
  boundaries: PersonaBoundaries;
  /** What we must say about who is talking, when we post. */
  disclosure: string | null;
  /** How to sound, per surface. A surface with no entry uses the voice above. */
  registers: Partial<Record<SurfaceId, PersonaRegister>>;
  /** Reserved server-side. Empty means the whole voice corpus. */
  corpusDocIds?: string[];
  updatedAt?: string | null;
}

/**
 * What `GET /api/persona` answers.
 *
 * The corpus is NOT a field on the persona: it is learned rather than edited,
 * it is large, and a form that could PUT it back would let this page overwrite
 * an index it never read. Kept beside the persona for exactly that reason.
 */
export interface PersonaView {
  persona: Persona | null;
  voice: { total: number; docs: VoiceCorpusDoc[] };
}

/** What `POST /api/persona/learn` answers, alongside the view. */
export interface LearnReport {
  /** How many the corpus holds afterwards. */
  total: number;
  /** How many this call wrote. Re-learning the same history writes the same
   *  rows, so a second press reports the same number, not double. */
  indexed: number;
  /** Which shows the operator's own words came out of. */
  shows: { showId: string; title: string; count: number }[];
  pasted: number;
}

// ── rooms ───────────────────────────────────────────────────────────────────

/** A subreddit, a channel, a conversation — and whether we may speak in it. */
export interface SurfaceRoom {
  surface: SurfaceId;
  room: string;
  /** A HUMAN turned this on. Default false, everywhere, always. */
  posting: boolean;
  /**
   * Whether the standing watch on this room is actually running.
   *
   * Optional, and ABSENT READS AS WATCHED: a room in this list is the watch,
   * and a server from before the column existed says nothing about it. Only an
   * explicit `false` means the room is recorded but not being read.
   */
  watching?: boolean;
  /** What we must say about who is talking, when we post here. */
  disclosure: string | null;
  addedAt: string;
}

// ── discover ────────────────────────────────────────────────────────────────
//
// Discovery used to mean one thing: scrape the eBay Live grid and draw it. That
// was one surface out of six, and a grid of what is on air is a phone book —
// what an operator needs is what is live THAT HAS ANYTHING TO DO WITH WHAT THEY
// SELL, which we already hold in Knowledge.
//
// So discovery is one question asked of every surface, and the answer carries
// its own reason for being on screen. `why` is never a score: it is the terms
// that matched and where they matched, which is the only form of relevance an
// operator can check.

/** Where an interest term was found in a hit. Title beats body. */
export type WhyWhere = "title" | "category" | "host" | "room" | "body";

/** What the operator can do with a hit, given the surface it is on. */
export type DiscoverAction = "prepare" | "attach" | "watch-room" | "open";

export interface DiscoverWhy {
  term: string;
  where: WhyWhere;
}

export interface DiscoverHit {
  surface: SurfaceId;
  /** Stable per surface, and the attach target. */
  id: string;
  title: string;
  /** Null is the honest answer where the source does not give one, and the UI
   *  draws nothing rather than a dash — a dash reads as a host called "—". */
  host: string | null;
  url: string;
  startedAt: string | null;
  liveNow: boolean;
  /** Null, never zero. Zero viewers is a measurement; a source that does not
   *  publish viewer counts has not made one. */
  viewers: number | null;
  why: DiscoverWhy[];
  action: DiscoverAction;
  /**
   * The legacy eBay row this hit was built from, when Discover is running on
   * the fallback path. Client-side only — the server never sends it — and it
   * exists so preparing a show off the old payload still carries the seller
   * handle and tags that build its catalog.
   */
  legacy?: DiscoveredShow;
}

export interface DiscoverSourceResult {
  surface: SurfaceId;
  /** One plain sentence: how this list was obtained. An operator should never
   *  have to guess whether they are looking at an API or a scrape. */
  method: string;
  hits: DiscoverHit[];
  /** Present when this surface could not answer. Its hits are then empty and
   *  the source is still listed — a missing tab reads as a broken product
   *  rather than a door the platform never opened. */
  unavailable: { reason: string; missing: string | null } | null;
}

/**
 * A term the operator sells around.
 *
 * Derived from their catalogs, then owned: what they sell next month is not in
 * last month's catalog, and a derived term they delete stays deleted.
 *
 * There is no catalog on this object and there cannot be one. Interests are
 * derived from ALL of an account's catalogs at once and belong to none of
 * them, so a chip that named one would be naming a source it does not have.
 */
export interface DiscoverInterest {
  /** The match identity, and the stable key. */
  slug: string;
  /** The display form, with the operator's or the catalog's own spelling and
   *  accents intact. Never the thing to compare on. */
  term: string;
  origin: "derived" | "own";
  pinned: boolean;
  /** How many of the account's listings carry the term — the whole of a
   *  derived chip's provenance. `0` for a term the operator typed. */
  weight: number;
}

/** `GET` and `PUT /api/discover/interests` — the set, and why it is that size. */
export interface DiscoverInterests {
  interests: DiscoverInterest[];
  /**
   * How many catalogs the account has.
   *
   * The empty state branches on this and not on the interests alone: no
   * catalogs is "we do not know what you sell", which is a door to Knowledge,
   * and catalogs with no terms is "you removed them all", which is not.
   */
  catalogs: number;
}

/** `GET /api/discover` — the interests it asked with, and one result per source. */
export interface DiscoverView {
  interests: DiscoverInterest[];
  /** Null when this answer did not carry the count; the interests endpoint
   *  always does. */
  catalogs: number | null;
  sources: DiscoverSourceResult[];
}
