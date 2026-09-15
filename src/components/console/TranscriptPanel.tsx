import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, ExternalLink, Eye } from "lucide-react";
import type { ListenHealth, ShowContext, SignalDistribution, TranscriptSegment } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The host's audio: one strip, and whatever moment you point at.
 *
 * This replaced a scrolling list of utterances, each with its own hover popover.
 * Two things were wrong with that. The popover was anchored to a row inside a
 * scrolling pane, so it was clipped by the scroll box and half of it vanished.
 * And the list duplicated the strip — the same information, twice, competing for
 * a rail that is already the narrowest column on screen.
 *
 * So: the strip is the panel. Point at a moment and the detail for that moment
 * fills the space BELOW it — rendered inline, never as an overlay, which is why
 * it cannot be clipped by anything. Point at nothing and you get the live edge,
 * which is what you wanted to see anyway.
 */

/** Emotion → hue. Tied to the label the metadata head emits, with no fallback
 *  colour: an unrecognised label is grey rather than confidently wrong. */
const HUE: Record<string, number> = {
  happy: 145,
  excited: 145,
  surprise: 95,
  neutral: 255,
  calm: 255,
  sad: 265,
  fear: 300,
  angry: 25,
  disgust: 40,
  confused: 60,
};

function hueFor(d: SignalDistribution | null | undefined): number | null {
  if (!d) return null;
  return HUE[pretty(d.topLabel)] ?? null;
}

/** `EMOTION_HAPPY` → `happy`. */
function pretty(raw: string): string {
  return raw
    .replace(/^(EMOTION|INTENT|SENTIMENT)_/i, "")
    .toLowerCase()
    .replace(/_/g, " ");
}

export function TranscriptPanel({
  transcript,
  levels,
  context,
  bridgeUrl,
  listen,
}: {
  transcript: TranscriptSegment[];
  levels: number[];
  context: ShowContext | null;
  bridgeUrl: string | null;
  listen?: ListenHealth | null;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);

  // The LATEST utterance, always. A hover-to-scrub affordance was here and it
  // was the wrong trade for this rail: during a show the operator wants the
  // thing that was just said, and scrubbing back is a thing they do afterwards,
  // in the report, where there is room for it.
  const shown = transcript[transcript.length - 1];

  useEffect(() => {
    const c = canvas.current;
    const box = wrap.current;
    if (!c || !box) return;
    const dpr = window.devicePixelRatio || 1;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const colW = 2;
    const gap = 1;
    const slots = Math.max(1, Math.floor(w / (colW + gap)));
    const win = levels.slice(-slots);
    const mid = h / 2;
    const hue = hueFor(shown?.emotion);

    win.forEach((v, i) => {
      const x = w - (win.length - i) * (colW + gap);
      const amp = Math.max(1, v * (h * 0.46));
      const age = (win.length - i) / Math.max(1, win.length);
      const alpha = 0.3 + 0.7 * (1 - age);
      ctx.fillStyle =
        hue != null ? `oklch(0.60 0.15 ${hue} / ${alpha})` : `oklch(0.62 0.02 255 / ${alpha})`;
      ctx.fillRect(x, mid - amp, colW, amp * 2);
    });

    ctx.fillStyle = "oklch(0.88 0.004 255 / 0.8)";
    ctx.fillRect(0, mid - 0.5, w, 1);
  }, [levels, shown]);

  // Loudness frames arrive at 10 Hz while the bridge is open. Once they stop,
  // the mic is not listening any more, however much transcript exists.
  const [lastLevelAt, setLastLevelAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (levels.length) setLastLevelAt(Date.now());
  }, [levels]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);
  const listening = lastLevelAt > 0 && now - lastLevelAt < 8_000;
  // A frozen last line looked like a working panel. Say how old it is once it
  // is old, and say plainly when the backend has judged the session deaf.
  const shownAgeS = shown ? Math.max(0, Math.round((now - Date.parse(shown.at)) / 1000)) : 0;
  const stale = listening && !!shown && shownAgeS > 30;
  const stalled = listen?.state === "stalled" || listen?.state === "reconnecting";

  return (
    <section className="flex min-h-0 flex-1 flex-col shadow-[0_-1px_0_var(--hairline)]">
      <header className="flex h-[26px] shrink-0 items-center justify-between gap-2 px-3">
        <div className="flex items-center gap-2">
          {listening ? (
            <Mic className="size-3.5 text-ok" aria-hidden />
          ) : (
            <MicOff className="size-3.5 text-text-muted" aria-hidden />
          )}
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Host audio
          </span>
          {context?.currentTopic && (
            <span className="truncate text-[11px] text-text-secondary">
              · {context.currentTopic}
            </span>
          )}
        </div>
        {bridgeUrl && (
          <a
            href={bridgeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            Open bridge <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </header>

      {/* The strip. Hover targets are laid over it, one per utterance in the
          window, so pointing at a moment selects that utterance. */}
      <div className="relative shrink-0 border-b border-hairline px-2 py-1.5">
        <div ref={wrap} className="h-16 w-full">
          <canvas ref={canvas} className="block h-full w-full" />
        </div>
        {!listening && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="text-[10px] text-text-muted">
              no audio yet — open the bridge and tick{" "}
              <strong className="text-text">Share tab audio</strong>
            </span>
          </div>
        )}
      </div>

      {(stalled || stale) && (
        <div
          role="status"
          className={cn(
            "shrink-0 border-b border-hairline px-3 py-1.5 text-[10.5px] leading-snug",
            stalled ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn",
          )}
        >
          {stalled
            ? `Transcript stalled — ${listen?.detail ?? "audio is live but nothing is being transcribed"}. The bridge reconnects on its own; if this stays, stop and start it.`
            : `No transcript for ${shownAgeS}s while audio is live. Replies are grounding on what the host said before that.`}
        </div>
      )}

      {/* The moment. Inline, never an overlay — which is why nothing clips it. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {shown ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="num text-[10px] tabular-nums text-text-muted">
                {new Date(shown.at).toLocaleTimeString([], { hour12: false })}
              </span>
              <span className={cn("text-[10px]", stale ? "text-warn" : "text-ok")}>
                {stale ? `${shownAgeS}s ago` : "live"}
              </span>
              {shown.speechRate != null && (
                <span className="num ml-auto text-[10px] tabular-nums text-text-muted">
                  {Math.round(shown.speechRate)} wpm
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-text">{shown.text}</p>

            {/* The 63% caveat lives on the section titles now. As a paragraph it
                was three lines in the narrowest column on screen and got clipped
                by the panel every time. */}
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {shown.emotion && <Bars kind="emotion" d={shown.emotion} />}
              {shown.intent && <Bars kind="intent" d={shown.intent} />}
            </div>
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-text-muted">
            Nothing heard yet. Open the bridge, pick the eBay Live tab and tick{" "}
            <strong className="text-text">Share tab audio</strong> — the host's speech then grounds
            replies alongside the catalog and the chat.
          </p>
        )}

        {/* What the copilot can SEE, and how the host is presenting. Kept with
            the audio because they describe the same moment of the show. */}
        {(context?.onScreen || context?.tone || context?.voice || context?.style) && (
          <div className="mt-2 space-y-1.5 border-t border-hairline pt-2">
            {context.onScreen && (
              <div className="flex items-start gap-1.5">
                <Eye className="mt-[2px] size-3 shrink-0 text-text-muted" aria-hidden />
                <div className="min-w-0">
                  <div className="text-[10px] text-text-muted">on camera</div>
                  <div className="text-[11px] leading-snug text-text">{context.onScreen.text}</div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1">
              {context.tone && (
                <span className="rounded-[3px] border border-hairline-strong px-1.5 py-0.5 text-[10px] text-text-muted">
                  tone · {context.tone}
                </span>
              )}
              {context.style && (
                <span
                  title={context.style.detail}
                  className="rounded-[3px] border border-hairline-strong px-1.5 py-0.5 text-[10px] text-text-secondary"
                >
                  style · {context.style.label}
                </span>
              )}
              {context.voice && (
                <span
                  title={`delivery, measured from the voice — ${context.voice.topK
                    .map((k) => `${pretty(k.label)} ${Math.round(k.p * 100)}%`)
                    .join(" · ")}`}
                  className="rounded-[3px] border border-accent/40 bg-accent/5 px-1.5 py-0.5 text-[10px] text-accent"
                >
                  delivery · {pretty(context.voice.topLabel)} {Math.round(context.voice.topP * 100)}
                  %
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Bars({ kind, d }: { kind: string; d: SignalDistribution }) {
  const hue = hueFor(d);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span
          title="Measured from the audio as a spread, not a verdict — accuracy on low-arousal states tops out near 63%."
          className="cursor-help text-[9px] uppercase tracking-wider text-text-muted"
        >
          {kind}
        </span>
        {d.changed && d.prevLabel && (
          <span
            title={`flipped from ${pretty(d.prevLabel)}`}
            className="shrink-0 rounded border border-warn/40 px-1 text-[9px] text-warn"
          >
            flip
          </span>
        )}
      </div>
      <div className="mt-0.5 space-y-[2px]">
        {d.topK.slice(0, 3).map((k) => (
          <div key={k.label} className="flex items-center gap-1">
            <span className="num w-12 shrink-0 truncate text-[9px] text-text-secondary">
              {pretty(k.label)}
            </span>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-hairline">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(2, k.p * 100)}%`,
                  background:
                    k.label === d.topLabel && hue != null
                      ? `oklch(0.58 0.15 ${hue})`
                      : "oklch(0.72 0.01 255)",
                }}
              />
            </span>
            <span className="num w-6 shrink-0 text-right text-[9px] tabular-nums text-text-muted">
              {k.p.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
