import { describe, expect, it } from "vitest";
import { experienceOf, experienceOfReport, teachOpen } from "./experience";
import type { HomeModel } from "./home";

const behind = (n: number): Pick<HomeModel, "behind"> => ({
  behind: {
    reports: Array.from({ length: n }, (_, i) => ({ showId: `s${i}` })) as never,
    followups: { total: 0, ready: 0 },
  },
});

describe("how much the product should explain itself", () => {
  it("treats a finished session as the thing that was learned", () => {
    expect(experienceOf(behind(0))).toBe("first_run");
    expect(experienceOf(behind(1))).toBe("practised");
    expect(experienceOf(behind(9))).toBe("practised");
  });

  it("shows everything on a first run, full band or empty", () => {
    expect(teachOpen("first_run", { hasContent: true })).toBe(true);
    expect(teachOpen("first_run", { hasContent: false })).toBe(true);
  });

  it("steps back only where there is something to read instead", () => {
    expect(teachOpen("practised", { hasContent: true })).toBe(false);
  });

  // The rule that stops this being a feature that hides things. A collapsed
  // explainer over an empty band leaves a heading above blank space, and the
  // sentence saying what would be there IS the content.
  it("NEVER collapses the explanation of an empty band", () => {
    expect(teachOpen("practised", { hasContent: false })).toBe(true);
  });
});

describe("the same question on a post-session report", () => {
  const readiness = (seen: number[]) =>
    ({ current: "L1_SUGGEST", next: null, ready: false,
       criteria: seen.map((showsSeen) => ({ showsSeen })) } as never);

  it("treats the FIRST report as a first run — the report you are reading is itself a session", () => {
    expect(experienceOfReport(readiness([1]))).toBe("first_run");
    expect(experienceOfReport(readiness([0]))).toBe("first_run");
  });

  it("folds once they have finished more than this one", () => {
    expect(experienceOfReport(readiness([2]))).toBe("practised");
    expect(experienceOfReport(readiness([0, 5, 1]))).toBe("practised");
  });

  it("explains everything when readiness could not be read", () => {
    // The safe direction to be wrong in is explaining something to someone who
    // already knew it.
    expect(experienceOfReport(null)).toBe("first_run");
  });

  it("survives a readiness with no criteria at all", () => {
    expect(experienceOfReport(readiness([]))).toBe("first_run");
  });
});
