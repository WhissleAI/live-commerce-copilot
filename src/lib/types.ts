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
}

/** A show this backend is watching. */
export interface ShowSummary {
  showId: string;
  title: string;
  sellerHandle: string;
  source: "simulated" | "ebaylive";
  externalId: string | null;
  readOnly: boolean;
  status: "live" | "ended";
  viewers: number;
  listings: number;
  proposals: number;
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
export interface TranscriptSegment {
  showId?: string;
  text: string;
  emotion: SignalDistribution | null;
  intent: SignalDistribution | null;
  speechRate: number | null;
  at: string;
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
  source: "listing" | "policy" | "catalog" | "qa" | "market";
  label: string;
  text: string;
  score: number;
  listingVersion?: number;
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
  updatedAt: string;
}

export interface Comp {
  title: string;
  soldPriceCents: number;
  soldAt: string;
  condition: string;
  size: string;
}

export interface ResearchCard {
  query: string;
  listingId: string | null;
  headline: string;
  comps: Comp[];
  medianCents: number;
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
  | { type: "chat"; data: ChatMessage }
  | { type: "proposal"; data: ReplyProposal }
  | { type: "action"; data: ActionProposal }
  | { type: "listing"; data: Listing }
  | { type: "audit"; data: AuditEntry }
  | { type: "metrics"; data: Metrics }
  | { type: "context"; data: ShowContext };

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

export type GatewayDoor = "chat_turn" | "utility_turn" | "voice_start" | "kb_upload" | "billing";

export interface BillingSnapshot {
  wallet: Wallet | null;
  /** Why a read failed. A missing scope and a zero balance are different facts. */
  walletError: { status: number; message: string } | null;
  usage: { days: number; totals: UsageTotal[]; daily: { day: string; service: string; quantity: number }[] } | null;
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

/** Who the console is acting as. A guest watches; a seller acts. */
export interface Account {
  id: string;
  kind: "guest" | "seller";
  handle: string;
  displayName: string;
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
