import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, ExternalLink, Eye } from "lucide-react";
import type { ShowContext, SignalDistribution, TranscriptSegment } from "@/lib/types";
import { AudioTimeline } from "./AudioTimeline";
import { cn } from "@/lib/utils";

/**
 * What the HOST is saying, live — as a timeline rather than a wall.
 *
 * This is the half of the room the chat cannot tell you. The catalog knows what
 * a card is; it does not know the host just said "this one's a jersey patch,
 * numbered to 25, last one tonight". A buyer who types "is that numbered?" four
 * seconds later is asking about that.
 *
 * The previous version printed every segment's full emotion AND intent
 * distribution inline — six bars per utterance, stacked, so a minute of speech
 * buried the words it was annotating. The signal is worth carrying and worth
 * showing, but not worth reading continuously: what an operator tracks while a
 * show runs is WHAT was said and WHEN. So each line is one utterance with one
 * compact chip, and the distributions live under a hover for the moments
 * somebody actually wants to interrogate.
 */
export function TranscriptPanel({
  transcript,
  levels,
  context,
  bridgeUrl,
}: {
  transcript: TranscriptSegment[];
  levels: number[];
  context: ShowContext | null;
  bridgeUrl: string | null;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const [pinnedToEnd, setPinnedToEnd] = useState(true);

  // Follow the live edge — but stop following the moment the operator scrolls
  // back, because yanking them to the bottom mid-read is how a live pane
  // becomes unusable.
  useEffect(() => {
    if (pinnedToEnd) endRef.current?.scrollIntoView({ block: "end" });
  }, [transcript.length, pinnedToEnd]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setPinnedToEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  const listening = transcript.length > 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-hairline">
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-hairline px-3">
        <div className="flex items-center gap-2">
          {listening ? (
            <Mic className="size-3.5 text-ok" aria-hidden />
          ) : (
            <MicOff className="size-3.5 text-text-muted" aria-hidden />
          )}
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Host audio</span>
        </div>
        {bridgeUrl && (
          <a
            href={bridgeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            bridge <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </header>

      {/* Loudness over time, tinted by how the host sounded. Above the words
          because it is the thing you read at a glance; the words are what you
          read when the strip makes you look. */}
      <div className="shrink-0 border-b border-hairline px-2 pb-1 pt-1.5">
        <AudioTimeline levels={levels} transcript={transcript} />
      </div>

      {/* The distilled state, above the raw stream: what the show is ABOUT right
          now, how it sounds, and what is on camera. Three lines, not three
          panels — this sits above a live feed and cannot own the height. */}
      {context && context.currentTopic && (
        <div className="shrink-0 border-b border-hairline px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">now talking about</div>
          <div className="truncate text-[12px] text-text">{context.currentTopic}</div>

          <div className="mt-1 flex flex-wrap items-center gap-1">
            {context.tone && <Chip label={`tone · ${context.tone}`} />}
            {context.voice && (
              <Chip
                tone="accent"
                label={`sounds · ${pretty(context.voice.topLabel)} ${Math.round(context.voice.topP * 100)}%`}
                title={context.voice.topK.map((k) => `${pretty(k.label)} ${Math.round(k.p * 100)}%`).join(" · ")}
              />
            )}
          </div>

          {context.onScreen && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-[4px] border border-hairline bg-elevated/60 px-2 py-1">
              <Eye className="mt-[2px] size-3 shrink-0 text-text-muted" aria-hidden />
              <div className="min-w-0">
                <div className="text-[10px] text-text-muted">on camera</div>
                <div className="text-[11px] leading-snug text-text">{context.onScreen.text}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {transcript.length === 0 ? (
          <p className="px-3 py-4 text-[11px] leading-relaxed text-text-muted">
            Not listening yet. Open the bridge, pick the eBay Live tab and tick{" "}
            <strong className="text-text">Share tab audio</strong> — the host's speech then grounds
            replies alongside the catalog and the chat.
          </p>
        ) : (
          <ol className="py-1">
            {transcript.map((t, i) => (
              <Utterance key={`${t.at}-${i}`} seg={t} />
            ))}
            <div ref={endRef} />
          </ol>
        )}
      </div>

      {!pinnedToEnd && transcript.length > 0 && (
        <button
          type="button"
          onClick={() => setPinnedToEnd(true)}
          className="shrink-0 border-t border-hairline bg-panel py-1 text-[10px] text-accent hover:bg-elevated"
        >
          jump to live
        </button>
      )}
    </section>
  );
}

/**
 * One utterance on the timeline.
 *
 * Time on the left so the column reads as a timeline; the words carry the row;
 * the signal is one chip. Everything measured about this moment is one hover
 * away and nothing below the fold.
 */
function Utterance({ seg }: { seg: TranscriptSegment }) {
  const has = Boolean(seg.emotion || seg.intent || seg.speechRate !== null);

  return (
    <li className="group relative flex gap-2 px-3 py-1.5 hover:bg-elevated/50">
      <time className="num w-9 shrink-0 pt-[1px] text-[10px] tabular-nums text-text-muted">
        {new Date(seg.at).toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" })}
      </time>

      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-relaxed text-text">{seg.text}</p>
        {has && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {seg.emotion && <MiniSignal d={seg.emotion} />}
            {seg.intent && <MiniSignal d={seg.intent} kind="intent" />}
            {seg.speechRate !== null && (
              <span className="num text-[10px] tabular-nums text-text-muted">
                {Math.round(seg.speechRate)} wpm
              </span>
            )}
          </div>
        )}
      </div>

    </li>
  );
}

/** The headline read, dimmed when the top two labels are close enough that the
 *  head is really guessing. */
function MiniSignal({ d, kind = "emotion" }: { d: SignalDistribution; kind?: string }) {
  const spread = d.topK.length > 1 ? (d.topK[0]?.p ?? 0) - (d.topK[1]?.p ?? 0) : 1;
  const decisive = spread >= 0.2;
  return (
    <span
      className={cn(
        "num rounded-[3px] border px-1 text-[10px] tabular-nums",
        kind === "intent" ? "border-hairline-strong" : "border-hairline-strong",
        decisive ? "text-text-secondary" : "text-text-muted opacity-70",
      )}
    >
      {pretty(d.topLabel)} {Math.round(d.topP * 100)}
      {d.changed && <span className="ml-1 text-warn">flip</span>}
    </span>
  );
}

/**
 * One Whissle acoustic distribution, rendered as a spread rather than a verdict.
 *
 * The gateway ships emotion and intent as a top-k distribution and says plainly
 * that accuracy on low-arousal states tops out around 63%. A single confident
 * word would be a lie of presentation; the bars let an operator see when the
 * model is genuinely sure versus splitting hairs between two labels.
 */
function Distribution({ kind, d }: { kind: string; d: SignalDistribution }) {
  const top = d.topK.slice(0, 3);
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{kind}</span>
        {d.changed && d.prevLabel && (
          <span
            title={`flipped from "${pretty(d.prevLabel)}"${d.flips !== null ? ` · ${d.flips} flips this session` : ""}`}
            className="rounded border border-warn/40 px-1 text-[9px] text-warn"
          >
            flip
          </span>
        )}
      </div>
      <div className="mt-0.5 space-y-[3px]">
        {top.map((k) => (
          <div key={k.label} className="flex items-center gap-1.5">
            <span className="num w-16 shrink-0 truncate text-[10px] text-text-secondary">{pretty(k.label)}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-hairline">
              <span
                className={cn("block h-full rounded-full", k.label === d.topLabel ? "bg-accent" : "bg-text-muted/50")}
                style={{ width: `${Math.max(2, k.p * 100)}%` }}
              />
            </span>
            <span className="num w-8 shrink-0 text-right text-[10px] tabular-nums text-text-muted">
              {k.p.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** `EMOTION_HAPPY` → `happy`. The wire carries the model's label; an operator
 *  should not have to read its namespace. */
function pretty(raw: string): string {
  return raw.replace(/^(EMOTION|INTENT|SENTIMENT)_/i, "").toLowerCase().replace(/_/g, " ");
}

function Chip({ label, title, tone }: { label: string; title?: string; tone?: "accent" }) {
  return (
    <span
      title={title}
      className={cn(
        "rounded-[3px] border px-1.5 py-0.5 text-[10px]",
        tone === "accent"
          ? "border-accent/40 bg-accent/5 text-accent"
          : "border-hairline-strong text-text-muted",
      )}
    >
      {label}
    </span>
  );
}
