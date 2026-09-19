import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DraftCard } from "./DraftsPage";
import type { SurfaceDraft } from "@/lib/types";

/** A Reddit draft: everything a room-based surface records. */
const full: SurfaceDraft = {
  id: "d_1",
  surface: "reddit",
  origin: { kind: "room", id: "r/mechmarket", label: "r/mechmarket" },
  room: "r/mechmarket",
  sessionId: "s_reddit",
  question: {
    author: "u/buyer",
    text: "Does this ship from the EU?",
    at: "2026-09-17T09:00:00.000Z",
    url: "https://reddit.com/r/mechmarket/comments/1abc2de/_/xyz",
  },
  thread: {
    threadId: "t_1abc2de",
    room: "r/mechmarket",
    summary: null,
    ancestors: [
      { author: "u/olivia", text: "[WTS] GMK Olivia, unused", at: "2026-09-15T10:00:00.000Z" },
      { author: "u/buyer", text: "Does this ship from the EU?", at: "2026-09-16T09:00:00.000Z" },
    ],
    rules: [],
  },
  draft: "Yes — it goes out from Lisbon, usually the same day.",
  evidence: [
    {
      factId: "policy:shipping#eu",
      source: "policy",
      corpus: "policy",
      label: "shipping",
      text: "Ships from Lisbon.",
      score: 0.8,
    },
  ],
  guards: [
    { guard: "claim_grounding", verdict: "allow" },
    { guard: "community_rule", verdict: "allow" },
  ],
  verdict: "allow",
  confidence: 0.74,
  rules: [
    {
      factId: "community:mechmarket#1",
      label: "rule 1",
      text: "Flair every sale post.",
      effect: "applied",
    },
  ],
  createdAt: "2026-09-17T09:01:00.000Z",
  status: "open",
};

/** A follow-up: the inbox stores a draft the guards already cleared, and keeps
 *  no evidence, no guard row and no thread. Its origin is the SESSION it came
 *  out of, and the server joins that session's title — this client used to
 *  hard-code the show id in its place. */
const thin: SurfaceDraft = {
  id: "d_2",
  surface: "dm",
  origin: {
    kind: "session",
    id: "ebay_47tK1SX0VsiHEXN1",
    label: "Friday Night Grails — Ep. 42",
  },
  room: "Friday Night Grails — Ep. 42",
  sessionId: "ebay_47tK1SX0VsiHEXN1",
  question: { author: "buyer42", text: "still have the 10?", at: "2026-09-16T20:00:00.000Z" },
  draft: "We do — one pair left in a 10.",
  createdAt: "2026-09-16T22:00:00.000Z",
  status: "open",
};

const noop = () => {};

describe("DraftCard with everything a room draft carries", () => {
  it("shows the room, the question, the draft and its citations", () => {
    render(<DraftCard d={full} onSent={noop} onDismiss={noop} />);
    expect(screen.getByText("Reddit")).toBeInTheDocument();
    expect(screen.getByText("r/mechmarket")).toBeInTheDocument();
    expect(screen.getByText("Does this ship from the EU?")).toBeInTheDocument();
    expect(
      screen.getByText("Yes — it goes out from Lisbon, usually the same day."),
    ).toBeInTheDocument();
    expect(screen.getByText("shipping")).toBeInTheDocument();
    expect(screen.getByText("conf 0.74")).toBeInTheDocument();
  });

  it("keeps the thread one click away rather than hidden or in the way", () => {
    render(<DraftCard d={full} onSent={noop} onDismiss={noop} />);
    const toggle = screen.getByText("The thread — opening post and 1 above");
    expect(screen.queryByText("[WTS] GMK Olivia, unused")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText("[WTS] GMK Olivia, unused")).toBeInTheDocument();
    expect(screen.getByText("opening post")).toBeInTheDocument();
  });

  it("names the rules in force as constraints, never as facts it answered from", () => {
    render(<DraftCard d={full} onSent={noop} onDismiss={noop} />);
    expect(screen.getByText(/Also in force: rule 1/)).toBeInTheDocument();
    expect(screen.getByText(/never facts it answers from/)).toBeInTheDocument();
  });

  /**
   * `would_block` — "the rule an earlier draft tripped and this one clears" —
   * cannot happen: the guard chain never returns a revise verdict, so the
   * repair pass that would produce an earlier draft is unreachable. The card
   * carried a paragraph of copy for a state the server can never send.
   */
  it("has no third rule state, because the system cannot reach one", () => {
    render(<DraftCard d={full} onSent={noop} onDismiss={noop} />);
    expect(screen.queryByText(/Would have blocked/)).not.toBeInTheDocument();
  });

  it("renders the guard row this surface runs, including the room-rule guard", () => {
    render(<DraftCard d={full} onSent={noop} onDismiss={noop} />);
    const pills = screen.getByRole("list", { name: "Guardrail results" });
    expect(pills.textContent).toContain("room rules");
    // Reddit has no sponsor corpus, so that guard is not drawn as a grey pill.
    expect(pills.textContent).not.toContain("sponsor");
  });

  it("offers Copy and Mark sent, and says who the sender is", () => {
    const sent: string[] = [];
    render(<DraftCard d={full} onSent={() => sent.push("sent")} onDismiss={noop} />);
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("We never post this. You do.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Mark sent"));
    expect(sent).toEqual(["sent"]);
  });
});

describe("where a draft came from", () => {
  it("prints the subreddit on a room draft", () => {
    render(<DraftCard d={full} onSent={noop} onDismiss={noop} />);
    expect(screen.getByText("r/mechmarket")).toBeInTheDocument();
  });

  // The bug: this client hard-coded `room: f.showId`, so the inbox printed
  // `ebay_47tK1SX0VsiHEXN1` where Reddit printed `r/mechmarket`. The server
  // joins the session title and sends both; the card prints the one a person
  // would say out loud.
  it("prints the session's title on a follow-up, not its id", () => {
    render(<DraftCard d={thin} onSent={noop} onDismiss={noop} />);
    expect(screen.getByText("Friday Night Grails — Ep. 42")).toBeInTheDocument();
    expect(screen.queryByText("ebay_47tK1SX0VsiHEXN1")).not.toBeInTheDocument();
  });
});

describe("DraftCard when the surface recorded less", () => {
  it("draws no confidence figure rather than a zero nobody measured", () => {
    render(<DraftCard d={thin} onSent={noop} onDismiss={noop} />);
    expect(screen.queryByText(/^conf /)).not.toBeInTheDocument();
  });

  it("draws no guard pills and says why instead", () => {
    render(<DraftCard d={thin} onSent={noop} onDismiss={noop} />);
    expect(screen.queryByRole("list", { name: "Guardrail results" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/A draft the guards held is never stored here at all/),
    ).toBeInTheDocument();
  });

  it("draws no thread toggle and no rules block", () => {
    render(<DraftCard d={thin} onSent={noop} onDismiss={noop} />);
    expect(screen.queryByText(/The thread —/)).not.toBeInTheDocument();
    expect(screen.queryByText("rules of the room")).not.toBeInTheDocument();
  });

  it("still shows the question, the draft and both controls", () => {
    render(<DraftCard d={thin} onSent={noop} onDismiss={noop} />);
    expect(screen.getByText("still have the 10?")).toBeInTheDocument();
    expect(screen.getByText("We do — one pair left in a 10.")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Mark sent")).toBeInTheDocument();
  });

  // The degrade path for a payload from a backend that is still being written.
  it("survives a draft with no rules array, no origin and no question url", () => {
    const half = {
      ...thin,
      origin: undefined,
      rules: undefined,
      evidence: undefined,
    } as unknown as SurfaceDraft;
    expect(() => render(<DraftCard d={half} onSent={noop} onDismiss={noop} />)).not.toThrow();
  });
});

describe("a blocked draft", () => {
  it("strikes the draft through and names the rule that held it", () => {
    const blocked: SurfaceDraft = {
      ...full,
      status: "blocked",
      rules: [
        {
          factId: "community:mechmarket#3",
          label: "rule 3",
          text: "No vendor self-promotion outside the weekly thread.",
          effect: "blocked",
          reason: "the draft links to your own store",
        },
      ],
    };
    render(<DraftCard d={blocked} onSent={noop} onDismiss={noop} />);
    expect(screen.getByText("Held — rule 3.")).toBeInTheDocument();
    expect(screen.getByText(blocked.draft).className).toContain("line-through");
  });
});
