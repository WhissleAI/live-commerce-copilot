import { useEffect, useRef } from "react";
import { Mic, MicOff, ExternalLink } from "lucide-react";
import type { ShowContext, SignalDistribution, TranscriptSegment } from "@/lib/types";

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
                  <div className="mt-1.5 space-y-1">
                    {t.emotion && <Distribution kind="emotion" d={t.emotion} />}
                    {t.intent && <Distribution kind="intent" d={t.intent} />}
                    {t.speechRate !== null && (
                      <div className="text-[10px] font-mono tabular-nums text-muted-foreground">
                        <span className="opacity-60">wpm </span>
                        <span className="text-foreground">{Math.round(t.speechRate)}</span>
                      </div>
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

/**
 * One Whissle acoustic distribution, rendered as a spread rather than a verdict.
 *
 * The gateway ships emotion and intent as a top-k distribution and says plainly
 * that accuracy on low-arousal states tops out around 63%. A single confident
 * word would be a lie of presentation; the bars let an operator see when the
 * model is genuinely sure versus splitting hairs between two labels.
 *
 * A FLIP — the top read changing — is called out, because that is the thing
 * worth noticing. A needle that twitches is not.
 */
function Distribution({ kind, d }: { kind: string; d: SignalDistribution }) {
  const top = d.topK.slice(0, 3);
  // A near-tie between the top two labels means the head is guessing; say so by
  // dimming the headline rather than asserting it.
  const spread = top.length > 1 ? (top[0]?.p ?? 0) - (top[1]?.p ?? 0) : 1;
  const decisive = spread >= 0.2;

  return (
    <div className="font-mono text-[10px] tabular-nums">
      <div className="flex items-center gap-1.5">
        <span className="w-[52px] shrink-0 text-muted-foreground opacity-60">{kind}</span>
        <span className={decisive ? "text-foreground" : "text-muted-foreground"}>{d.topLabel}</span>
        {d.topP > 0 && <span className="text-muted-foreground opacity-60">{d.topP.toFixed(2)}</span>}
        {d.changed && d.prevLabel && (
          <span
            title={`Top read flipped from "${d.prevLabel}"${d.flips !== null ? ` · ${d.flips} flips this session` : ""}`}
            className="rounded border border-warn/40 px-1 text-warn"
          >
            flip
          </span>
        )}
        {!d.trusted && (
          <span title="Low-confidence reading from the metadata head" className="opacity-50">
            weak
          </span>
        )}
      </div>

      {/* The spread itself. Two near-equal bars say "it does not know". */}
      {top.length > 1 && (
        <div className="mt-0.5 ml-[58px] space-y-[2px]">
          {top.map((k) => (
            <div key={k.label} className="flex items-center gap-1.5">
              <span className="w-[68px] shrink-0 truncate text-muted-foreground opacity-70">{k.label}</span>
              <span className="h-[3px] flex-1 overflow-hidden rounded-sm bg-border">
                <span
                  className={k.label === d.topLabel ? "block h-full bg-primary" : "block h-full bg-muted-foreground/50"}
                  style={{ width: `${Math.round(Math.min(1, Math.max(0, k.p)) * 100)}%` }}
                />
              </span>
              <span className="w-[26px] shrink-0 text-right text-muted-foreground opacity-70">
                {k.p.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
