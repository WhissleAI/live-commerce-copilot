import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";
import { Hover, IntentBadge, SectionHeader } from "./primitives";

export function ChatColumn({
  chat,
  onInject,
  onHoverProposal,
  linkedProposalIds,
}: {
  chat: ChatMessage[];
  onInject: (text: string) => void;
  onHoverProposal: (id: string | null) => void;
  linkedProposalIds: Set<string>;
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
    <section className="flex min-h-0 flex-col border-r border-hairline bg-panel">
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
                    "anim-in flex items-start gap-2 px-3 py-1 hover:bg-elevated/60",
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
                  {m.intent ? <IntentBadge intent={m.intent} animate /> : null}
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

      <form
        className="flex items-center gap-1 border-t border-hairline p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onInject(draft.trim());
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Inject a buyer message…"
          aria-label="Inject a buyer message"
          className="h-7 min-w-0 flex-1 rounded-[4px] border border-hairline bg-canvas px-2 text-[12px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Inject message"
          className="grid size-7 shrink-0 place-items-center rounded-[4px] border border-hairline-strong text-text-secondary hover:border-accent hover:text-accent"
        >
          <Send className="size-3.5" aria-hidden />
        </button>
      </form>
    </section>
  );
}
