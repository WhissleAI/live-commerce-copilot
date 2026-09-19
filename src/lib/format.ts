import type { ChatIntent, GuardName } from "./types";

/** All money in the API is integer cents. This is the only place it becomes a string. */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const v = Math.abs(cents) / 100;
  return `${sign}$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoneyShort(cents: number): string {
  const v = Math.abs(cents) / 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return `${cents < 0 ? "-" : ""}$${s}`;
}

export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export const INTENT_LABEL: Record<ChatIntent, string> = {
  price_question: "price",
  availability: "stock",
  sizing: "sizing",
  shipping: "shipping",
  returns: "returns",
  authenticity: "authenticity",
  comparison: "compare",
  discount_request: "discount",
  hype: "hype",
  other: "other",
};

/**
 * Topic hues, as oklch hue angles — and `null` for the one topic that should
 * not have a colour at all.
 *
 * Re-spaced deliberately. `discount_request` sat at hue 20, two degrees from
 * `--bad` (27.4) and next door to `--warn` (71.5), so a topic chip read as an
 * alert on the one screen where red means blocked or live. Nothing now sits in
 * the 0–90° band those two own; topics start at 105 and step 30–40°, which is
 * as much separation as eight of them fit into the remaining arc.
 */
export const INTENT_HUE: Record<ChatIntent, string | null> = {
  returns: "105",
  availability: "145",
  authenticity: "175",
  price_question: "205",
  shipping: "235",
  hype: "265",
  comparison: "295",
  sizing: "320",
  discount_request: "340",
  // "other" is not a topic. Giving it a hue made an unclassified comment look
  // like a category the operator should recognise.
  other: null,
};

/**
 * The six guards every reply passes, in order.
 *
 * Still six, deliberately. The two surface-specific guards are appended by
 * `guardOrderFor` only on a surface that has them — see `lib/surfaces.ts` — so
 * a live-commerce card carries exactly the six pills it has always carried.
 */
export const GUARD_ORDER: GuardName[] = [
  "price",
  "availability",
  "policy",
  "claim_grounding",
  "tone",
  "pii",
];

export const GUARD_LABEL: Record<GuardName, string> = {
  price: "price",
  availability: "stock",
  policy: "policy",
  claim_grounding: "grounding",
  tone: "tone",
  pii: "pii",
  // A room's rules are not the seller's policy and the two must not read as one
  // word: "policy" is what the operator promises, "room rules" is what the
  // place they are speaking in demands.
  community_rule: "room rules",
  sponsor: "sponsor",
};

/**
 * What each guard is actually checking, in one line.
 *
 * Written in the register the console already speaks in: a statement of what
 * was checked, never a claim about what the model thought.
 */
export const GUARD_MEANS: Record<GuardName, string> = {
  price:
    "every figure in the reply matches the listing it came from, at the version it was read at",
  availability: "the reply does not offer something that is sold out or was never in the lineup",
  policy: "nothing in it contradicts the seller's own shipping, returns and refund rules",
  claim_grounding: "every claim of fact cites a retrieved fact — an uncited one is not sent",
  tone: "it sounds like the seller, within the never-say list and the length they set",
  pii: "no buyer's address, order number or contact detail is repeated back in public",
  community_rule:
    "the room's own rules are constraints on the reply, never facts to answer from — a violated one blocks and names the rule",
  sponsor:
    "a claim about a sponsored product stands on the sponsor's approved copy, or it is not made",
};
