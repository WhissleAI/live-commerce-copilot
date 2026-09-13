import { useEffect, useRef } from "react";
import { Mic, MicOff, ExternalLink } from "lucide-react";
import type { ShowContext, TranscriptSegment } from "@/lib/types";

/**
 * What the HOST is saying, live.
 *
 * This is the half of the room the chat cannot tell you. The catalog knows what
 * a card is; it does not know the host just said "this one's a jersey patch,
 * numbered to 25, last one tonight". A buyer who types "is that numbered?" four
 * seconds later is asking about that — so the transcript, and the voice metadata
 * Whissle emits alongside it, feed the same grounding context the replies use.
 */
export function TranscriptPanel({
  transcript,
  context,
  bridgeUrl,
}: {
  transcript: TranscriptSegment[];
  context: ShowContext | null;
  bridgeUrl: string | null;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [transcript.length]);

  const listening = transcript.length > 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-border">
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex items-center gap-2">
          {listening ? (
            <Mic className="h-3.5 w-3.5 text-success" aria-hidden />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          )}
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Host audio
          </span>
        </div>
        {bridgeUrl && (
          <a
            href={bridgeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            {listening ? "bridge" : "start capture"}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </header>

      {/* What the rolling context engine has distilled from the speech. */}
      {context && context.currentTopic && (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <div className="text-[11px] text-muted-foreground">now talking about</div>
          <div className="truncate text-xs text-foreground">{context.currentTopic}</div>
          {context.tone && (
            <span className="mt-1 inline-block rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              tone · {context.tone}
            </span>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {transcript.length === 0 ? (
          <p className="py-4 text-[11px] leading-relaxed text-muted-foreground">
            Not listening yet. Open the bridge, pick the eBay Live tab and tick{" "}
            <strong className="text-foreground">Share tab audio</strong> — the host's speech then
            grounds replies alongside the catalog and the chat.
          </p>
        ) : (
          <ul className="space-y-2">
            {transcript.map((t, i) => (
              <li key={`${t.at}-${i}`} className="text-xs leading-relaxed">
                <p className="text-foreground">{t.text}</p>
                {(t.emotion || t.intent || t.speechRate !== null) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.emotion && <MetaChip label="emotion" value={t.emotion.label} p={t.emotion.p} />}
                    {t.intent && <MetaChip label="intent" value={t.intent.label} p={t.intent.p} />}
                    {t.speechRate !== null && (
                      <MetaChip label="wpm" value={String(Math.round(t.speechRate))} />
                    )}
                  </div>
                )}
              </li>
            ))}
            <div ref={endRef} />
          </ul>
        )}
      </div>
    </section>
  );
}

/** One piece of Whissle voice metadata. Monospace, because the operator is
 *  comparing these across segments, not reading them as prose. */
function MetaChip({ label, value, p }: { label: string; value: string; p?: number | undefined }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
      <span className="opacity-60">{label}</span>
      <span className="text-foreground">{value}</span>
      {typeof p === "number" && <span className="opacity-60">{p.toFixed(2)}</span>}
    </span>
  );
}
