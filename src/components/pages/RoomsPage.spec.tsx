import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RoomRow, SurfaceRooms, roomSurfaces } from "./RoomsPage";
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

  it("draws an empty state that says nothing is read until a room is listed", () => {
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
    expect(screen.getByText("No subreddit watched.")).toBeInTheDocument();
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
