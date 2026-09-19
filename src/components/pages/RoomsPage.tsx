/**
 * Rooms — the places this copilot is allowed to open its mouth.
 *
 * Posting is off by default, everywhere, always. The database column defaults
 * to false, preflight reads a missing row as false, and this page is where a
 * human turns one on, one room at a time. That sequence is the product: a
 * copilot that can post to a subreddit on its own is one bug away from being
 * the vendor spam every subreddit has a rule against.
 *
 * Two things are therefore said plainly rather than implied:
 *
 *  · A watched room and a room we may speak in are different decisions, and the
 *    switch says which one it is.
 *  · Reddit drafts are NEVER posted by us — not as a setting on this page, but
 *    in the backend's code, where no switch can reach it. A row for a
 *    draft-only surface shows that instead of a toggle, because a disabled
 *    toggle reads as "not yet" and this is "not ever".
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Hash, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  SURFACE_IDS,
  SURFACE_LABEL,
  SURFACE_ROOM_NOUN,
  capabilitiesOf,
  draftOnly,
} from "@/lib/surfaces";
import type { SurfaceCapabilities, SurfaceId, SurfaceInfo, SurfaceRoom } from "@/lib/types";
import { AppShell } from "@/components/app/AppShell";
import { Section } from "./PageShell";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui/kit";

/** Which surfaces have rooms to watch at all. A live show is attached by link
 *  and is not a standing room, so it is not listed here. */
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
  return rows.filter((s) => s.capabilities.communityRules || s.capabilities.tempo === "async");
}

export function RoomsPage() {
  const [surfaces, setSurfaces] = useState<SurfaceInfo[] | null>(null);
  const [rooms, setRooms] = useState<Record<string, SurfaceRoom[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const infos = await api.surfaces().catch(() => null);
    setSurfaces(infos);
    const wanted = roomSurfaces(infos);
    const entries = await Promise.all(
      wanted.map(async (s) => [s.id, await api.rooms(s.id).catch(() => [])] as const),
    );
    setRooms(Object.fromEntries(entries));
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
      setError((e as Error).message);
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
          ? "reading the rooms you watch…"
          : `${Object.values(rooms).flat().length} watched · ${
              Object.values(rooms)
                .flat()
                .filter((r) => r.posting).length
            } may be posted to`
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
            until you turn it on for that room specifically.
          </p>
        </div>
      </Card>

      {error ? (
        <Card tone="bad" className="mb-6 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
          <span className="text-[12.5px]">{error}</span>
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
          ? `Every reply written for a ${noun} here goes to Drafts. There is no posting switch, because there is no posting.`
          : `Watching a ${noun} is not the same decision as speaking in it. Posting starts off and a human turns it on, one ${noun} at a time.`
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
            . The rooms below are kept; nothing is read from them until it is.
          </span>
        </Card>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {rooms.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Hash className="size-5" aria-hidden />}
              title={`No ${noun} watched.`}
            >
              Add one below. Nothing is read until it is on this list, and nothing is posted until
              you say so for that {noun}.
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
          placeholder={info.id === "reddit" ? "r/mechmarket" : `a ${noun} to watch`}
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
          Watch
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
  return (
    <Card className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <span className="num min-w-0 flex-1 truncate text-[13px]">{room.room}</span>

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
          {room.posting ? "posting on" : "posting off"}
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Stop watching ${room.room}`}
        title="Stop watching this room"
        className="grid size-[26px] shrink-0 place-items-center rounded-sm text-text-muted hover:bg-bad/10 hover:text-bad"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </Card>
  );
}
