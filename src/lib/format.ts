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

/** Muted per-intent chip colors, expressed as inline-safe css color strings. */
export const INTENT_HUE: Record<ChatIntent, string> = {
  price_question: "200",
  availability: "150",
  sizing: "280",
  shipping: "230",
  returns: "40",
  authenticity: "170",
  comparison: "310",
  discount_request: "20",
  hype: "330",
  other: "260",
};

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
};
