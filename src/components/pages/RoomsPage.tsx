/**
 * Rooms — the places this copilot is allowed to open its mouth.
 *
 * Posting is off by default, everywhere, always. The database column defaults
 * to false, preflight reads a missing row as false, and this page is where a
 * human turns one on, one room at a time. That sequence is the product: a
 * copilot that can post to a subreddit on its own is one bug away from being
 * the vendor spam every subreddit has a rule against.
 *
 * Three things are therefore said plainly rather than implied:
 *
 *  · A room on this list is a CHOICE, not a process. Nothing in this build
 *    turns a row into a running watch: there is no supervisor that reads the
 *    list, `shows.attach` is only ever called from the paste box, and the boot
 *    resume is eBay Live only. The server says per room whether a session is
 *    actually open on it (`GET /api/surfaces/:surface/rooms` → `watching`,
 *    backend `src/api/routes.ts`), and this page renders that answer instead
 *    of a page full of the word "watched".
 *  · A listed room and a room we may speak in are different decisions, and the
 *    switch says which one it is. Turning it on ARMS a path — it does not make
 *    the copilot speak, and nothing in this build posts on its own.
 *  · Reddit drafts are NEVER posted by us — not as a setting on this page, but
 *    in the backend's code, where no switch can reach it. The server refuses a
 *    posting switch on a draft-only surface outright (409 `draft-only`), so a
 *    row for one shows that instead of a toggle: a disabled toggle reads as
 *    "not yet" and this is "not ever".
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, Hash, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  NO_ADAPTER,
  SURFACE_IDS,
  SURFACE_LABEL,
  SURFACE_ROOM_NOUN,
  capabilitiesOf,
  draftOnly,
} from "@/lib/surfaces";
import type { SurfaceCapabilities, SurfaceId, SurfaceInfo, SurfaceRoom } from "@/lib/types";
import { LOAD_FAILED, operatorMessage } from "@/lib/copy";
import { AppShell } from "@/components/app/AppShell";
import { Section } from "./PageShell";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui/kit";

/**
 * Which surfaces have rooms at all.
 *
 * A live session is attached by link and is not a standing room, so it is not
 * listed here. Neither is a surface this build has no adapter for: YouTube
 * Live is a capability row and nothing else — the backend registers seven
 * adapters and it is not among them (`src/surfaces/registry.ts`) — so every
 * control on its rows leads somewhere that cannot be reached. Knowledge and
 * the paste box already ask this question; this was the last screen that
 * offered the surface as usable.
 *
 * The server's own list never contains it. This matters for the fallback,
 * which is the table, and the table is what renders before `GET /api/surfaces`
 * answers — and if it never does.
 */
export function roomSurfaces(infos: SurfaceInfo[] | null): SurfaceInfo[] {
  const rows =
    infos ??
    SURFACE_IDS.map((id) => ({
      id,
      label: SURFACE_LABEL[id],
      capabilities: capabilitiesOf(id),
      available: true,
      missing: null,
    }));
  return rows
    .filter((s) => !NO_ADAPTER.has(s.id))
    .filter((s) => s.capabilities.communityRules || s.capabilities.tempo === "async");
}

/**
 * Is a session actually open on this room?
 *
 * Three answers, and the third is why this is a function. `true` and `false`
 * are the server's; `undefined` is a backend older than the column, which has
 * told us nothing — and a page that painted "being read" over silence would be
 * making exactly the claim this screen was fixed for making.
 */
export function watchState(r: SurfaceRoom): "reading" | "idle" | "unknown" {
  return r.watching === true ? "reading" : r.watching === false ? "idle" : "unknown";
}

export function RoomsPage() {
  const [surfaces, setSurfaces] = useState<SurfaceInfo[] | null>(null);
  const [rooms, setRooms] = useState<Record<string, SurfaceRoom[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A failed read, as distinct from an account that watches nothing. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    // CONTENT-22: both reads swallowed into `null` and `[]`, so a failed read
    // of the rooms you watch rendered as "you watch no rooms" — which on this
    // page is a safety statement, because a room that is not listed is a room
    // whose posting switch you cannot see.
    let failed: unknown = null;
    const infos = await api.surfaces().catch((e: unknown) => {
      failed = e;
      return null;
    });
    setSurfaces(infos);
    const wanted = roomSurfaces(infos);
    const entries = await Promise.all(
      wanted.map(
        async (s) =>
          [
            s.id,
            await api.rooms(s.id).catch((e: unknown) => {
              failed ??= e;
              return [] as SurfaceRoom[];
            }),
          ] as const,
      ),
    );
    setRooms(Object.fromEntries(entries));
    setLoadError(failed ? operatorMessage(failed, "Your rooms") : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => roomSurfaces(surfaces), [surfaces]);

  const run = async (key: string, work: () => Promise<SurfaceRoom[]>, surface: SurfaceId) => {
    setBusy(key);
    setError(null);
    try {
      const next = await work();
      setRooms((prev) => ({ ...(prev ?? {}), [surface]: next }));
    } catch (e) {
      setError(operatorMessage(e, "That room"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell
      section="rooms"
      title="Rooms"
      subtitle={
        rooms === null
          ? "reading your rooms…"
          : (() => {
              // "N watched" was the page's headline claim and nothing was
              // watching anything. The count of rows is a count of rows; the
              // number being READ is the server's `watching` flag, and it is
              // zero until a session is open on one of them.
              const all = Object.values(rooms).flat();
              const reading = all.filter((r) => watchState(r) === "reading").length;
              return `${all.length} on the list · ${reading} being read now · ${
                all.filter((r) => r.posting).length
              } may be posted to`;
            })()
      }
    >
      <Card tone="accent" className="mb-6 flex items-start gap-2.5 px-3.5 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <div className="text-[12.5px] leading-relaxed">
          <p className="font-medium text-text">Reddit drafts are never posted by us.</p>
          <p className="mt-0.5 text-text-secondary">
            Not a setting on this page — Reddit is draft-only in the code, so nothing on any screen
            can turn it into a poster. A reply written for a subreddit goes to Drafts, and you post
            it yourself, under your own name. Everywhere else, posting starts off and stays off
            until you turn it on for that room specifically, and turning it on arms a path rather
            than starting one.
          </p>
        </div>
      </Card>

      {/* What this list is, said before the operator reads a row and assumes
          otherwise. A row is a kept choice; being read is a separate state the
          server reports per room, and nothing here starts it. */}
      <Card className="mb-6 flex items-start gap-2.5 px-3.5 py-3">
        <Eye className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
        <div className="text-[12.5px] leading-relaxed">
          <p className="font-medium text-text">A room here is a list, not a running watch.</p>
          <p className="mt-0.5 text-text-secondary">
            Keeping a room records that you care about it, and each row says whether a session is
            open on it right now. Nothing on this page starts one: a session begins when you paste a
            link on Home, and a room is read for as long as that session is open. Adding a subreddit
            does not, on its own, put drafts in your queue.
          </p>
        </div>
      </Card>

      {error ? (
        <Card tone="bad" className="mb-6 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
          <span className="text-[12.5px]">{error}</span>
        </Card>
      ) : null}

      {loadError ? (
        <Card tone="bad" className="mb-6 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
          <span className="text-[12.5px]">
            {loadError} {LOAD_FAILED.body} Until then this page is not a complete list of the rooms
            you watch.
          </span>
        </Card>
      ) : null}

      {rooms === null ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[34px] w-1/2" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
      ) : (
        shown.map((s) => (
          <SurfaceRooms
            key={s.id}
            info={s}
            rooms={rooms[s.id] ?? []}
            busy={busy}
            onAdd={(room) => void run(`${s.id}:add`, () => api.addRoom(s.id, room), s.id)}
            onToggle={(room, posting) =>
              void run(`${s.id}:${room}`, () => api.setRoomPosting(s.id, room, posting), s.id)
            }
            onRemove={(room) => void run(`${s.id}:${room}`, () => api.removeRoom(s.id, room), s.id)}
          />
        ))
      )}
    </AppShell>
  );
}

export function SurfaceRooms({
  info,
  rooms,
  busy,
  onAdd,
  onToggle,
  onRemove,
}: {
  info: SurfaceInfo;
  rooms: SurfaceRoom[];
  busy: string | null;
  onAdd: (room: string) => void;
  onToggle: (room: string, posting: boolean) => void;
  onRemove: (room: string) => void;
}) {
  const [value, setValue] = useState("");
  const caps = info.capabilities;
  const noun = SURFACE_ROOM_NOUN[info.id] ?? "room";
  // Only when the server actually said so. "We did not ask" and "the key is
  // missing" are different facts, and a warning on the second that fires on the
  // first is a warning nobody will read twice.
  const unreachable = info.available === false || Boolean(info.missing);

  return (
    <Section
      title={info.label}
      hint={
        draftOnly(caps)
          ? `Every reply written for a ${noun} here goes to Drafts. There is no posting switch, because there is no posting — the server refuses to store one for this surface.`
          : `Keeping a ${noun} is not the same decision as speaking in it. Posting starts off and a human arms it, one ${noun} at a time.`
      }
    >
      {unreachable ? (
        <Card tone="warn" className="mb-2.5 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
          <span className="text-[12.5px]">
            {info.label} is not connected
            {info.missing ? (
              <>
                {" "}
                — <code className="num rounded-xs bg-elevated px-1 py-0.5">{info.missing}</code> is
                not set on the server
              </>
            ) : null}
            . The rooms below are kept, and nothing is read from them.
          </span>
        </Card>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {rooms.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Hash className="size-5" aria-hidden />}
              title={`No ${noun} on the list.`}
            >
              Add one below to keep it. A {noun} on this list is read while a session is open on it,
              which you start by pasting a link on Home — and nothing is posted anywhere until you
              say so for that {noun}.
            </EmptyState>
          </Card>
        ) : (
          rooms.map((r) => (
            <RoomRow
              key={r.room}
              room={r}
              caps={caps}
              busy={busy === `${info.id}:${r.room}`}
              onToggle={(posting) => onToggle(r.room, posting)}
              onRemove={() => onRemove(r.room)}
            />
          ))
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              e.preventDefault();
              onAdd(value.trim());
              setValue("");
            }
          }}
          placeholder={info.id === "reddit" ? "r/mechmarket" : `a ${noun} to keep`}
          aria-label={`Add a ${noun} on ${info.label}`}
          className="num min-w-0 max-w-[320px] flex-1 rounded-sm bg-panel px-2.5 py-2 text-[12.5px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
        />
        <Button
          onClick={() => {
            if (!value.trim()) return;
            onAdd(value.trim());
            setValue("");
          }}
          disabled={!value.trim() || busy === `${info.id}:add`}
        >
          {busy === `${info.id}:add` ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-3" aria-hidden />
          )}
          {/* "Watch" was a verb for something the button does not do: it adds
              a row. What reads the room is a session, started elsewhere. */}
          Add
        </Button>
      </div>
    </Section>
  );
}

/** Exported so a spec can drive one row without standing up the shell. */
export function RoomRow({
  room,
  caps,
  busy,
  onToggle,
  onRemove,
}: {
  room: SurfaceRoom;
  caps: SurfaceCapabilities;
  busy: boolean;
  onToggle: (posting: boolean) => void;
  onRemove: () => void;
}) {
  const never = draftOnly(caps);
  const state = watchState(room);
  return (
    <Card className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <span className="num min-w-0 flex-1 truncate text-[13px]">{room.room}</span>

      {/* Whether anything is reading this room — the server's answer, per row.
          Discover has rendered this since the field landed; this page threw it
          away and told the operator their subreddits were watched. Silence
          when the server did not say: a badge painted over an unanswered
          question would be the same claim in a smaller place. */}
      {state === "reading" ? (
        <Badge tone="ok" title="A session is open on this room right now, and it is being read.">
          being read
        </Badge>
      ) : state === "idle" ? (
        <Badge
          tone="neutral"
          title="Kept, and nothing is reading it. A room is read while a session is open on it, and sessions start from a link pasted on Home."
        >
          not being read
        </Badge>
      ) : null}

      {room.disclosure ? (
        <span
          className="hidden max-w-[240px] truncate text-[11.5px] text-text-muted lg:block"
          title={room.disclosure}
        >
          must say: {room.disclosure}
        </span>
      ) : null}

      {never ? (
        // Not a disabled toggle. A disabled control reads as "not yet"; this is
        // "not ever", and the difference is the whole safety story.
        <Badge tone="neutral" title="Draft-only in the code — no switch can change it">
          drafts only · never posted by us
        </Badge>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={room.posting}
          aria-label={`Posting in ${room.room}`}
          title={
            room.posting
              ? "Armed: a reply here may be posted by something that can post. Nothing in this build posts on its own."
              : "Off: a reply written for this room is yours to post."
          }
          disabled={busy}
          onClick={() => onToggle(!room.posting)}
          className={cn(
            "flex h-[26px] shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-[12px] font-medium",
            room.posting
              ? "bg-warn/15 text-[oklch(0.49_0.115_71.5)]"
              : "bg-elevated text-text-secondary",
            "enabled:hover:brightness-[0.94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45",
          )}
        >
          {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
          {/* "armed", not "on". The switch is a permission preflight reads
              (backend `src/actions/preflight.ts`: posting off refuses a
              `post_reply` outright); it does not mean the copilot will speak,
              and nothing in this build sends a reply anywhere. */}
          {room.posting ? "posting armed" : "posting off"}
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${room.room} from the list`}
        title="Take this room off the list"
        className="grid size-[26px] shrink-0 place-items-center rounded-sm text-text-muted hover:bg-bad/10 hover:text-bad"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </Card>
  );
}
