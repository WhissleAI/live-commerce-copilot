import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithRouter } from "@/test/router";
import { BehindBand, NowBand, SurfaceRow, SurfaceTable } from "./HomePage";
import { deriveSurfaces } from "@/lib/home";
import { SURFACE_CAPABILITIES } from "@/lib/surfaces";
import type { HomeLiveSession, HomeReport, HomeSurfaceRow, SurfaceInfo } from "@/lib/types";

const noop = () => {};

const live = (over: Partial<HomeLiveSession> = {}): HomeLiveSession => ({
  showId: "s_1",
  surface: "ebaylive",
  title: "Denim Vault",
  host: "kicksbyrae",
  startedAt: new Date(Date.now() - 65_000).toISOString(),
  awaiting: 2,
  blocked: 1,
  readOnly: false,
  ...over,
});

const row = (over: Partial<HomeSurfaceRow> = {}): HomeSurfaceRow => ({
  id: "twitch",
  label: "Twitch",
  attachable: true,
  tempo: "live",
  delivery: "api",
  connected: false,
  missing: "TWITCH_CLIENT_ID",
  before: [
    { label: "Keys on the server — TWITCH_CLIENT_ID", done: false, href: "/settings" },
    { label: "Choose channels", done: false, href: "/rooms", cta: "Open Rooms" },
  ],
  during: "answers and acts",
  after: "report and follow-ups",
  rooms: 0,
  ...over,
});

const report: HomeReport = {
  showId: "s_old",
  surface: "ebaylive",
  title: "Friday drop",
  endedAt: "2026-09-12T20:00:00.000Z",
  answered: 39,
  blocked: 3,
  topGap: "does it ship to Canada",
};

const surfaces: SurfaceInfo[] = [
  {
    id: "ebaylive",
    label: "eBay Live",
    capabilities: SURFACE_CAPABILITIES.ebaylive,
    attachable: true,
    available: true,
    missing: null,
  },
  {
    id: "reddit",
    label: "Reddit",
    capabilities: SURFACE_CAPABILITIES.reddit,
    attachable: true,
    available: true,
    missing: null,
  },
];

const derived = deriveSurfaces(surfaces, {
  ebay: null,
  catalogs: null,
  home: null,
  reports: null,
  drafts: null,
  rooms: {},
});

// ── NOW ─────────────────────────────────────────────────────────────────────

describe("the NOW band", () => {
  it("names the surface a session is on, not just its title", async () => {
    await renderWithRouter(
      <NowBand
        live={[live({ surface: "twitch", title: "Friday build", host: "raebuilds" })]}
        drafts={{ total: 0, bySurface: [] }}
        surfaces={derived}
        onOpen={noop}
      />,
    );
    expect(screen.getByText("Friday build")).toBeInTheDocument();
    expect(screen.getByText(/Twitch · raebuilds/)).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("carries the queue depth and the blocked count into the row", async () => {
    await renderWithRouter(
      <NowBand
        live={[live()]}
        drafts={{ total: 0, bySurface: [] }}
        surfaces={derived}
        onOpen={noop}
      />,
    );
    expect(screen.getByText("2 awaiting · 1 blocked")).toBeInTheDocument();
  });

  it("opens the console for the session that was pressed", async () => {
    const opened: string[] = [];
    await renderWithRouter(
      <NowBand
        live={[live({ showId: "s_9" })]}
        drafts={{ total: 0, bySurface: [] }}
        surfaces={derived}
        onOpen={(id) => opened.push(id)}
      />,
    );
    fireEvent.click(screen.getByText("Open console"));
    expect(opened).toEqual(["s_9"]);
  });

  it("counts the drafts waiting and says which surfaces they came from", async () => {
    await renderWithRouter(
      <NowBand
        live={[]}
        drafts={{
          total: 9,
          bySurface: [
            { surface: "reddit", count: 7 },
            { surface: "dm", count: 2 },
          ],
        }}
        surfaces={derived}
        onOpen={noop}
      />,
    );
    expect(screen.getByText(/9 drafts waiting for you to send/)).toBeInTheDocument();
    expect(screen.getByText("7 Reddit · 2 Follow-ups")).toBeInTheDocument();
    expect(screen.getByText("Open Drafts").closest("a")).toHaveAttribute("href", "/drafts");
  });

  // A band that vanishes when quiet teaches that the copilot is only there
  // when it is busy. It is watching either way, and says how widely.
  it("stays on screen when empty and names how many surfaces are watching", async () => {
    await renderWithRouter(
      <NowBand live={[]} drafts={{ total: 0, bySurface: [] }} surfaces={derived} onOpen={noop} />,
    );
    expect(screen.getByText(/Nothing needs you this minute\./)).toBeInTheDocument();
    expect(screen.getByText(/surfaces watching/)).toBeInTheDocument();
  });

  it("is still a band, with its phase and what the phase means", async () => {
    await renderWithRouter(
      <NowBand live={[]} drafts={{ total: 0, bySurface: [] }} surfaces={derived} onOpen={noop} />,
    );
    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("What needs you this minute")).toBeInTheDocument();
  });
});

// ── BEHIND YOU ──────────────────────────────────────────────────────────────

describe("the BEHIND YOU band", () => {
  it("shows the one number that matters and the top gap", async () => {
    await renderWithRouter(<BehindBand reports={[report]} followups={{ total: 12, ready: 5 }} />);
    expect(screen.getByText("Friday drop")).toBeInTheDocument();
    expect(screen.getByText("39 answered · 3 blocked")).toBeInTheDocument();
    expect(screen.getByText(/top gap: “does it ship to Canada”/)).toBeInTheDocument();
    expect(screen.getByText("Report").closest("a")).toHaveAttribute("href", "/reports/s_old");
  });

  it("draws no top gap clause when the report has none, rather than an empty quote", async () => {
    await renderWithRouter(
      <BehindBand reports={[{ ...report, topGap: null }]} followups={{ total: 0, ready: 0 }} />,
    );
    expect(screen.queryByText(/top gap/)).not.toBeInTheDocument();
  });

  it("counts the follow-ups a finished session produced", async () => {
    await renderWithRouter(<BehindBand reports={[report]} followups={{ total: 12, ready: 5 }} />);
    expect(
      screen.getByText("12 follow-ups from finished sessions · 5 still to send"),
    ).toBeInTheDocument();
  });

  it("says nothing has finished rather than drawing an empty list", async () => {
    await renderWithRouter(<BehindBand reports={[]} followups={{ total: 0, ready: 0 }} />);
    expect(screen.getByText(/Nothing has finished yet\./)).toBeInTheDocument();
  });
});

// ── the surface table ───────────────────────────────────────────────────────

describe("the surface table", () => {
  it("has a row per surface with all three phases on it", async () => {
    await renderWithRouter(<SurfaceTable rows={derived} />);
    expect(screen.getByText("Surfaces")).toBeInTheDocument();
    expect(screen.getByText("eBay Live")).toBeInTheDocument();
    expect(screen.getByText("Reddit")).toBeInTheDocument();
    // The column headers ARE the three phases.
    expect(screen.getByRole("columnheader", { name: "Before" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "During" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "After" })).toBeInTheDocument();
  });

  it("says what an async surface does during and leaves after", async () => {
    await renderWithRouter(<SurfaceTable rows={derived} />);
    // Reddit and the follow-up inbox are both draft-only, and both say so.
    expect(screen.getAllByText("drafts only")).toHaveLength(2);
    expect(screen.getAllByText("weekly digest")).toHaveLength(2);
  });

  it("lists every surface the operator could use, not only the live ones", async () => {
    await renderWithRouter(<SurfaceTable rows={derived} />);
    for (const label of ["eBay Live", "Whatnot", "TikTok Live", "Twitch", "Reddit", "Follow-ups"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // The scripted fixture is not a place anyone sells.
    expect(screen.queryByText("Simulated show")).not.toBeInTheDocument();
  });
});

describe("one surface row", () => {
  const render1 = (r: HomeSurfaceRow, open = false) =>
    renderWithRouter(
      <table>
        <tbody>
          <SurfaceRow row={r} open={open} onToggle={noop} />
        </tbody>
      </table>,
    );

  it("names the variable the server named, and does not draw it as a fault", async () => {
    await render1(row());
    expect(screen.getByText("not connected")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Twitch needs TWITCH_CLIENT_ID on the server. The adapter is here; the key is not.",
      ),
    ).toBeInTheDocument();
    // An invitation, never an error: nothing in the row is a bad-toned badge.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows how far the Before has got and what the next step is", async () => {
    await render1(
      row({
        before: [
          { label: "Keys on the server", done: true },
          { label: "Choose channels", done: false },
        ],
      }),
    );
    expect(screen.getByText("1/2 ready")).toBeInTheDocument();
    expect(screen.getByText("Choose channels")).toBeInTheDocument();
  });

  it("says so plainly when a surface needs nothing more", async () => {
    await render1(
      row({
        connected: true,
        missing: null,
        before: [{ label: "Keys on the server", done: true }],
      }),
    );
    expect(screen.getByText("connected")).toBeInTheDocument();
    expect(screen.getByText("everything this surface needs is in place")).toBeInTheDocument();
  });

  it("marks a surface with no adapter without pretending it is misconfigured", async () => {
    await render1(
      row({ id: "youtubelive", label: "YouTube Live", attachable: false, missing: null }),
    );
    expect(screen.getByText("no adapter yet")).toBeInTheDocument();
  });

  // The product explaining itself: the three phases with this operator's own
  // state in each, one click from the row.
  it("expands to Before / During / After with a working link per open step", async () => {
    await render1(row(), true);
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("During")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Open Rooms").closest("a")).toHaveAttribute("href", "/rooms");
    expect(screen.getByText(/A bounded session with a start and an end/)).toBeInTheDocument();
  });

  it("tells an async surface's story as a watch rather than a session", async () => {
    await render1(
      row({
        id: "reddit",
        label: "Reddit",
        tempo: "async",
        delivery: "draft-only",
        during: "drafts only",
        after: "weekly digest",
        rooms: 3,
        before: [],
      }),
      true,
    );
    expect(
      screen.getByText(/No session — a standing watch and a queue of drafts/),
    ).toBeInTheDocument();
    expect(screen.getByText(/We never post here; you do\./)).toBeInTheDocument();
    expect(screen.getByText("3 rooms watched")).toBeInTheDocument();
    expect(screen.getByText(/Nothing to connect/)).toBeInTheDocument();
  });

  it("is a disclosure, so the phases can be reached from the keyboard", async () => {
    const toggled: number[] = [];
    await renderWithRouter(
      <table>
        <tbody>
          <SurfaceRow row={row()} open={false} onToggle={() => toggled.push(1)} />
        </tbody>
      </table>,
    );
    const button = screen.getByRole("button", { name: /Twitch — before, during and after/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(toggled).toHaveLength(1);
  });
});
