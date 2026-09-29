/**
 * The vision model's reading was shown; the picture it came from was not.
 *
 * The backend has kept the frame WITH its reading since frames existed — its own
 * comment says "what the agent saw and what it said it saw are one record; a
 * seller reviewing a wrong reading needs the picture to judge it" — and emits a
 * `frame` event carrying the seq. Nothing subscribed. `frame` was missing from
 * `STREAM_EVENTS`, so `EventSource` never delivered it and the console rendered
 * the text alone.
 *
 * That is the third event in this app written and never read; `levels` and
 * `budget` are the other two, each with its own note in `api.ts`.
 *
 * It matters because a wrong reading is only catchable against the frame. A white
 * sneaker came back as "smartphone" while the host was saying "size ten men,
 * Nike" — and from the text alone that is indistinguishable from a right answer.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TranscriptPanel } from "./TranscriptPanel";
import type { ShowContext } from "@/lib/types";

const ctx = (onScreen: string | null): ShowContext =>
  ({
    currentTopic: "amethyst",
    recentPoints: [],
    tone: null,
    style: null,
    voice: null,
    onScreen: onScreen ? { text: onScreen, at: new Date().toISOString() } : null,
  }) as unknown as ShowContext;

describe("the frame beside its reading", () => {
  it("shows the picture the reading came from", () => {
    render(
      <TranscriptPanel
        transcript={[]}
        levels={[]}
        context={ctx("Aquamarine crystal")}
        frameSrc="https://example.test/frames/7?token=abc"
      />,
    );
    const img = screen.getByRole("img", { name: /Aquamarine crystal/ });
    expect(img.getAttribute("src")).toContain("/frames/7");
    // The alt text says what the picture is FOR, not just that it is a picture.
    expect(img.getAttribute("alt")).toContain("this reading came from");
  });

  it("shows the reading alone when there is no frame", () => {
    // A vision call can succeed while the write does not. The reading is what the
    // copilot acts on and must not be withheld for want of a picture.
    render(<TranscriptPanel transcript={[]} levels={[]} context={ctx("Aquamarine crystal")} />);
    expect(screen.getByText("Aquamarine crystal")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /reading came from/ })).toBeNull();
  });

  it("subscribes to the event, which is the whole reason it was invisible", () => {
    const api = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");
    const list = api.slice(api.indexOf("STREAM_EVENTS"), api.indexOf("] as const"));
    expect(list, "`frame` must be in STREAM_EVENTS or EventSource never delivers it").toContain('"frame"');
  });

  it("requires BOTH halves before drawing anything", () => {
    // A reading whose frame was not kept must not show a STALE picture beside
    // fresh text — worse than showing none.
    const src = readFileSync(join(process.cwd(), "src/components/console/Console.tsx"), "utf8");
    const expr = src.slice(src.indexOf("const frameSrc ="), src.indexOf("const frameSrc =") + 320);
    expect(expr).toContain("store.frame");
    expect(expr).toContain("store.context?.onScreen");
    expect(expr).toContain("mediaToken");
  });
});
