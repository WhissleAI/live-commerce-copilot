/**
 * What a row in the By-session table is allowed to claim.
 *
 * `hasReport` is on the payload now (backend `src/shows/analytics.ts`), and
 * the figures beside it on an ungraded session are coercions rather than
 * measurements. Two separate false statements come out of printing them: a
 * row of zeroes under a target reads as a failing grade for a session nobody
 * graded, and a zero in the Chain column reads as a BROKEN audit chain —
 * which is a claim about trust, and worse than a missing number.
 *
 * It also cuts the other way. A real report for a session shorter than thirty
 * seconds rounds to zero minutes, so the old `durationMin === 0` test called
 * a graded session ungraded beside its own numbers.
 */

import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "@/test/router";
import { BySession } from "./AnalyticsPage";
import type { AnalyticsOverview } from "@/lib/types";

type Row = AnalyticsOverview["perShow"][number];

const row = (over: Partial<Row> = {}): Row => ({
  showId: "s_1",
  title: "Friday Night Grails",
  startedAt: "2026-09-18T18:00:00.000Z",
  hasReport: true,
  durationMin: 95,
  answeredRate: 0.82,
  p95LatencyMs: 1400,
  blocked: 3,
  flaggedWrong: 0,
  gmvCents: 412_00,
  chainOk: true,
  ...over,
});

const ungraded = row({
  showId: "s_nolog",
  hasReport: false,
  durationMin: 0,
  answeredRate: 0,
  p95LatencyMs: 0,
  blocked: 0,
  flaggedWrong: 0,
  gmvCents: null,
  chainOk: false,
});

describe("a session that left no report", () => {
  it("does not call its audit chain broken", async () => {
    await renderWithRouter(<BySession rows={[ungraded]} />);
    expect(screen.getByText("no report")).toBeInTheDocument();
    expect(screen.queryByText("broken")).not.toBeInTheDocument();
    expect(screen.queryByText("intact")).not.toBeInTheDocument();
  });

  it("prints no duration, rather than a zero nobody measured", async () => {
    await renderWithRouter(<BySession rows={[ungraded]} />);
    expect(screen.queryByText("0h 0m")).not.toBeInTheDocument();
  });

  it("prints none of the other figures either", async () => {
    await renderWithRouter(<BySession rows={[ungraded]} />);
    // A row of zeroes under a target is a failing grade for a session that was
    // never graded.
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByText("0ms")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });
});

describe("a session that really was measured", () => {
  it("shows its numbers and verifies its chain", async () => {
    await renderWithRouter(<BySession rows={[row()]} />);
    expect(screen.getByText("1h 35m")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("1400ms")).toBeInTheDocument();
    expect(screen.getByText("intact")).toBeInTheDocument();
  });

  it("says a broken chain is broken", async () => {
    await renderWithRouter(<BySession rows={[row({ chainOk: false })]} />);
    expect(screen.getByText("broken")).toBeInTheDocument();
  });

  /** The defect the server's new field exists to end. */
  it("is not called ungraded because it lasted twenty seconds", async () => {
    await renderWithRouter(<BySession rows={[row({ durationMin: 0, hasReport: true })]} />);
    expect(screen.queryByText("no report")).not.toBeInTheDocument();
    expect(screen.getByText("intact")).toBeInTheDocument();
    expect(screen.getByText("under a minute")).toBeInTheDocument();
  });
});

describe("a backend older than the field", () => {
  it("falls back to the duration, which is all it used to have", async () => {
    const { hasReport: _absent, ...noField } = ungraded;
    await renderWithRouter(<BySession rows={[noField]} />);
    expect(screen.getByText("no report")).toBeInTheDocument();
  });

  it("still reads a session with a duration as measured", async () => {
    const { hasReport: _absent, ...noField } = row();
    await renderWithRouter(<BySession rows={[noField]} />);
    expect(screen.getByText("intact")).toBeInTheDocument();
  });
});
