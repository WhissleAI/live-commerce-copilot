/**
 * The show, played back.
 *
 * During the show the host-audio panel showed one strip and the latest
 * utterance; scrubbing back was deliberately left for here, where there is
 * room. This puts the three kept signals on one clock — the audio chunks, the
 * utterances with their distributions, and the frames the agent read — and
 * lets the seller point at a moment and hear it.
 *
 * Audio is a sequence of ~10 s chunks, each independently playable. One
 * <audio> element plays them in order; seeking picks the chunk that contains
 * the offset and sets the time within it. Gaps between chunks (a retry that
 * never landed) are skipped, not padded — silence you did not record is not
 * silence you can play.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Mic, Pause, Play } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ShowTimeline, SignalDistribution, Utterance } from "@/lib/types";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/kit";

/** `EMOTION_HAPPY` → `happy`. */
export function pretty(raw: string): string {
  return raw.replace(/^(EMOTION|INTENT|SENTIMENT)_/i, "").toLowerCase().replace(/_/g, " ");
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function ReportTimeline({ showId }: { showId: string }) {
  const [t, setT] = useState<ShowTimeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    api
      .timeline(showId)
      .then((x) => !stop && setT(x))
      .catch((e: Error) => !stop && setError(e.message));
    return () => {
      stop = true;
    };
  }, [showId]);

  if (error) return <p className="text-[12.5px] text-bad">{error}</p>;
  if (!t) return <Skeleton className="h-[220px]" />;
  if (!t.utterances.length && !t.frames.length && !t.audio.length) {
    return (
      <Card>
        <EmptyState icon={<Mic className="size-5" aria-hidden />} title="Nothing was kept for this show.">
          The timeline is built from host audio and camera frames, which arrive through the audio
          bridge. Open it next show and this page fills with what was said and shown.
        </EmptyState>
      </Card>
    );
  }
  return <Player t={t} showId={showId} />;
}

function Player({ t, showId }: { t: ShowTimeline; showId: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [chunkIx, setChunkIx] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** Milliseconds from show start, updated while playing. */
  const [pos, setPos] = useState(0);

  const chunks = t.audio;
  const end = useMemo(() => {
    const last = [
      ...chunks.map((c) => c.offsetMs + c.durationMs),
      ...t.utterances.map((u) => u.offsetMs),
      ...t.frames.map((f) => f.offsetMs),
    ];
    return Math.max(1, ...last);
  }, [chunks, t.frames, t.utterances]);

  const chunkFor = useCallback(
    (ms: number) => {
      let ix = chunks.findIndex((c) => ms >= c.offsetMs && ms < c.offsetMs + c.durationMs);
      if (ix < 0) ix = chunks.findIndex((c) => c.offsetMs >= ms);
      return ix < 0 ? chunks.length - 1 : ix;
    },
    [chunks],
  );

  const seek = useCallback(
    (ms: number, andPlay = true) => {
      if (!chunks.length) {
        setPos(ms);
        return;
      }
      const ix = chunkFor(ms);
      const c = chunks[ix]!;
      const el = audio.current;
      setChunkIx(ix);
      setPos(ms);
      if (!el) return;
      const src = api.audioUrl(showId, c.seq);
      const within = Math.max(0, (ms - c.offsetMs) / 1000);
      const apply = () => {
        el.currentTime = within;
        if (andPlay) void el.play().catch(() => setPlaying(false));
      };
      if (el.src !== src) {
        el.src = src;
        el.onloadedmetadata = apply;
        el.load();
      } else apply();
    },
    [chunkFor, chunks, showId],
  );

  // Chunk boundary: roll to the next one, or stop at the end.
  const onEnded = useCallback(() => {
    const next = chunkIx + 1;
    if (next < chunks.length) seek(chunks[next]!.offsetMs, true);
    else setPlaying(false);
  }, [chunkIx, chunks, seek]);

  const onTime = useCallback(() => {
    const el = audio.current;
    const c = chunks[chunkIx];
    if (!el || !c) return;
    setPos(c.offsetMs + el.currentTime * 1000);
  }, [chunkIx, chunks]);

  const toggle = () => {
    const el = audio.current;
    if (!el || !chunks.length) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      if (!el.src) seek(pos, true);
      else void el.play().catch(() => {});
      setPlaying(true);
    }
  };

  const current = useMemo(() => {
    let best: Utterance | null = null;
    for (const u of t.utterances) if (u.offsetMs <= pos) best = u;
    return best;
  }, [pos, t.utterances]);
  const currentFrame = useMemo(() => {
    let best = null as ShowTimeline["frames"][number] | null;
    for (const f of t.frames) if (f.offsetMs <= pos) best = f;
    return best;
  }, [pos, t.frames]);

  return (
    <div className="flex flex-col gap-3">
      <audio
        ref={audio}
        onEnded={onEnded}
        onTimeUpdate={onTime}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="none"
      />

      {/* transport + scrub ---------------------------------------------- */}
      <Card className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            disabled={!chunks.length}
            aria-label={playing ? "Pause" : "Play"}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground disabled:opacity-40"
          >
            {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          </button>
          <span className="num w-[72px] shrink-0 text-[12.5px]">{clock(pos)}</span>
          <Scrub t={t} end={end} pos={pos} onSeek={(ms) => seek(ms, playing)} />
          <span className="num w-[72px] shrink-0 text-right text-[12px] text-text-muted">{clock(end)}</span>
        </div>
        <p className="mt-2 text-[11.5px] text-text-muted">
          {chunks.length
            ? `${chunks.length} audio chunks · ${t.utterances.length} utterances · ${t.frames.length} frames the agent read. Click the strip or any line to jump.`
            : `No audio was kept — ${t.utterances.length} utterances and ${t.frames.length} frames are on the clock, but there is nothing to play.`}
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* what was said -------------------------------------------------- */}
        <Card className="max-h-[520px] overflow-y-auto">
          <div className="sticky top-0 bg-panel px-4 py-2.5 text-[12px] text-text-muted shadow-[0_1px_0_var(--hairline)]">
            What the host said · emotion and intent as measured
          </div>
          <ul>
            {t.utterances.map((u) => (
              <li key={u.seq}>
                <button
                  type="button"
                  onClick={() => seek(u.offsetMs, true)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-2 text-left shadow-[0_1px_0_var(--hairline)] hover:bg-elevated/60",
                    current?.seq === u.seq && "bg-accent/[0.06]",
                  )}
                >
                  <span className="num w-[62px] shrink-0 pt-0.5 text-[11px] text-text-muted">
                    {clock(u.offsetMs)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] leading-snug">{u.text}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {u.emotion ? <Chip kind="sounds" d={u.emotion} /> : null}
                      {u.intent ? <Chip kind="intent" d={u.intent} /> : null}
                      {u.speechRate ? (
                        <span className="num text-[10.5px] text-text-muted">{Math.round(u.speechRate)} wpm</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {t.utterances.length === 0 ? (
              <li className="px-4 py-3 text-[12.5px] text-text-muted">No host speech was transcribed.</li>
            ) : null}
          </ul>
        </Card>

        {/* what was on screen -------------------------------------------- */}
        <Card className="max-h-[520px] overflow-y-auto">
          <div className="sticky top-0 bg-panel px-4 py-2.5 text-[12px] text-text-muted shadow-[0_1px_0_var(--hairline)]">
            What the camera showed · read by the agent
          </div>
          {currentFrame ? (
            <div className="px-4 pt-3">
              <img
                src={api.frameUrl(showId, currentFrame.seq)}
                alt={currentFrame.reading}
                className="w-full rounded-sm bg-elevated object-cover"
              />
              <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug">
                <Eye className="mt-0.5 size-3 shrink-0 text-text-muted" aria-hidden />
                {currentFrame.reading}
              </p>
            </div>
          ) : null}
          <ul className="mt-2">
            {t.frames.map((f) => (
              <li key={f.seq}>
                <button
                  type="button"
                  onClick={() => seek(f.offsetMs, playing)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-elevated/60",
                    currentFrame?.seq === f.seq && "bg-accent/[0.06]",
                  )}
                >
                  <img
                    src={api.frameUrl(showId, f.seq)}
                    alt=""
                    loading="lazy"
                    className="h-9 w-14 shrink-0 rounded-sm bg-elevated object-cover"
                  />
                  <span className="num w-[62px] shrink-0 text-[11px] text-text-muted">{clock(f.offsetMs)}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px]">{f.reading}</span>
                </button>
              </li>
            ))}
            {t.frames.length === 0 ? (
              <li className="px-4 py-3 text-[12.5px] text-text-muted">No frames were read.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/** A strip of the whole show: audio coverage, utterances as ticks, frames as dots. */
function Scrub({
  t,
  end,
  pos,
  onSeek,
}: {
  t: ShowTimeline;
  end: number;
  pos: number;
  onSeek: (ms: number) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const x = (ms: number) => `${Math.min(100, Math.max(0, (ms / end) * 100))}%`;
  return (
    <div
      ref={box}
      role="slider"
      aria-label="Position in the show"
      aria-valuemin={0}
      aria-valuemax={end}
      aria-valuenow={pos}
      tabIndex={0}
      onClick={(e) => {
        const r = box.current?.getBoundingClientRect();
        if (!r) return;
        onSeek(((e.clientX - r.left) / r.width) * end);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onSeek(Math.min(end, pos + 10_000));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, pos - 10_000));
      }}
      className="relative h-8 min-w-0 flex-1 cursor-pointer rounded-sm bg-elevated"
    >
      {t.audio.map((c) => (
        <span
          key={c.seq}
          aria-hidden
          className="absolute top-3 h-2 rounded-[1px] bg-accent/30"
          style={{ left: x(c.offsetMs), width: `calc(${(c.durationMs / end) * 100}% + 1px)` }}
        />
      ))}
      {t.utterances.map((u) => (
        <span
          key={u.seq}
          aria-hidden
          className="absolute top-1 h-2 w-px bg-text-muted/60"
          style={{ left: x(u.offsetMs) }}
        />
      ))}
      {t.frames.map((f) => (
        <span
          key={f.seq}
          aria-hidden
          className="absolute bottom-1 size-1.5 -translate-x-1/2 rounded-full bg-warn"
          style={{ left: x(f.offsetMs) }}
        />
      ))}
      <span aria-hidden className="absolute inset-y-0 w-0.5 bg-text" style={{ left: x(pos) }} />
    </div>
  );
}

function Chip({ kind, d }: { kind: string; d: SignalDistribution }) {
  return (
    <Badge
      title={d.topK.map((k) => `${pretty(k.label)} ${Math.round(k.p * 100)}%`).join(" · ")}
      className="num"
    >
      {kind} · {pretty(d.topLabel)} {Math.round(d.topP * 100)}%
    </Badge>
  );
}
