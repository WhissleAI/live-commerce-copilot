/**
 * What each surface can do, and the console's questions asked in those terms.
 *
 * This is a MIRROR of `SURFACE_CAPABILITIES` in the backend's
 * `src/surfaces/types.ts`, and it is a mirror for the same reason the backend
 * keeps a static table rather than reading the adapter registry: the answer to
 * "does this surface have a lot rail" has to exist before the first byte of the
 * stream arrives, and a layout that waits on a fetch is a layout that flickers
 * through the wrong shape on every reload.
 *
 * `GET /api/surfaces` is authoritative when it answers — `withRemote` folds it
 * over this table, so a surface whose capabilities change server-side changes
 * here without a deploy. Until it answers, and if it never does, the table is
 * the answer. An unknown id reads as live commerce, which is what every row
 * written before the column existed actually was.
 */

import type {
  CorpusKind,
  GuardName,
  SurfaceCapabilities,
  SurfaceId,
  SurfaceInfo,
  ShowState,
} from "./types";

/** eBay Live as it behaves today, field for field. Nothing here is new. */
export const EBAYLIVE_CAPABILITIES: SurfaceCapabilities = {
  tempo: "live",
  delivery: "api",
  perception: { audio: true, video: true },
  actions: ["push_listing", "swap_pinned", "markdown_price", "adjust_stock", "end_listing"],
  corpora: ["listing", "policy", "qa", "community"],
  // eBay Live has no per-room rule corpus to retrieve, so the community-rule
  // guard answers n/a here and the reference surface is untouched by a guard
  // written for subreddits.
  communityRules: false,
};

/**
 * The scripted show. Identical to eBay Live by design: the simulated source
 * exists to exercise the live-commerce path, so a capability that differed
 * would make the demo test something production does not do.
 */
export const SIMULATED_CAPABILITIES: SurfaceCapabilities = { ...EBAYLIVE_CAPABILITIES };

/**
 * Whatnot and TikTok Live: live commerce read through a browser, nothing more.
 *
 * These were mirrored as copies of eBay Live, which was wrong in the way that
 * matters most: it claimed we can PUSH A LISTING and MARK A PRICE DOWN on a
 * platform we hold no seller credentials for. The backend has always had them
 * as their own shape; this file had not caught up, and the table is what
 * renders before `GET /api/surfaces` answers — so home's During column said
 * "answers and acts" on two surfaces where nothing can be sent at all.
 *
 * · `delivery: "draft-only"` — neither platform exposes a way for us to post
 *   into a room's chat, so the reply is written for a human to send.
 * · `perception: false` — we read the DOM, not the stream: no host audio.
 * · The five listing writes are gone. What is left writes only to records we
 *   own: marking a moment, and handing a question to a human.
 */
export const SCRAPED_LIVE_CAPABILITIES: SurfaceCapabilities = {
  tempo: "live",
  delivery: "draft-only",
  perception: { audio: false, video: false },
  actions: ["mark_highlight", "flag_for_human"],
  corpora: ["listing", "policy", "qa"],
  communityRules: false,
};

export const SURFACE_CAPABILITIES: Record<SurfaceId, SurfaceCapabilities> = {
  simulated: SIMULATED_CAPABILITIES,
  ebaylive: EBAYLIVE_CAPABILITIES,
  whatnot: SCRAPED_LIVE_CAPABILITIES,
  tiktoklive: SCRAPED_LIVE_CAPABILITIES,
  twitch: {
    tempo: "live",
    delivery: "api",
    perception: { audio: true, video: true },
    actions: ["create_clip", "mark_highlight", "run_poll", "shoutout", "pin_message", "post_reply"],
    corpora: ["schedule", "sponsor", "product", "qa", "community"],
    communityRules: true,
  },
  youtubelive: {
    tempo: "live",
    delivery: "api",
    perception: { audio: true, video: true },
    actions: ["mark_highlight", "pin_message", "post_reply"],
    corpora: ["schedule", "sponsor", "product", "qa", "community"],
    communityRules: true,
  },
  reddit: {
    tempo: "async",
    delivery: "draft-only",
    perception: { audio: false, video: false },
    // `post_reply` is absent deliberately, and its absence is a second lock on
    // the same door the backend keeps: `delivery` already refuses it, and an
    // action a surface does not declare is refused by preflight before
    // delivery is even read. Undisclosed automation replying as a person
    // breaks Reddit's own rules, so the only thing this surface hands a human
    // is a draft.
    actions: ["flag_for_human"],
    corpora: ["product", "policy", "qa", "community"],
    communityRules: true,
  },
  dm: {
    tempo: "async",
    delivery: "draft-only",
    perception: { audio: false, video: false },
    actions: ["send_dm", "flag_for_human"],
    corpora: ["listing", "policy", "product", "qa"],
    communityRules: false,
  },
};

export const SURFACE_LABEL: Record<SurfaceId, string> = {
  simulated: "Simulated show",
  ebaylive: "eBay Live",
  whatnot: "Whatnot",
  tiktoklive: "TikTok Live",
  twitch: "Twitch",
  youtubelive: "YouTube Live",
  reddit: "Reddit",
  dm: "Follow-ups",
};

/** What each surface calls the place a conversation happens. */
export const SURFACE_ROOM_NOUN: Record<SurfaceId, string> = {
  simulated: "show",
  ebaylive: "show",
  whatnot: "show",
  tiktoklive: "stream",
  twitch: "channel",
  youtubelive: "channel",
  reddit: "subreddit",
  dm: "inbox",
};

export const SURFACE_IDS = Object.keys(SURFACE_CAPABILITIES) as SurfaceId[];

export function isSurfaceId(v: unknown): v is SurfaceId {
  return typeof v === "string" && v in SURFACE_CAPABILITIES;
}

/** A surface's human name, even for an id this build has never heard of. */
export function surfaceLabel(id: SurfaceId | string | null | undefined): string {
  return isSurfaceId(id) ? SURFACE_LABEL[id] : (id ?? "unknown");
}

/**
 * What this surface can do.
 *
 * Unknown, absent, or a value from a backend older than the column: live
 * commerce. Every show written before surfaces existed was one.
 */
export function capabilitiesOf(
  id: SurfaceId | string | null | undefined,
  remote?: readonly SurfaceInfo[] | null,
): SurfaceCapabilities {
  const said = remote?.find((s) => s.id === id)?.capabilities;
  if (said) return normalizeCapabilities(said);
  return isSurfaceId(id) ? SURFACE_CAPABILITIES[id] : EBAYLIVE_CAPABILITIES;
}

/**
 * A server answer, made safe to read.
 *
 * The backend for all of this is being written beside this file, and a console
 * that reads `caps.perception.audio` off a half-shipped payload throws inside a
 * render — which takes the whole console down, on the one surface that must
 * never break. Every field falls back to eBay Live's.
 */
export function normalizeCapabilities(c: Partial<SurfaceCapabilities> | null | undefined) {
  const base = EBAYLIVE_CAPABILITIES;
  return {
    tempo: c?.tempo === "async" ? "async" : "live",
    delivery: c?.delivery === "draft-only" ? "draft-only" : "api",
    perception: {
      audio: c?.perception?.audio ?? base.perception.audio,
      video: c?.perception?.video ?? base.perception.video,
    },
    actions: Array.isArray(c?.actions) ? c.actions : base.actions,
    corpora: Array.isArray(c?.corpora) ? c.corpora : base.corpora,
    communityRules: c?.communityRules === true,
  } satisfies SurfaceCapabilities;
}

/** Which surface a show is on. `surface` is the column; `source` is its older
 *  name and still the only answer a pre-018 backend gives. */
export function surfaceOf(
  show: Pick<ShowState, "surface" | "source"> | null | undefined,
): SurfaceId {
  const id = show?.surface ?? show?.source;
  return isSurfaceId(id) ? id : "ebaylive";
}

export function hasCorpus(caps: SurfaceCapabilities, kind: CorpusKind): boolean {
  return caps.corpora.includes(kind);
}

export function isAsync(caps: SurfaceCapabilities): boolean {
  return caps.tempo === "async";
}

/** Can we deliver a reply here at all, or is a human the sender? */
export function draftOnly(caps: SurfaceCapabilities): boolean {
  return caps.delivery === "draft-only";
}

// ── what the console renders, as a function of what the surface can do ──────
//
// One object, computed once, so the four places that need to know cannot
// disagree — which is the bug the old console had in a milder form: three
// independent `show.source === "ebaylive"` checks, each with its own idea of
// what that implied.

export interface ConsoleLayout {
  /** The pinned lot and the lot queue. There is no lot without a catalog. */
  lotRail: boolean;
  /** The p95 meter. A reply written to a three-day-old thread has no budget to
   *  breach, and a meter against one invents a deadline nobody has. */
  latencyMeter: boolean;
  /** The host's speech and the loudness strip. */
  hostAudio: boolean;
  /** The opening post and the branch above the comment being answered. */
  threadPanel: boolean;
  /** Actions and the audit chain — every surface has at least one action. */
  actionRail: boolean;
  /** The reply is ours to send, or the operator's. */
  deliverable: boolean;
}

export function consoleLayout(caps: SurfaceCapabilities): ConsoleLayout {
  return {
    lotRail: hasCorpus(caps, "listing"),
    latencyMeter: caps.tempo === "live",
    hostAudio: caps.perception.audio,
    threadPanel: caps.tempo === "async",
    actionRail: caps.actions.length > 0,
    deliverable: caps.delivery === "api",
  };
}

// ── guards, per surface ─────────────────────────────────────────────────────
//
// The base six run everywhere. The two surface-specific ones are added only
// where the surface actually has them, so an eBay Live card carries exactly the
// six pills it has always carried — adding two permanent `–` pills to the
// reference surface would be a regression dressed as a feature.

export const BASE_GUARDS: GuardName[] = [
  "price",
  "availability",
  "policy",
  "claim_grounding",
  "tone",
  "pii",
];

export function guardOrderFor(caps: SurfaceCapabilities): GuardName[] {
  const order = [...BASE_GUARDS];
  if (caps.communityRules) order.push("community_rule");
  if (hasCorpus(caps, "sponsor")) order.push("sponsor");
  return order;
}

/**
 * Fold a server answer over the table.
 *
 * A row the server does not mention keeps its built-in capabilities rather than
 * disappearing: a backend that only lists the surfaces it has keys for would
 * otherwise erase eBay Live from the console the moment it shipped.
 */
export function withRemote(remote: readonly SurfaceInfo[] | null | undefined): SurfaceInfo[] {
  const said = new Map((remote ?? []).map((s) => [s.id, s]));
  return SURFACE_IDS.map((id) => {
    const r = said.get(id);
    return {
      id,
      // The server names an adapter that is actually wired; the table names
      // every surface the product has a word for. Prefer the server's.
      label: r?.label && r.label !== id ? r.label : SURFACE_LABEL[id],
      capabilities: r ? normalizeCapabilities(r.capabilities) : SURFACE_CAPABILITIES[id],
      // Unheard-of surfaces are not attachable: a paste box that offers to
      // watch something this build has no adapter for is offering a 409.
      attachable: r ? r.attachable !== false : false,
      available: r?.available ?? true,
      missing: r?.missing ?? null,
    };
  });
}

/**
 * Which surface does this paste belong to?
 *
 * The same first-match-wins order the backend's registry uses, and eBay Live
 * goes first for the same reason: its pattern is the tightest, so nothing can
 * steal a link that belongs to it. Null when nothing claims it — a box that
 * guessed would attach the wrong surface to a mistyped link, which is a worse
 * failure than saying "we do not recognise that".
 */
export interface RecognisedTarget {
  surface: SurfaceId;
  externalId: string;
  /** What to call it before we have asked the server anything. */
  detail: string;
  room?: string;
}

export function recognise(input: string): RecognisedTarget | null {
  const t = (input || "").trim();
  if (!t) return null;

  // eBay Live — a 16-character event id, or its own URL path.
  const ebayPath = t.match(/\/ebaylive\/events\/([A-Za-z0-9]{10,})/)?.[1];
  if (ebayPath) return { surface: "ebaylive", externalId: ebayPath, detail: `event ${ebayPath}` };
  if (/^[A-Za-z0-9]{16}$/.test(t))
    return { surface: "ebaylive", externalId: t, detail: `event ${t}` };

  // Reddit — a subreddit, or one thread in it.
  const thread = t.match(/reddit\.com\/r\/([A-Za-z0-9_]{2,21})\/comments\/([A-Za-z0-9]+)/i);
  if (thread) {
    return {
      surface: "reddit",
      externalId: thread[2]!,
      room: `r/${thread[1]}`,
      detail: `a thread in r/${thread[1]}`,
    };
  }
  const sub = t.match(
    /^(?:https?:\/\/(?:www\.|old\.)?reddit\.com)?\/?r\/([A-Za-z0-9_]{2,21})\/?$/i,
  );
  if (sub) {
    return {
      surface: "reddit",
      externalId: `r/${sub[1]}`,
      room: `r/${sub[1]}`,
      detail: `r/${sub[1]}`,
    };
  }

  // Whatnot — a live page.
  const whatnot = t.match(/whatnot\.com\/live\/([A-Za-z0-9-]+)/i);
  if (whatnot) return { surface: "whatnot", externalId: whatnot[1]!, detail: `a Whatnot show` };

  // TikTok Live — /@handle/live.
  const tiktok = t.match(/tiktok\.com\/@([A-Za-z0-9._]+)\/live/i);
  if (tiktok)
    return {
      surface: "tiktoklive",
      externalId: tiktok[1]!,
      room: `@${tiktok[1]}`,
      detail: `@${tiktok[1]} on TikTok`,
    };

  // YouTube Live — a watch link or a channel's /live.
  const yt = t.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (yt) return { surface: "youtubelive", externalId: yt[1]!, detail: `a YouTube stream` };
  const ytChannel = t.match(/youtube\.com\/@([A-Za-z0-9._-]+)\/live/i);
  if (ytChannel)
    return {
      surface: "youtubelive",
      externalId: ytChannel[1]!,
      room: `@${ytChannel[1]}`,
      detail: `@${ytChannel[1]} on YouTube`,
    };

  // Twitch — a channel page, or a bare channel name prefixed to disambiguate
  // it from every other bare word someone might paste.
  const twitch = t.match(/twitch\.tv\/([A-Za-z0-9_]{3,25})\/?$/i);
  if (twitch)
    return {
      surface: "twitch",
      externalId: twitch[1]!,
      room: twitch[1]!,
      detail: `the ${twitch[1]} channel`,
    };
  const twitchBare = t.match(/^twitch:([A-Za-z0-9_]{3,25})$/i);
  if (twitchBare)
    return {
      surface: "twitch",
      externalId: twitchBare[1]!,
      room: twitchBare[1]!,
      detail: `the ${twitchBare[1]} channel`,
    };

  return null;
}

// ── knowledge, by kind ──────────────────────────────────────────────────────
//
// A corpus is what a reply is GROUNDED in, and the seven kinds are not
// interchangeable: a listing answers "is it still there", a community rule
// decides whether we may answer at all. The Knowledge page groups by kind for
// the same reason the console reads capabilities — so the operator can see
// which surfaces a thing they load will actually help.

export const CORPUS_ORDER: CorpusKind[] = [
  "listing",
  "policy",
  "qa",
  "community",
  "product",
  "schedule",
  "sponsor",
];

export const CORPUS_LABEL: Record<CorpusKind, string> = {
  listing: "Listings",
  policy: "Policies",
  schedule: "Schedule",
  sponsor: "Sponsor briefs",
  product: "Product docs",
  community: "Community rules",
  qa: "Prior answers",
};

export const CORPUS_BLURB: Record<CorpusKind, string> = {
  listing: "What is for sale, at what price, and how many are left.",
  policy: "Shipping, returns, authenticity — your words, cited rather than paraphrased.",
  schedule: "When you are on, and what is planned. A stream answers “when is the next one”.",
  sponsor: "What a sponsor requires said, and what they forbid. The sponsor guard reads this.",
  product: "Specs, manuals and spec sheets for things you did not list yourself.",
  // CONTENT-16: this said "retrieved per subreddit or channel before a reply
  // is drafted", which the app claimed and the landing page deliberately
  // refused to. The Reddit adapter fetches a subreddit's rules once, at
  // attach, and uses the result only to build a status string
  // (`reddit/adapter.ts:170-176`); the facts never reach the retriever, so
  // `pipeline.ts:369` finds none and `communityRuleGuard` answers n/a. The
  // guard is built. It is not yet fed.
  community:
    "The rules of each room. Read once when you attach a room, and shown there — not yet used to check a draft.",
  qa: "Questions already answered, and the answer that was approved.",
};

/**
 * Surfaces this build has no adapter for.
 *
 * `youtubelive` is a capability row and nothing else: the backend's
 * `src/surfaces/registry.ts` registers seven adapters and it is not among
 * them. The row exists so the shape of the next surface is written down, which
 * is useful — but anything that offers a surface to an operator has to ask
 * whether they could actually use it, and `SURFACE_CAPABILITIES` does not
 * answer that question. Nothing else in this file should grow a hard-coded id;
 * when the adapter lands, this set empties.
 */
export const NO_ADAPTER: ReadonlySet<SurfaceId> = new Set<SurfaceId>(["youtubelive"]);

export function isAttachable(id: SurfaceId): boolean {
  return id !== "simulated" && !NO_ADAPTER.has(id);
}

/**
 * Which surfaces are grounded by one kind of corpus.
 *
 * CONTENT-17. This filtered on the capability table alone, so YouTube Live —
 * which declares five corpora and has no adapter — was printed in the Grounds
 * column of five of the Knowledge page's seven rows, offering a surface
 * nobody can attach as a reason to load a corpus.
 *
 * `community` is narrower still: eBay Live declares the corpus but
 * `communityRules: false`, which is the backend saying it has no per-room
 * rules to retrieve — `communityRuleGuard` returns n/a there before it looks
 * at anything. Printing it under a column headed "Community rules" said the
 * opposite.
 */
export function surfacesForCorpus(
  kind: CorpusKind,
  remote?: readonly SurfaceInfo[] | null,
): SurfaceId[] {
  return withRemote(remote)
    .filter((s) => isAttachable(s.id))
    .filter((s) => s.capabilities.corpora.includes(kind))
    .filter((s) => kind !== "community" || s.capabilities.communityRules)
    .map((s) => s.id);
}
