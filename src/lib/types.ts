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

export type GuardName = "price" | "availability" | "policy" | "claim_grounding" | "tone" | "pii";
export type Verdict = "allow" | "revise" | "block";

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
  /** Where buyer chat comes from. */
  source?: "simulated" | "ebaylive";
  /** The eBay Live event id, when source is "ebaylive". */
  externalId?: string | null;
  /** A monitored stream we do not own: every write action is refused. */
  readOnly?: boolean;
  status?: "live" | "ended";
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
  source: "simulated" | "ebaylive";
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

export interface Evidence {
  factId: string;
  source: "listing" | "policy" | "catalog" | "qa" | "market" | "host";
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
  sentText?: string;
}

export type ActionKind =
  "push_listing" | "swap_pinned" | "markdown_price" | "adjust_stock" | "end_listing";

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
