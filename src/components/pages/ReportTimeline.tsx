/**
 * The show, played back.
 *
 * During the show the host-audio panel showed one strip and the latest
 * utterance; scrubbing back was deliberately left for here, where there is
 * room. This puts the three kept signals on ONE clock and ONE feed: the audio
 * chunks drive a player, and the utterances and the frames the agent read are
 * interleaved in time order below it, so a frame sits beside what the host was
 * saying when it was taken. Click any row to hear that moment; click a frame
 * to see it large, with the fuller reading the agent wrote after the show.
 *
 * Audio is a sequence of ~10 s chunks, each independently playable. One
 * <audio> element plays them in order; seeking picks the chunk that contains
 * the offset and sets the time within it. Gaps between chunks (a retry that
 * never landed) are skipped, not padded — silence you did not record is not
 * silence you can play.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Mic, Pause, Play, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ShowTimeline, SignalDistribution, TimelineFrame, Utterance } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui/kit";

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
  const load = useCallback(() => api.timeline(showId), [showId]);

  useEffect(() => {
    let stop = false;
    load()
      .then((x) => !stop && setT(x))
      .catch((e: Error) => !stop && setError(e.message));
    return () => {
      stop = true;
    };
  }, [load]);

  // While the describer is writing, the page fills in on its own.
  useEffect(() => {
    if (!t?.describing) return;
    const timer = setInterval(() => {
      load().then(setT).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [t?.describing, load]);

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
  return (
    <Player
      t={t}
      showId={showId}
      onDescribe={() =>
        api
          .describeTimeline(showId)
          .then(() => setT((prev) => (prev ? { ...prev, describing: true } : prev)))
          .catch(() => {})
      }
    />
  );
}

type Row =
  | { kind: "say"; at: number; u: Utterance }
  | { kind: "see"; at: number; f: TimelineFrame; repeat: boolean };

function Player({ t, showId, onDescribe }: { t: ShowTimeline; showId: string; onDescribe: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const feed = useRef<HTMLDivElement | null>(null);
  const [chunkIx, setChunkIx] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** Milliseconds from show start, updated while playing. */
  const [pos, setPos] = useState(0);
  const [follow, setFollow] = useState(true);
  const [allFrames, setAllFrames] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  // Chunks in show order. The server numbers them, but a show recorded before
  // that had bridge numbers that restart per page load; time is the truth.
  const chunks = useMemo(() => [...t.audio].sort((a, b) => a.offsetMs - b.offsetMs), [t.audio]);
  const end = useMemo(() => {
    const last = [
      ...chunks.map((c) => c.offsetMs + c.durationMs),
      ...t.utterances.map((u) => u.offsetMs),
      ...t.frames.map((f) => f.offsetMs),
    ];
    return Math.max(1, ...last);
  }, [chunks, t.frames, t.utterances]);

  // One feed. A run of frames that read the same is one moment on the table;
  // the repeats are folded unless asked for.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = t.utterances.map((u) => ({ kind: "say", at: u.offsetMs, u }));
    let prev = "";
    for (const f of t.frames) {
      const key = f.reading.trim().toLowerCase();
      out.push({ kind: "see", at: f.offsetMs, f, repeat: key === prev });
      prev = key;
    }
    return out.sort((a, b) => a.at - b.at);
  }, [t.utterances, t.frames]);
  const shownRows = useMemo(() => (allFrames ? rows : rows.filter((r) => r.kind === "say" || !r.repeat)), [rows, allFrames]);
  const frames = useMemo(() => t.frames, [t.frames]);
  const undescribed = frames.filter((f) => f.description == null).length;

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
        try {
          el.currentTime = within;
        } catch {
          /* a chunk with no duration metadata: play from its start */
        }
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

  // The row for "now": the last row at or before the playhead.
  const currentKey = useMemo(() => {
    let best: string | null = null;
    for (const r of shownRows) {
      if (r.at > pos) break;
      best = r.kind === "say" ? `u${r.u.seq}` : `f${r.f.seq}`;
    }
    return best;
  }, [pos, shownRows]);
  const currentFrame = useMemo(() => {
    let best: TimelineFrame | null = null;
    for (const f of frames) if (f.offsetMs <= pos) best = f;
    return best;
  }, [pos, frames]);

  // Keep the playing row in view without fighting a reader who scrolled away.
  useEffect(() => {
    if (!playing || !follow || !currentKey || !feed.current) return;
    const el = feed.current.querySelector<HTMLElement>(`[data-row="${currentKey}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentKey, playing, follow]);

  // Lightbox keys.
  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o == null ? o : Math.min(frames.length - 1, o + 1)));
      if (e.key === "ArrowLeft") setOpen((o) => (o == null ? o : Math.max(0, o - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, frames.length]);

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
      <Card className="sticky top-0 z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            disabled={!chunks.length}
            aria-label={playing ? "Pause" : "Play"}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          </button>
          <span className="num w-[72px] shrink-0 text-[12.5px]">{clock(pos)}</span>
          <Scrub t={t} chunks={chunks} end={end} pos={pos} onSeek={(ms) => seek(ms, playing)} />
          <span className="num w-[72px] shrink-0 text-right text-[12px] text-text-muted">{clock(end)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-muted">
          <span>
            {chunks.length
              ? `${chunks.length} audio chunks · ${t.utterances.length} utterances · ${frames.length} frames. Click any line to jump; click a frame to see it large.`
              : `No audio was kept — ${t.utterances.length} utterances and ${frames.length} frames are on the clock, but there is nothing to play.`}
          </span>
          <label className="ml-auto flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="size-3" />
            follow playback
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={allFrames} onChange={(e) => setAllFrames(e.target.checked)} className="size-3" />
            every frame
          </label>
          {t.describing ? (
            <span className="flex items-center gap-1 text-accent">
              <Sparkles className="size-3 animate-pulse" aria-hidden /> writing frame descriptions…
            </span>
          ) : undescribed > 0 && frames.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={onDescribe} title="Ask the show's agent for a fuller reading of each frame">
              <Sparkles className="size-3" aria-hidden /> Describe {undescribed} frame{undescribed === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </Card>

      {/* the feed --------------------------------------------------------- */}
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <Card className="max-h-[70vh] overflow-y-auto" >
          <div ref={feed}>
            <div className="sticky top-0 z-[1] bg-panel px-4 py-2.5 text-[12px] text-text-muted shadow-[0_1px_0_var(--hairline)]">
              What the host said and what the camera showed, in order · emotion and intent as measured
            </div>
            <ul>
              {shownRows.map((r) =>
                r.kind === "say" ? (
                  <li key={`u${r.u.seq}`} data-row={`u${r.u.seq}`}>
                    <button
                      type="button"
                      onClick={() => seek(r.u.offsetMs, true)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-2 text-left shadow-[0_1px_0_var(--hairline)] transition-colors hover:bg-elevated/60",
                        currentKey === `u${r.u.seq}` && "bg-accent/[0.06]",
                      )}
                    >
                      <span className="num w-[62px] shrink-0 pt-0.5 text-[11px] text-text-muted">{clock(r.u.offsetMs)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] leading-snug">{r.u.text}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {r.u.emotion ? <Chip kind="sounds" d={r.u.emotion} /> : null}
                          {r.u.intent ? <Chip kind="intent" d={r.u.intent} /> : null}
                          {r.u.speechRate ? (
                            <span className="num text-[10.5px] text-text-muted">{Math.round(r.u.speechRate)} wpm</span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={`f${r.f.seq}`} data-row={`f${r.f.seq}`}>
                    <div
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-2 shadow-[0_1px_0_var(--hairline)] transition-colors hover:bg-elevated/60",
                        currentKey === `f${r.f.seq}` && "bg-accent/[0.06]",
                        r.repeat && "opacity-70",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => seek(r.f.offsetMs, true)}
                        className="num w-[62px] shrink-0 pt-0.5 text-left text-[11px] text-text-muted"
                        title="Play from here"
                      >
                        {clock(r.f.offsetMs)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpen(frames.findIndex((f) => f.seq === r.f.seq))}
                        className="group flex min-w-0 flex-1 items-start gap-3 text-left"
                        title="See this frame large"
                      >
                        <img
                          src={api.frameUrl(showId, r.f.seq)}
                          alt={r.f.reading}
                          loading="lazy"
                          className="h-[54px] w-24 shrink-0 rounded-sm bg-elevated object-cover ring-1 ring-hairline transition-transform group-hover:scale-[1.03]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-[12.5px] leading-snug">
                            <Eye className="size-3 shrink-0 text-text-muted" aria-hidden />
                            <span className="truncate font-medium">{r.f.reading}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-text-secondary">
                            {r.f.description ??
                              (t.describing ? "description on its way…" : "on camera · the fuller reading is written after the show")}
                          </span>
                        </span>
                      </button>
                    </div>
                  </li>
                ),
              )}
              {shownRows.length === 0 ? (
                <li className="px-4 py-3 text-[12.5px] text-text-muted">No host speech was transcribed and no frames were read.</li>
              ) : null}
            </ul>
          </div>
        </Card>

        {/* the current frame, beside the feed ------------------------------ */}
        <Card className="hidden self-start lg:block">
          <div className="px-4 py-2.5 text-[12px] text-text-muted shadow-[0_1px_0_var(--hairline)]">On camera at the playhead</div>
          {currentFrame ? (
            <button type="button" onClick={() => setOpen(frames.findIndex((f) => f.seq === currentFrame.seq))} className="block w-full px-4 pb-4 pt-3 text-left">
              <img src={api.frameUrl(showId, currentFrame.seq)} alt={currentFrame.reading} className="w-full rounded-sm bg-elevated object-cover ring-1 ring-hairline" />
              <p className="mt-2 text-[12.5px] font-medium leading-snug">{currentFrame.reading}</p>
              {currentFrame.description ? (
                <p className="mt-1 text-[11.5px] leading-snug text-text-secondary">{currentFrame.description}</p>
              ) : null}
              <p className="num mt-1.5 text-[10.5px] text-text-muted">{clock(currentFrame.offsetMs)}</p>
            </button>
          ) : (
            <p className="px-4 py-3 text-[12.5px] text-text-muted">{frames.length ? "Play, or click a frame, to see it here." : "No frames were read."}</p>
          )}
        </Card>
      </div>

      {open != null && frames[open] ? (
        <Lightbox
          showId={showId}
          frame={frames[open]!}
          index={open}
          count={frames.length}
          onClose={() => setOpen(null)}
          onPrev={() => setOpen(Math.max(0, open - 1))}
          onNext={() => setOpen(Math.min(frames.length - 1, open + 1))}
          onPlay={() => {
            seek(frames[open]!.offsetMs, true);
            setOpen(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Lightbox({
  showId,
  frame,
  index,
  count,
  onClose,
  onPrev,
  onNext,
  onPlay,
}: {
  showId: string;
  frame: TimelineFrame;
  index: number;
  count: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlay: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Frame"
      className="anim-fade fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-[880px] rounded-md bg-panel shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2.5 shadow-[0_1px_0_var(--hairline)]">
          <span className="num text-[12px] text-text-muted">
            {clock(frame.offsetMs)} · frame {index + 1} of {count}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={onPrev} disabled={index === 0} aria-label="Previous frame" className="rounded-sm p-1 hover:bg-elevated disabled:opacity-40">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={onNext} disabled={index >= count - 1} aria-label="Next frame" className="rounded-sm p-1 hover:bg-elevated disabled:opacity-40">
              <ChevronRight className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-sm p-1 hover:bg-elevated">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <img src={api.frameUrl(showId, frame.seq)} alt={frame.reading} className="max-h-[60vh] w-full bg-black object-contain" />
        <div className="px-4 py-3">
          <p className="flex items-center gap-1.5 text-[13.5px] font-medium">
            <Eye className="size-3.5 text-text-muted" aria-hidden /> {frame.reading}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
            {frame.description ?? "The fuller reading has not been written for this frame yet."}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={onPlay}>
              <Play className="size-3" aria-hidden /> Play from here
            </Button>
            <span className="text-[11px] text-text-muted">← → to step, Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A strip of the whole show: audio coverage, utterances as ticks, frames as dots. */
function Scrub({
  t,
  chunks,
  end,
  pos,
  onSeek,
}: {
  t: ShowTimeline;
  chunks: ShowTimeline["audio"];
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
      {chunks.map((c) => (
        <span
          key={c.seq}
          aria-hidden
          className="absolute top-3 h-2 rounded-[1px] bg-accent/30"
          style={{ left: x(c.offsetMs), width: `calc(${(c.durationMs / end) * 100}% + 1px)` }}
        />
      ))}
      {t.utterances.map((u) => (
        <span key={u.seq} aria-hidden className="absolute top-1 h-2 w-px bg-text-muted/60" style={{ left: x(u.offsetMs) }} />
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
