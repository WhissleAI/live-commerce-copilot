import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  LineChart,
  MessageSquareQuote,
  Mic,
  PenLine,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GUARD_LABEL, GUARD_MEANS, GUARD_ORDER, formatMs, timeAgo } from "@/lib/format";
import { deliveryOf } from "@/lib/surfaces";
import type { Evidence, GuardName, GuardResult, ReplyProposal } from "@/lib/types";
import { ConsoleButton, Dots, Hover, IntentBadge, Kbd, SectionHeader } from "./primitives";
import {
  Badge,
  BadgeButton,
  GUARD_MARK,
  GUARD_PILL_CLASS,
  VERDICT_WORD,
} from "@/components/ui/kit";

const SOURCE_ICON: Record<Evidence["source"], typeof Tag> = {
  listing: Tag,
  policy: BookOpen,
  catalog: FileText,
  qa: Gavel,
  market: LineChart,
  host: Mic,
  // The operator's own past sends. A pen, not a tag: it is how something was
  // said, never what is true.
  persona: PenLine,
};

/** The facts an answer stands on, as chips. Exported because a draft on a
 *  surface we do not post to carries exactly the same citations, and drawing
 *  them a second way would be the copy-paste divergence `kit.tsx` exists to
 *  stop. */
export function EvidenceChips({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-[4px] border border-hairline-strong px-1.5 py-0.5 text-[11px] text-text-muted">
        <ShieldAlert className="size-3" aria-hidden />
        No grounding facts — abstained
      </span>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {evidence.map((e) => {
        // A source this build has never heard of still gets a chip.
        const Icon = SOURCE_ICON[e.source] ?? FileText;
        return (
          <Hover
            key={e.factId}
            panelClassName="w-80"
            content={
              <div className="space-y-1.5">
                <div className="text-text">{e.text}</div>
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span className="num">{e.factId}</span>
                  <span className="num">score {e.score.toFixed(2)}</span>
                </div>
                {e.listingVersion !== undefined ? (
                  <div className="num text-[11px] text-text-muted">v{e.listingVersion}</div>
                ) : null}
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    View on eBay <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </div>
            }
          >
            <span
              tabIndex={0}
              className="inline-flex items-center gap-1 rounded-[4px] border border-hairline-strong bg-canvas px-1.5 py-0.5 text-[11px] text-text-secondary hover:border-accent hover:text-text"
            >
              <Icon className="size-3 text-text-muted" aria-hidden />
              {e.label}
            </span>
          </Hover>
        );
      })}
    </div>
  );
}

/**
 * The guards, in order, with `–` explicitly not a failure.
 *
 * `order` is the surface's own list: the base six everywhere, plus the room-rule
 * and sponsor guards only where the surface actually has them. Rendering two
 * permanent `–` pills on every eBay Live card would be a regression dressed as
 * a feature.
 */
function GuardStrip({ guards, order }: { guards: GuardResult[]; order: GuardName[] }) {
  return (
    <div className="flex flex-wrap gap-1" role="list" aria-label="Guardrail results">
      {order.map((name) => {
        const g = guards.find((x) => x.guard === name);
        const verdict = g?.verdict ?? "n/a";
        // CONTENT-42: these were hand-rolled copies of `kit.tsx`'s pill with
        // the pre-darkening colours, on the one element the stylesheet calls
        // "the whole signal".
        const tone = GUARD_PILL_CLASS[verdict];
        const mark = GUARD_MARK[verdict];
        return (
          <Hover
            key={name}
            panelClassName="w-72"
            content={
              <div className="space-y-1">
                <div className="text-text">
                  {GUARD_LABEL[name]} · {verdict}
                </div>
                <div>{g?.reason ?? "This guard did not apply to this reply."}</div>
                {/* What it checks, for the operator who has not met this guard
                    before. Below the verdict, never instead of it. */}
                <div className="border-t border-hairline pt-1 text-[11px] text-text-muted">
                  {GUARD_MEANS[name]}
                </div>
                {g?.detail ? (
                  <div className="num space-y-0.5 border-t border-hairline pt-1 text-[11px]">
                    {g.detail.expected ? (
                      <div>
                        expected <span className="text-ok">{g.detail.expected}</span>
                      </div>
                    ) : null}
                    {g.detail.found ? (
                      <div>
                        found <span className="text-bad">{g.detail.found}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            }
          >
            <span
              tabIndex={0}
              role="listitem"
              className={cn(
                "inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px]",
                tone,
              )}
            >
              <span className="num" aria-hidden>
                {mark}
              </span>
              <span aria-hidden>{GUARD_LABEL[name]}</span>
              {/* CONTENT-38. This announced "✕ price" and nothing else: the
                  verdict, the reason and the expected/found detail were all
                  inside a hover panel with no `aria-describedby` pointing at
                  it. On the one screen the product exists for, a blocked
                  reply could not be understood without a mouse. */}
              <span className="sr-only">
                {GUARD_LABEL[name]} {VERDICT_WORD[verdict]}. {g?.reason ?? GUARD_MEANS[name]}
                {g?.detail?.expected || g?.detail?.found
                  ? ` Expected ${g.detail.expected ?? "—"}, found ${g.detail.found ?? "—"}.`
                  : ""}
              </span>
            </span>
          </Hover>
        );
      })}
    </div>
  );
}

/**
 * How the operator answered this before.
 *
 * A style reference is never grounding — it says nothing about whether the
 * reply is TRUE — so it is rendered muted, after the guards, and it never wears
 * a pill. The guard row is the reply's receipt and nothing quiet is allowed to
 * compete with it.
 */
export function StyleRef({ styleRef }: { styleRef: ReplyProposal["styleRef"] | undefined }) {
  if (!styleRef?.text) return null;
  // The server phrases the WHEN — "Your own words · March 2026". Take its
  // wording rather than re-deriving a month from a timestamp that may not be
  // there, and drop its prefix, because this line already says whose words
  // these are.
  const when =
    styleRef.label?.replace(/^\s*your own words\s*[·:-]\s*/i, "").trim() ||
    (styleRef.at ? new Date(styleRef.at).toLocaleDateString(undefined, { month: "long" }) : null);
  return (
    <Hover
      panelClassName="w-80"
      content={
        <div className="space-y-1.5">
          <div className="text-text">{styleRef.text}</div>
          <div className="num text-[11px] text-text-muted">{styleRef.factId}</div>
          <div className="text-[11px] text-text-muted">
            Your own wording, used as a style reference. It grounds nothing — no claim in this reply
            stands on it.
          </div>
        </div>
      }
    >
      <span
        tabIndex={0}
        className="inline-flex items-center gap-1.5 text-[11px] text-text-faint hover:text-text-muted"
      >
        <PenLine className="size-3" aria-hidden />
        written the way you answered this{when ? ` in ${when}` : " before"}
      </span>
    </Hover>
  );
}

/**
 * Taking the reply.
 *
 * CONTENT-19 made this render on every surface rather than only the draft-only
 * ones, because nothing is delivered anywhere: `send()` re-checks the draft,
 * records it and writes it into the audit chain, and no code path posts a
 * character to any platform. So the copy is the operator's real next step.
 *
 * `onCopied` is what makes it more than a clipboard button. Where the reply is
 * the operator's to post, copying it IS accepting it — it is the moment they
 * take the words — so the copy records it through the same endpoint the Send
 * button uses, and the reply stops being an open proposal. Until this existed,
 * the only control offered on those surfaces never called the API at all, so
 * the answered-rate, the audit chain and the Recent list all had nothing to
 * say about a reply the operator had actually used.
 *
 * It records only after the clipboard ACCEPTED the text. A copy the browser
 * refused (an insecure origin, a denied permission) leaves the operator with
 * nothing in hand, and recording "I took this" on top of that would be the
 * same false statement in a smaller place.
 */
function CopyDraft({
  text,
  variant = "primary",
  onCopied,
}: {
  text: string;
  variant?: "primary" | "secondary";
  /** Called once the text is really on the clipboard. Absent where the reply
   *  is ours to deliver: there, Send is the accept and a copy is a copy. */
  onCopied?: (() => void) | undefined;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <ConsoleButton
      variant={variant}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setState("copied");
            onCopied?.();
          })
          .catch(() => setState("failed"));
        if (!navigator.clipboard) setState("failed");
        window.setTimeout(() => setState("idle"), 2000);
      }}
      title={
        onCopied
          ? "The reply is yours to post — copying it records that you took it"
          : "Put the reply on the clipboard"
      }
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Could not copy" : "Copy"}
    </ConsoleButton>
  );
}

function Confidence({ value }: { value: number }) {
  const filled = value > 0.8 ? 3 : value > 0.6 ? 2 : 1;
  const tone = filled === 3 ? "bg-ok" : filled === 2 ? "bg-warn" : "bg-bad";
  return (
    <span className="flex items-center gap-1" aria-label={`confidence ${value.toFixed(2)}`}>
      <span className="num text-[11px] text-text-secondary">{value.toFixed(2)}</span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-2 w-1 rounded-[1px]", i < filled ? tone : "bg-hairline")}
          />
        ))}
      </span>
    </span>
  );
}

function SentLine({ p, onFlag }: { p: ReplyProposal; onFlag: (reason: string) => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <li className="anim-in flex flex-col gap-1.5 px-3 py-2 text-[12px] shadow-[0_1px_0_var(--hairline)] last:shadow-none">
      <div className="flex items-center gap-2">
        <Check className="size-3.5 shrink-0 text-ok" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-text-secondary">{p.sentText ?? p.draft}</span>
        {p.status === "auto_sent" ? <Badge tone="accent">auto</Badge> : null}
        <BadgeButton
          onClick={() => setAsking((v) => !v)}
          title="Mark this reply wrong — the one number the report cannot measure on its own"
        >
          wrong?
        </BadgeButton>
        <span className="num shrink-0 text-[11px] text-text-muted">
          {formatMs(p.spans.totalMs)}
        </span>
      </div>

      {/* Why it was wrong IS the eval case: "wrong fact" and "should have
          abstained" are different failures that get fixed in different places. */}
      {asking ? (
        <div className="anim-in flex flex-wrap items-center gap-1.5 pl-5">
          {["wrong fact", "out of date", "wrong lot", "tone", "should have abstained"].map((r) => (
            <BadgeButton
              key={r}
              tone="bad"
              onClick={() => {
                onFlag(r);
                setAsking(false);
              }}
            >
              {r}
            </BadgeButton>
          ))}
          <BadgeButton onClick={() => setAsking(false)}>cancel</BadgeButton>
        </div>
      ) : null}
    </li>
  );
}

function ProposalCard({
  p,
  focused,
  highlighted,
  editing,
  guardOrder,
  onFocus,
  onSend,
  onCopy,
  onEdit,
  onCancelEdit,
  onDismiss,
  onRegenerate,
  onInspect,
}: {
  p: ReplyProposal;
  focused: boolean;
  highlighted: boolean;
  editing: boolean;
  guardOrder: GuardName[];
  onFocus: () => void;
  onSend: (text?: string) => void;
  /** The operator took the words. Only offered where the reply is theirs to
   *  post; see `CopyDraft`. */
  onCopy: (text?: string) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDismiss: () => void;
  onRegenerate: () => void;
  onInspect: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(p.draft);

  useEffect(() => {
    if (!focused) return;
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
    // J/K used to move a ring and nothing else: `aria-current` was set on a
    // card no screen reader was ever told about, because focus stayed on
    // <body>. Move focus with the highlight — unless the operator is already
    // inside this card, where taking it back would undo their click.
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [focused]);

  useEffect(() => {
    if (editing) {
      setValue(p.draft);
      const t = textRef.current;
      if (t) {
        t.focus();
        t.setSelectionRange(t.value.length, t.value.length);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const drafting = p.status === "drafting";
  const blocked = p.status === "blocked";
  const needsReview = p.status === "needs_review";
  const blockingGuard = p.guards.find((g) => g.verdict === "block");
  /** The guard that asked for a revision — `needs_review`'s equivalent of the
   *  one that blocked, and the only one with anything to say about why the
   *  draft is on this card rather than sendable outright. */
  const revisingGuard = p.guards.find((g) => g.verdict === "revise");
  /**
   * Who sends this one — the server's answer, on this proposal.
   *
   * Not the surface's capability row. The row is what a platform would permit;
   * this is what the backend will actually do, having also asked whether a
   * delivery path is wired into the process that drafted it. They disagree on
   * every surface in the build today, and the console rendered a Send button
   * and a "Reply sent" toast off the optimistic half of the disagreement.
   */
  const delivers = deliveryOf(p) === "api";

  return (
    <li
      ref={ref}
      onClick={onFocus}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === " ") {
          e.preventDefault();
          onFocus();
        }
      }}
      aria-current={focused ? "true" : undefined}
      className={cn(
        "anim-in relative rounded-md border bg-panel transition-colors duration-150 ease-out",
        focused
          ? "border-accent bg-elevated ring-2 ring-accent"
          : "border-hairline hover:border-hairline-strong",
        highlighted && !focused && "border-accent/60",
      )}
    >
      {/* A held reply is a guard doing its job, not a failure: amber, not red.
          Red stays for a draft that genuinely errored. */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] rounded-l-md",
          blocked ? "bg-warn" : needsReview ? "bg-warn" : "bg-transparent",
        )}
        aria-hidden
      />

      <div className="flex items-center gap-2 border-b border-hairline px-3 py-1.5">
        <span className="num text-[11px] text-text-muted">{timeAgo(p.message.at)}</span>
        {p.message.intent ? <IntentBadge intent={p.message.intent} /> : null}
        {p.repaired ? (
          <Hover
            panelClassName="w-72"
            content="First draft failed a guardrail and was re-grounded before you saw it."
          >
            <span
              tabIndex={0}
              className="rounded-[4px] border border-warn/45 bg-warn/12 px-1.5 text-[10px] text-warn"
            >
              repaired
            </span>
          </Hover>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          {/* The hovers stay: they are the peek. This is where the whole story
              of one reply opens, in the one panel the shell reserves for it. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
            title="Why this reply — evidence, every guard, where the time went (I)"
            aria-label="Inspect this reply"
            className="text-text-muted hover:text-text"
          >
            <Info className="size-3.5" aria-hidden />
          </button>
          <Confidence value={p.confidence} />
          <span
            className={cn("num text-[11px]", p.spans.overBudget ? "text-bad" : "text-text-muted")}
          >
            {formatMs(p.spans.totalMs)}
          </span>
        </span>
      </div>

      {drafting ? (
        <div className="h-0.5 overflow-hidden bg-hairline">
          <div className="anim-indeterminate h-full w-1/3 bg-accent" />
        </div>
      ) : null}

      <div className="space-y-2.5 p-3">
        <blockquote className="border-l-2 border-hairline-strong pl-2.5">
          <span className="flex items-center gap-1 text-[11px] text-text-muted">
            <MessageSquareQuote className="size-3" aria-hidden />
            {p.message.author}
          </span>
          <p className="text-[12px] text-text-secondary">{p.message.text}</p>
        </blockquote>

        {editing ? (
          <textarea
            ref={textRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onCancelEdit();
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                // Unconditionally, held card included. An edit is a NEW draft
                // and is judged on its own words: the server re-guards what
                // was typed here and refuses with the guard's own reason if it
                // still fails (`Pipeline.send`, backend
                // `src/pipeline/pipeline.ts`). Gating the keystroke on the
                // verdict the REPLACED text earned is what made the card's own
                // instruction — "edit it and send" — impossible to follow.
                onSend(value);
              }
            }}
            rows={3}
            aria-label="Edit reply"
            className="w-full resize-y rounded-[4px] border border-accent bg-canvas p-2 text-[14px] text-text focus:outline-none"
          />
        ) : (
          <p
            className={cn(
              "text-[14px] leading-snug",
              blocked ? "text-text-muted line-through" : "text-text",
            )}
          >
            {p.draft}
            {drafting ? (
              <span className="anim-live ml-0.5 inline-block h-[15px] w-[7px] translate-y-[2px] bg-accent" />
            ) : null}
          </p>
        )}

        {!drafting ? (
          <>
            {/* Why this card is not simply sendable.
                Two states, one panel, and `needs_review` had only a stripe:
                it is the common one — a guard asking for a revision, a repair
                pass that did not fully clear — and an amber edge with no words
                beside it leaves the operator to guess which of eight checks
                spoke and what it said. Both read the SERVER's reason; neither
                invents one. */}
            {blocked || needsReview ? (
              <div className="flex items-start gap-2 rounded-[4px] border border-warn/40 bg-warn/[0.07] px-2.5 py-2 text-[12px]">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-text">
                    {blocked ? (
                      <>
                        Held by the {blockingGuard ? GUARD_LABEL[blockingGuard.guard] : "guardrail"}{" "}
                        guard
                      </>
                    ) : revisingGuard ? (
                      <>The {GUARD_LABEL[revisingGuard.guard]} guard asked for a revision</>
                    ) : (
                      <>Needs your eyes before it goes out</>
                    )}
                  </p>
                  <p className="mt-0.5 leading-snug text-text-secondary">
                    {(blocked ? blockingGuard : revisingGuard)?.reason ??
                      (blocked
                        ? "This draft did not pass the checks a reply must pass before it can be sent."
                        : "No guard gave a reason — this one was not cleared to go out on its own.")}
                  </p>
                  {(blocked ? blockingGuard : revisingGuard)?.detail ? (
                    <p className="num mt-0.5 text-[11px] text-text-muted">
                      expected {(blocked ? blockingGuard : revisingGuard)?.detail?.expected} · found{" "}
                      {(blocked ? blockingGuard : revisingGuard)?.detail?.found}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-text-muted">
                    {blocked
                      ? "What to do: edit it and send — your edit is a new draft and is checked again, on its own words — or dismiss it. Nothing went wrong; this one was stopped on purpose."
                      : "What to do: take it as it stands, edit it first, or regenerate. Nothing is blocked here — the reply is yours to decide on."}
                  </p>
                </div>
              </div>
            ) : null}

            <EvidenceChips evidence={p.evidence} />
            <GuardStrip guards={p.guards} order={guardOrder} />
            <StyleRef styleRef={p.styleRef} />

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {/* Accepting it.
                  A held draft cannot go out AS IT STANDS, and the server is
                  where that refusal lives — a keystroke and a curl are not
                  this console. But an edit is a new draft: while the operator
                  is rewriting a held card the accept control comes back, as a
                  secondary, and the server judges what they typed. Hiding it
                  here was the last of the three locks that made the card's own
                  instruction impossible to follow. */}
              {blocked && !editing ? null : delivers ? (
                <ConsoleButton
                  variant={blocked || needsReview ? "secondary" : "primary"}
                  onClick={() => onSend(editing ? value : undefined)}
                >
                  {blocked ? "Send edit" : needsReview ? "Send anyway" : "Send"}
                  {/* Bare ⏎ does not send a held card — it says what to do
                      instead — so the key is only claimed where it works. */}
                  {blocked ? null : (
                    <Kbd
                      className={
                        needsReview
                          ? ""
                          : "border-accent-foreground/40 bg-transparent text-accent-foreground/80"
                      }
                    >
                      ⏎
                    </Kbd>
                  )}
                </ConsoleButton>
              ) : null}
              {blocked && !editing ? null : (
                <CopyDraft
                  text={editing ? value : p.draft}
                  variant={delivers ? "secondary" : "primary"}
                  onCopied={delivers ? undefined : () => onCopy(editing ? value : undefined)}
                />
              )}
              <ConsoleButton variant="secondary" onClick={editing ? onCancelEdit : onEdit}>
                {editing ? "Cancel" : "Edit"}
                <Kbd>{editing ? "esc" : "E"}</Kbd>
              </ConsoleButton>
              <ConsoleButton variant="ghost" onClick={onDismiss}>
                Dismiss <Kbd>X</Kbd>
              </ConsoleButton>
              {/* Regenerate was hidden on a held card by this console alone:
                  `POST /api/proposals/:id/regenerate` has never once looked at
                  the verdict (backend `src/api/routes.ts`), and asking for
                  another draft is the obvious move when the guards refused the
                  first one. */}
              <ConsoleButton variant="ghost" onClick={onRegenerate}>
                Regenerate <Kbd>R</Kbd>
              </ConsoleButton>
            </div>
          </>
        ) : null}
      </div>
    </li>
  );
}

export function ProposalQueue({
  live,
  recent,
  focusedId,
  editingId,
  highlightedId,
  onFocus,
  onSend,
  onCopy,
  onEdit,
  onCancelEdit,
  onDismiss,
  onRegenerate,
  onFlag,
  onInspect,
  leading,
  trailing,
  guardOrder = GUARD_ORDER,
}: {
  live: ReplyProposal[];
  recent: ReplyProposal[];
  focusedId: string | null;
  editingId: string | null;
  highlightedId: string | null;
  onFocus: (id: string) => void;
  onSend: (id: string, text?: string) => void;
  /** The operator copied the reply on a surface where that is how it goes out.
   *  Recorded through the same endpoint Send uses — see `CopyDraft`. */
  onCopy: (id: string, text?: string) => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDismiss: (id: string) => void;
  onRegenerate: (id: string) => void;
  /** The PRD's unmeasurable metric, made measurable by the only person who can
   *  see it. */
  onFlag: (id: string, reason: string) => void;
  /** Opens the shell's inspector on one reply. */
  onInspect: (id: string) => void;
  /** Narrow-layout drawer toggles. They belong in the header row, not floating
   *  over it — an absolutely-positioned button landed on the counts. */
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Which guards this surface runs, in order. The base six by default, which
   *  is every live-commerce surface and every card rendered before surfaces. */
  guardOrder?: GuardName[];
}) {
  const [filter, setFilter] = useState<"all" | "blocked">("all");
  // An abstention is not a suggestion. When retrieval found nothing, the draft
  // is filler — "the host will get to that shortly" — and putting it on a card
  // with a Send button beside real grounded answers is how a queue fills with
  // sixteen things the operator has to read to discover none of them help.
  //
  // They are still SHOWN, because "this was asked and we could not answer it" is
  // the most useful thing in the post-session report and the operator should see
  // it accumulating. Just not as sendable cards.
  const groundless = (p: ReplyProposal) =>
    p.status !== "drafting" && p.evidence.length === 0 && p.confidence < 0.3;
  const answerable = live.filter((p) => !groundless(p));
  const unanswerable = live.filter(groundless);
  const awaiting = answerable.filter((p) => p.status !== "drafting").length;
  const blockedCount = answerable.filter((p) => p.status === "blocked").length;
  const shown =
    filter === "blocked" ? answerable.filter((p) => p.status === "blocked") : answerable;
  // The most recent proposal that has settled into a decidable state. It is
  // what the live region announces — the event, not the count.
  const newest = answerable.find((p) => p.status !== "drafting") ?? null;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-panel">
      <SectionHeader title="Proposals" leading={leading}>
        {/* The counts were already here; making them toggles costs no space and
            gives the operator a blocked-only view during a bad run. */}
        <BadgeButton
          tone={filter === "all" ? "accent" : "neutral"}
          onClick={() => setFilter("all")}
        >
          {awaiting} awaiting
        </BadgeButton>
        {blockedCount > 0 && (
          <BadgeButton
            tone={filter === "blocked" ? "bad" : "neutral"}
            onClick={() => setFilter((f) => (f === "blocked" ? "all" : "blocked"))}
          >
            {blockedCount} blocked
          </BadgeButton>
        )}
        {unanswerable.length > 0 && (
          <Badge title="Asked, but nothing in the catalog could ground an answer. These are the gaps the post-session report lists.">
            {unanswerable.length} unanswerable
          </Badge>
        )}
        {/* The key legend is the first thing to go: below 1360px the counts,
            the Chat toggle and this line no longer fit on one 26px row. */}
        <span className="hidden min-w-0 truncate text-[11px] text-text-muted min-[1360px]:block">
          J/K move · Enter send · E edit · X dismiss · R regenerate
        </span>
        {trailing}
      </SectionHeader>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        {/* CONTENT-39: this announced "{n} proposals awaiting a decision" and
            nothing else — never that a reply had been drafted, never who
            asked, never that one had been blocked. A count is the one fact a
            screen-reader user could already get by reading the list. */}
        <div aria-live="polite" className="sr-only">
          {newest
            ? newest.status === "blocked"
              ? `A reply to ${newest.message.author} was blocked: ${
                  newest.guards.find((g) => g.verdict === "block")?.reason ??
                  "it did not pass the checks a reply must pass"
                }`
              : newest.status === "needs_review"
                ? `A reply to ${newest.message.author} needs review before it can be sent.`
                : `A reply to ${newest.message.author} is ready. ${newest.draft}`
            : ""}
        </div>

        {live.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[12px] text-text-muted">
            <span>Listening to chat. Proposals appear here.</span>
            <Dots />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((p) => (
              <ProposalCard
                key={p.id}
                p={p}
                focused={focusedId === p.id}
                highlighted={highlightedId === p.id}
                editing={editingId === p.id}
                guardOrder={guardOrder}
                onFocus={() => onFocus(p.id)}
                onSend={(text) => onSend(p.id, text)}
                onCopy={(text) => onCopy(p.id, text)}
                onEdit={() => onEdit(p.id)}
                onCancelEdit={onCancelEdit}
                onDismiss={() => onDismiss(p.id)}
                onRegenerate={() => onRegenerate(p.id)}
                onInspect={() => onInspect(p.id)}
              />
            ))}
          </ul>
        )}

        {/* The gaps, compact. Each is a question the catalog could not ground an
            answer for — the list that becomes `gaps.unanswered` in the report and
            the input to the next show's setup. */}
        {unanswerable.length > 0 && (
          <div className="mt-3 rounded-[6px] border border-hairline bg-panel/60 p-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              asked · nothing to ground an answer
            </div>
            <ul className="mt-1 space-y-0.5">
              {unanswerable.slice(-8).map((p) => (
                <li key={p.id} className="flex items-baseline gap-2 text-[11px]">
                  <span className="shrink-0 text-text-muted">{p.message.author}</span>
                  <span className="truncate text-text-secondary">{p.message.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recent.length ? (
          <div className="mt-4">
            <div className="section-header mb-1 px-1">Recent</div>
            <ul className="overflow-hidden rounded-md border border-hairline bg-panel">
              {recent.map((p) => (
                <SentLine key={p.id} p={p} onFlag={(reason) => onFlag(p.id, reason)} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
