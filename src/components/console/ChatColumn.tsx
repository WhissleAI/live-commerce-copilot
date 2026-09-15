import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";
import { Hover, IntentBadge, SectionHeader } from "./primitives";
import { BadgeButton } from "@/components/ui/kit";

export function ChatColumn({
  chat,
  onInject,
  onHoverProposal,
  linkedProposalIds,
  onAnswerDropped,
}: {
  chat: ChatMessage[];
  onInject: (text: string) => void;
  onHoverProposal: (id: string | null) => void;
  linkedProposalIds: Set<string>;
  /** The gate dropped it and the operator disagrees. One show dropped 1,204
   *  messages as reaction; the gate is right about nearly all of them and wrong
   *  about some, and without this it is unarguable rather than merely strict. */
  onAnswerDropped: (messageId: string) => void;
}) {
  const [mode, setMode] = useState<"all" | "admitted">("all");
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => (mode === "admitted" ? chat.filter((m) => m.admitted) : chat),
    [chat, mode],
  );

  const rate = useMemo(() => {
    const cutoff = Date.now() - 60_000;
    return chat.filter((m) => new Date(m.at).getTime() > cutoff).length;
  }, [chat]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pinnedToBottom) {
      el.scrollTop = el.scrollHeight;
      setUnseen(0);
    } else {
      setUnseen((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setPinnedToBottom(atBottom);
    if (atBottom) setUnseen(0);
  };

  const jumpDown = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setPinnedToBottom(true);
    setUnseen(0);
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel">
      <SectionHeader title="Buyer chat">
        <span className="num text-[11px] text-text-muted">{rate}/min</span>
        <div className="flex overflow-hidden rounded-[4px] border border-hairline-strong">
          {(["all", "admitted"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "h-5 px-1.5 text-[10px] capitalize transition-colors duration-150",
                mode === m ? "bg-elevated text-text" : "text-text-muted hover:text-text",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </SectionHeader>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="scroll-thin absolute inset-0 overflow-y-auto"
        >
          <ul className="flex flex-col justify-end py-1">
            {visible.map((m) => {
              const linked = m.proposalId && linkedProposalIds.has(m.proposalId);
              const row = (
                <li
                  key={m.id}
                  onMouseEnter={() => (linked ? onHoverProposal(m.proposalId!) : undefined)}
                  onMouseLeave={() => onHoverProposal(null)}
                  className={cn(
                    "anim-in group flex items-start gap-2 px-3 py-1.5 hover:bg-elevated/60",
                    linked && "border-l-2 border-accent pl-[10px]",
                    !m.admitted && "opacity-45",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-medium text-accent">
                      {!m.admitted ? <span className="text-text-muted">· </span> : null}
                      {m.author}
                    </span>{" "}
                    <span className="text-[12px] break-words text-text">{m.text}</span>
                  </div>
                  {!m.admitted ? (
                    <BadgeButton
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      title="Draft a reply anyway — the gate dropped this one"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onAnswerDropped(m.id);
                      }}
                    >
                      answer
                    </BadgeButton>
                  ) : null}
                  {m.intent ? (
                    <IntentBadge
                      intent={m.intent}
                      speechAct={m.speechAct}
                      dropReason={m.dropReason}
                      animate
                    />
                  ) : null}
                </li>
              );
              return m.admitted ? (
                row
              ) : (
                <Hover
                  key={m.id}
                  className="block w-full"
                  panelClassName="w-56"
                  content={
                    <span>
                      Not admitted — <span className="text-text">{m.dropReason ?? "filtered"}</span>
                    </span>
                  }
                >
                  <span className="block w-full">{row}</span>
                </Hover>
              );
            })}
          </ul>
        </div>

        {unseen > 0 && !pinnedToBottom ? (
          <button
            type="button"
            onClick={jumpDown}
            className="anim-in absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-accent bg-elevated px-2 py-1 text-[11px] text-accent"
          >
            <ArrowDown className="size-3" aria-hidden />
            <span className="num">{unseen}</span> new
          </button>
        ) : null}
      </div>

      {/* The "inject a buyer message" box lived here. It is a test affordance —
          a way to fake a comment — and on a real show it occupied permanent
          space in the narrowest column to do something the operator never wants
          to do while a stranger's buyers are actually typing. It is still on the
          API (`POST /api/chat/inject`) for demos and the walkthrough. */}
    </section>
  );
}
