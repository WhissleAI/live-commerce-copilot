import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "./TopBar";
import { P95_ANSWER_MS } from "@/lib/targets";

// The console used to turn the p95 meter red above the 2 s ENGINEERING budget
// while the report called the same number inside the 10 s PRODUCT target. The
// operator got red on air and green afterwards for one measurement, which is
// two screens disagreeing about whether the show went well.

const show = {
  showId: "s1", title: "Friday night", sellerHandle: "rae", source: "ebaylive",
  externalId: "e1", readOnly: false, status: "live", startedAt: new Date().toISOString(),
  viewers: 10, listings: 4, proposals: 2,
} as never;

const metrics = (p95: number, samples = 12) =>
  ({
    latency: { p50: 400, p95, p99: p95 + 200, budgetMs: 2000, breaches: 0, samples },
    cacheHitRate: 0.1,
  }) as never;

const renderBar = (m: unknown) =>
  render(
    <TopBar
      show={show}
      metrics={m as never}
      connection="open"
      viewerDelta={0}
      onAutonomy={() => {}}
      onToggleCost={() => {}}
      costOpen={false}
      latencyMeter
    />,
  );

const bar = () => screen.getByLabelText(/p95 latency/).querySelector("[class*='text-']");
const toneOf = (p95: number): string => {
  const { unmount } = render(
    <TopBar
      show={show}
      metrics={metrics(p95)}
      connection="open"
      viewerDelta={0}
      onAutonomy={() => {}}
      onToggleCost={() => {}}
      costOpen={false}
      latencyMeter
    />,
  );
  const el = screen.getByLabelText(/p95 latency/);
  const cls = el.querySelector(".num")?.className ?? "";
  const tone = cls.includes("text-bad") ? "bad" : cls.includes("text-warn") ? "warn" : "ok";
  unmount();
  return tone;
};

describe("the live p95 meter", () => {
  it("is calm well inside the engineering budget", () => {
    expect(toneOf(900)).toBe("ok");
  });

  it("warns — not fails — between the design budget and the PRD target", () => {
    // 2.7 s: slower than the stage allocation, and a reply the buyer still reads.
    expect(toneOf(2774)).toBe("warn");
    expect(toneOf(P95_ANSWER_MS - 1)).toBe("warn");
  });

  it("only goes red once the answer stops converting", () => {
    expect(toneOf(P95_ANSWER_MS + 1)).toBe("bad");
    expect(toneOf(15_000)).toBe("bad");
  });
});

/**
 * Seen on a live eBay Live show, 46 seconds in, queue empty: "p95 0ms" in
 * green.
 *
 * A percentile of an empty window is 0, and the bar could not tell that from a
 * reply that took no time — `0 / 2000` is under every threshold. So the one
 * moment an operator most wants to know the copilot has not spoken yet was
 * reported as answering instantly.
 */
describe("before anything has been answered", () => {
  it("shows no number, rather than a perfect one", () => {
    const { unmount } = renderBar(metrics(0, 0));
    const el = screen.getByLabelText(/p95 latency/);
    expect(el.querySelector(".num")?.textContent).toBe("—");
    unmount();
  });

  it("is not green", () => {
    const { unmount } = renderBar(metrics(0, 0));
    const cls = screen.getByLabelText(/p95 latency/).querySelector(".num")?.className ?? "";
    expect(cls).not.toContain("text-ok");
    unmount();
  });

  it("says so to a screen reader too", () => {
    const { unmount } = renderBar(metrics(0, 0));
    expect(screen.getByLabelText(/nothing answered yet/)).toBeTruthy();
    unmount();
  });

  it("a real 0ms with samples is still graded normally", () => {
    // Only an EMPTY window is unmeasured. A cache hit that genuinely returned
    // in under a millisecond is a measurement and keeps its colour.
    const { unmount } = renderBar(metrics(0, 5));
    const cls = screen.getByLabelText(/p95 latency/).querySelector(".num")?.className ?? "";
    expect(cls).toContain("text-ok");
    unmount();
  });

  it("an older backend that sends no sample count keeps the old behaviour", () => {
    const { unmount } = renderBar({
      latency: { p50: 400, p95: 900, p99: 1100, budgetMs: 2000, breaches: 0 },
      cacheHitRate: 0.1,
    });
    const cls = screen.getByLabelText(/p95 latency/).querySelector(".num")?.className ?? "";
    expect(cls).toContain("text-ok");
    unmount();
  });
});
