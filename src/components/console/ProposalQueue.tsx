import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  FileText,
  Gavel,
  LineChart,
  MessageSquareQuote,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GUARD_LABEL, GUARD_ORDER, formatMs, timeAgo } from "@/lib/format";
import type { Evidence, GuardResult, ReplyProposal } from "@/lib/types";
import { ConsoleButton, Dots, Hover, IntentBadge, Kbd, SectionHeader } from "./primitives";

const SOURCE_ICON = {
  listing: Tag,
  policy: BookOpen,
  catalog: FileText,
  qa: Gavel,
  market: LineChart,
} as const;

function EvidenceChips({ evidence }: { evidence: Evidence[] }) {
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
        const Icon = SOURCE_ICON[e.source];
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

function GuardStrip({ guards }: { guards: GuardResult[] }) {
  return (
    <div className="flex flex-wrap gap-1" role="list" aria-label="Guardrail results">
      {GUARD_ORDER.map((name) => {
        const g = guards.find((x) => x.guard === name);
        const verdict = g?.verdict ?? "n/a";
        const tone =
          verdict === "allow"
            ? "border-ok/45 bg-ok/12 text-ok"
            : verdict === "revise"
              ? "border-warn/45 bg-warn/12 text-warn"
              : verdict === "block"
                ? "border-bad/50 bg-bad/12 text-bad"
                : "border-hairline-strong bg-canvas text-text-muted";
        const mark = verdict === "allow" ? "✓" : verdict === "revise" ? "!" : verdict === "block" ? "✕" : "–";
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
                "inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px]",
                tone,
              )}
            >
              <span className="num">{mark}</span>
              {GUARD_LABEL[name]}
            </span>
          </Hover>
        );
      })}
    </div>
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

function SentLine({ p }: { p: ReplyProposal }) {
  return (
    <li className="anim-in flex items-center gap-2 border-b border-hairline px-3 py-1.5 text-[12px]">
      <Check className="size-3.5 shrink-0 text-ok" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-text-secondary">
        {p.sentText ?? p.draft}
      </span>
      {p.status === "auto_sent" ? (
        <span className="rounded-[4px] border border-accent/40 px-1 text-[10px] text-accent">
          auto
        </span>
      ) : null}
      <span className="num shrink-0 text-[11px] text-text-muted">{formatMs(p.spans.totalMs)}</span>
    </li>
  );
}

function ProposalCard({
  p,
  focused,
  highlighted,
  editing,
  onFocus,
  onSend,
  onEdit,
  onCancelEdit,
  onDismiss,
  onRegenerate,
}: {
  p: ReplyProposal;
  focused: boolean;
  highlighted: boolean;
  editing: boolean;
  onFocus: () => void;
  onSend: (text?: string) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDismiss: () => void;
  onRegenerate: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(p.draft);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest" });
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

  return (
    <li
      ref={ref}
      onClick={onFocus}
      className={cn(
        "anim-in relative rounded-md border bg-panel transition-colors duration-150 ease-out",
        focused
          ? "border-accent bg-elevated ring-2 ring-accent"
          : "border-hairline hover:border-hairline-strong",
        highlighted && !focused && "border-accent/60",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] rounded-l-md",
          blocked ? "bg-bad" : needsReview ? "bg-warn" : "bg-transparent",
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
          <Confidence value={p.confidence} />
          <span
            className={cn(
              "num text-[11px]",
              p.spans.overBudget ? "text-bad" : "text-text-muted",
            )}
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
            {blocked && blockingGuard ? (
              <p className="flex items-start gap-1.5 rounded-[4px] border border-bad/40 bg-bad/8 px-2 py-1.5 text-[12px] text-bad">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Blocked by the <strong>{GUARD_LABEL[blockingGuard.guard]}</strong> guard —{" "}
                  {blockingGuard.reason}
                  {blockingGuard.detail ? (
                    <span className="num block pt-0.5 text-[11px] text-text-secondary">
                      expected {blockingGuard.detail.expected} · found {blockingGuard.detail.found}
                    </span>
                  ) : null}
                </span>
              </p>
            ) : null}

            <EvidenceChips evidence={p.evidence} />
            <GuardStrip guards={p.guards} />

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {blocked ? null : (
                <ConsoleButton
                  variant={needsReview ? "secondary" : "primary"}
                  onClick={() => onSend(editing ? value : undefined)}
                >
                  {needsReview ? "Send anyway" : "Send"}
                  <Kbd className={needsReview ? "" : "border-accent-foreground/40 bg-transparent text-accent-foreground/80"}>
                    ⏎
                  </Kbd>
                </ConsoleButton>
              )}
              <ConsoleButton variant="secondary" onClick={editing ? onCancelEdit : onEdit}>
                {editing ? "Cancel" : "Edit"}
                <Kbd>{editing ? "esc" : "E"}</Kbd>
              </ConsoleButton>
              <ConsoleButton variant="ghost" onClick={onDismiss}>
                Dismiss <Kbd>X</Kbd>
              </ConsoleButton>
              {blocked ? null : (
                <ConsoleButton variant="ghost" onClick={onRegenerate}>
                  Regenerate <Kbd>R</Kbd>
                </ConsoleButton>
              )}
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
  onEdit,
  onCancelEdit,
  onDismiss,
  onRegenerate,
}: {
  live: ReplyProposal[];
  recent: ReplyProposal[];
  focusedId: string | null;
  editingId: string | null;
  highlightedId: string | null;
  onFocus: (id: string) => void;
  onSend: (id: string, text?: string) => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDismiss: (id: string) => void;
  onRegenerate: (id: string) => void;
}) {
  const awaiting = live.filter((p) => p.status !== "drafting").length;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-canvas">
      <SectionHeader title="Proposals">
        <span className="num text-[11px] text-text-secondary">{awaiting} awaiting</span>
        <span className="hidden text-[11px] text-text-muted lg:inline">
          J/K move · Enter send · E edit · X dismiss · R regenerate
        </span>
      </SectionHeader>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        <div aria-live="polite" className="sr-only">
          {live.length} proposals awaiting a decision
        </div>

        {live.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[12px] text-text-muted">
            <span>Listening to chat. Proposals appear here.</span>
            <Dots />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {live.map((p) => (
              <ProposalCard
                key={p.id}
                p={p}
                focused={focusedId === p.id}
                highlighted={highlightedId === p.id}
                editing={editingId === p.id}
                onFocus={() => onFocus(p.id)}
                onSend={(text) => onSend(p.id, text)}
                onEdit={() => onEdit(p.id)}
                onCancelEdit={onCancelEdit}
                onDismiss={() => onDismiss(p.id)}
                onRegenerate={() => onRegenerate(p.id)}
              />
            ))}
          </ul>
        )}

        {recent.length ? (
          <div className="mt-4">
            <div className="section-header mb-1 px-1">Recent</div>
            <ul className="overflow-hidden rounded-md border border-hairline bg-panel">
              {recent.map((p) => (
                <SentLine key={p.id} p={p} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
