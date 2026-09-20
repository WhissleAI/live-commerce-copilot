import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RoomRow, SurfaceRooms, roomSurfaces, watchState } from "./RoomsPage";
import { SURFACE_CAPABILITIES } from "@/lib/surfaces";
import type { SurfaceInfo, SurfaceRoom } from "@/lib/types";

const redditInfo: SurfaceInfo = {
  id: "reddit",
  label: "Reddit",
  capabilities: SURFACE_CAPABILITIES.reddit,
  attachable: true,
};

const twitchInfo: SurfaceInfo = {
  id: "twitch",
  label: "Twitch",
  capabilities: SURFACE_CAPABILITIES.twitch,
  attachable: true,
};

const room = (over: Partial<SurfaceRoom> = {}): SurfaceRoom => ({
  surface: "twitch",
  room: "somechannel",
  posting: false,
  disclosure: null,
  addedAt: "2026-09-10T00:00:00.000Z",
  ...over,
});

const noop = () => {};

describe("roomSurfaces", () => {
  it("lists the surfaces that have standing rooms, not the ones attached by link", () => {
    const ids = roomSurfaces(null).map((s) => s.id);
    expect(ids).toContain("reddit");
    expect(ids).toContain("twitch");
    expect(ids).toContain("dm");
    // A live show is a link you paste, not a room you watch.
    expect(ids).not.toContain("ebaylive");
    expect(ids).not.toContain("simulated");
  });

  it("works from the built-in table when the server answered nothing", () => {
    expect(() => roomSurfaces(null)).not.toThrow();
    expect(roomSurfaces(null).length).toBeGreaterThan(0);
  });
});

describe("RoomRow on a surface we can deliver to", () => {
  it("draws posting as a switch, off by default", () => {
    render(
      <RoomRow
        room={room()}
        caps={SURFACE_CAPABILITIES.twitch}
        busy={false}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Posting in somechannel" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveTextContent("posting off");
  });

  it("asks for the opposite of what is set when pressed", () => {
    const seen: boolean[] = [];
    render(
      <RoomRow
        room={room({ posting: true })}
        caps={SURFACE_CAPABILITIES.twitch}
        busy={false}
        onToggle={(v) => seen.push(v)}
        onRemove={noop}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Posting in somechannel" }));
    expect(seen).toEqual([false]);
  });

  it("shows the disclosure the room requires when it has one", () => {
    render(
      <RoomRow
        room={room({ disclosure: "answered by the shop's assistant" })}
        caps={SURFACE_CAPABILITIES.twitch}
        busy={false}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getByText(/answered by the shop's assistant/)).toBeInTheDocument();
  });
});

describe("RoomRow on a draft-only surface", () => {
  // A disabled toggle reads as "not yet". This is "not ever", and the
  // difference is the whole safety story.
  it("shows no switch at all, and says so in words", () => {
    render(
      <RoomRow
        room={room({ surface: "reddit", room: "r/mechmarket" })}
        caps={SURFACE_CAPABILITIES.reddit}
        busy={false}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText("drafts only · never posted by us")).toBeInTheDocument();
  });
});

describe("SurfaceRooms", () => {
  it("says a draft-only surface has no posting switch because there is no posting", () => {
    render(
      <SurfaceRooms
        info={redditInfo}
        rooms={[]}
        busy={null}
        onAdd={noop}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    expect(
      screen.getByText(/There is no posting switch, because there is no posting/),
    ).toBeInTheDocument();
  });

  /** "No subreddit watched." named a state the product does not have: a row is
   *  a kept choice, and reading one is a session being open on it. */
  it("draws an empty state that describes a list, not a watch", () => {
    render(
      <SurfaceRooms
        info={redditInfo}
        rooms={[]}
        busy={null}
        onAdd={noop}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getByText("No subreddit on the list.")).toBeInTheDocument();
    expect(screen.getByText(/while a session is open on it/)).toBeInTheDocument();
  });

  it("adds a room on Enter and clears the box", () => {
    const added: string[] = [];
    render(
      <SurfaceRooms
        info={redditInfo}
        rooms={[]}
        busy={null}
        onAdd={(r) => added.push(r)}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    const input = screen.getByLabelText("Add a subreddit on Reddit");
    fireEvent.change(input, { target: { value: " r/mechmarket " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(added).toEqual(["r/mechmarket"]);
    expect(input).toHaveValue("");
  });

  // The degrade path: the server said a key is missing.
  it("names the missing variable rather than saying the surface does not exist", () => {
    render(
      <SurfaceRooms
        info={{ ...twitchInfo, available: false, missing: "TWITCH_CLIENT_ID" }}
        rooms={[room()]}
        busy={null}
        onAdd={noop}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getByText("TWITCH_CLIENT_ID")).toBeInTheDocument();
    expect(screen.getByText(/The rooms below are kept/)).toBeInTheDocument();
  });

  it("says nothing about connectivity when the server did not raise it", () => {
    render(
      <SurfaceRooms
        info={twitchInfo}
        rooms={[room()]}
        busy={null}
        onAdd={noop}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    expect(screen.queryByText(/is not connected/)).not.toBeInTheDocument();
  });
});

/**
 * The page said rooms were watched and nothing was watching them.
 *
 * The backend is honest about it and always was: `GET /api/surfaces/:surface/
 * rooms` computes `watching` per room from the live registry and its own
 * comment says why — "a row in `surface_rooms` is a choice, not a process…
 * nothing in this build turns one into a running watch" (backend
 * `src/api/routes.ts`). Discover has read the field since it landed. This page
 * threw it away, under the word "watched" six times.
 */
describe("whether a room is actually being read", () => {
  const rowFor = (over: Partial<SurfaceRoom>) =>
    render(
      <RoomRow
        room={room(over)}
        caps={SURFACE_CAPABILITIES.twitch}
        busy={false}
        onToggle={noop}
        onRemove={noop}
      />,
    );

  it("says so when a session is open on it", () => {
    rowFor({ watching: true });
    expect(screen.getByText("being read")).toBeInTheDocument();
  });

  it("says plainly when nothing is reading it", () => {
    rowFor({ watching: false });
    expect(screen.getByText("not being read")).toBeInTheDocument();
  });

  /** A backend older than the column has told us nothing, and painting either
   *  badge over silence is the claim this screen was fixed for making. */
  it("claims neither when the server did not say", () => {
    rowFor({});
    expect(screen.queryByText("being read")).not.toBeInTheDocument();
    expect(screen.queryByText("not being read")).not.toBeInTheDocument();
  });

  it("reads the three states apart", () => {
    expect(watchState(room({ watching: true }))).toBe("reading");
    expect(watchState(room({ watching: false }))).toBe("idle");
    expect(watchState(room({}))).toBe("unknown");
  });
});

/**
 * The posting switch arms a path; it does not mean the copilot will speak.
 * Preflight refuses a `post_reply` outright while it is off (backend
 * `src/actions/preflight.ts`), and nothing in this build posts on its own.
 */
describe("what the posting switch claims", () => {
  it("says armed rather than on", () => {
    render(
      <RoomRow
        room={room({ posting: true })}
        caps={SURFACE_CAPABILITIES.twitch}
        busy={false}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Posting in somechannel" });
    expect(toggle).toHaveTextContent("posting armed");
    expect(toggle.getAttribute("title")).toMatch(/nothing in this build posts on its own/i);
  });
});

/**
 * YouTube Live is a capability row with no adapter — the backend registers
 * seven and it is not among them (`src/surfaces/registry.ts`). Rooms was the
 * last screen still offering it as a usable surface, with an add box and a
 * posting switch leading somewhere unreachable.
 */
describe("a surface this build has no adapter for", () => {
  it("is not offered a room list", () => {
    expect(roomSurfaces(null).map((s) => s.id)).not.toContain("youtubelive");
  });

  it("stays out even though its capability row declares community rules", () => {
    expect(SURFACE_CAPABILITIES.youtubelive.communityRules).toBe(true);
    expect(roomSurfaces(null).map((s) => s.id)).toContain("twitch");
  });
});

/** Removing a row takes it off the list. It was never a watch to stop. */
describe("removing a room", () => {
  it("does not describe itself as stopping a watch", () => {
    render(
      <RoomRow
        room={room()}
        caps={SURFACE_CAPABILITIES.twitch}
        busy={false}
        onToggle={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getByLabelText("Remove somechannel from the list")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Stop watching/)).not.toBeInTheDocument();
  });
});
