/**
 * Drafts — the one place in this product where a human is the sender.
 *
 * Everywhere else the copilot can deliver: a proposal on the console has a Send
 * button and pressing it posts to eBay. On a `draft-only` surface it cannot,
 * and that is not a configuration or a missing key — Reddit is draft-only in
 * the backend's code, because a copilot that can post to a subreddit on its own
 * is one bug away from being the vendor spam every subreddit has a rule
 * against.
 *
 * Which changes what this screen has to be. A queue of Send buttons is useless
 * here; what the operator needs is everything required to DECIDE, in one place,
 * because the next thing they do is paste it into someone else's website under
 * their own name:
 *
 *   · the thread — the opening post and the branch above the comment, because a
 *     reply that answers the words and not the conversation reads as a bot;
 *   · the draft and its citations, so they know what it is standing on;
 *   · which rules of the room applied, and which rule HELD it, because a rule
 *     that stopped a reply is the reason there is nothing to send and it is
 *     invisible everywhere else;
 *   · Copy, and Mark sent.
 *
 * "Mark sent" is recorded and never inferred. We cannot see the subreddit, so
 * the only honest source for "this went out" is the person who pasted it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  MessageSquareQuote,
  Scale,
  SquarePen,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GUARD_LABEL, timeAgo } from "@/lib/format";
import { capabilitiesOf, guardOrderFor, surfaceLabel } from "@/lib/surfaces";
import type { AppliedRule, HomeDraftCount, SurfaceDraft, SurfaceId } from "@/lib/types";
import { AppShell, type Tab } from "@/components/app/AppShell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  GuardPill,
  SectionHeading,
  Skeleton,
} from "@/components/ui/kit";
import { EvidenceChips, StyleRef } from "@/components/console/ProposalQueue";

export function DraftsPage() {
  const [drafts, setDrafts] = useState<SurfaceDraft[] | null>(null);
  // The server's own count of what is waiting, across the whole account. Not
  // derived from the list below: the list can be filtered and this must not
  // move, and it is built by the same function that answers home — so the
  // number here and the number there are the same number, not two that agree.
  const [waiting, setWaiting] = useState<HomeDraftCount>({ total: 0, bySurface: [] });
  const [error, setError] = useState<string | null>(null);
  const [surface, setSurface] = useState<SurfaceId | "all">("all");

  const load = useCallback(async () => {
    try {
      const queue = await api.drafts();
      setDrafts(queue.drafts);
      setWaiting(queue.waiting);
      setError(null);
    } catch (e) {
      // An endpoint that refused and an account with nothing waiting are
      // different facts. Neither of them is "you have no drafts".
      setError((e as Error).message);
      setDrafts([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = useMemo(
    () => (drafts ?? []).filter((d) => (d.status ?? "open") === "open"),
    [drafts],
  );
  const sent = useMemo(() => (drafts ?? []).filter((d) => d.status === "sent"), [drafts]);
  // A guard held it: there is nothing to send, and it is not waiting on
  // anyone. Carried rather than hidden, because an operator who never sees a
  // held draft concludes the copilot simply did not answer.
  const held = useMemo(() => (drafts ?? []).filter((d) => d.status === "blocked"), [drafts]);

  const shown = surface === "all" ? open : open.filter((d) => d.surface === surface);
  const heldShown = surface === "all" ? held : held.filter((d) => d.surface === surface);

  // One tab per surface that actually has something waiting, counted from the
  // server's queue rather than from the rows on screen. A tab for a surface
  // with nothing in it is a promise of somewhere to go.
  const tabs: Tab[] =
    waiting.bySurface.length > 1
      ? [
          {
            label: "All",
            count: waiting.total,
            active: surface === "all",
            onClick: () => setSurface("all"),
          },
          ...waiting.bySurface.map((s) => ({
            label: surfaceLabel(s.surface),
            count: s.count,
            active: surface === s.surface,
            onClick: () => setSurface(s.surface),
          })),
        ]
      : [];

  const mark = async (d: SurfaceDraft, what: "sent" | "dismissed") => {
    const id = d.id;
    // Optimistic: the row moves the moment it is clicked and comes back if the
    // server disagrees. A list that does not move after "Mark sent" is a list
    // the operator marks twice.
    setDrafts((prev) =>
      (prev ?? []).map((d) =>
        d.id === id
          ? {
              ...d,
              status: what === "sent" ? "sent" : "dismissed",
              sentAt: new Date().toISOString(),
            }
          : d,
      ),
    );
    try {
      if (what === "sent") await api.markDraftSent(id);
      else await api.dismissDraft(id);
    } catch (e) {
      setError((e as Error).message);
      await load();
    }
  };

  return (
    <AppShell
      section="drafts"
      title="Drafts"
      subtitle={
        drafts === null
          ? "reading your drafts…"
          : `${waiting.total} waiting · nothing here is ever posted by us`
      }
      tabs={tabs}
    >
      <SectionHeading hint="These are the surfaces the copilot writes for and does not post to. It reads the thread, drafts a reply against the same guards a live session uses, and stops. You are the sender: copy it, post it under your own name, and mark it sent so the next draft knows this question is answered.">
        Written for you to send
      </SectionHeading>

      {error ? (
        <Card tone="warn" className="mt-3 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
          <span className="text-[12.5px]">{error}</span>
        </Card>
      ) : null}

      <div className="mt-3 flex flex-col gap-2.5">
        {drafts === null ? (
          <>
            <Skeleton className="h-[160px]" />
            <Skeleton className="h-[160px]" />
          </>
        ) : shown.length === 0 ? (
          <Card>
            <EmptyState
              icon={<SquarePen className="size-5" aria-hidden />}
              title="Nothing to send."
            >
              Two things fill this queue. A room you watch — add a subreddit or a channel on
              Rooms — puts a draft here whenever the copilot reads a thread and writes a reply
              for it. And a session that ends leaves one reply per buyer who asked and did not
              buy, re-checked against your knowledge as it stands now. Either way you are the
              sender: Reddit drafts are never posted by us, not as a setting, in the code.
            </EmptyState>
          </Card>
        ) : (
          shown.map((d) => (
            <DraftCard
              key={d.id}
              d={d}
              onSent={() => void mark(d, "sent")}
              onDismiss={() => void mark(d, "dismissed")}
            />
          ))
        )}
      </div>

      {heldShown.length ? (
        <div className="mt-8">
          <SectionHeading hint="A guard stopped these before they were written out, so there is nothing to paste. They are here because a draft that never appears reads as a copilot that had no answer — and the rule that held it is usually the most useful thing on the card.">
            Held by a guard
          </SectionHeading>
          <div className="mt-3 flex flex-col gap-2.5">
            {heldShown.map((d) => (
              <DraftCard
                key={d.id}
                d={d}
                onSent={() => void mark(d, "sent")}
                onDismiss={() => void mark(d, "dismissed")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {sent.length ? (
        <div className="mt-8 mb-10">
          <SectionHeading hint="Marked by you, because nobody else can see it happen. This is what stops the copilot drafting the same answer again.">
            Sent
          </SectionHeading>
          <ul className="mt-3 flex flex-col gap-1.5">
            {sent.slice(0, 20).map((d) => (
              <li key={d.id}>
                <Card className="flex items-center gap-3 px-3 py-2.5">
                  <Check className="size-3.5 shrink-0 text-ok" aria-hidden />
                  <span className="shrink-0 text-[11.5px] text-text-muted">
                    {d.origin?.label ?? d.room}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-secondary">
                    {d.draft}
                  </span>
                  <span className="num shrink-0 text-[11px] text-text-faint">
                    {d.sentAt ? timeAgo(d.sentAt) : ""}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppShell>
  );
}

/** Exported so a spec can drive one card without standing up the shell. */
export function DraftCard({
  d,
  onSent,
  onDismiss,
}: {
  d: SurfaceDraft;
  onSent: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  const [openThread, setOpenThread] = useState(false);
  const caps = capabilitiesOf(d.surface);
  const order = guardOrderFor(caps);
  const ancestors = d.thread?.ancestors ?? [];
  const rules = d.rules ?? [];
  const evidence = d.evidence ?? [];
  const guards = d.guards ?? [];
  const blocking = rules.find((r) => r.effect === "blocked");
  const applied = rules.filter((r) => r.effect === "applied");

  const copy = () => {
    if (!navigator.clipboard) {
      setCopied("failed");
      return;
    }
    void navigator.clipboard
      .writeText(d.draft)
      .then(() => setCopied("ok"))
      .catch(() => setCopied("failed"));
    window.setTimeout(() => setCopied("idle"), 2000);
  };

  return (
    <Card {...(blocking ? { tone: "warn" as const } : {})} className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 shadow-[0_1px_0_var(--hairline)]">
        <Badge>{surfaceLabel(d.surface)}</Badge>
        {/* What a person would say out loud: `r/mechmarket`, or the session's
            own title. The inbox used to print `ebay_47tK1SX0VsiHEXN1` here
            because this client hard-coded the show id as the room; the server
            joins the title and sends both. */}
        <span className="truncate text-[12px] text-text-secondary">
          {d.origin?.label ?? d.room}
        </span>
        <span className="num ml-auto shrink-0 text-[11px] text-text-muted">
          {timeAgo(d.createdAt)}
        </span>
        {/* A follow-up carries no confidence figure — it was written from a
            draft the guards had already cleared. Drawing a 0.00 there would be
            a measurement nobody made. */}
        {d.confidence != null ? (
          <span className="num shrink-0 text-[11px] text-text-muted">
            conf {d.confidence.toFixed(2)}
          </span>
        ) : null}
      </div>

      <div className="space-y-2.5 p-3">
        {/* The comment being answered. */}
        <blockquote className="border-l-2 border-hairline-strong pl-2.5">
          <span className="flex items-center gap-1 text-[11px] text-text-muted">
            <MessageSquareQuote className="size-3" aria-hidden />
            {d.question.author}
            {d.question.url ? (
              <a
                href={d.question.url}
                target="_blank"
                rel="noreferrer"
                className="ml-1 text-accent hover:underline"
              >
                open
              </a>
            ) : null}
          </span>
          <p className="text-[12.5px] leading-snug text-text-secondary">{d.question.text}</p>
        </blockquote>

        {/* The thread above it. Collapsed by default and never hidden: it is
            the difference between answering the words and answering the
            conversation, and it is also the longest thing on the card. */}
        {ancestors.length ? (
          <div>
            <button
              type="button"
              onClick={() => setOpenThread((v) => !v)}
              aria-expanded={openThread}
              className="flex items-center gap-1 text-[11.5px] text-text-muted hover:text-text"
            >
              <ChevronRight
                className={cn("size-3 transition-transform", openThread && "rotate-90")}
                aria-hidden
              />
              {openThread
                ? "Hide the thread"
                : `The thread — opening post and ${ancestors.length - 1} above`}
            </button>
            {openThread ? (
              <ol className="anim-in mt-1.5 flex flex-col gap-1.5 rounded-sm bg-elevated p-2.5">
                {ancestors.map((a, i) => (
                  <li
                    key={`${a.author}-${a.at}-${i}`}
                    className={cn(
                      "border-l-2 pl-2.5",
                      i === 0 ? "border-accent/50" : "border-hairline-strong",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                      {a.author}
                      {i === 0 ? <span className="text-text-faint">opening post</span> : null}
                      <span className="num ml-auto text-text-faint">
                        {a.at ? timeAgo(a.at) : ""}
                      </span>
                    </span>
                    <p className="mt-0.5 text-[12px] leading-snug whitespace-pre-wrap text-text-secondary">
                      {a.text}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : d.thread ? (
          <p className="text-[11.5px] text-text-muted">
            This is the opening post — nothing above it.
          </p>
        ) : null}

        <p
          className={cn(
            "text-[14px] leading-snug",
            blocking ? "text-text-muted line-through" : "text-text",
          )}
        >
          {d.draft}
        </p>

        {/* The citations and the guard row exist where the surface recorded
            them. Where it did not — the follow-up inbox stores only a draft the
            chain had already cleared — the card says that in one line rather
            than drawing six grey pills that would read as "nothing ran".
            Length, not presence: a server that sends `evidence: []` means the
            same thing as one that sends nothing, and an empty rail is furniture
            that looks like a failure. */}
        {evidence.length ? <EvidenceChips evidence={evidence} /> : null}

        {guards.length ? (
          <div className="flex flex-wrap gap-1" role="list" aria-label="Guardrail results">
            {order.map((g) => (
              <GuardPill
                key={g}
                guard={g}
                verdict={guards.find((x) => x.guard === g)?.verdict ?? "n/a"}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11.5px] text-text-muted">
            Written through the same guard chain a live reply passes, against the catalog as it
            stands now. A draft the guards held is never stored here at all.
          </p>
        )}

        <StyleRef styleRef={d.styleRef} />

        <Rules blocking={blocking ?? null} applied={applied} />

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Button variant="primary" onClick={copy}>
            {copied === "ok" ? "Copied" : copied === "failed" ? "Could not copy" : "Copy"}
          </Button>
          <Button variant="secondary" onClick={onSent}>
            <Check className="size-3" aria-hidden /> Mark sent
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
          <span className="ml-auto text-[11px] text-text-muted">We never post this. You do.</span>
        </div>
      </div>
    </Card>
  );
}

/**
 * What the room's rules did to this draft.
 *
 * Two states, not three, and not drawn alike. A rule that BLOCKED is the reason
 * there is nothing to send; the rest are constraints the reply was written
 * under. There used to be a third — the rule an earlier draft tripped and this
 * one clears — with a paragraph of copy behind it. The guard chain never
 * returns a revise verdict, so the repair pass that would have produced an
 * earlier draft is unreachable and the server can never set it. A state the UI
 * renders and the system cannot reach is a promise the UI is making alone.
 */
function Rules({ blocking, applied }: { blocking: AppliedRule | null; applied: AppliedRule[] }) {
  if (!blocking && applied.length === 0) return null;
  return (
    <div className="rounded-sm bg-elevated px-2.5 py-2">
      <div className="section-header flex items-center gap-1.5">
        <Scale className="size-3" aria-hidden />
        rules of the room
      </div>

      {blocking ? (
        <p className="mt-1.5 text-[12px] leading-snug text-warn">
          <span className="font-medium">Held — {blocking.label}.</span>{" "}
          {blocking.reason ?? blocking.text}{" "}
          <span className="num text-[11px] text-text-muted">{blocking.factId}</span>
        </p>
      ) : null}

      {applied.length ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-text-muted">
          Also in force: {applied.map((r) => r.label).join(" · ")}. These are constraints on the
          reply, never facts it answers from.
        </p>
      ) : null}
    </div>
  );
}

/** Exported for the spec: the guard row a draft renders is the surface's own. */
export const draftGuardLabels = (surface: SurfaceId): string[] =>
  guardOrderFor(capabilitiesOf(surface)).map((g) => GUARD_LABEL[g]);
