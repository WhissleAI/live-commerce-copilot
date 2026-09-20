/**
 * Sentences that are said in more than one place.
 *
 * The audit's sharpest structural finding was that there is no string table
 * and no message boundary anywhere in this app, so one fact is written by
 * however many authors happened to need it, none of whom could see each other.
 * That is not a style problem — it is how "Sent means it reached a buyer"
 * (`ReportPage`, Replies) came to sit 770 lines below "sent means you pressed
 * Enter on it" (`ReportPage`, Did it help) in the same file, defining the
 * report's central metric as two different things, one of which never happens.
 *
 * This file is not a translation layer and is not trying to be one. It holds
 * exactly the strings where a divergence is a correctness bug:
 *
 *   · what "sent" means, because nothing is sent;
 *   · the states three pages each described in their own words;
 *   · the boundary where a backend error becomes an operator sentence.
 *
 * A string is added here when it is said twice. Page-specific copy stays on
 * its page, where it can be read next to what it describes.
 */

// ── what "sent" means ───────────────────────────────────────────────────────
//
// It means the operator approved it. It does not mean it reached anybody.
//
// `pipeline.send()` (sidestage-copilot `src/pipeline/pipeline.ts:545-553`)
// re-runs the chain on an edit, sets `status: "sent"`, increments a counter
// and appends a `reply_sent` audit entry. There is no platform call on that
// path or on any other: `actions/executor.ts` has no `post_reply` branch and
// `actions/proposer.ts` never produces one. Getting the reply in front of a
// buyer is the operator's half, and every surface says so.

/** The one definition, in the fewest words that are still true. */
export const SENT_MEANS =
  "Sent means you approved it: the reply was re-checked, recorded and written into the audit chain. Putting it in front of the buyer is your half.";

export const SENT_MEANS_SUMMARY =
  "Measured against the targets in the PRD. Answered means the copilot put a sendable reply in front of you. " +
  SENT_MEANS +
  " A question nothing could ground is a gap below, never an answer.";

export const SENT_MEANS_REPLIES =
  "Every reply the copilot drafted, newest first, with the verdicts it received — the six that run everywhere, plus the room-rule and sponsor guards on a surface that has them. " +
  SENT_MEANS +
  " A strikethrough was blocked; 'edited' is your revealed opinion of the draft.";

// ── states that three pages each named differently ──────────────────────────
//
// CONTENT-29. "Nothing has finished yet." · "No shows finished in the last 30
// days." · "No finished sessions in this window" — three nouns, three tenses,
// three punctuations, one state. Titles end in a full stop here, which is what
// most of the app already does.

export const NO_FINISHED_SESSIONS = {
  title: "No sessions have finished yet.",
  /** Home offers the next step; the two read-only pages explain the absence. */
  home: "A session's report is written when it ends, and the gaps it found are carried into the next one.",
  analytics:
    "Analytics is built from the report each session leaves behind. Monitor a session, end it, and this fills in.",
  cost: "A row is written when a session closes. Sessions still on air are in the console's cost rail until they end.",
} as const;

export const NOTHING_BLOCKED = {
  title: "Nothing was blocked.",
  session: "No guard stopped a reply in this session.",
} as const;

export const READINESS_UNAVAILABLE = {
  title: "Readiness could not be read.",
  body: "The ladder is scored from your own finished sessions. Finish one, and the criteria are judged against its numbers.",
} as const;

// ── absent is not failed ────────────────────────────────────────────────────
//
// CONTENT-22. Six pages render a failed read as an empty state: the console
// says "Nothing is on air." while the stream is broken, and the persona page
// says the seller has never written one when the read 500'd. The distinction
// is one boolean at every call site, so the sentences for the failed half live
// here rather than being invented six times.

export const LOAD_FAILED = {
  title: "That did not load.",
  /** What to do, which is the same thing every time and is not "try again". */
  body: "This is a failed read, not an empty one — whatever is there is still there. Reload the page; if it keeps happening the server is the thing to look at.",
} as const;

// ── the message boundary ────────────────────────────────────────────────────
//
// CONTENT-23. `lib/api.ts` manufactures `${path} failed: ${res.status}` and
// around twenty sites render `(e as Error).message` straight to the screen, so
// an operator gets `/api/drafts failed: 500` inside a confirm dialog, and the
// backend's API-contract copy — "seq must be a non-negative integer" — is
// rendered as though it were addressed to them. Those messages are for API
// clients. This turns one into a sentence for a person.
//
// It deliberately does NOT try to map every backend string. It maps the shapes
// that are generated rather than written — a route-and-status, a bare status —
// and passes through anything that already reads like a sentence, because the
// backend's refusals on the paths that matter (preflight, the guard chain,
// eBay sign-in) are written for the operator and are better than anything a
// map would substitute.

const STATUS_SENTENCE: Record<number, string> = {
  400: "The server refused that as malformed. That is ours to fix, not yours.",
  401: "Your session has expired. Reload the page to sign in again.",
  402: "This workspace is out of credit.",
  403: "You do not have access to that.",
  404: "That is not there any more — it may have been deleted, or it may never have been yours.",
  409: "Something changed underneath that. Reload and look again before you redo it.",
  429: "Too many requests at once. Wait a moment and try again.",
  500: "The server failed on that. Nothing was changed.",
  502: "The server could not reach something it depends on. Nothing was changed.",
  503: "The server is not taking requests right now. Nothing was changed.",
  504: "That took too long and was given up on. Nothing was changed.",
};

/** `"/api/drafts failed: 500"` and `"HTTP 500"` are the two shapes `api.ts` makes. */
const GENERATED = /^(?:(\S+)\s+failed:\s*(\d{3})|HTTP\s+(\d{3}))\s*$/;

/**
 * Copy written for whoever is calling the API, not for whoever is selling.
 *
 * `src/api/routes.ts` ships "seq must be a non-negative integer", "durationMs
 * must be between 1 and 120000", "frame must be an image data URL" and
 * `send { interests: [{ term }] }` as 400 bodies, and every one of them was
 * rendered to the operator verbatim. They describe a contract the operator
 * has no part in and cannot act on; the right sentence is that the app sent
 * something wrong, which is true and is ours.
 */
const API_CONTRACT =
  /^(?:send \{|expected |[A-Za-z][A-Za-z0-9_.[\]]* (?:must be|is required|should be)\b)/;

/**
 * A thrown error, as a sentence for the person looking at the screen.
 *
 * `what` names the thing that failed in the operator's words — "The drafts",
 * "This session" — and is prepended only when the message does not already
 * carry its own subject.
 */
export function operatorMessage(e: unknown, what?: string): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  // `api.ts` puts the response status on the error it throws.
  const status =
    e && typeof e === "object" && typeof (e as { status?: unknown }).status === "number"
      ? (e as { status: number }).status
      : Number(raw.match(GENERATED)?.[2] ?? raw.match(GENERATED)?.[3]) || null;

  if (GENERATED.test(raw) || API_CONTRACT.test(raw)) {
    const sentence = status
      ? (STATUS_SENTENCE[status] ?? `The server answered ${status}, which it should not have.`)
      : "The app sent the server something it could not accept. That is ours to fix, not yours.";
    return what ? `${what} could not be read. ${sentence}` : sentence;
  }
  if (!raw) {
    return what ? `${what} could not be read. No reason was given.` : LOAD_FAILED.body;
  }
  // Network-layer failures reach us as the browser's own wording, which names
  // no route and helps nobody.
  if (/^(Failed to fetch|NetworkError|Load failed|The Internet connection appears)/i.test(raw)) {
    return "The server could not be reached. Check your connection — nothing was changed.";
  }
  // Already a sentence somebody wrote for an operator. Leave it alone.
  return raw;
}

/**
 * A title for the console's stream-failure banner, from the failure class.
 *
 * CONTENT-31. It used to be the constant "The server does not know that show"
 * for every `stream_error` the server emits — a dropped socket, an expired
 * console session and a 500 all got the same confident, usually wrong,
 * sentence, with the real message demoted underneath it. Three classes is not
 * a taxonomy, but it is three more than one.
 */
export function streamTitle(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  if (/\bno show\b|not found|unknown show|\b404\b/.test(raw)) {
    return "The server does not have that session";
  }
  if (/\b401\b|\b403\b|unauthor|forbidden|expired/.test(raw)) {
    return "This console is no longer signed in";
  }
  return "The session stream stopped";
}

// ── one name, one description, one verb ────────────────────────────────────
//
// CONTENT-30. The page a session is attached from is called "Home" in the rail
// and in body copy and "Today" in its own header. The box on it is described
// three ways ("paste a session link, a channel, or a thread" · "Paste a
// session, a channel or a thread on Home" · "Paste a link on Home to begin")
// and the button that acts on it is called four ("Start monitoring" ·
// "Monitor a session" · "Monitor" · "Monitor a session"). One object, decided
// per screen.

/** What the page is called, wherever it is referred to from somewhere else. */
export const HOME = "Home";

/** What the paste box takes. Said once; every page that points at it points here. */
export const ATTACH_INPUT = "a session link, a channel, or a thread";

/** The verb. One word, so it is the same word on a button and in a sentence. */
export const ATTACH_VERB = "Monitor";

/** "Paste a session link, a channel, or a thread on Home." */
export const ATTACH_HINT = `Paste ${ATTACH_INPUT} on ${HOME} and the copilot attaches to it.`;

// ── refusals that name a shell command ──────────────────────────────────────
//
// CONTENT-21. The blocking step of the primary Before workflow — Discover with
// no eBay Live session, which is the default state for every new operator —
// was answered with "Run `npm run ebay:signin` in the server repo", in two
// different wordings depending on which code path answered: `lib/discover.ts`
// wrote one and the backend's discover source wrote another. The backend's own
// readiness module states the principle at `src/shows/readiness.ts:185-190`:
// "Product language. A seller does not run npm scripts."
//
// There is no sign-in affordance in the product and this file may not invent
// one. What it can do is say the true thing: the session lives on the server
// and creating one needs someone with access to that machine — and say the
// same true thing whichever side produced the refusal.

/** Said once. The operator's half is the second sentence; there is no first. */
export const EBAY_SIGNIN_REFUSAL =
  "eBay Live streams its grid only to a signed-in browser, and this server holds no session — creating one takes somebody with access to the machine it runs on, because nobody types a credential for you. Pasting a link to a session still attaches and monitors it from here.";

export const EBAY_SIGNIN_STALE =
  "The eBay session this server holds has expired, and renewing it takes somebody with access to the machine it runs on. Pasting a link to a session still attaches and monitors it from here.";

/**
 * A refusal from the server, as a sentence for an operator.
 *
 * Narrow on purpose: it rewrites the one class of message that tells a seller
 * to run a shell command in a repository they do not have, and passes
 * everything else through untouched. A refusal the backend wrote for an
 * operator is better than anything this file would substitute.
 */
export function operatorRefusal(text: string | null | undefined): string | null {
  if (!text) return null;
  if (/npm run ebay:signin/i.test(text)) {
    return /stale|old enough|expired/i.test(text) ? EBAY_SIGNIN_STALE : EBAY_SIGNIN_REFUSAL;
  }
  return text;
}
