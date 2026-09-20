/**
 * Mock live-show driver. Simulates the SSE stream + REST surface so the console
 * runs standalone with VITE_USE_MOCKS === "true".
 */
import type {
  ActionProposal,
  AuditEntry,
  AutonomyLevel,
  ChatIntent,
  ChatMessage,
  Evidence,
  GuardName,
  GuardResult,
  HelloPayload,
  Listing,
  Metrics,
  ReplyProposal,
  ResearchCard,
  ShowContext,
  ShowState,
  StreamEvent,
  Verdict,
} from "./types";
import { formatMoney } from "./format";

let n = 1;
const uid = (p: string) => `${p}_${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nowIso = () => new Date().toISOString();
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;
const rnd = (min: number, max: number) => min + Math.random() * (max - min);

function hash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < input.length; i++) {
    h1 = (h1 ^ input.charCodeAt(i)) * 16777619;
    h2 = (h2 + input.charCodeAt(i) * (i + 7)) * 2654435761;
    h1 >>>= 0;
    h2 >>>= 0;
  }
  return (
    h1.toString(16).padStart(8, "0") +
    h2.toString(16).padStart(8, "0") +
    ((h1 ^ h2) >>> 0).toString(16).padStart(8, "0")
  );
}

const IMG = (seed: string) => `https://picsum.photos/seed/${seed}/240/240`;

function makeListings(): Listing[] {
  const base = {
    state: "live" as const,
    shippingProfile: "US · 2-day · $12",
    updatedAt: nowIso(),
  };
  return [
    {
      ...base,
      id: "lst_aj1chi",
      sku: "DZ5485-612",
      title: 'Air Jordan 1 Retro High OG "Chicago Reimagined"',
      brand: "Jordan",
      model: "Air Jordan 1 Retro High OG",
      colorway: "Varsity Red / Black / Sail",
      size: "10",
      condition: "DS",
      priceCents: 41200,
      floorPriceCents: 35500,
      costCents: 30500,
      qty: 1,
      soldThisShow: 2,
      views: 1840,
      pinned: true,
      version: 12,
      imageUrl: IMG("aj1chicago"),
      authenticated: true,
      certId: "CERT-88213",
    },
    {
      ...base,
      id: "lst_nb990",
      sku: "M990GL6",
      title: "New Balance 990v6 Grey",
      brand: "New Balance",
      model: "990v6",
      colorway: "Grey / Silver",
      size: "9.5",
      condition: "VNDS",
      priceCents: 21800,
      floorPriceCents: 19000,
      costCents: 15500,
      qty: 1,
      soldThisShow: 0,
      views: 612,
      pinned: false,
      version: 4,
      imageUrl: IMG("nb990v6"),
      authenticated: false,
      certId: null,
    },
    {
      ...base,
      id: "lst_supbox",
      sku: "SUP-FW22-BL",
      title: "Supreme Box Logo Hoodie FW22 Black",
      brand: "Supreme",
      model: "Box Logo Hoodie",
      colorway: "Black",
      size: "L",
      condition: "DS",
      priceCents: 56500,
      floorPriceCents: 49000,
      costCents: 42000,
      qty: 1,
      soldThisShow: 0,
      views: 431,
      pinned: false,
      version: 2,
      imageUrl: IMG("supremebox"),
      authenticated: true,
      certId: "CERT-77120",
    },
    {
      ...base,
      id: "lst_panda",
      sku: "DD1391-100",
      title: "Nike Dunk Low Panda",
      brand: "Nike",
      model: "Dunk Low",
      colorway: "White / Black",
      size: "11",
      condition: "DS",
      priceCents: 12800,
      floorPriceCents: 11000,
      costCents: 9500,
      qty: 3,
      soldThisShow: 1,
      views: 990,
      pinned: false,
      version: 6,
      imageUrl: IMG("dunkpanda"),
      authenticated: true,
      certId: "CERT-55901",
    },
    {
      ...base,
      id: "lst_yzslide",
      sku: "FZ5897",
      title: "Yeezy Slide Bone",
      brand: "adidas",
      model: "Yeezy Slide",
      colorway: "Bone",
      size: "10",
      condition: "DS",
      priceCents: 9200,
      floorPriceCents: 8000,
      costCents: 6500,
      qty: 2,
      soldThisShow: 0,
      views: 288,
      pinned: false,
      version: 3,
      imageUrl: IMG("yeezyslide"),
      authenticated: false,
      certId: null,
    },
  ];
}

const AUTHORS = [
  "sneakerhead_92",
  "grailhunter",
  "rae_fan_01",
  "dunkdaddy",
  "sizeten_only",
  "hypeless",
  "kicksinYYZ",
  "boxlogo_bri",
  "resell_ray",
  "midnightmarv",
];

const SCRIPT: { text: string; intent: ChatIntent }[] = [
  { text: "what's the lowest on the chicagos", intent: "discount_request" },
  { text: "does it come with the box?", intent: "other" },
  { text: "ship to canada?", intent: "shipping" },
  { text: "is that the reimagined or the 2015", intent: "comparison" },
  { text: "size 10 still there??", intent: "availability" },
  { text: "how much for the panda", intent: "price_question" },
  { text: "return policy?", intent: "returns" },
  { text: "are these authenticated", intent: "authenticity" },
  { text: "can you do 380", intent: "discount_request" },
  { text: "do the 990s run big or tts", intent: "sizing" },
  { text: "whats the price on the box logo", intent: "price_question" },
  { text: "any 11s in the chicago", intent: "availability" },
  { text: "how long does shipping take", intent: "shipping" },
  { text: "slides still available?", intent: "availability" },
  { text: "any flaws on the 990s", intent: "other" },
];

const HYPE = ["W", "LETS GOOO", "🔥🔥", "first", "rae the goat", "W W W", "cop"];

const REPLIES: Partial<Record<ChatIntent, string[]>> = {
  discount_request: [
    "I can go to {price} on the Chicagos tonight — that's my floor with authentication included.",
    "Best I can do on this pair is {price}, shipped from the US in 2 days.",
  ],
  price_question: [
    "That one is {price} right now, ships in 2 days with tracking.",
    "Priced at {price} — deadstock with the original box.",
  ],
  availability: [
    "Size {size} is still available — {qty} left in this lot.",
    "Yes, {qty} left in size {size}. It's the pinned lot right now.",
  ],
  shipping: [
    "I ship US 2-day for $12; Canada is 5-7 business days with tracking.",
    "Ships next business day, $12 flat in the US.",
  ],
  returns: [
    "Returns accepted within 3 days of delivery if the pair is unworn and tagged.",
    "3-day return window on unworn pairs — just message me first.",
  ],
  sizing: [
    "The 990v6 fits true to size; if you're between sizes go down a half.",
    "True to size on these — I'd stay with your normal Nike size.",
  ],
  authenticity: [
    "Every pair is third-party authenticated — this one is cert {cert}.",
    "Authenticated with cert {cert}, tag stays on until you receive it.",
  ],
  comparison: [
    'This is the 2022 "Reimagined" release, not the 2015 — you can tell from the sail midsole.',
    "It's the Reimagined pair, off-white sail tooling rather than the 2015 bright white.",
  ],
  other: [
    "Yes, original box included and it ships double-boxed.",
    "No flaws worth calling out — I'll show the soles on camera now.",
  ],
};

function evidenceFor(l: Listing, intent: ChatIntent): Evidence[] {
  const ev: Evidence[] = [
    {
      factId: `fact_price_${l.id}_v${l.version}`,
      source: "listing",
      label: "Listing · price",
      text: `${l.title} is listed at ${formatMoney(l.priceCents)} (floor ${formatMoney(l.floorPriceCents)}), listing version ${l.version}.`,
      score: 0.97,
      listingVersion: l.version,
    },
    {
      factId: `fact_stock_${l.id}`,
      source: "listing",
      label: "Listing · stock",
      text: `Size ${l.size} ${l.condition}, ${l.qty} available, ${l.soldThisShow} sold this show.`,
      score: 0.93,
      listingVersion: l.version,
    },
  ];
  if (intent === "returns" || intent === "shipping")
    ev.push({
      factId: "fact_policy_returns",
      source: "policy",
      label: "Policy · returns",
      text: "Seller policy: 3-day returns on unworn items; shipping US 2-day $12, Canada 5-7 days.",
      score: 0.91,
    });
  if (intent === "authenticity")
    ev.push({
      factId: `fact_cert_${l.id}`,
      source: "qa",
      label: "QA · authentication",
      text: `Authentication record ${l.certId ?? "none on file"} for SKU ${l.sku}.`,
      score: 0.88,
    });
  if (intent === "discount_request" || intent === "price_question")
    ev.push({
      factId: "fact_market_comps",
      source: "market",
      label: "Market · comps",
      text: `Median of 12 comparable sales in the last 14 days: ${formatMoney(36800)}.`,
      score: 0.82,
    });
  if (intent === "comparison")
    ev.push({
      factId: `fact_catalog_${l.sku}`,
      source: "catalog",
      label: "Catalog · spec",
      text: `SKU ${l.sku} — ${l.model}, ${l.colorway}, 2022 release.`,
      score: 0.86,
    });
  return ev;
}

function guards(overrides: Partial<Record<GuardName, GuardResult>> = {}): GuardResult[] {
  const all: GuardName[] = ["price", "availability", "policy", "claim_grounding", "tone", "pii"];
  return all.map(
    (g) =>
      overrides[g] ?? {
        guard: g,
        verdict: "allow",
        reason: `${g} check passed against the live listing snapshot.`,
      },
  );
}

function spans(total: number, over = false, cacheHit = false) {
  const admitMs = Math.round(total * 0.04);
  const classifyMs = Math.round(total * 0.12);
  const retrieveMs = Math.round(total * 0.22);
  const composeMs = Math.round(total * 0.42);
  const guardMs = Math.round(total * 0.16);
  return {
    admitMs,
    classifyMs,
    retrieveMs,
    composeMs,
    guardMs,
    repairMs: 0,
    totalMs: Math.round(total),
    cacheHit,
    budgetMs: 2000,
    overBudget: over || total > 2000,
  };
}

export class MockDriver {
  private listeners = new Set<(e: StreamEvent) => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private started = false;

  show: ShowState;
  listings: Listing[] = makeListings();
  proposals: ReplyProposal[] = [];
  actions: ActionProposal[] = [];
  audit: AuditEntry[] = [];
  metrics: Metrics;
  context: ShowContext;

  constructor() {
    this.show = {
      id: "show_42",
      title: "Friday Night Grails — Ep. 42",
      sellerHandle: "@kicksbyrae",
      startedAt: new Date(Date.now() - 4364_000).toISOString(),
      viewers: 247,
      pinnedListingId: "lst_aj1chi",
      lotQueue: ["lst_nb990", "lst_supbox", "lst_panda", "lst_yzslide"],
      autonomyLevel: "L2_ONE_TAP",
      undoWindowS: 90,
    };
    this.metrics = {
      proposals: 38,
      sent: 26,
      autoSent: 4,
      dismissed: 5,
      blocked: 3,
      guardBlocks: {
        price: 2,
        availability: 0,
        policy: 1,
        claim_grounding: 0,
        tone: 0,
        pii: 0,
        // The scripted show is live commerce, where neither of these runs.
        community_rule: 0,
        sponsor: 0,
      },
      latency: { p50: 520, p95: 840, p99: 1610, budgetMs: 2000, breaches: 2 },
      cacheHitRate: 0.41,
      answeredRate: 0.78,
      actionsCommitted: 5,
      actionsRolledBack: 1,
    };
    this.context = {
      currentTopic: "Chicago Reimagined pricing",
      listingInFocus: "lst_aj1chi",
      voice: {
        topLabel: "EMOTION_HAPPY",
        topP: 0.61,
        topK: [
          { label: "EMOTION_HAPPY", p: 0.61 },
          { label: "EMOTION_NEUTRAL", p: 0.29 },
        ],
        changed: false,
        prevLabel: null,
        heldMs: 4200,
        flips: 2,
        trusted: true,
      },
      onScreen: {
        text: "a red and white high-top sneaker held to camera",
        at: new Date().toISOString(),
      },
      recentPoints: [
        "Showed the sail midsole on camera",
        "Confirmed 3-day return window",
        "Teased the Supreme box logo next",
      ],
      tone: "warm, fast, no hard sell",
      updatedAt: nowIso(),
    };
    this.seed();
  }

  /* ---------------- subscription ---------------- */

  subscribe(cb: (e: StreamEvent) => void): () => void {
    this.listeners.add(cb);
    cb({ type: "hello", data: this.hello() });
    if (!this.started) {
      this.started = true;
      this.loop();
    }
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(e: StreamEvent) {
    this.listeners.forEach((l) => l(e));
  }

  private after(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  hello(): HelloPayload {
    return {
      show: this.show,
      listings: this.listings,
      proposals: this.proposals,
      actions: this.actions,
      audit: this.audit,
      metrics: this.metrics,
      context: this.context,
    };
  }

  /* ---------------- audit chain ---------------- */

  private pushAudit(
    kind: AuditEntry["kind"],
    actorType: AuditEntry["actorType"],
    summary: string,
    detail: Record<string, unknown> = {},
    emit = true,
  ) {
    const prev = this.audit[this.audit.length - 1];
    const seq = (prev?.seq ?? 0) + 1;
    const prevHash = prev?.hash ?? "0".repeat(24);
    const at = nowIso();
    const entry: AuditEntry = {
      seq,
      at,
      hash: hash(`${seq}|${prevHash}|${kind}|${summary}|${at}`),
      prevHash,
      kind,
      actorType,
      summary,
      detail,
    };
    this.audit.push(entry);
    if (emit) this.emit({ type: "audit", data: entry });
    return entry;
  }

  /* ---------------- seeding ---------------- */

  private seed() {
    const aj1 = this.listings[0]!;
    const panda = this.listings[3]!;

    const mk = (
      author: string,
      text: string,
      intent: ChatIntent,
      p: Partial<ReplyProposal>,
    ): ReplyProposal => {
      const at = new Date(Date.now() - Math.round(rnd(20_000, 200_000))).toISOString();
      const id = uid("prp");
      return {
        id,
        message: { id: uid("msg"), author, text, at, intent, admitted: true, proposalId: id },
        status: "ready",
        draft: "",
        claims: [],
        evidence: [],
        guards: guards(),
        verdict: "allow",
        confidence: 0.86,
        repaired: false,
        spans: spans(1240),
        createdAt: at,
        // The scripted show wires no deliverer, which is also true of every
        // real surface in this build — so the server would answer "human" here
        // and the mock must not be the one place the console is told a reply
        // sends itself.
        delivery: "human",
        ...p,
      };
    };

    const ready = mk("sneakerhead_92", "does it come with the box?", "other", {
      draft:
        "Yes — original box included and it ships double-boxed, US 2-day for $12. Deadstock size 10, authenticated cert CERT-88213.",
      evidence: [
        ...evidenceFor(aj1, "other"),
        {
          factId: "fact_policy_ship",
          source: "policy",
          label: "Policy · shipping",
          text: "US 2-day shipping at $12 flat, double-boxed on footwear.",
          score: 0.9,
        },
        {
          factId: "fact_cert_lst_aj1chi",
          source: "qa",
          label: "QA · authentication",
          text: "Authentication record CERT-88213 for SKU DZ5485-612.",
          score: 0.88,
        },
      ],
      confidence: 0.91,
      spans: spans(1240, false, true),
    });

    const needsReview = mk("resell_ray", "can you do 380", "discount_request", {
      status: "needs_review",
      draft:
        "380 is under where I can go tonight — I'm firm at 412, and honestly these are gone by the next show.",
      guards: guards({
        tone: {
          guard: "tone",
          verdict: "revise",
          reason: "Closing line reads as pressure selling; softer phrasing recommended.",
          detail: { expected: "no urgency claims", found: '"gone by the next show"' },
        },
      }),
      verdict: "revise",
      confidence: 0.62,
      evidence: evidenceFor(aj1, "discount_request"),
      spans: spans(1680),
    });

    const blocked = mk("grailhunter", "what's the lowest on the chicagos", "price_question", {
      status: "blocked",
      draft:
        "I can let the Chicagos go for $412 tonight — that's the lowest I can do on this pair.",
      guards: guards({
        price: {
          guard: "price",
          verdict: "block",
          reason:
            "Reply quotes a price from listing version 12; the live listing is version 13 after a markdown.",
          detail: { expected: "$370.00 (v13)", found: "$412.00" },
        },
        claim_grounding: {
          guard: "claim_grounding",
          verdict: "revise",
          reason: "Price claim no longer supported by the current listing snapshot.",
        },
      }),
      verdict: "block",
      confidence: 0.44,
      evidence: evidenceFor(aj1, "price_question"),
      spans: spans(1980),
      claims: [
        { text: "lowest is $412", factId: "fact_price_lst_aj1chi_v12", supported: false },
        { text: "authenticated pair", factId: "fact_cert_lst_aj1chi", supported: true },
      ],
    });

    const sent = mk("dunkdaddy", "how much for the panda", "price_question", {
      status: "sent",
      draft: "The Pandas are $128 in size 11, three pairs left, ships tomorrow.",
      sentText: "The Pandas are $128 in size 11, three pairs left, ships tomorrow.",
      evidence: evidenceFor(panda, "price_question"),
      confidence: 0.94,
      spans: spans(760, false, true),
    });

    this.proposals = [sent, blocked, needsReview, ready];

    this.actions = [
      {
        id: uid("act"),
        kind: "markdown_price",
        listingId: aj1.id,
        listingTitle: aj1.title,
        summary: `Mark down AJ1 Chicago · size 10 — ${formatMoney(41200)} → ${formatMoney(37000)} (−10%)`,
        rationale:
          "4 buyers asked for a discount in the last 3 minutes; median comp is $368 and the lot has been pinned for 9 minutes.",
        params: { priceCents: 37000, percent: -10 },
        before: { priceCents: 41200, version: 12 },
        status: "proposed",
        preflight: {
          ok: true,
          checks: [
            { name: "above floor price", ok: true, detail: "floor $355.00" },
            { name: "within 15% max discount", ok: true, detail: "−10.2% requested" },
            { name: "show action budget", ok: true, detail: "5 of 12 actions used" },
          ],
        },
        idempotencyKey: `idem_${hash("markdown-aj1")}`,
        undoableUntil: null,
        createdAt: new Date(Date.now() - 42_000).toISOString(),
      },
      {
        id: uid("act"),
        kind: "adjust_stock",
        listingId: panda.id,
        listingTitle: panda.title,
        summary: "Fix stock on Nike Dunk Low Panda · size 11 — 2 → 3 available",
        rationale:
          "A cancelled order left the lot understated; two buyers were told it was sold out.",
        params: { qty: 3 },
        before: { qty: 2 },
        status: "committed",
        preflight: {
          ok: true,
          checks: [
            { name: "quantity within receipt count", ok: true, detail: "3 units scanned in" },
            { name: "no open orders affected", ok: true, detail: "0 pending orders" },
          ],
        },
        idempotencyKey: `idem_${hash("stock-panda")}`,
        undoableUntil: new Date(Date.now() + 74_000).toISOString(),
        createdAt: new Date(Date.now() - 96_000).toISOString(),
      },
    ];

    // Seed audit chain (no emit — part of hello).
    this.pushAudit(
      "autonomy_changed",
      "seller",
      "Autonomy set to L2 One-tap",
      { level: "L2_ONE_TAP" },
      false,
    );
    this.pushAudit(
      "reply_sent",
      "seller",
      `Reply sent to @dunkdaddy — price on ${panda.title}`,
      { proposalId: sent.id },
      false,
    );
    this.pushAudit(
      "reply_blocked",
      "system",
      "Reply blocked by price guard — stale listing version 12",
      { guard: "price", expected: "$370.00 (v13)" },
      false,
    );
    this.pushAudit(
      "action_proposed",
      "copilot",
      "Proposed stock fix on Nike Dunk Low Panda",
      { kind: "adjust_stock" },
      false,
    );
    this.pushAudit(
      "action_committed",
      "seller",
      "Committed stock fix — Panda size 11 now 3 available",
      { kind: "adjust_stock", qty: 3 },
      false,
    );
    this.pushAudit(
      "action_rolled_back",
      "seller",
      "Rolled back markdown on Yeezy Slide Bone",
      { kind: "markdown_price" },
      false,
    );
    this.pushAudit(
      "action_failed",
      "system",
      "Push listing failed — marketplace rate limit",
      { retryable: true },
      false,
    );

    // Seed chat backlog.
    this.backlog();
  }

  private backlog() {
    const msgs: ChatMessage[] = [];
    for (let i = 14; i >= 0; i--) {
      const hype = Math.random() < 0.35;
      const s = hype ? { text: pick(HYPE), intent: "hype" as ChatIntent } : pick(SCRIPT);
      msgs.push({
        id: uid("msg"),
        author: pick(AUTHORS),
        text: s.text,
        at: new Date(Date.now() - i * 4200).toISOString(),
        intent: s.intent,
        admitted: !hype,
        ...(hype ? { dropReason: "hype / no question detected" } : {}),
      });
    }
    this.backlogMessages = msgs;
  }

  backlogMessages: ChatMessage[] = [];

  /* ---------------- live loop ---------------- */

  private loop() {
    const chatTick = () => {
      this.after(rnd(1000, 3000), () => {
        this.spawnChat();
        chatTick();
      });
    };
    chatTick();

    const actionTick = () => {
      this.after(rnd(30_000, 60_000), () => {
        this.spawnAction();
        actionTick();
      });
    };
    actionTick();

    const metricsTick = () => {
      this.after(3000, () => {
        this.drift();
        metricsTick();
      });
    };
    metricsTick();
  }

  private pinned(): Listing {
    return this.listings.find((l) => l.id === this.show.pinnedListingId) ?? this.listings[0]!;
  }

  private spawnChat() {
    const rate = Math.random();
    const hype = rate < 0.32;
    const spam = rate >= 0.32 && rate < 0.4;
    const script = hype || spam ? null : pick(SCRIPT);
    const msg: ChatMessage = {
      id: uid("msg"),
      author: pick(AUTHORS),
      text: spam ? "dm me for cheap pairs 👀 link in bio" : hype ? pick(HYPE) : script!.text,
      at: nowIso(),
      intent: null,
      admitted: !hype && !spam,
      ...(spam
        ? { dropReason: "promo / spam pattern" }
        : hype
          ? { dropReason: "hype / no question detected" }
          : {}),
    };
    this.emit({ type: "chat", data: msg });

    // Async classification.
    this.after(rnd(350, 900), () => {
      const classified: ChatMessage = {
        ...msg,
        intent: spam ? "other" : hype ? "hype" : script!.intent,
      };
      this.emit({ type: "chat", data: classified });
      if (classified.admitted && Math.random() < 0.72) this.spawnProposal(classified);
    });
  }

  private spawnProposal(message: ChatMessage) {
    const listing = this.pinned();
    const intent = message.intent ?? "other";
    const template = pick(REPLIES[intent] ?? REPLIES.other!);
    const text = template
      .replace("{price}", formatMoney(listing.priceCents))
      .replace("{size}", listing.size)
      .replace("{qty}", String(listing.qty))
      .replace("{cert}", listing.certId ?? "pending");

    const roll = Math.random();
    const finalStatus: ReplyProposal["status"] =
      roll < 0.1 ? "blocked" : roll < 0.28 ? "needs_review" : "ready";
    const total = rnd(520, 1900);
    const id = uid("prp");
    const linked: ChatMessage = { ...message, proposalId: id };
    this.emit({ type: "chat", data: linked });

    let g = guards();
    let verdict: Verdict = "allow";
    if (finalStatus === "blocked") {
      const stale = listing.version + 1;
      g = guards({
        price: {
          guard: "price",
          verdict: "block",
          reason: `Reply quotes a price from listing version ${listing.version}; the live listing is version ${stale} after a markdown.`,
          detail: {
            expected: `${formatMoney(listing.priceCents - 4200)} (v${stale})`,
            found: formatMoney(listing.priceCents),
          },
        },
      });
      verdict = "block";
    } else if (finalStatus === "needs_review") {
      g = guards({
        tone: {
          guard: "tone",
          verdict: "revise",
          reason: "Phrasing leans on urgency; consider a calmer close.",
          detail: { expected: "no urgency claims", found: "scarcity phrasing" },
        },
      });
      verdict = "revise";
    }

    const base: ReplyProposal = {
      id,
      message: linked,
      status: "drafting",
      draft: "",
      claims: [
        {
          text: text.slice(0, 34),
          factId: `fact_price_${listing.id}_v${listing.version}`,
          supported: finalStatus !== "blocked",
        },
      ],
      evidence: Math.random() < 0.07 ? [] : evidenceFor(listing, intent),
      guards: guards(),
      verdict: "allow",
      confidence: Number(rnd(0.55, 0.97).toFixed(2)),
      repaired: Math.random() < 0.18,
      spans: spans(total, false, Math.random() < 0.4),
      createdAt: nowIso(),
      // Nothing delivers on the scripted show either. See `mk`.
      delivery: "human",
    };
    this.proposals = [...this.proposals, base];
    this.emit({ type: "proposal", data: base });

    // Stream the draft in character by character over 500–1200ms.
    const duration = rnd(500, 1200);
    const steps = Math.max(6, Math.ceil(text.length / 3));
    const step = duration / steps;
    for (let i = 1; i <= steps; i++) {
      this.after(step * i, () => {
        const cut = Math.ceil((text.length * i) / steps);
        const partial = { ...base, draft: text.slice(0, cut) };
        this.upsertProposal(partial);
      });
    }
    this.after(duration + 120, () => {
      const done: ReplyProposal = {
        ...base,
        draft: text,
        status: finalStatus,
        guards: g,
        verdict,
        spans: { ...base.spans, repairMs: base.repaired ? Math.round(rnd(120, 320)) : 0 },
      };
      this.upsertProposal(done);
      if (finalStatus === "blocked")
        this.pushAudit(
          "reply_blocked",
          "system",
          `Reply blocked by price guard — ${listing.title}`,
          { proposalId: id },
        );
      // No auto-send here, at any rung.
      //
      // `decideReply` (backend `src/autonomy/ladder.ts:100`) returns `suggest`
      // — "pre-approved, yours to send" — rather than `auto_send` whenever
      // delivery is not `"api"`, and nothing in this build delivers. A mock
      // that flipped a card to `auto_sent` would be showing the operator the
      // one state the ladder refuses to produce, on the one screen where
      // "nobody sent this" is the fact that matters.
    });
  }

  private upsertProposal(p: ReplyProposal) {
    this.proposals = this.proposals.map((x) => (x.id === p.id ? p : x));
    if (!this.proposals.some((x) => x.id === p.id)) this.proposals = [...this.proposals, p];
    this.emit({ type: "proposal", data: p });
  }

  private upsertAction(a: ActionProposal) {
    this.actions = this.actions.map((x) => (x.id === a.id ? a : x));
    this.emit({ type: "action", data: a });
  }

  private spawnAction() {
    const listing = pick(this.listings);
    const kinds: ActionKindLocal[] = [
      "markdown_price",
      "adjust_stock",
      "swap_pinned",
      "push_listing",
    ];
    const kind = pick(kinds);
    const failing = Math.random() < 0.25;
    const newPrice = Math.round(listing.priceCents * 0.9);
    const summaries: Record<ActionKindLocal, string> = {
      markdown_price: `Mark down ${listing.brand} ${listing.model} · size ${listing.size} — ${formatMoney(listing.priceCents)} → ${formatMoney(newPrice)} (−10%)`,
      adjust_stock: `Fix stock on ${listing.title} · size ${listing.size} — ${listing.qty} → ${listing.qty + 1} available`,
      swap_pinned: `Swap pinned lot to ${listing.title} · size ${listing.size}`,
      push_listing: `Push ${listing.title} to the front of the lot queue`,
    };
    const checks = [
      {
        name: "above floor price",
        ok: newPrice >= listing.floorPriceCents,
        detail: `floor ${formatMoney(listing.floorPriceCents)}`,
      },
      { name: "within 15% max discount", ok: true, detail: "−10.0% requested" },
      {
        name: "show action budget",
        ok: !failing,
        detail: failing
          ? "12 of 12 actions used"
          : `${this.metrics.actionsCommitted + 5} of 12 actions used`,
      },
    ];
    const ok = checks.every((c) => c.ok);
    const action: ActionProposal = {
      id: uid("act"),
      kind,
      listingId: listing.id,
      listingTitle: listing.title,
      summary: summaries[kind],
      rationale:
        kind === "markdown_price"
          ? `${Math.round(rnd(3, 6))} buyers asked for a discount in the last 3 minutes; median comp is ${formatMoney(newPrice - 200)}.`
          : kind === "adjust_stock"
            ? "Inventory scan disagrees with the live count; buyers are being told it's sold out."
            : `Chat interest shifted to ${listing.brand} ${listing.model} over the last 2 minutes.`,
      params: kind === "markdown_price" ? { priceCents: newPrice } : { listingId: listing.id },
      before: { priceCents: listing.priceCents, qty: listing.qty, version: listing.version },
      status: ok ? "proposed" : "preflight_failed",
      preflight: { ok, checks },
      idempotencyKey: `idem_${hash(listing.id + kind + Date.now())}`,
      undoableUntil: null,
      createdAt: nowIso(),
    };
    this.actions = [action, ...this.actions];
    this.emit({ type: "action", data: action });
    this.pushAudit(
      ok ? "action_proposed" : "action_preflight_failed",
      "copilot",
      `${ok ? "Proposed" : "Preflight failed"} — ${action.summary}`,
      { kind, listingId: listing.id },
    );
  }

  private drift() {
    const l = this.metrics.latency;
    const jitter = (v: number, amt: number) => Math.max(120, Math.round(v + rnd(-amt, amt)));
    const p95 = jitter(l.p95, 90);
    this.metrics = {
      ...this.metrics,
      latency: {
        ...l,
        p50: jitter(l.p50, 50),
        p95,
        p99: Math.max(p95 + 200, jitter(l.p99, 140)),
        breaches: p95 > l.budgetMs ? l.breaches + 1 : l.breaches,
      },
      cacheHitRate: Math.min(0.85, Math.max(0.1, this.metrics.cacheHitRate + rnd(-0.03, 0.03))),
      answeredRate: Math.min(0.99, Math.max(0.4, this.metrics.answeredRate + rnd(-0.02, 0.02))),
      proposals: this.metrics.proposals + (Math.random() < 0.4 ? 1 : 0),
    };
    this.emit({ type: "metrics", data: this.metrics });

    this.show = {
      ...this.show,
      viewers: Math.max(40, this.show.viewers + Math.round(rnd(-6, 8))),
    };
    this.emit({ type: "hello", data: this.hello() });

    if (Math.random() < 0.25) {
      this.context = {
        ...this.context,
        currentTopic: pick([
          "Chicago Reimagined pricing",
          "Shipping to Canada",
          "990v6 sizing",
          "Box logo authenticity",
        ]),
        updatedAt: nowIso(),
      };
      this.emit({ type: "context", data: this.context });
    }
  }

  /* ---------------- REST surface ---------------- */

  async sendProposal(id: string, text?: string): Promise<ReplyProposal> {
    const p = this.proposals.find((x) => x.id === id)!;
    const next: ReplyProposal = { ...p, status: "sent", sentText: text ?? p.draft };
    this.upsertProposal(next);
    this.metrics = { ...this.metrics, sent: this.metrics.sent + 1 };
    this.emit({ type: "metrics", data: this.metrics });
    // The server's own wording on a surface with no reply API: what happened
    // is that the answer was approved and recorded, and a human posts it.
    this.pushAudit(
      "reply_sent",
      "seller",
      `Answer for @${p.message.author} approved and recorded — you post it`,
      { proposalId: id, text: next.sentText, delivery: next.delivery ?? "human" },
    );
    return next;
  }

  async dismissProposal(id: string): Promise<ReplyProposal> {
    const p = this.proposals.find((x) => x.id === id)!;
    const next: ReplyProposal = { ...p, status: "dismissed" };
    this.upsertProposal(next);
    this.metrics = { ...this.metrics, dismissed: this.metrics.dismissed + 1 };
    this.emit({ type: "metrics", data: this.metrics });
    return next;
  }

  async regenerateProposal(id: string): Promise<ReplyProposal> {
    const p = this.proposals.find((x) => x.id === id)!;
    const listing = this.pinned();
    const intent = p.message.intent ?? "other";
    const text = pick(REPLIES[intent] ?? REPLIES.other!)
      .replace("{price}", formatMoney(listing.priceCents))
      .replace("{size}", listing.size)
      .replace("{qty}", String(listing.qty))
      .replace("{cert}", listing.certId ?? "pending");
    const drafting: ReplyProposal = { ...p, status: "drafting", draft: "", repaired: false };
    this.upsertProposal(drafting);
    const steps = Math.max(6, Math.ceil(text.length / 3));
    const duration = rnd(500, 1100);
    for (let i = 1; i <= steps; i++) {
      this.after((duration / steps) * i, () => {
        this.upsertProposal({
          ...drafting,
          draft: text.slice(0, Math.ceil((text.length * i) / steps)),
        });
      });
    }
    this.after(duration + 100, () => {
      this.upsertProposal({
        ...drafting,
        draft: text,
        status: "ready",
        guards: guards(),
        verdict: "allow",
        confidence: Number(rnd(0.7, 0.97).toFixed(2)),
        spans: spans(rnd(500, 1500), false, false),
      });
    });
    return drafting;
  }

  async approveAction(id: string): Promise<ActionProposal> {
    const a = this.actions.find((x) => x.id === id)!;
    const committing: ActionProposal = { ...a, status: "committing" };
    this.upsertAction(committing);
    this.after(rnd(700, 1500), () => {
      const fail = Math.random() < 0.15;
      if (fail) {
        this.upsertAction({
          ...a,
          status: "failed",
          error: "Marketplace rejected the update (429 rate limited)",
        });
        this.pushAudit("action_failed", "system", `Failed — ${a.summary}`, { error: "429" });
        return;
      }
      const committed: ActionProposal = {
        ...a,
        status: "committed",
        undoableUntil: new Date(Date.now() + this.show.undoWindowS * 1000).toISOString(),
      };
      this.upsertAction(committed);
      this.metrics = { ...this.metrics, actionsCommitted: this.metrics.actionsCommitted + 1 };
      this.emit({ type: "metrics", data: this.metrics });
      this.pushAudit("action_committed", "seller", `Committed — ${a.summary}`, {
        kind: a.kind,
        params: a.params,
      });
      this.applyAction(committed);
    });
    return committing;
  }

  private applyAction(a: ActionProposal) {
    const l = this.listings.find((x) => x.id === a.listingId);
    if (!l) return;
    let next: Listing = { ...l, version: l.version + 1, updatedAt: nowIso() };
    if (a.kind === "markdown_price" && typeof a.params["priceCents"] === "number")
      next = { ...next, priceCents: a.params["priceCents"] as number };
    if (a.kind === "adjust_stock" && typeof a.params["qty"] === "number")
      next = { ...next, qty: a.params["qty"] as number };
    if (a.kind === "swap_pinned") {
      this.listings = this.listings.map((x) => ({ ...x, pinned: x.id === l.id }));
      this.show = { ...this.show, pinnedListingId: l.id };
      this.emit({ type: "hello", data: this.hello() });
      next = { ...next, pinned: true };
    }
    this.listings = this.listings.map((x) => (x.id === next.id ? next : x));
    this.emit({ type: "listing", data: next });
  }

  async rejectAction(id: string): Promise<ActionProposal> {
    const a = this.actions.find((x) => x.id === id)!;
    const next: ActionProposal = { ...a, status: "rejected" };
    this.upsertAction(next);
    this.pushAudit("action_proposed", "seller", `Rejected — ${a.summary}`, { kind: a.kind });
    return next;
  }

  async rollbackAction(id: string): Promise<ActionProposal> {
    const a = this.actions.find((x) => x.id === id)!;
    const next: ActionProposal = { ...a, status: "rolled_back", undoableUntil: null };
    this.upsertAction(next);
    this.metrics = { ...this.metrics, actionsRolledBack: this.metrics.actionsRolledBack + 1 };
    this.emit({ type: "metrics", data: this.metrics });
    this.pushAudit("action_rolled_back", "seller", `Rolled back — ${a.summary}`, { kind: a.kind });
    const l = this.listings.find((x) => x.id === a.listingId);
    if (l) {
      const restored: Listing = {
        ...l,
        priceCents:
          typeof a.before["priceCents"] === "number"
            ? (a.before["priceCents"] as number)
            : l.priceCents,
        qty: typeof a.before["qty"] === "number" ? (a.before["qty"] as number) : l.qty,
        version: l.version + 1,
        updatedAt: nowIso(),
      };
      this.listings = this.listings.map((x) => (x.id === restored.id ? restored : x));
      this.emit({ type: "listing", data: restored });
    }
    return next;
  }

  async setAutonomy(level: AutonomyLevel): Promise<ShowState> {
    this.show = { ...this.show, autonomyLevel: level };
    this.emit({ type: "hello", data: this.hello() });
    this.pushAudit(
      "autonomy_changed",
      "seller",
      `Autonomy set to ${level
        .replace(/^L\d_/, (m) => m.slice(0, 2) + " ")
        .replace(/_/g, " ")
        .toLowerCase()}`,
      { level },
    );
    return this.show;
  }

  async injectChat(author: string, text: string): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: uid("msg"),
      author,
      text,
      at: nowIso(),
      intent: null,
      admitted: true,
    };
    this.emit({ type: "chat", data: msg });
    this.after(400, () => {
      const guess: ChatIntent = /price|how much|\$|\d{3}/i.test(text)
        ? "price_question"
        : /ship/i.test(text)
          ? "shipping"
          : /return/i.test(text)
            ? "returns"
            : /size|fit/i.test(text)
              ? "sizing"
              : /legit|authentic/i.test(text)
                ? "authenticity"
                : /left|available|still/i.test(text)
                  ? "availability"
                  : "other";
      const classified = { ...msg, intent: guess };
      this.emit({ type: "chat", data: classified });
      this.spawnProposal(classified);
    });
    return msg;
  }

  async research(query: string, listingId?: string): Promise<ResearchCard> {
    await new Promise((r) => setTimeout(r, rnd(500, 1400)));
    const listing = this.listings.find((l) => l.id === listingId) ?? this.pinned();
    const base = listing.priceCents;
    const comps: Comp[] = Array.from({ length: 6 }).map((_, i) => ({
      title: listing.title,
      priceCents: Math.round(base * rnd(0.82, 1.06)),
      soldAt: new Date(Date.now() - (i + 1) * 86_400_000 * rnd(0.6, 2)).toISOString(),
      condition: pick(["DS", "VNDS", "USED"]),
      size: pick([listing.size, "9.5", "10.5", "11"]),
      basis: "sold" as const,
    }));
    const sorted = comps.map((c) => c.priceCents).sort((a, b) => a - b);
    const median = Math.round((sorted[2]! + sorted[3]!) / 2);
    return {
      query,
      listingId: listing.id,
      headline: `${listing.brand} ${listing.model} — ${listing.colorway}`,
      comps,
      // Mock mode invents sales, and says so by claiming the stronger basis it
      // is pretending to have. Real shows get whatever eBay actually answers.
      marketBasis: "sold" as const,
      marketSource: "seeded" as const,
      medianCents: median,
      suggestion:
        median < listing.priceCents
          ? `Comps sit ${formatMoney(listing.priceCents - median)} below your ask — ${formatMoney(median + 800)} should still clear tonight.`
          : `You're under market by ${formatMoney(median - listing.priceCents)} — hold at ${formatMoney(listing.priceCents)} or nudge up.`,
      specDiff: [
        { attribute: "Midsole", ours: "Sail (Reimagined)", theirs: "White (2015)" },
        { attribute: "Release", ours: "2022", theirs: "2015" },
        { attribute: "Box", ours: "Original included", theirs: "Replacement" },
      ],
      latencyMs: Math.round(rnd(600, 2400)),
      evidence: [
        {
          factId: "fact_market_comps",
          source: "market",
          label: "Market · comps",
          text: `Median of ${comps.length} comparable sales in the last 14 days: ${formatMoney(median)}.`,
          score: 0.9,
        },
        {
          factId: `fact_catalog_${listing.sku}`,
          source: "catalog",
          label: "Catalog · spec",
          text: `SKU ${listing.sku} — ${listing.model}, ${listing.colorway}.`,
          score: 0.84,
        },
      ],
    };
  }

  async getAudit(): Promise<AuditEntry[]> {
    return this.audit;
  }

  async getMetrics(): Promise<Metrics> {
    return this.metrics;
  }
}

type ActionKindLocal = "markdown_price" | "adjust_stock" | "swap_pinned" | "push_listing";
type Comp = import("./types").Comp;

let singleton: MockDriver | null = null;
export function getMockDriver(): MockDriver {
  if (!singleton) singleton = new MockDriver();
  return singleton;
}
