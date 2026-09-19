/**
 * The conversation a reply is being written into.
 *
 * On a live session the context is the last ninety seconds and the transcript
 * panel is the right shape for it: the host is talking, and the comment before
 * this one is its only neighbour. None of that survives the move to a
 * subreddit, where a comment lands under an opening post and a branch written
 * over three days by people who disagree with each other. "The last ninety
 * seconds" is an empty window there, and a draft written without the branch
 * answers the words rather than the conversation — which reads, correctly, as
 * a bot.
 *
 * So this panel takes the transcript's place wherever the tempo is async. The
 * rules of the room sit at the bottom under their own heading, because they are
 * a CONSTRAINT on the reply and never a fact to answer from, and a rule chip
 * mixed in with the evidence chips is exactly how that mistake gets made.
 */

import { MessageSquareQuote, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import type { ThreadContext } from "@/lib/types";
import { Hover, SectionHeader } from "./primitives";

export function ThreadPanel({
  thread,
  room,
  className,
}: {
  thread: ThreadContext | null | undefined;
  /** The room the session is in, for the header when no thread is focused yet. */
  room?: string | null;
  className?: string;
}) {
  const label = thread?.room || room || null;
  const ancestors = thread?.ancestors ?? [];
  const rules = thread?.rules ?? [];

  return (
    <section className={cn("flex min-h-0 flex-1 flex-col bg-panel", className)}>
      <SectionHeader title="Thread">
        {label ? <span className="num truncate text-[11px] text-text-muted">{label}</span> : null}
        {ancestors.length ? (
          <span className="num shrink-0 text-[11px] text-text-faint">{ancestors.length} above</span>
        ) : null}
      </SectionHeader>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {!thread ? (
          // Two different facts, and they are not the same empty state: nothing
          // focused yet, versus a surface that gives us no thread at all.
          <p className="py-3 text-[12px] text-text-muted">
            Focus a proposal to read the post it answers and the branch above it.
          </p>
        ) : ancestors.length === 0 ? (
          <p className="py-3 text-[12px] text-text-muted">
            This is the opening post — nothing above it.
          </p>
        ) : (
          <ol className="flex flex-col gap-2 py-2">
            {ancestors.map((a, i) => (
              <li
                key={`${a.author}-${a.at}-${i}`}
                className={cn(
                  "border-l-2 pl-2.5",
                  // The opening post is the one that frames everything below
                  // it, so it keeps its weight while the branch recedes.
                  i === 0 ? "border-accent/50" : "border-hairline-strong",
                )}
              >
                <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <MessageSquareQuote className="size-3" aria-hidden />
                  {a.author}
                  {i === 0 ? <span className="text-text-faint">opening post</span> : null}
                  <span className="num ml-auto text-text-faint">{a.at ? timeAgo(a.at) : ""}</span>
                </span>
                <p
                  className={cn(
                    "mt-0.5 leading-snug whitespace-pre-wrap",
                    i === 0 ? "text-[12.5px] text-text-secondary" : "text-[12px] text-text-muted",
                  )}
                >
                  {a.text}
                </p>
              </li>
            ))}
          </ol>
        )}

        {thread?.summary ? (
          <p className="mt-2 rounded-sm bg-elevated px-2.5 py-2 text-[12px] leading-snug text-text-secondary">
            {thread.summary}
          </p>
        ) : null}

        {rules.length ? (
          <div className="mt-3">
            <div className="section-header flex items-center gap-1.5">
              <Scale className="size-3" aria-hidden />
              rules of the room
            </div>
            <p className="mt-1 text-[11px] leading-snug text-text-faint">
              Constraints on the reply, never facts to answer from.
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {rules.map((r) => (
                <li key={r.factId}>
                  <Hover
                    panelClassName="w-80"
                    content={
                      <div className="space-y-1.5">
                        <div className="text-text">{r.text}</div>
                        <div className="num text-[11px] text-text-muted">{r.factId}</div>
                      </div>
                    }
                  >
                    <span
                      tabIndex={0}
                      className="inline-flex items-center gap-1 rounded-[4px] border border-hairline-strong bg-canvas px-1.5 py-0.5 text-[11px] text-text-secondary hover:border-accent hover:text-text"
                    >
                      {r.label}
                    </span>
                  </Hover>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
