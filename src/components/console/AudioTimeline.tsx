import { useEffect, useMemo, useRef, useState } from "react";
import type { SignalDistribution, TranscriptSegment } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The show's audio as a timeline: loudness over time, tinted by how the host
 * sounded, with the words underneath.
 *
 * Honest about what it is. This is a TIME-DOMAIN loudness envelope — RMS per
 * 100ms, measured in the bridge off the track it publishes — not a spectrogram.
 * We have the samples, so loudness over time is something we can measure;
 * frequency bins are not, and drawing bins we never computed would be a picture
 * of nothing.
 *
 * Why it earns its space: the transcript alone cannot show a pause, and on a
 * selling show the pause IS the signal — it is the host waiting for bids. A
 * strip built only from recognised speech freezes exactly when the room gets
 * interesting and reads as a dead capture.
 */

/** Emotion → hue. Tied to the label the metadata head emits, with a neutral
 *  fallback, so an unrecognised label is grey rather than a confident colour. */
const HUE: Record<string, number> = {
  happy: 145, excited: 145, surprise: 95,
  neutral: 255, calm: 255,
  sad: 265, fear: 300,
  angry: 25, disgust: 40,
};

function hueFor(d: SignalDistribution | null | undefined): number | null {
  if (!d) return null;
  const label = d.topLabel.replace(/^EMOTION_/i, "").toLowerCase();
  return HUE[label] ?? null;
}

export function AudioTimeline({
  levels,
  transcript,
  className,
}: {
  levels: number[];
  transcript: TranscriptSegment[];
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ x: number; seg: TranscriptSegment } | null>(null);

  // The strip is the live window; the utterance that owns each column is found
  // by walking back from the newest, because the newest is what a hover near
  // the right edge means.
  const recent = useMemo(() => transcript.slice(-40), [transcript]);

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

    // One column per sample, right-aligned so the live edge is pinned to the
    // right and history scrolls off the left — the direction a timeline reads.
    const colW = 2;
    const gap = 1;
    const slots = Math.floor(w / (colW + gap));
    const shown = levels.slice(-slots);
    const mid = h / 2;

    // The tint is the emotion of the utterance nearest in time. Utterances do
    // not cover every sample — silence has no emotion — so untinted columns
    // stay grey rather than inheriting a colour they did not earn.
    const lastHue = hueFor(recent[recent.length - 1]?.emotion);

    shown.forEach((v, i) => {
      const x = w - (shown.length - i) * (colW + gap);
      const amp = Math.max(1, v * (h * 0.46));
      // Fade with age so the live edge reads as "now".
      const age = (shown.length - i) / Math.max(1, shown.length);
      const alpha = 0.25 + 0.75 * (1 - age);
      ctx.fillStyle =
        lastHue != null
          ? `oklch(0.62 0.14 ${lastHue} / ${alpha})`
          : `oklch(0.62 0.02 255 / ${alpha})`;
      ctx.fillRect(x, mid - amp, colW, amp * 2);
    });

    // The zero line, so silence is visibly silence rather than an empty canvas.
    ctx.fillStyle = "oklch(0.86 0.005 255 / 0.7)";
    ctx.fillRect(0, mid - 0.5, w, 1);
  }, [levels, recent]);

  const listening = levels.length > 0;

  return (
    <div className={cn("relative", className)}>
      <div ref={wrap} className="h-12 w-full">
        <canvas ref={canvas} className="block h-full w-full" />
      </div>

      {!listening && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="text-[10px] text-text-muted">no audio yet</span>
        </div>
      )}

      {/* The utterances that fall inside the window, as hover targets laid over
          the strip. The words are below; this is for interrogating a moment. */}
      <div className="absolute inset-0 flex items-stretch justify-end">
        {recent.slice(-12).map((seg, i) => (
          <button
            key={`${seg.at}-${i}`}
            type="button"
            aria-label={seg.text.slice(0, 60)}
            onMouseEnter={(e) => setHover({ x: e.currentTarget.offsetLeft, seg })}
            onMouseLeave={() => setHover(null)}
            className="h-full flex-1 border-l border-transparent hover:border-accent/40 hover:bg-accent/5"
          />
        ))}
      </div>

      {hover && (
        <SegmentCard seg={hover.seg} />
      )}
    </div>
  );
}

/**
 * One moment, interrogated.
 *
 * Rendered ABOVE the strip and anchored to its container rather than to the
 * hovered column — inside a scrolling pane a column-anchored popover gets
 * clipped by the scroll box and half of it disappears, which is exactly what
 * the previous version did.
 */
function SegmentCard({ seg }: { seg: TranscriptSegment }) {
  return (
    <div className="anim-in absolute bottom-[calc(100%+4px)] left-0 right-0 z-40 rounded-[6px] border border-hairline bg-panel p-2 shadow-lg">
      <p className="text-[11px] leading-snug text-text">{seg.text}</p>
      <div className="mt-1.5 space-y-1.5">
        {seg.emotion && <Bars kind="emotion" d={seg.emotion} />}
        {seg.intent && <Bars kind="intent" d={seg.intent} />}
      </div>
      <div className="mt-1.5 flex items-center gap-2 border-t border-hairline pt-1 text-[10px] text-text-muted">
        <span className="num">
          {new Date(seg.at).toLocaleTimeString([], { hour12: false })}
        </span>
        {seg.speechRate !== null && seg.speechRate !== undefined && (
          <span className="num">{Math.round(seg.speechRate)} wpm</span>
        )}
        <span className="ml-auto">accuracy on low-arousal states tops out near 63%</span>
      </div>
    </div>
  );
}

function Bars({ kind, d }: { kind: string; d: SignalDistribution }) {
  const hue = hueFor(d);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-wider text-text-muted">{kind}</span>
        {d.changed && d.prevLabel && (
          <span className="rounded border border-warn/40 px-1 text-[9px] text-warn">
            flipped from {pretty(d.prevLabel)}
          </span>
        )}
      </div>
      <div className="mt-0.5 space-y-[2px]">
        {d.topK.slice(0, 3).map((k) => (
          <div key={k.label} className="flex items-center gap-1.5">
            <span className="num w-14 shrink-0 truncate text-[10px] text-text-secondary">{pretty(k.label)}</span>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-hairline">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(2, k.p * 100)}%`,
                  background:
                    k.label === d.topLabel && hue != null
                      ? `oklch(0.58 0.14 ${hue})`
                      : "oklch(0.7 0.01 255)",
                }}
              />
            </span>
            <span className="num w-7 shrink-0 text-right text-[10px] tabular-nums text-text-muted">
              {k.p.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** `EMOTION_HAPPY` → `happy`. The wire carries the model's namespace; an
 *  operator should not have to read it. */
function pretty(raw: string): string {
  return raw.replace(/^(EMOTION|INTENT|SENTIMENT)_/i, "").toLowerCase().replace(/_/g, " ");
}
