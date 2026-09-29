/**
 * One panel failing must cost that panel and nothing else.
 *
 * The only boundary in this app was TanStack's route-level `errorComponent`, so
 * a render error anywhere in the console replaced the WHOLE PAGE with "This page
 * didn't load" — buyer chat, proposal queue, pinned lot, action approvals and
 * audit log all gone because one of them threw, while the seller is live on air
 * and somebody is waiting for an answer.
 *
 * The claim these tests hold is the one a seller needs to be true: the rest is
 * still there, and the session was not touched.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PanelBoundary } from "./PanelBoundary";

/**
 * Throws while told to, renders otherwise.
 *
 * Not "throws once": React re-renders a subtree after a boundary catches, to see
 * whether the error is deterministic, so a component that heals itself on its
 * second render never reaches the fallback at all. The flag is flipped by the
 * TEST, between asserting the failure and asking for a redraw.
 */
function Throws({ state }: { state: { failing: boolean } }) {
  if (state.failing) throw new Error("Cannot read properties of null (reading 'toFixed')");
  return <p>the panel, working</p>;
}

describe("a panel that throws", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    // React logs the caught error itself; the test's own output is not the point.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it("says which panel stopped, in the name the operator knows it by", () => {
    render(
      <PanelBoundary name="Buyer chat">
        <Throws state={{ failing: true }} />
      </PanelBoundary>,
    );
    expect(screen.getByText(/Buyer chat stopped drawing/)).toBeTruthy();
  });

  it("answers the seller's first question before anything else", () => {
    render(
      <PanelBoundary name="Proposals">
        <Throws state={{ failing: true }} />
      </PanelBoundary>,
    );
    // Not "something went wrong". The seller is on air and about to decide
    // whether to reload — which would cost them the session.
    expect(screen.getByText(/rest of the console is still live/i)).toBeTruthy();
    expect(screen.getByText(/session is untouched/i)).toBeTruthy();
  });

  it("leaves its siblings alone", () => {
    render(
      <div>
        <PanelBoundary name="The host">
          <Throws state={{ failing: true }} />
        </PanelBoundary>
        <PanelBoundary name="Proposals">
          <p>eleven drafts waiting</p>
        </PanelBoundary>
      </div>,
    );
    expect(screen.getByText(/The host stopped drawing/)).toBeTruthy();
    // The whole point. A route-level boundary would have taken this with it.
    expect(screen.getByText("eleven drafts waiting")).toBeTruthy();
  });

  it("draws again when asked, without a reload", () => {
    const state = { failing: true };
    render(
      <PanelBoundary name="The show">
        <Throws state={state} />
      </PanelBoundary>,
    );
    expect(screen.getByText(/The show stopped drawing/)).toBeTruthy();
    // Whatever was wrong with the frame has passed.
    state.failing = false;
    fireEvent.click(screen.getByRole("button", { name: /draw it again/i }));
    // A transient bad frame from the stream is the common case, and recovering
    // from it must not mean losing a live session to a page reload.
    expect(screen.getByText("the panel, working")).toBeTruthy();
  });

  it("is announced, because a seller watching chat will not see it appear", () => {
    render(
      <PanelBoundary name="Buyer chat">
        <Throws state={{ failing: true }} />
      </PanelBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("keeps the layout box it replaced, so the column does not collapse", () => {
    // The boundary IS the panel's flex child rather than a wrapper inside it —
    // an extra flex child between a column and its panel is how the
    // empty-catalog notice broke this layout once already.
    const { container } = render(
      <PanelBoundary name="Buyer chat" className="flex min-h-0 flex-[3] flex-col">
        <p>fine</p>
      </PanelBoundary>,
    );
    expect(container.firstElementChild?.className).toContain("flex-[3]");
  });

  it("carries the same classes once it has failed", () => {
    const { container } = render(
      <PanelBoundary name="Buyer chat" className="flex min-h-0 flex-[3] flex-col">
        <Throws state={{ failing: true }} />
      </PanelBoundary>,
    );
    expect(container.firstElementChild?.className).toContain("flex-[3]");
  });
});

/**
 * And the console actually uses it.
 *
 * A boundary nothing is wrapped in is worse than none: it reads as protection in
 * the diff and provides none on the screen. This asserts the four panels the
 * operator works in are each inside one, by reading the console's source — the
 * console itself needs a router, a shell and a live SSE subscription to mount,
 * which is why `Console.spec.tsx` tests its layout decision rather than the
 * component.
 */
describe("the console's panels are each inside one", () => {
  const src = readFileSync(join(process.cwd(), "src/components/console/Console.tsx"), "utf8");

  /**
   * The opening tag of the boundary named `name`, wherever its attributes sit.
   *
   * Matched across newlines on purpose: prettier splits
   * `<PanelBoundary name="Proposals" className="…">` over four lines the moment
   * the line grows, and a test that only matches the one-line form fails on a
   * reformat while the wiring is perfectly intact. It did — this test caught its
   * own author running the formatter.
   */
  const boundaryAt = (name: string): number =>
    src.search(new RegExp(`<PanelBoundary[\\s\\S]{0,200}?name="${name}"`));

  it("wraps buyer chat, the host, proposals and the show rail", () => {
    for (const name of ["Buyer chat", "The host", "Proposals", "The show"]) {
      expect(boundaryAt(name), `no PanelBoundary named ${name}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("puts every panel component inside a boundary, not beside one", () => {
    // Each of these must appear AFTER a boundary opens and BEFORE it closes.
    for (const [panel, boundary] of [
      ["<ChatColumn", "Buyer chat"],
      ["<TranscriptPanel", "The host"],
      ["<ProposalQueue", "Proposals"],
      ["<ShowRail", "The show"],
    ] as const) {
      const opens = boundaryAt(boundary);
      const closes = src.indexOf("</PanelBoundary>", opens);
      const at = src.indexOf(panel);
      expect(at, `${panel} is not inside the ${boundary} boundary`).toBeGreaterThan(opens);
      expect(at, `${panel} is not inside the ${boundary} boundary`).toBeLessThan(closes);
    }
  });
});
