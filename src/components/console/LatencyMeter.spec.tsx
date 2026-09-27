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

const metrics = (p95: number) =>
  ({
    latency: { p50: 400, p95, p99: p95 + 200, budgetMs: 2000, breaches: 0 },
    cacheHitRate: 0.1,
  }) as never;

const bar = () => screen.getByLabelText(/p95 latency/).querySelector("[class*='text-']");
const toneOf = (p95: number): string => {
  const { unmount } = render(
    <TopBar show={show} metrics={metrics(p95)} onToggleCost={() => {}} costOpen={false} latencyMeter />,
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
